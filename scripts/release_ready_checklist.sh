#!/usr/bin/env bash
set -euo pipefail

LOCAL_ONLY=0
if [[ "${1:-}" == "--local-only" ]]; then
  LOCAL_ONLY=1
fi
RELEASE_EVIDENCE_FILE="${HUNGRY_RELEASE_EVIDENCE_FILE:-tasks/release-evidence/full-audit-v1.env}"

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
run_step "9) Website static predeploy gates" npm run website:predeploy:local
run_step "10) Expo Doctor" env EXPO_NO_DOTENV=1 CI=1 NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor .

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

require_evidence() {
  local key="$1"
  local description="$2"
  if grep -Eq "^${key}=1$" "${RELEASE_EVIDENCE_FILE}"; then
    echo "- ${description}: evidence recorded"
    return 0
  fi
  echo "- ${description}: missing ${key}=1"
  return 1
}

echo
if [[ ! -f "${RELEASE_EVIDENCE_FILE}" ]]; then
  echo "[Hungry] Release remains No-Go until these external blockers have evidence:"
  echo "- Android/EAS build or device smoke proof"
  echo "- production secret verification for EAS/store release environments"
  echo "- public privacy/account-deletion URL reachability and store-console metadata"
  echo "- Supabase owner/dashboard actions for leaked-password protection and remaining Advisor findings"
  echo "- pushed GitHub CI evidence for the merchant-catalog E2E gate"
  echo "- dirty-worktree reconciliation before merge or public-release claims"
  echo "- SEC-06 verified/unverified merchant runtime smoke"
  echo "- SEC-08 app_ops_admin seeding plus live multi-user RLS/storage/Edge Function smoke"
  echo "- MER-PORTAL-01 merchant email worker/provider and prepared native merchant smoke"
  echo "- MERCH-P0-ANALYTICS-01 live Supabase smoke and analytics behavior proof"
  echo
  echo "Create ${RELEASE_EVIDENCE_FILE} from tasks/release-evidence/full-audit-v1.example.env after the external proof is captured."
  exit 2
fi

echo "[Hungry] Checking external release evidence in ${RELEASE_EVIDENCE_FILE}"
missing=0
require_evidence "ANDROID_EAS_PROOF" "Android/EAS build or device smoke proof" || missing=1
require_evidence "PRODUCTION_SECRET_PROOF" "production secret verification for EAS/store release environments" || missing=1
require_evidence "STORE_CONSOLE_PROOF" "public privacy/account-deletion URL reachability and store-console metadata" || missing=1
require_evidence "SUPABASE_OWNER_PROOF" "Supabase owner/dashboard actions for leaked-password protection and remaining Advisor findings" || missing=1
require_evidence "PUSHED_CI_PROOF" "pushed GitHub CI evidence for the merchant-catalog E2E gate" || missing=1
require_evidence "DIRTY_WORKTREE_RECONCILED" "dirty-worktree reconciliation before merge or public-release claims" || missing=1
require_evidence "SEC_06_RUNTIME_PROOF" "SEC-06 verified/unverified merchant runtime smoke" || missing=1
require_evidence "SEC_08_RUNTIME_PROOF" "SEC-08 app_ops_admin seeding plus live multi-user RLS/storage/Edge Function smoke" || missing=1
require_evidence "MER_PORTAL_01_RUNTIME_PROOF" "MER-PORTAL-01 merchant email worker/provider and prepared native merchant smoke" || missing=1
require_evidence "MERCH_P0_ANALYTICS_PROOF" "MERCH-P0-ANALYTICS-01 live Supabase smoke and analytics behavior proof" || missing=1

if [[ "${missing}" != "0" ]]; then
  echo
  echo "[Hungry] Release remains No-Go until every evidence key above is set to 1."
  exit 2
fi

echo
echo "[Hungry] Release evidence complete. Repo-local gates and external evidence checks passed."
