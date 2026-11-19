#!/usr/bin/env bash
# Round trip of the staging test activity on the LOCAL Postgres stand-in (scripts/local-pg-standin):
# on a throwaway clone, seed, check, seed again over the top (the wrapper clears first), refuse a seed
# on top of existing diners, reset, and compare against how it started: the row count of every table,
# every dish's own rating values, and the full content of an unmarked diner's rows (who reviewed and
# saved a dish the test diners also used) must all be unchanged. Row contents of other tables are not
# compared.
# It never touches staging. Build the stand-in first: scripts/local-pg-standin/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${BASE:-/var/tmp/hungry-standin}"
PORT="${PORT:-5501}"
DB=seedtest
psql_at() { psql -X -q -h "$BASE/sock" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 "${@:2}"; }
# The files carry no begin/commit: like the wrapper, run them in one transaction.
run_file() { psql_at "$DB" -1 -f "$HERE/staging-test-activity.$1.sql"; }

psql_at postgres -c "drop database if exists $DB" -c "create database $DB template hungry"
trap 'psql_at postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true' EXIT

snapshot() {
  psql_at "$DB" -At <<'SQL'
select table_schema || '.' || table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_schema in ('public', 'app_private', 'auth') and table_type = 'BASE TABLE'
union all select 'dishes rating values',
  md5(coalesce(string_agg(id || ':' || rating_avg || ':' || review_count, ',' order by id), '')) from dishes
union all select 'unmarked diner rows',
  md5(coalesce((select string_agg(to_jsonb(r)::text, ',' order by r.id) from reviews r where r.user_id = '00000000-0000-1119-a000-000000000001'), '')
   || coalesce((select string_agg(to_jsonb(f)::text, ',' order by f.dish_id) from user_favourite_dishes f where f.user_id = '00000000-0000-1119-a000-000000000001'), '')
   || coalesce((select string_agg(to_jsonb(u)::text, ',') from auth.users u where u.id = '00000000-0000-1119-a000-000000000001'), ''))
order by 1;
SQL
}

# One unmarked diner (not a test diner) who reviewed and saved a dish the test diners will also use:
# a reset must leave them, and the dish's own rating values, exactly as they were.
psql_at "$DB" -c "insert into auth.users (id, email) values ('00000000-0000-1119-a000-000000000001', 'real-diner-fixture@example.test')" \
  -c "insert into user_profiles (id, display_name, created_at) values ('00000000-0000-1119-a000-000000000001', 'Real Diner Fixture', now() - interval '60 days')" \
  -c "insert into reviews (id, user_id, dish_id, rating, text) select '00000000-0000-1119-a000-0000000000e1', '00000000-0000-1119-a000-000000000001', id, 5, 'Fixture review' from dishes order by id limit 1" \
  -c "insert into user_favourite_dishes (user_id, dish_id) select '00000000-0000-1119-a000-000000000001', id from dishes order by id limit 1"
# Put one building in the launch zone, so the zone-first choice of dishes is exercised too.
psql_at "$DB" -c "insert into launch_zone_places (slug, building_id) values ('seed-test-zone', 'building-maxwell')"
before="$(snapshot)"
notice="$(psql_at "$DB" -1 -f "$HERE/staging-test-activity.seed.sql" 2>&1 >/dev/null)"
grep -q "(5 in the launch zone)" <<<"$notice" || { echo "FAIL: zone dishes were not chosen first: $notice"; exit 1; }
psql_at "$DB" -f "$HERE/staging-test-activity.check.sql" | grep -q "checks passed" || { echo "FAIL: checks"; exit 1; }
seeded="$(snapshot)"
[ "$(grep '^unmarked diner rows' <<<"$before")" = "$(grep '^unmarked diner rows' <<<"$seeded")" ] || { echo "FAIL: a seed changed the unmarked diner"; exit 1; }

# A second seed over the top must be refused, not double the activity.
if psql_at "$DB" -1 -f "$HERE/staging-test-activity.seed.sql" >/dev/null 2>&1; then echo "FAIL: seed ran twice"; exit 1; fi
# What the wrapper runs (reset then seed, one transaction) gives the same picture.
psql_at "$DB" -1 -f "$HERE/staging-test-activity.reset.sql" -f "$HERE/staging-test-activity.seed.sql" >/dev/null 2>&1
[ "$(snapshot)" = "$seeded" ] || { echo "FAIL: a rerun gave a different picture"; diff <(echo "$seeded") <(snapshot) || true; exit 1; }

# A failed seed leaves the old activity in place (the reset in the same transaction is undone).
failing="$(mktemp)"; sed 's/^select app_private.refresh_leaderboards();$/select 1\/0;/' "$HERE/staging-test-activity.seed.sql" > "$failing"
if psql_at "$DB" -1 -f "$HERE/staging-test-activity.reset.sql" -f "$failing" >/dev/null 2>&1; then echo "FAIL: a broken seed did not fail"; rm -f "$failing"; exit 1; fi
rm -f "$failing"
[ "$(snapshot)" = "$seeded" ] || { echo "FAIL: a failed seed lost the old activity"; exit 1; }

# The catalog is untouched by a seed: no dish, stall or building is added or changed.
for t in dishes venues buildings; do
  grep -q "^public.$t|" <<<"$before" && [ "$(grep "^public.$t|" <<<"$before")" = "$(grep "^public.$t|" <<<"$seeded")" ] \
    || { echo "FAIL: $t changed"; exit 1; }
done

psql_at "$DB" -1 -f "$HERE/staging-test-activity.reset.sql" >/dev/null
after="$(snapshot)"
if [ "$before" != "$after" ]; then echo "FAIL: reset did not put things back"; diff <(echo "$before") <(echo "$after") || true; exit 1; fi
left="$(psql_at "$DB" -At -c "select (select count(*) from auth.users where email like '%@internal.hungry.test') + (select count(*) from user_profiles where email like '%@internal.hungry.test') + (select count(*) from reviews where user_id::text like '00000000-0000-1119-d000%')")"
[ "$left" = "0" ] || { echo "FAIL: $left marked rows left after reset"; exit 1; }
# And a reset with nothing to remove is a no-op.
psql_at "$DB" -1 -f "$HERE/staging-test-activity.reset.sql" >/dev/null
[ "$(snapshot)" = "$before" ] || { echo "FAIL: an empty reset changed something"; exit 1; }
echo "PASS staging test activity: seed, checks, rerun, failed seed, reset round trip"
