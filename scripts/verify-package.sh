#!/usr/bin/env bash
# Pre-PR verification bundle for Hungry build packages.
# Usage:
#   scripts/verify-package.sh [focused-test-file ...]
#   scripts/verify-package.sh --dry-run [focused-test-file ...]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DRY_RUN=0
TESTS=()
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=1
  else
    TESTS+=("$arg")
  fi
done

run_step() {
  local label="$1"
  shift
  echo "==> [verify-package] $label"
  if [ "$DRY_RUN" = 1 ]; then
    echo "    dry-run: $*"
    return 0
  fi
  "$@"
}

if [ "${#TESTS[@]}" -gt 0 ]; then
  run_step "focused tests (${#TESTS[@]})" env \
    HUNGRY_DATA_SOURCE=mock \
    HUNGRY_DISABLE_ASYNC_STORAGE=1 \
    HUNGRY_DISABLE_SECURE_STORE=1 \
    TSX_TSCONFIG_PATH=tsconfig.test.json \
    node --import tsx --test "${TESTS[@]}"
fi

run_step "typecheck" npm run typecheck
run_step "rate-limits" npm run check:rate-limits
run_step "n-plus-one" npm run check:n-plus-one
run_step "race-patterns" npm run audit:races
run_step "staging-functions-manifest" npm run check:staging-functions
run_step "migration-safety" npm run audit:supabase:migration-safety
run_step "whitespace-diff-check" git diff --check
run_step "whitespace-diff-check-staged" git diff --cached --check

echo "==> [verify-package] PASS"
