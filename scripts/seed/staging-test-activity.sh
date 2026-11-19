#!/usr/bin/env bash
# Test activity on STAGING (build plan package 3.2): 20 labelled test diners with saves, quick logs,
# ratings, written reviews and follows, so screens that depend on activity can be judged.
#   scripts/seed/staging-test-activity.sh seed     clear any old test activity, then add it
#   scripts/seed/staging-test-activity.sh reset    remove all of it (staging goes back to clean)
#   scripts/seed/staging-test-activity.sh status   count the test diners and what they made
# Staging only: it refuses every project but the staging ref below, and never takes a production URL.
# Environment: STAGING_DB_URL and STAGING_PGPASSWORD, as the scripts in scripts/db.
# The test diners are the accounts whose email ends @internal.hungry.test. See tasks/environment.md.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/../db/common.sh"

STAGING_REF="uuylnktiipkmcweyqnpd"
[ "$STAGING_REF" != "$PROD_REF" ] || die "staging ref equals the production ref"
[ $# -eq 1 ] || die "usage: staging-test-activity.sh seed|reset|status"

load_env staging
[ "$DB_REF" = "$STAGING_REF" ] || die "STAGING_DB_URL points at '$DB_REF', not the staging project '$STAGING_REF'"

case "$1" in
  seed)
    say "clearing old test activity on staging ($DB_REF)"
    psql_db -q -f "$HERE/staging-test-activity.reset.sql"
    say "adding test activity on staging ($DB_REF)"
    psql_db -q -f "$HERE/staging-test-activity.seed.sql"
    ;;
  reset)
    say "removing test activity from staging ($DB_REF)"
    psql_db -q -f "$HERE/staging-test-activity.reset.sql"
    ;;
  status)
    psql_db -q <<'SQL'
select count(*) as test_diners from auth.users where email like '%@internal.hungry.test';
select count(*) as reviews from reviews r join auth.users u on u.id = r.user_id where u.email like '%@internal.hungry.test';
select count(*) as saved_dishes from user_favourite_dishes f join auth.users u on u.id = f.user_id where u.email like '%@internal.hungry.test';
select count(*) as board_rows from leaderboard_standings s join auth.users u on u.id = s.user_id where u.email like '%@internal.hungry.test';
SQL
    ;;
  *) die "usage: staging-test-activity.sh seed|reset|status" ;;
esac
