#!/usr/bin/env bash
set -euo pipefail

echo "[Hungry] Release readiness checklist"
echo

echo "1) Typecheck"
npm run typecheck
echo

echo "2) Tests"
npm test -- --watch=false
echo

echo "3) Expo doctor (writable cache override)"
NPM_CONFIG_CACHE=/tmp/hungry-npm-cache npx expo-doctor
echo

echo "4) Manual verification reminder"
echo "- Run iOS + Android smoke for Auth, Discover->Stall->Dish, Review, Post Composer"
echo "- Verify no reviewer-visible mock/placeholder copy in release path"
echo "- Confirm App Store/Play metadata and privacy/account deletion links are current"
echo

echo "Checklist execution complete."
