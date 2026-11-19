import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

// Contract for the staging test activity (build plan package 3.2). The data itself is checked by
// scripts/seed/test-staging-test-activity.sh on the local Postgres stand-in; these tests keep the
// scripts staging-only, marker-only and free of invented catalog data without needing a database.

const dir = new URL(".", import.meta.url).pathname;
const repoRoot = path.resolve(dir, "../..");
const read = (name) => readFileSync(path.join(dir, name), "utf8");
const seed = read("staging-test-activity.seed.sql");
const reset = read("staging-test-activity.reset.sql");
const check = read("staging-test-activity.check.sql");
const wrapper = read("staging-test-activity.sh");
const environmentDoc = readFileSync(path.join(repoRoot, "tasks/environment.md"), "utf8");

const STAGING_REF = "uuylnktiipkmcweyqnpd";
const PROD_REF = "frluxwpqqyomiqmjzavd";
const MARKER = "@internal.hungry.test";

test("the same marker identifies the test diners in every file and in the docs", () => {
  for (const [name, text] of [["seed", seed], ["reset", reset], ["check", check], ["wrapper", wrapper], ["environment.md", environmentDoc]]) {
    assert.ok(text.includes(MARKER), `${name} must name ${MARKER}`);
  }
  assert.ok(seed.includes("'internal', true"), "auth metadata marks the diners internal");
});

test("the seed writes no catalog, price, photo or menu row", () => {
  const forbidden = /\b(insert\s+into|update|delete\s+from)\s+(public\.)?(dishes|venues|buildings|dish_images|menu_[a-z_]+|storage\.objects|review_photos|post_media|catalog_[a-z_]+|launch_zone_places)\b/i;
  assert.doesNotMatch(seed, forbidden);
  assert.doesNotMatch(reset, forbidden);
});

test("the seed goes through the app's own functions for reviews, ratings, Tried and entries", () => {
  for (const fn of ["public.submit_review(", "public.submit_dish_taste_rating(", "public.set_dish_tried(", "app_private.refresh_leaderboards()"]) {
    assert.ok(seed.includes(fn), `seed must call ${fn}`);
  }
  assert.match(seed, /'media', '\[\]'::jsonb/, "entries carry no media");
  assert.match(seed, /'\[\]'::jsonb,\s*case when/, "reviews carry no photos");
});

test("the seed is repeatable: no random() and no generated ids", () => {
  const code = seed.replace(/--.*$/gm, "");
  assert.doesNotMatch(code, /\brandom\s*\(/);
  assert.doesNotMatch(code, /gen_random_uuid\s*\(/);
});

test("the seed refuses to double up and the review guard is paused and restored inside one transaction", () => {
  assert.match(seed, /test diners already exist/);
  const begin = seed.indexOf("\nbegin;");
  const commit = seed.lastIndexOf("\ncommit;");
  const off = seed.indexOf("disable trigger trg_enforce_merchant_review_reply_update");
  const on = seed.indexOf("enable trigger trg_enforce_merchant_review_reply_update");
  assert.ok(begin >= 0 && commit > on && on > off && off > begin, "disable and enable sit between begin and commit");
});

test("the reset deletes only the marked diners", () => {
  const deletes = reset.match(/delete\s+from\s+[\s\S]*?;/gi) ?? [];
  assert.ok(deletes.length >= 5);
  for (const statement of deletes) {
    assert.match(statement, /in \(select id from seed_ids\)/, `unscoped delete: ${statement}`);
  }
  assert.match(reset, /where email like '%@internal\.hungry\.test'/);
});

test("the wrapper is staging only", () => {
  assert.ok(wrapper.includes(`STAGING_REF="${STAGING_REF}"`));
  assert.ok(wrapper.includes("load_env staging"));
  assert.doesNotMatch(wrapper, /load_env\s+prod|PROD_DB_URL|PROD_PGPASSWORD/);
  assert.ok(!wrapper.includes(PROD_REF), "the production ref is only ever compared inside common.sh");
});

test("environment.md says how to leave the test diners out of real numbers", () => {
  assert.match(environmentDoc, /Staging test activity/);
  assert.match(environmentDoc, /email not like '%@internal\.hungry\.test'/);
});

// Run the wrapper with stubbed psql so nothing real is reached.
function runWrapper(command, env) {
  const bin = mkdtempSync(path.join(tmpdir(), "staging-test-activity-"));
  const log = path.join(bin, "psql.log");
  for (const name of ["psql", "pg_dump", "shasum", "sha256sum"]) {
    writeFileSync(path.join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${log}"\nexit 0\n`);
    chmodSync(path.join(bin, name), 0o755);
  }
  const result = spawnSync("bash", [path.join(dir, "staging-test-activity.sh"), command], {
    env: { PATH: `${bin}:${process.env.PATH}`, HOME: bin, ...env },
    encoding: "utf8",
  });
  let calls = "";
  try { calls = readFileSync(log, "utf8"); } catch { /* the stub was never called */ }
  return { ...result, calls };
}

test("the wrapper refuses production, other projects, a missing URL and an unknown command", () => {
  const prodUrl = `postgresql://postgres.${PROD_REF}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  const otherUrl = "postgresql://postgres.abcdefghijklmnopqrst@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
  for (const url of [prodUrl, otherUrl]) {
    const result = runWrapper("seed", { STAGING_DB_URL: url });
    assert.notEqual(result.status, 0, url);
    assert.equal(result.calls, "", `no database call for ${url}`);
  }
  assert.notEqual(runWrapper("seed", {}).status, 0);
  const stagingUrl = `postgresql://postgres.${STAGING_REF}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
  assert.notEqual(runWrapper("explode", { STAGING_DB_URL: stagingUrl }).status, 0);
});

test("the wrapper runs reset then seed on staging, and only reset for reset", () => {
  const stagingUrl = `postgresql://postgres.${STAGING_REF}@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`;
  const seeded = runWrapper("seed", { STAGING_DB_URL: stagingUrl });
  assert.equal(seeded.status, 0, seeded.stderr);
  const files = seeded.calls.split("\n").filter((line) => line.startsWith("psql")).map((line) => line.match(/staging-test-activity\.(\w+)\.sql/)?.[1]);
  assert.deepEqual(files, ["reset", "seed"]);
  const cleared = runWrapper("reset", { STAGING_DB_URL: stagingUrl });
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.deepEqual(cleared.calls.split("\n").filter((line) => line.startsWith("psql")).map((line) => line.match(/staging-test-activity\.(\w+)\.sql/)?.[1]), ["reset"]);
});
