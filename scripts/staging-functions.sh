#!/usr/bin/env bash
# Staging Edge Functions: secrets, deploy, secret-name check, smoke. STAGING ONLY.
#   scripts/staging-functions.sh secrets   generate worker tokens, push secrets to staging
#   scripts/staging-functions.sh deploy    deploy all functions to staging (verify_jwt comes from config.toml)
#   scripts/staging-functions.sh check     list staging secret NAMES and report any that are missing
#   scripts/staging-functions.sh smoke     call each function once (scripts/smoke-staging-functions.mjs)
#   scripts/staging-functions.sh all       secrets, deploy, check, smoke
# Needs the Supabase CLI logged in (or SUPABASE_ACCESS_TOKEN). Secret values live in
# ${HUNGRY_STAGING_FUNCTIONS_ENV:-$HOME/.hungry/staging-functions.env} (mode 600, outside the repo).
# Third-party keys are read from the shell when exported and only pushed if present:
#   GOOGLE_CLOUD_VISION_API_KEY GEMINI_API_KEY AI_PROVIDER AI_MODEL ANTHROPIC_API_KEY RESEND_API_KEY
#   RESEND_FROM REPORT_DIGEST_TO SENTRY_DSN EXPO_ACCESS_TOKEN SEND_EMAIL_HOOK_SECRET RESEND_TEMPLATE_SIGNIN_ID
# Allowed origins default to ORIGINS below; override with STAGING_ALLOWED_ORIGINS.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_REF="uuylnktiipkmcweyqnpd"
PROD_REF="frluxwpqqyomiqmjzavd"
ENV_FILE="${HUNGRY_STAGING_FUNCTIONS_ENV:-$HOME/.hungry/staging-functions.env}"
ORIGINS="${STAGING_ALLOWED_ORIGINS:-https://usehungry.com,http://localhost:3000}"

die() { echo "ERROR: $*" >&2; exit 1; }
say() { echo "==> $*"; }
[ "$STAGING_REF" != "$PROD_REF" ] || die "staging ref equals the production ref"
SB=(npx --yes supabase)

# Add NAME=random to the env file unless it is already there.
ensure_token() {
  grep -q "^$1=" "$ENV_FILE" || echo "$1=$(openssl rand -hex 32)" >> "$ENV_FILE"
}

cmd_secrets() {
  mkdir -p "$(dirname "$ENV_FILE")"; touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
  for name in ACCOUNT_DELETION_WORKER_TOKEN ORPHAN_MEDIA_WORKER_TOKEN REPORT_DIGEST_TOKEN \
    NOTIFICATION_WORKER_TOKEN TASTE_TAGGING_WORKER_TOKEN GUEST_SESSION_API_KEY; do
    ensure_token "$name"
  done
  local tmp; tmp="$(mktemp)"; chmod 600 "$tmp"; trap 'rm -f "$tmp"' RETURN
  cat "$ENV_FILE" > "$tmp"
  {
    echo "APP_ENV=staging"
    for name in CHECK_PHOTO_SAFETY GUEST_SESSION INGEST_MENU_PHOTO OPS_DISHES_DRAFT; do echo "${name}_ALLOWED_ORIGINS=$ORIGINS"; done
    for name in GOOGLE_CLOUD_VISION_API_KEY GEMINI_API_KEY AI_PROVIDER AI_MODEL ANTHROPIC_API_KEY RESEND_API_KEY \
      RESEND_FROM REPORT_DIGEST_TO SENTRY_DSN EXPO_ACCESS_TOKEN SEND_EMAIL_HOOK_SECRET RESEND_TEMPLATE_SIGNIN_ID; do
      if [ -n "${!name:-}" ]; then echo "$name=${!name}"; fi
    done
  } >> "$tmp"
  say "pushing secrets to staging ($STAGING_REF); values are not printed"
  "${SB[@]}" secrets set --project-ref "$STAGING_REF" --env-file "$tmp"
}

cmd_deploy() {
  cd "$REPO_ROOT"
  say "deploying every function in supabase/functions to staging ($STAGING_REF)"
  "${SB[@]}" functions deploy --project-ref "$STAGING_REF"
  "${SB[@]}" functions list --project-ref "$STAGING_REF"
}

cmd_check() {
  cd "$REPO_ROOT"
  say "required secret names on staging"
  "${SB[@]}" secrets list --project-ref "$STAGING_REF" -o json | node scripts/staging-functions/check-secrets.mjs
}

cmd_smoke() {
  cd "$REPO_ROOT"
  [ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
  export GUEST_SESSION_ALLOWED_ORIGINS="${GUEST_SESSION_ALLOWED_ORIGINS:-$ORIGINS}"
  node scripts/smoke-staging-functions.mjs --require-tokens
}

case "${1:-}" in
  secrets) cmd_secrets ;;
  deploy) cmd_deploy ;;
  check) cmd_check ;;
  smoke) cmd_smoke ;;
  all) cmd_secrets; cmd_deploy; cmd_check; cmd_smoke ;;
  *) sed -n 2,9p "$0"; exit 2 ;;
esac
