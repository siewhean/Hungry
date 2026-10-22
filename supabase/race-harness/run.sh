#!/usr/bin/env bash
# Two-session concurrency checks for supabase/migrations/20261022124500_race_condition_fixes.sql.
#
# Builds a throwaway Postgres cluster with minimal stand-in tables, loads the function bodies
# as they were BEFORE the fix migration, then replays each race with two overlapping
# transactions (session A holds its transaction open while session B starts). Runs once
# against the old bodies ("before", informational) and once after applying the migration
# ("after", asserted). Exits non-zero if any race still shows up.
#
#   bash supabase/race-harness/run.sh
#   RACE_SHOW_BEFORE=1 bash supabase/race-harness/run.sh   # also print the "before" outcomes
#
# Needs the Postgres 14+ server binaries (initdb, pg_ctl, psql) and python3. It does not
# touch Supabase or any real database.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION=20261022124500_race_condition_fixes.sql
WORK="${RACE_HARNESS_DIR:-/var/tmp/hungry-race-harness}"
PORT="${RACE_HARNESS_PORT:-5544}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
HOLD="${HOLD:-1.5}"

if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "Postgres server binaries not found (set PGBIN)." >&2
  exit 2
fi

as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }

rm -rf "$WORK"
mkdir -p "$WORK"
[ "$(id -u)" = 0 ] && chown postgres "$WORK"
as_pg "$PGBIN/initdb -D '$WORK/data' -U postgres -A trust >/dev/null"
as_pg "$PGBIN/pg_ctl -D '$WORK/data' -o '-p $PORT -k $WORK' -l '$WORK/log' -w start >/dev/null"
trap 'as_pg "$PGBIN/pg_ctl -D '"'$WORK/data'"' -m immediate stop >/dev/null 2>&1"' EXIT

PSQL=("$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -X -q -At)
python3 "$HERE/extract_functions.py" "$WORK/fn" --before "$MIGRATION" >/dev/null

load_fn() { grep -v '^--' "$WORK/fn/$1.sql" | PGOPTIONS="-c check_function_bodies=off" "${PSQL[@]}" -v ON_ERROR_STOP=1 -d "$2" || { echo "could not load $1" >&2; exit 2; }; }

"${PSQL[@]}" -d postgres -c "create database base" >/dev/null
"${PSQL[@]}" -d base -v ON_ERROR_STOP=1 -f "$HERE/stubs.sql" >/dev/null || exit 2
for f in public__assert_portfolio_expected_updated_at public__update_portfolio_item_with_version \
  public__reorder_checklist_items public__sync_post_engagement_counts public__submit_catalog_correction \
  public__enforce_portfolio_creation_rate_limit public__enforce_portfolio_flag_rate_limit \
  app_private__enforce_user_stall_submission_limits app_private__submit_merchant_claim_interest \
  public__increment_mission_progress app_private__award_food_cred app_private__report_content \
  app_private__sync_dish_review_stats app_private__refresh_dish_review_stats \
  app_private__sync_review_helpful_count app_private__request_my_account_deletion \
  app_private__refresh_user_profile_counters app_private__add_portfolio_item_with_passport \
  public__catalog_raw_publish_release public__refresh_merchant_analytics_daily_rollup \
  public__refresh_merchant_dish_analytics_daily; do
  load_fn "$f" base
done
# report_post lives in app_private behind a public wrapper in the real schema
sed 's/public\.report_post/app_private.report_post/' "$WORK/fn/public__report_post.sql" \
  | grep -v '^--' | PGOPTIONS="-c check_function_bodies=off" "${PSQL[@]}" -v ON_ERROR_STOP=1 -d base || exit 2
"${PSQL[@]}" -d base -v ON_ERROR_STOP=1 <<'SQL' >/dev/null || exit 2
create trigger t_likes after insert or delete on post_likes
  for each row execute function public.sync_post_engagement_counts();
create trigger t_reviews after insert or update or delete on reviews
  for each row execute function app_private.sync_dish_review_stats();
SQL

for db in before after; do "${PSQL[@]}" -d postgres -c "create database $db template base" >/dev/null; done
PGOPTIONS="-c check_function_bodies=off" "${PSQL[@]}" -d after -v ON_ERROR_STOP=1 \
  -f "$HERE/../migrations/$MIGRATION" >/dev/null || { echo "migration failed to apply" >&2; exit 2; }
# the migration must be safe to run twice
PGOPTIONS="-c check_function_bodies=off" "${PSQL[@]}" -d after -v ON_ERROR_STOP=1 \
  -f "$HERE/../migrations/$MIGRATION" >/dev/null || { echo "migration is not idempotent" >&2; exit 2; }

U1=00000000-0000-0000-0000-000000000001
U2=00000000-0000-0000-0000-000000000002
U3=00000000-0000-0000-0000-000000000003
POST=33333333-0000-0000-0000-000000000001
PORTFOLIO=11111111-0000-0000-0000-000000000001
ITEM=22222222-0000-0000-0000-000000000001
OUTLET=44444444-0000-0000-0000-000000000001
CONVO=66666666-0000-0000-0000-000000000001
DRAFT=77777777-0000-0000-0000-000000000001

# run_scenarios <db> <results file>
run_scenarios() {
  local db=$1 out=$2
  local q=("${PSQL[@]}" -d "$db")
  : >"$out"
  record() { echo "$1=$2" >>"$out"; }

  session() { # uid delay sql -> prints the first error line, if any
    ( sleep "$2"
      "${q[@]}" -c "begin; select set_config('request.jwt.claim.sub','$1',true);" -c "$3" \
        -c "select pg_sleep($HOLD);" -c "commit;" 2>&1 | grep -i "error" | head -1 | cut -c1-120 )
  }
  race() { # key uidA uidB sqlA sqlB -> records <key>_errors
    local a b
    a=$(mktemp) b=$(mktemp)
    session "$2" 0 "$4" >"$a" & local pa=$!
    session "$3" 0.5 "$5" >"$b" & local pb=$!
    wait $pa $pb
    local n=0
    [ -s "$a" ] && n=$((n + 1))
    [ -s "$b" ] && n=$((n + 1))
    record "$1_errors" "$n"
    rm -f "$a" "$b"
  }
  reset() {
    PGOPTIONS="-c client_min_messages=warning" "${q[@]}" -c "truncate portfolios, portfolio_items, posts, post_likes, post_reports, moderation_actions, post_moderation_states, home_feed_items, venues, catalog_corrections, food_cred_events, user_food_cred, merchant_popular_visitor_pins, reviews, dishes, account_deletion_requests, read_receipts, messages, conversation_participants, dishes_draft cascade" >/dev/null
  }
  val() { "${q[@]}" -c "$1"; }

  reset
  val "insert into portfolios(id, owner_id, updated_at) values ('$PORTFOLIO','$U1','2026-01-01'); insert into portfolio_items(id,portfolio_id,item_type,stall_id,position) values ('$ITEM','$PORTFOLIO','stall','s1',0);" >/dev/null
  race T1 $U1 $U1 \
    "select public.update_portfolio_item_with_version('$ITEM', 5, null, null, '2026-01-01');" \
    "select public.update_portfolio_item_with_version('$ITEM', 7, null, null, '2026-01-01');"

  reset
  val "insert into posts(id) values ('$POST');" >/dev/null
  race T2 $U1 $U2 "insert into post_likes values ('$POST','$U1');" "insert into post_likes values ('$POST','$U2');"
  record T2_like_count "$(val 'select like_count from posts')"

  reset
  val "insert into posts(id) values ('$POST'); insert into post_reports(reporter_id,post_id,reason_code,status,created_at) values ('$U3','$POST','spam','open',now());" >/dev/null
  race T3 $U1 $U2 "select app_private.report_post('$POST','harassment',null);" "select app_private.report_post('$POST','harassment',null);"
  record T3_state "$(val 'select state from post_moderation_states')"

  reset
  val "insert into venues values ('v1','b1'); insert into catalog_corrections(venue_id,reporter_id,kind) select 'v1','$U1','other' from generate_series(1,9);" >/dev/null
  race T4 $U1 $U1 "select public.submit_catalog_correction('v1','closed',null,null);" "select public.submit_catalog_correction('v1','wrong_price',null,null);"
  record T4_corrections "$(val "select count(*) from catalog_corrections where reporter_id='$U1'")"

  reset
  race T5 $U1 $U1 "select * from app_private.award_food_cred('daily_checkin','e1');" "select * from app_private.award_food_cred('daily_checkin','e2');"
  record T5_points "$(val 'select coalesce(sum(points),0) from food_cred_events where points>0')"

  reset
  val "insert into merchant_popular_visitor_pins(outlet_id,review_id,sort_order) select '$OUTLET', gen_random_uuid(), g from generate_series(0,4) g;" >/dev/null
  race T6 $U1 $U1 \
    "insert into merchant_popular_visitor_pins(outlet_id,review_id,sort_order) values ('$OUTLET', gen_random_uuid(), 0);" \
    "insert into merchant_popular_visitor_pins(outlet_id,review_id,sort_order) values ('$OUTLET', gen_random_uuid(), 0);"
  record T6_active "$(val 'select count(*) from merchant_popular_visitor_pins where is_active')"
  record T6_sort "$(val "select string_agg(sort_order::text, ',' order by sort_order) from merchant_popular_visitor_pins")"

  reset
  val "insert into dishes(id) values ('d1');" >/dev/null
  race T7 $U1 $U2 "insert into reviews(dish_id,user_id,rating) values ('d1','$U1',5);" "insert into reviews(dish_id,user_id,rating) values ('d1','$U2',3);"
  record T7_review_count "$(val 'select review_count from dishes')"
  record T7_rating_avg "$(val 'select rating_avg from dishes')"

  reset
  val "insert into user_profiles values ('$U1') on conflict do nothing;" >/dev/null
  race T8 $U1 $U1 "select app_private.request_my_account_deletion('x');" "select app_private.request_my_account_deletion('x');"
  record T8_requests "$(val 'select count(*) from account_deletion_requests')"

  reset
  val "insert into portfolios(id, owner_id) values ('$PORTFOLIO','$U1');" >/dev/null
  race T9 $U1 $U1 \
    "select app_private.add_portfolio_item_with_passport('$PORTFOLIO','stall',null,'sA');" \
    "select app_private.add_portfolio_item_with_passport('$PORTFOLIO','stall',null,'sB');"
  record T9_positions "$(val "select string_agg(position::text, ',' order by position) from portfolio_items")"

  if [ "$db" = after ]; then
    reset
    val "insert into messages(id,conversation_id,sender_user_id) values ('55555555-0000-0000-0000-000000000001','$CONVO','$U2'),('55555555-0000-0000-0000-000000000002','$CONVO','$U2'); insert into conversation_participants values ('$CONVO','$U1',null);" >/dev/null
    race T10 $U1 $U1 "select public.mark_conversation_read('$CONVO');" "select public.mark_conversation_read('$CONVO');"
    record T10_receipts "$(val 'select count(*) from read_receipts')"

    reset
    val "insert into dishes_draft(id,extraction_confidence) values ('$DRAFT',0.5);" >/dev/null
    race T11 $U1 $U1 "select public.bump_dish_draft_confidence('$DRAFT', 0.8);" "select public.bump_dish_draft_confidence('$DRAFT', 0.9);"
    record T11_bumps "$(val 'select confidence_bumps from dishes_draft')"
    record T11_confidence "$(val 'select extraction_confidence from dishes_draft')"
  fi
}

# key=expected after the fix
EXPECTED="T1_errors=1
T2_errors=0
T2_like_count=2
T3_errors=0
T3_state=hidden
T4_errors=1
T4_corrections=10
T5_errors=0
T5_points=10
T6_errors=1
T6_active=6
T6_sort=0,1,2,3,4,5
T7_errors=0
T7_review_count=2
T7_rating_avg=4.00
T8_errors=0
T8_requests=1
T9_errors=0
T9_positions=0,1
T10_errors=0
T10_receipts=2
T11_errors=0
T11_bumps=2
T11_confidence=0.9"

DESC="T1 two saves with the same expected version (second must be rejected)
T2 two likes at once (like_count)
T3 third and fourth report at once (post must be hidden)
T4 two corrections at once with one slot left of the daily cap
T5 two Food Cred awards at once under a cap of one a day
T6 two pins at once with one slot left of the 6-pin cap
T7 two reviews at once (review_count, rating_avg)
T8 double tap on delete account
T9 two list items added at once (positions)
T10 mark_conversation_read from two tabs
T11 two OCR confidence bumps at once"

if [ -n "${RACE_SHOW_BEFORE:-}" ]; then
  run_scenarios before "$WORK/before.txt"
  echo "--- before the fix (old function bodies; every line that differs from the expected value is a race):"
  while IFS= read -r line; do
    key=${line%%=*}; want=$(printf '%s\n' "$EXPECTED" | grep "^$key=" | cut -d= -f2-)
    [ "$line" = "$key=$want" ] && echo "  ok    $line" || echo "  RACE  $line   (expected $want)"
  done <"$WORK/before.txt"
fi

run_scenarios after "$WORK/after.txt"
echo "--- after the fix:"
fail=0
while IFS= read -r line; do
  key=${line%%=*}; want=$(printf '%s\n' "$EXPECTED" | grep "^$key=" | cut -d= -f2-)
  if [ "$line" = "$key=$want" ]; then echo "  ok    $line"; else echo "  FAIL  $line   (expected $want)"; fail=1; fi
done <"$WORK/after.txt"
missing=$(printf '%s\n' "$EXPECTED" | cut -d= -f1 | while read -r k; do grep -q "^$k=" "$WORK/after.txt" || echo "$k"; done)
if [ -n "$missing" ]; then echo "  FAIL  no result recorded for: $missing"; fail=1; fi
# The down migration must restore the old bodies exactly, and the up migration must re-apply.
"${PSQL[@]}" -d postgres -c "create database down template after" >/dev/null
PGOPTIONS="-c check_function_bodies=off" "${PSQL[@]}" -d down -v ON_ERROR_STOP=1 \
  -f "$HERE/../rollbacks/${MIGRATION%.sql}.down.sql" >/dev/null || { echo "  FAIL  down migration failed to apply"; fail=1; }
bodies() { "${PSQL[@]}" -d "$1" -c "select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')=' || md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public','app_private') and p.proname not in ('mark_conversation_read','bump_dish_draft_confidence','enforce_popular_visitor_pin_limit') order by 1"; }
if diff <(bodies before) <(bodies down) >/dev/null; then
  echo "  ok    down migration restores every function body"
else
  echo "  FAIL  down migration left different function bodies:"; diff <(bodies before) <(bodies down) | head; fail=1
fi
PGOPTIONS="-c check_function_bodies=off" "${PSQL[@]}" -d down -v ON_ERROR_STOP=1 \
  -f "$HERE/../migrations/$MIGRATION" >/dev/null 2>&1 && echo "  ok    up migration re-applies after down" || { echo "  FAIL  up migration does not re-apply after down"; fail=1; }
echo
printf '%s\n' "$DESC"
[ "$fail" = 0 ] && echo "All race checks passed." || echo "Race checks FAILED."
exit "$fail"
