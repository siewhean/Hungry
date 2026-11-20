import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const reclaimPath = path.join(repoRoot, "scripts/db/reclaim-free-tier-budget.sh");
const promotePath = path.join(repoRoot, "scripts/db/promote-launch-zone.sh");

function runBash(scriptPath, args = [], env = {}) {
  return spawnSync("bash", [scriptPath, ...args], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    encoding: "utf8",
  });
}

test("reclaim-free-tier-budget.sh validates syntax, passes psql options outside dollar-quotes, guards optional tables, and runs VACUUM outside a tx block", () => {
  assert.equal(spawnSync("bash", ["-n", reclaimPath]).status, 0);
  const noArgs = runBash(reclaimPath);
  assert.notEqual(noArgs.status, 0);
  assert.match(noArgs.stderr, /usage: reclaim-free-tier-budget\.sh/);

  const badFlag = runBash(reclaimPath, ["staging", "--bogus"]);
  assert.notEqual(badFlag.status, 0);

  const wrongProd = runBash(reclaimPath, ["prod"], {
    PROD_DB_URL:
      "postgresql://postgres.uuylnktiipkmcweyqnpd@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  });
  assert.notEqual(wrongProd.status, 0);
  assert.match(wrongProd.stderr, /not the production project/);

  const source = fs.readFileSync(reclaimPath, "utf8");
  // Backup must always run before the reclaim transaction.
  const backupPos = source.indexOf('"$DB_DIR/backup.sh"');
  const txPos = source.indexOf("psql_db -1");
  assert.ok(backupPos > 0 && backupPos < txPos, "backup.sh must precede the reclaim transaction");

  // Options must be interpolated outside DO $$ ... $$; (psql never expands :'var' inside dollar quotes).
  const doBlock = source.slice(source.indexOf("do $$"), source.indexOf("end\n$$;"));
  assert.doesNotMatch(doBlock, /:'(all_inactive|trim_menuless|drop_hygiene)'/);
  assert.match(source, /insert into _reclaim_opts \(all_inactive, trim_menuless, drop_hygiene\)/);

  // Optional tables must be checked via to_regclass before counting.
  assert.match(source, /count_optional_table\(\)/);
  assert.match(source, /if v_active_count <> 1 then/);

  // VACUUM must be passed in its own -c argument, never semicolon-joined with SET in a single -c,
  // and -v variables must never be combined with -c (psql only expands :var on stdin).
  assert.match(source, /psql_db -c "set lock_timeout = '30s'" -c "vacuum \(full, analyze\) \$tbl"/);
  assert.doesNotMatch(source, /psql_db[\s\S]{0,200}-v\s+\w+=[\s\S]{0,200}-c\s+"/);
});

test("promote-launch-zone.sh validates syntax, excludes merchant dishes across child writes, and refreshes active zone galleries", () => {
  assert.equal(spawnSync("bash", ["-n", promotePath]).status, 0);
  const badFlag = runBash(promotePath, ["--bogus"]);
  assert.notEqual(badFlag.status, 0);

  const missingEnv = runBash(promotePath);
  assert.notEqual(missingEnv.status, 0);
  assert.match(missingEnv.stderr, /STAGING_DB_URL is not set/);

  const prodPointedAtStaging = runBash(promotePath, [], {
    STAGING_DB_URL:
      "postgresql://postgres.uuylnktiipkmcweyqnpd@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    PROD_DB_URL:
      "postgresql://postgres.uuylnktiipkmcweyqnpd@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
  });
  assert.notEqual(prodPointedAtStaging.status, 0);

  const source = fs.readFileSync(promotePath, "utf8");
  assert.match(source, /\\set payload `cat :'payload_file'`/);
  assert.doesNotMatch(source, /\$\(cat /);
  const backupPos = source.indexOf('"$DB_DIR/backup.sh" prod');
  const writePos = source.indexOf("psql_prod -1 -v payload_file=");
  assert.ok(backupPos > 0 && backupPos < writePos, "prod backup must run before zone promote");

  // Must preserve rating_avg/review_count, exclude merchant-claimed stalls across dishes + images + dietary_flags,
  // run apply_launch_zone(), and refresh active raw venue/dish/media projections.
  assert.match(source, /column_name not in \('id', 'created_at', 'rating_avg', 'review_count'\)/);
  assert.match(source, /create temp table _merchant_venue_ids/);
  assert.match(source, /create temp table _eligible_dish_ids/);
  assert.equal(
    (
      source.match(
        /exists \(select 1 from _eligible_dish_ids ed where ed\.dish_id = x\.dish_id\)/g,
      ) ?? []
    ).length,
    3,
    "dish_images, dietary_flags, and dish_dietary_flags must all filter on _eligible_dish_ids",
  );
  assert.match(source, /perform app_private\.apply_launch_zone\(\);/);
  assert.match(source, /perform public\.catalog_raw_refresh_venue\(v_venue_id\);/);
  assert.match(source, /insert into public\.catalog_raw_dish_media/);
});
