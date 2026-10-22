#!/usr/bin/env bash
# Rehearse one PR's migration on staging and push the evidence file to that PR's branch.
#   bash rehearse-pr.sh <pr branch> <migration version>
# Needs STAGING_PGPASSWORD and PROD_PGPASSWORD in the environment (prod is only read, to compare schemas).
# Staging is in Seoul (ap-northeast-2); production is in Singapore (ap-southeast-1).
set -euo pipefail
BRANCH="${1:?usage: rehearse-pr.sh <pr branch> <migration version>}"
VERSION="${2:?usage: rehearse-pr.sh <pr branch> <migration version>}"
REPO="${HUNGRY_REPO:-/Users/Siew Hean/Documents/GitHub/Hungry}"
[ -n "${STAGING_PGPASSWORD:-}" ] && [ -n "${PROD_PGPASSWORD:-}" ] || { echo "Load both passwords first (read -s lines)."; exit 1; }
[ -d /opt/homebrew/opt/libpq/bin ] && export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
STAGING_REF=uuylnktiipkmcweyqnpd
STAGING_HOST="aws-0-ap-northeast-2.pooler.supabase.com"
PROD_REF=frluxwpqqyomiqmjzavd
PROD_HOST="aws-0-ap-southeast-1.pooler.supabase.com"
# Session pooler (5432) first: it keeps one connection for the whole script. Fall back to the transaction pooler (6543).
port_for() { # <ref> <host> <password>
  if PGPASSWORD="$3" psql "postgresql://postgres.$1@$2:5432/postgres?connect_timeout=8" -X -At -c 'select 1' >/dev/null 2>&1; then echo 5432; else echo 6543; fi
}
STAGING_PORT="$(port_for "$STAGING_REF" "$STAGING_HOST" "$STAGING_PGPASSWORD")"
PROD_PORT="$(port_for "$PROD_REF" "$PROD_HOST" "$PROD_PGPASSWORD")"
echo "Staging pooler port $STAGING_PORT, production pooler port $PROD_PORT"
export STAGING_DB_URL="postgresql://postgres.$STAGING_REF@$STAGING_HOST:$STAGING_PORT/postgres?connect_timeout=15"
export PROD_DB_URL="postgresql://postgres.$PROD_REF@$PROD_HOST:$PROD_PORT/postgres?connect_timeout=15"
export STAGING_PGPASSWORD PROD_PGPASSWORD
# Fail early, with a plain message, if either login is wrong.
PGPASSWORD="$STAGING_PGPASSWORD" psql "$STAGING_DB_URL" -X -At -c 'select 1' >/dev/null || { echo "Cannot log in to staging. Check STAGING_PGPASSWORD and that hungry-staging is Healthy (not paused)."; exit 1; }
PGPASSWORD="$PROD_PGPASSWORD" psql "$PROD_DB_URL" -X -At -c 'select 1' >/dev/null || { echo "Cannot log in to production (Singapore). Check PROD_PGPASSWORD is the hungry-prod-sg database password."; exit 1; }

git -C "$REPO" fetch origin main "$BRANCH"
WT="$(mktemp -d)/rehearse-$VERSION"
git -C "$REPO" worktree add --detach "$WT" "origin/$BRANCH"
cd "$WT"
git merge --no-edit origin/main
scripts/db/rehearse.sh "$VERSION"
git add "supabase/rehearsals/$VERSION.json"
git commit -m "Staging rehearsal evidence for $VERSION"
git push origin "HEAD:$BRANCH"
cd "$REPO"
git worktree remove --force "$WT"
echo "REHEARSAL_PUSHED $VERSION"
