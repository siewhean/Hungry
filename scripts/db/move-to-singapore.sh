#!/usr/bin/env bash
# Move prod from Seoul to Singapore, on sh's Mac.
#   bash ~/move-to-singapore.sh bootstrap    # phase 1: build the empty Singapore project (about 35 min, safe any time)
#   bash ~/move-to-singapore.sh functions    # deploy the 9 Edge Functions to Singapore (needs SUPABASE_ACCESS_TOKEN)
#   bash ~/move-to-singapore.sh auth         # push Auth settings + email templates from supabase/config.toml, list secret names (needs SUPABASE_ACCESS_TOKEN)
#   bash ~/move-to-singapore.sh cutover      # phase 2: copy rows + photos, create Vault secrets, verify
#   bash ~/move-to-singapore.sh finish       # only the photo count check, Vault secrets and verify (after a cutover that copied everything but stopped early)
# Seoul is only read. Needs, loaded first with `read -s` lines in zsh:
#   SRC_PGPASSWORD   Seoul prod DB password
#   DST_PGPASSWORD   Singapore DB password (the one you reset in the dashboard)
#   cutover also: SRC_SERVICE_KEY, DST_SERVICE_KEY (legacy service_role keys, Project Settings > API Keys)
set -euo pipefail
PHASE="${1:?usage: move-to-singapore.sh bootstrap|cutover}"
REPO="${HUNGRY_REPO:-/Users/Siew Hean/Documents/GitHub/Hungry}"
BRANCH="claude/project-thread-chaz1d"
SRC_REF=yrlxjeovwslirseajomz
DST_REF=frluxwpqqyomiqmjzavd
if [ "$PHASE" = functions ] || [ "$PHASE" = auth ]; then
  [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || { echo "Load SUPABASE_ACCESS_TOKEN first (a token from the account that owns hungry-prod-sg)."; exit 1; }
  git -C "$REPO" fetch origin "$BRANCH"
  WT="$(mktemp -d)/fn"; git -C "$REPO" worktree add --detach "$WT" "origin/$BRANCH"
  trap 'git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
  cd "$WT"
  if [ "$PHASE" = auth ]; then
    # config.toml pins every Auth key this app relies on; the new project starts from defaults, so nothing is lost.
    # Free-plan projects cannot change Auth email templates; production sends auth email through the
    # Send Email hook (Resend) instead, so the template blocks are dropped from this push only.
    awk '/^\[auth\.email\.template\./ {skip=1; next} /^\[/ {skip=0} !skip' supabase/config.toml > supabase/config.toml.new && mv supabase/config.toml.new supabase/config.toml
    npx --yes supabase config push --project-ref "$DST_REF"
    echo "Edge Function secret NAMES (values are write-only). Old project, then new project:"
    npx --yes supabase secrets list --project-ref "$SRC_REF" | awk -F'|' 'NR>2 {gsub(/ /,"",$1); print "  old: " $1}'
    npx --yes supabase secrets list --project-ref "$DST_REF" | awk -F'|' 'NR>2 {gsub(/ /,"",$1); print "  new: " $1}'
    echo "AUTH_OK"
    exit 0
  fi
  npx --yes supabase functions deploy --project-ref "$DST_REF" --use-api
  npx --yes supabase functions list --project-ref "$DST_REF"
  echo "FUNCTIONS_OK"
  exit 0
fi
[ -n "${SRC_PGPASSWORD:-}" ] && [ -n "${DST_PGPASSWORD:-}" ] || { echo "Load SRC_PGPASSWORD and DST_PGPASSWORD first (read -s lines)."; exit 1; }
if [ "$PHASE" = cutover ]; then
  [ -n "${SRC_SERVICE_KEY:-}" ] && [ -n "${DST_SERVICE_KEY:-}" ] || { echo "Load SRC_SERVICE_KEY and DST_SERVICE_KEY first (read -s lines)."; exit 1; }
fi
[ -d /opt/homebrew/opt/libpq/bin ] && export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# Find the Singapore pooler host (the transaction pooler on 6543 works on your network).
DST_HOST=""
for h in aws-0-ap-southeast-1.pooler.supabase.com aws-1-ap-southeast-1.pooler.supabase.com; do
  if PGPASSWORD="$DST_PGPASSWORD" psql "postgresql://postgres.$DST_REF@$h:6543/postgres?connect_timeout=10" -X -At -c 'select 1' >/dev/null 2>&1; then DST_HOST="$h"; break; fi
done
[ -n "$DST_HOST" ] || { echo "Cannot connect to the Singapore project. Check DST_PGPASSWORD (reset it in the dashboard) and that the project shows Healthy."; exit 1; }
echo "Singapore pooler: $DST_HOST"
export SRC_DB_URL="postgresql://postgres.$SRC_REF@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?connect_timeout=15"
export DST_DB_URL="postgresql://postgres.$DST_REF@$DST_HOST:6543/postgres?connect_timeout=15"
export SRC_API_URL="https://$SRC_REF.supabase.co" DST_API_URL="https://$DST_REF.supabase.co"
export SRC_PGPASSWORD DST_PGPASSWORD SRC_SERVICE_KEY DST_SERVICE_KEY 2>/dev/null || true

git -C "$REPO" fetch origin main "$BRANCH"
WT="$(mktemp -d)/move"
git -C "$REPO" worktree add --detach "$WT" "origin/$BRANCH"
trap 'git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
cd "$WT"
S=scripts/db/move-project.sh
case "$PHASE" in
  bootstrap) bash $S bootstrap ;;
  cutover) bash $S data && bash $S storage && bash $S secrets && bash $S verify && echo "CUTOVER_COPY_OK" ;;
  # After a cutover that stopped at the storage count check: rows and photos are already copied.
  finish) bash $S verify-storage && bash $S secrets && bash $S verify && echo "CUTOVER_COPY_OK" ;;
  *) echo "unknown phase"; exit 1 ;;
esac
