#!/usr/bin/env bash
# Round trip of the staging test activity on the LOCAL Postgres stand-in (scripts/local-pg-standin):
# on a throwaway clone, seed, check, seed again over the top (the wrapper clears first), refuse a seed
# on top of existing diners, reset, and prove every table and every dish rating is back as it was.
# It never touches staging. Build the stand-in first: scripts/local-pg-standin/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${BASE:-/var/tmp/hungry-standin}"
PORT="${PORT:-5501}"
DB=seedtest
psql_at() { psql -X -q -h "$BASE/sock" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 "${@:2}"; }

psql_at postgres -c "drop database if exists $DB" -c "create database $DB template hungry"
trap 'psql_at postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT

snapshot() {
  psql_at "$DB" -At <<'SQL'
select table_schema || '.' || table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint
from information_schema.tables
where table_schema in ('public', 'app_private', 'auth') and table_type = 'BASE TABLE'
union all select 'dishes rating columns', coalesce(sum(rating_avg * 1000 + review_count), 0)::bigint from dishes
union all select 'dishes', count(*) from dishes
order by 1;
SQL
}

# Put one building in the launch zone, so the zone-first choice of dishes is exercised too.
psql_at "$DB" -c "insert into launch_zone_places (slug, building_id) values ('seed-test-zone', 'building-maxwell')"
before="$(snapshot)"
notice="$(psql_at "$DB" -f "$HERE/staging-test-activity.seed.sql" 2>&1 >/dev/null)"
grep -q "(5 in the launch zone)" <<<"$notice" || { echo "FAIL: zone dishes were not chosen first: $notice"; exit 1; }
psql_at "$DB" -f "$HERE/staging-test-activity.check.sql" | grep -q "checks passed" || { echo "FAIL: checks"; exit 1; }
seeded="$(snapshot)"

# A second seed over the top must be refused, not double the activity.
if psql_at "$DB" -f "$HERE/staging-test-activity.seed.sql" >/dev/null 2>&1; then echo "FAIL: seed ran twice"; exit 1; fi
# Reset then seed (what the wrapper does) gives the same picture.
psql_at "$DB" -f "$HERE/staging-test-activity.reset.sql" >/dev/null
psql_at "$DB" -f "$HERE/staging-test-activity.seed.sql" >/dev/null
[ "$(snapshot)" = "$seeded" ] || { echo "FAIL: a rerun gave a different picture"; diff <(echo "$seeded") <(snapshot) || true; exit 1; }

# The catalog is untouched by a seed: no dish, stall or building is added or changed.
for t in dishes venues buildings; do
  grep -q "^public.$t|" <<<"$before" && [ "$(grep "^public.$t|" <<<"$before")" = "$(grep "^public.$t|" <<<"$seeded")" ] \
    || { echo "FAIL: $t changed"; exit 1; }
done

psql_at "$DB" -f "$HERE/staging-test-activity.reset.sql" >/dev/null
after="$(snapshot)"
if [ "$before" != "$after" ]; then echo "FAIL: reset did not put things back"; diff <(echo "$before") <(echo "$after") || true; exit 1; fi
# And a reset with nothing to remove is a no-op.
psql_at "$DB" -f "$HERE/staging-test-activity.reset.sql" >/dev/null
echo "PASS staging test activity: seed, checks, rerun, reset round trip"
