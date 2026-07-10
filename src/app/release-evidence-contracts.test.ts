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
  "POST_COMPOSER_ERROR_BOUNDARY",
  "ANDROID_PERMISSIONS_COMPLETE",
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

const FINAL_CHECKLIST_ZERO_KEYS = [
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
  "NATIVE_MAESTRO_ANDROID_PROOF",
  "UGC_MODERATION_PROOF",
  "SUPABASE_OWNER_PROOF",
  "PUSHED_CI_PROOF",
  "DIRTY_WORKTREE_RECONCILED",
  "SEC_06_RUNTIME_PROOF",
  "MER_PORTAL_01_RUNTIME_PROOF",
  "MERCH_P0_ANALYTICS_PROOF",
] as const;

const FINAL_CHECKLIST_ONE_KEYS = [
  "ANDROID_EAS_PROOF",
  "SENTRY_STAGING_CRASH_PROOF",
  "POST_COMPOSER_ERROR_BOUNDARY",
  "ANDROID_PERMISSIONS_COMPLETE",
] as const;

test("release evidence template, script, and final checklist keep public launch blocked until proof exists", () => {
  const example = readRepoFile("tasks/release-evidence/full-audit-v1.example.env");
  const finalChecklist = readRepoFile("tasks/Roadmap/app-final-go-no-go-checklist.md");
  const releaseScript = readRepoFile("scripts/release_ready_checklist.sh");

  for (const key of REQUIRED_RELEASE_EVIDENCE_KEYS) {
    assert.match(example, new RegExp(`^${key}=[01]$`, "m"));
    assert.match(releaseScript, new RegExp(`require_evidence "${key}"`));
  }

  for (const key of FINAL_CHECKLIST_ZERO_KEYS) {
    assert.match(finalChecklist, new RegExp(`${key}=0`));
  }

  for (const key of FINAL_CHECKLIST_ONE_KEYS) {
    assert.match(finalChecklist, new RegExp(`${key}=1`));
  }

  assert.match(finalChecklist, /Production status:\s+\*\*No-Go\*\*/i);
  assert.match(finalChecklist, /Android\/EAS proof\s+\|\s+.*preview artifact pass/i);
  assert.match(
    finalChecklist,
    /does not prove install\/device\/internal-track\/production readiness/,
  );
  assert.match(finalChecklist, /Android native\/install proof\s+\|\s+blocked/i);
  assert.match(finalChecklist, /Production monitoring proof\s+\|\s+blocked/i);
  assert.match(finalChecklist, /Rollback rehearsal proof\s+\|\s+blocked/i);
  assert.match(finalChecklist, /VoiceOver\/TalkBack smoke\s+\|\s+blocked/i);
});
