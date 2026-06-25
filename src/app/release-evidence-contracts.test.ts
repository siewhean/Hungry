import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const REQUIRED_RELEASE_EVIDENCE_KEYS = [
  "ANDROID_EAS_PROOF",
  "IOS_EAS_PROOF",
  "PRODUCTION_SECRET_PROOF",
  "STORE_CONSOLE_PROOF",
  "APP_STORE_CONNECT_PROOF",
  "PLAY_CONSOLE_PROOF",
  "ASO_METADATA_APPROVAL_PROOF",
  "REVIEWER_NOTES_APPROVAL_PROOF",
  "STORE_SCREENSHOT_RIGHTS_PROOF",
  "STORE_POLICY_CHECKLIST_APPROVAL_PROOF",
  "PUBLIC_PRIVACY_URL_PROOF",
  "PUBLIC_ACCOUNT_DELETION_URL_PROOF",
  "SENTRY_STAGING_CRASH_PROOF",
  "NATIVE_MAESTRO_IOS_PROOF",
  "NATIVE_MAESTRO_ANDROID_PROOF",
  "UGC_MODERATION_PROOF",
  "SUPABASE_OWNER_PROOF",
  "PUSHED_CI_PROOF",
  "DIRTY_WORKTREE_RECONCILED",
  "SEC_06_RUNTIME_PROOF",
  "SEC_08_RUNTIME_PROOF",
  "MER_PORTAL_01_RUNTIME_PROOF",
  "MERCH_P0_ANALYTICS_PROOF",
] as const;

test("release evidence template and final checklist keep public launch blocked until all proof exists", () => {
  const example = readRepoFile("tasks/release-evidence/full-audit-v1.example.env");
  const finalChecklist = readRepoFile("tasks/Roadmap/app-final-go-no-go-checklist.md");
  const releaseScript = readRepoFile("scripts/release_ready_checklist.sh");

  for (const key of REQUIRED_RELEASE_EVIDENCE_KEYS) {
    assert.match(example, new RegExp(`^${key}=0$`, "m"));
  }

  for (const key of [
    "ANDROID_EAS_PROOF",
    "IOS_EAS_PROOF",
    "PRODUCTION_SECRET_PROOF",
    "STORE_CONSOLE_PROOF",
    "APP_STORE_CONNECT_PROOF",
    "PLAY_CONSOLE_PROOF",
    "ASO_METADATA_APPROVAL_PROOF",
    "REVIEWER_NOTES_APPROVAL_PROOF",
    "STORE_SCREENSHOT_RIGHTS_PROOF",
    "STORE_POLICY_CHECKLIST_APPROVAL_PROOF",
    "PUBLIC_PRIVACY_URL_PROOF",
    "PUBLIC_ACCOUNT_DELETION_URL_PROOF",
    "SENTRY_STAGING_CRASH_PROOF",
    "NATIVE_MAESTRO_IOS_PROOF",
    "NATIVE_MAESTRO_ANDROID_PROOF",
    "UGC_MODERATION_PROOF",
    "SUPABASE_OWNER_PROOF",
    "PUSHED_CI_PROOF",
    "DIRTY_WORKTREE_RECONCILED",
  ]) {
    assert.match(releaseScript, new RegExp(`require_evidence "${key}"`));
  }

  for (const key of [
    "IOS_EAS_PROOF",
    "STORE_CONSOLE_PROOF",
    "APP_STORE_CONNECT_PROOF",
    "PLAY_CONSOLE_PROOF",
    "NATIVE_MAESTRO_ANDROID_PROOF",
  ]) {
    assert.match(finalChecklist, new RegExp(`${key}=0`));
  }

  for (const key of [
    "ANDROID_EAS_PROOF",
    "PRODUCTION_SECRET_PROOF",
    "UGC_MODERATION_PROOF",
    "SUPABASE_OWNER_PROOF",
    "PUSHED_CI_PROOF",
    "DIRTY_WORKTREE_RECONCILED",
  ]) {
    assert.match(finalChecklist, new RegExp(`${key}=1`));
  }
});
