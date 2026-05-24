#!/usr/bin/env bash
set -euo pipefail

LOCAL_ONLY=0
if [[ "${1:-}" == "--local-only" ]]; then
  LOCAL_ONLY=1
fi

run_step() {
  local label="$1"
  shift
  echo
  echo "[Hungry] ${label}"
  "$@"
}

echo "[Hungry] Full Audit V1 release readiness checklist"
echo
echo "This script verifies repo-local gates and then reports the remaining"
echo "external release blockers. Use --local-only for local gate rehearsal."

run_step "1) Typecheck" npm run typecheck
run_step "2) Test suite" npm run test
run_step "3) Static Supabase audit" npm run audit:supabase:static
run_step "4) Supabase Advisor app-owned guard" npm run audit:supabase:advisor-security
run_step "5) Edge Function static checks" npm run check:edge-functions
run_step "6) Asset audit" npm run audit:assets
run_step "7) TruffleHog filesystem scan" npm run security:trufflehog
run_step "8) npm audit" npm run security:audit
run_step "9) Expo Doctor" env CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .

echo
echo "[Hungry] Native proof status"
echo "- iOS prepared Maestro smoke: already recorded as passing in tasks/verification.md."
if [[ -d android ]]; then
  echo "- Android native project exists locally; run Android smoke/build proof before release."
else
  echo "- Android native project is not present locally; Android/EAS proof must come from EAS or a generated Android project."
fi

if [[ "${LOCAL_ONLY}" == "1" ]]; then
  echo
  echo "[Hungry] Local gate rehearsal complete. External blockers were not enforced."
  exit 0
fi

echo
echo "[Hungry] Release remains No-Go until these external blockers have evidence:"
echo "- Android/EAS build or device smoke proof"
echo "- production secret verification for EAS/store release environments"
echo "- public privacy/account-deletion URL reachability and store-console metadata"
echo "- Supabase owner/dashboard actions for leaked-password protection and remaining Advisor findings"
exit 2
