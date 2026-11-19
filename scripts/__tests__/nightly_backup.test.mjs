#!/usr/bin/env node
// Package 0.3: nightly encrypted backup + size check. Run: npm run test:nightly-backup
// Set HUNGRY_TEST_PG_URL (a throwaway Postgres, with its database name as HUNGRY_PROD_REF) to also run
// the end-to-end test: dump, encrypt, decrypt, restore into a second scratch database, compare rows.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const workflow = fs.readFileSync(".github/workflows/nightly-backup.yml", "utf8");

function sh(script, env = {}) {
  return spawnSync("bash", [script], {
    env: { PATH: process.env.PATH, HOME: os.homedir(), ...env },
    encoding: "utf8",
  });
}

test("workflow runs nightly and on demand only, with read-only repo permissions", () => {
  assert.match(workflow, /cron: "40 18 \* \* \*"/);
  assert.ok(workflow.includes("workflow_dispatch:"));
  assert.equal(workflow.includes("pull_request"), false);
  assert.equal(workflow.includes("push:"), false);
  assert.match(workflow, /permissions:\n {2}contents: read/);
  assert.equal(workflow.includes("contents: write"), false);
});

test("workflow uses exactly the two secrets and pinned actions", () => {
  const secrets = new Set([...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]));
  assert.deepEqual([...secrets].sort(), ["BACKUP_AGE_PUBLIC_KEY", "BACKUP_DB_URL"]);
  for (const m of workflow.matchAll(/uses: (\S+)@(\S+)/g)) {
    assert.match(m[2], /^[0-9a-f]{40}$/, `${m[1]} must be pinned to a commit`);
  }
});

test("workflow keeps 14 nightly and 8 weekly copies and uploads only the encrypted file", () => {
  assert.match(workflow, /name: prod-nightly-[\s\S]*?retention-days: 14/);
  assert.match(workflow, /name: prod-weekly-[\s\S]*?retention-days: 56/);
  assert.equal(workflow.match(/path: \$\{\{ steps\.backup\.outputs\.file \}\}/g)?.length, 2);
  assert.ok(workflow.includes("[ \"$(date -u +%u)\" = 7 ]"), "weekly copy is taken on Sunday");
});

test("size check is its own job with the 400 MB and 800 MB defaults", () => {
  assert.match(workflow, /size-check:/);
  assert.ok(workflow.includes("vars.HUNGRY_DB_WARN_MB || '400'"));
  assert.ok(workflow.includes("vars.HUNGRY_STORAGE_WARN_MB || '800'"));
});

const MB = 1048576;
const size = (db, storage, extra = {}) =>
  sh("scripts/db/size-check.sh", { SIZE_FIXTURE: `${db} ${storage}`, ...extra });

test("size check passes under both lines and fails at or over either line", () => {
  const ok = size(399 * MB, 799 * MB);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /db_mb=399 storage_mb=799 status=ok/);

  const dbOver = size(400 * MB, 10 * MB);
  assert.equal(dbOver.status, 1);
  assert.match(dbOver.stdout, /status=over/);
  assert.match(dbOver.stderr, /database 400\/400 MB/);

  const storageOver = size(10 * MB, 800 * MB);
  assert.equal(storageOver.status, 1);
});

test("size check honours custom limits, rejects bad limits and bad numbers", () => {
  assert.equal(size(450 * MB, 1, { SIZE_DB_WARN_MB: "480" }).status, 0);
  assert.notEqual(size(1, 1, { SIZE_DB_WARN_MB: "lots" }).status, 0);
  assert.notEqual(size("abc", 1).status, 0);
});

test("size check writes a step summary table", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "size-")), "summary.md");
  size(100 * MB, 5 * MB, { GITHUB_STEP_SUMMARY: file });
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /\| Database \| 100 MB \| 400 MB \|/);
  assert.match(text, /\| Photo storage \| 5 MB \| 800 MB \|/);
});

test("nightly backup refuses missing settings and a private age key", () => {
  assert.match(sh("scripts/db/nightly-backup.sh", {}).stderr, /BACKUP_DB_URL is not set/);
  const base = { BACKUP_DB_URL: "postgresql://backup_ro:x@localhost:5432/db" };
  assert.match(sh("scripts/db/nightly-backup.sh", base).stderr, /BACKUP_AGE_PUBLIC_KEY is not set/);
  const priv = sh("scripts/db/nightly-backup.sh", { ...base, BACKUP_AGE_PUBLIC_KEY: "AGE-SECRET-KEY-1ABC" });
  assert.notEqual(priv.status, 0);
  assert.match(priv.stderr, /public key starting with age1/);
});

const hasAge = !spawnSync("age", ["--version"]).error;

test("nightly backup refuses a database that is not production", { skip: !hasAge && "age is not installed" }, () => {
  const pub = "age1" + "q".repeat(58);
  const r = sh("scripts/db/nightly-backup.sh", {
    BACKUP_DB_URL: "postgresql://backup_ro.aaaaaaaaaaaaaaaaaaaa:x@localhost:5432/db",
    BACKUP_AGE_PUBLIC_KEY: pub,
    NIGHTLY_OUT_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "nb-")),
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /not the production project/);
});

test("restore drill refuses Supabase hosts and an unconfirmed target", () => {
  const run = (url, env = {}) =>
    spawnSync("bash", ["scripts/db/restore-drill.sh", os.tmpdir(), url], {
      env: { PATH: process.env.PATH, HOME: os.homedir(), ...env },
      encoding: "utf8",
    });
  const hosted = run("postgresql://postgres.aaaaaaaaaaaaaaaaaaaa@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres");
  assert.notEqual(hosted.status, 0);
  assert.match(hosted.stderr, /must not be a Supabase project/);
  const prod = run("postgresql://postgres.frluxwpqqyomiqmjzavd@localhost:5432/postgres");
  assert.match(prod.stderr, /must not be staging or production/);
});

test("end to end: encrypt, decrypt, restore and compare", { skip: !process.env.HUNGRY_TEST_PG_URL }, () => {
  const url = process.env.HUNGRY_TEST_PG_URL; // postgresql://user:pw@host:5432/<db>
  const scratch = process.env.HUNGRY_TEST_PG_SCRATCH_URL; // empty database to restore into
  assert.ok(scratch, "set HUNGRY_TEST_PG_SCRATCH_URL too");
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "nb-e2e-"));
  const keyFile = path.join(out, "key.txt");
  const gen = spawnSync("age-keygen", ["-o", keyFile], { encoding: "utf8" });
  const pub = gen.stderr.match(/age1[a-z0-9]+/)[0];
  const env = { BACKUP_DB_URL: url, BACKUP_AGE_PUBLIC_KEY: pub, NIGHTLY_OUT_DIR: out, HUNGRY_PROD_REF: url.split("/").pop() };
  const run = sh("scripts/db/nightly-backup.sh", env);
  assert.equal(run.status, 0, run.stderr);
  const file = run.stdout.trim().split("\n").pop();
  assert.ok(fs.readFileSync(file).subarray(0, 22).toString().startsWith("age-encryption.org"));
  assert.deepEqual(fs.readdirSync(out).filter((f) => f.endsWith(".age")).length, 1);
  const drill = spawnSync("bash", ["scripts/db/restore-drill.sh", file, scratch], {
    env: { ...process.env, AGE_KEY_FILE: keyFile, RESTORE_DRILL_CONFIRM: scratch.split("/").pop() },
    encoding: "utf8",
  });
  assert.equal(drill.status, 0, drill.stderr);
  assert.match(drill.stdout, /drill ok/);
});
