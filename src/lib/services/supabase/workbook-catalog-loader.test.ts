import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const scriptPath = "scripts/load_workbook_catalog_snapshot.py";
const loader = readFileSync(resolve(root, scriptPath), "utf8");

function runLoader(args: string[], env: Record<string, string>) {
  return spawnSync("python3", ["-I", scriptPath, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_DB_URL: "", HUNGRY_SUPABASE_ALLOWED_HOSTS: "", ...env },
  });
}

test("workbook catalog loader only targets local hosts unless explicitly allowed", () => {
  assert.match(loader, /LOCAL_HOSTS = frozenset\(\{"localhost", "127\.0\.0\.1", "::1"\}\)/);
  assert.match(loader, /ALLOWED_HOSTS_ENV = "HUNGRY_SUPABASE_ALLOWED_HOSTS"/);
  assert.match(loader, /refusing non-local database host/);

  const secret = "s3cr3t-loader-password";
  const result = runLoader(["--apply"], {
    SUPABASE_DB_URL: `postgresql://postgres:${secret}@db.example.com:5432/postgres`,
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /refusing non-local database host db\.example\.com/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(secret));
});

test("workbook catalog loader never prints or passes the DB URL on argv", () => {
  assert.doesNotMatch(loader, /(print|log\.\w+)\([^)]*\b(db_url|PGPASSWORD|password)\b/);
  assert.match(loader, /env\["PGPASSWORD"\] = unquote\(parsed\.password\)/);
  assert.match(loader, /\["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"\]/);
  assert.doesNotMatch(loader, /\["psql",[^\]]*db_url/);
});

test("workbook catalog loader copies buildings, venues, dishes in one ordered transaction", () => {
  const body = loader.slice(loader.indexOf("def load_script("));
  const buildings = body.indexOf('copy_block("buildings"');
  const venues = body.indexOf('copy_block("venues"');
  const dishes = body.indexOf('copy_block("dishes"');
  assert.ok(
    buildings > 0 && buildings < venues && venues < dishes,
    "COPY order must be buildings -> venues -> dishes",
  );
  assert.equal(loader.match(/"begin;"/g)?.length, 1);
  assert.equal(loader.match(/"commit;\\n"/g)?.length, 1);
  assert.match(loader, /\\\\set ON_ERROR_STOP 1/);
  assert.match(loader, /post-load row counts do not match the workbook/);
});

test("workbook catalog loader refuses non-empty tables unless --replace and keeps triggers on", () => {
  assert.match(loader, /are not empty; rerun with --replace to reload/);
  assert.match(loader, /--replace refused: % rows in % reference catalog tables/);
  assert.doesNotMatch(loader, /truncate/i);
  assert.doesNotMatch(loader, /session_replication_role\s*=/);
  assert.match(loader, /TRIGGER_EXEMPT_ROLES = \("postgres", "supabase_admin", "service_role"\)/);
});
