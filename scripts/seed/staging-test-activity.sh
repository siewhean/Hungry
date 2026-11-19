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
# The ref in the user name is not enough: psql must connect to a Supabase pooler or staging's own
# direct host. So the whole URL has to match one strict shape: plain user name (no encoding), one host
# (no fallback list), an optional port, a database name and at most one sslmode option that is require or stronger. Anything else
# (host/hostaddr in any spelling, percent-encoded keys, a second host) is refused before psql runs.
url_re='^postgres(ql)?://[A-Za-z0-9._-]+@(aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com|db\.'"$STAGING_REF"'\.supabase\.co)(:[0-9]+)?/[A-Za-z0-9_]+(\?sslmode=(require|verify-ca|verify-full))?$'
[[ "$DB_URL" =~ $url_re ]] || die "STAGING_DB_URL must look like postgresql://USER@HOST:PORT/DB where HOST is a Supabase pooler or the staging direct host (one host, no other options)"

# Nothing in the environment may redirect or weaken the connection: a pinned address, a service file
# or a default host would win over (or fill in behind) the URL checked above.
unset PGHOST PGHOSTADDR PGSERVICE PGSERVICEFILE PGSYSCONFDIR PGPORT

# TLS is always on: libpq would fall back to plain text without an sslmode, and a service file or
# PGSSLMODE can change it, so the mode is written into the URL itself (the URL always wins). It is
# require unless the URL or PGSSLMODE asks for more. (Require encrypts but does not check the
# certificate; verify-full needs the Supabase root CA, so it stays optional.)
export PGSSLMODE="${PGSSLMODE:-require}"
case "$PGSSLMODE" in require|verify-ca|verify-full) ;; *) die "PGSSLMODE '$PGSSLMODE' is weaker than require" ;; esac
case "$DB_URL" in *sslmode=*) ;; *) DB_URL="${DB_URL}?sslmode=${PGSSLMODE}" ;; esac

case "$1" in
  seed)
    # One transaction (-1): if the seed fails, the old test activity is still there.
    say "replacing test activity on staging ($DB_REF)"
    psql_db -q -1 -f "$HERE/staging-test-activity.reset.sql" -f "$HERE/staging-test-activity.seed.sql"
    ;;
  reset)
    say "removing test activity from staging ($DB_REF)"
    psql_db -q -1 -f "$HERE/staging-test-activity.reset.sql"
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
