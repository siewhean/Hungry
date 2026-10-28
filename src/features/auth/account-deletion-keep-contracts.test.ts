import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

// Signing in does not cancel a deletion request; only Keep my account
// (cancel_my_account_deletion) does. The copy and the app must both say so.

test("deletion copy says to sign in and choose Keep my account", () => {
  const surfaces = [
    "src/app/screens/profile/SettingsScreen.tsx",
    "marketing/website/web-v2/src/app/privacy/page.tsx",
    "marketing/website/web-v2/src/app/account/delete/page.tsx",
    "supabase/templates/magic_link.html",
  ];
  for (const file of surfaces) {
    const source = read(file);
    assert.match(source, /Keep my account/, file);
    assert.doesNotMatch(
      source,
      /signing back in before then (cancels it|lets you keep)|Sign (back )?in before then to keep/i,
      file,
    );
  }
});

test("a failed deletion check or cancel is asked again on the next foreground", () => {
  const hook = read("src/features/auth/useAccountDeletionGracePrompt.ts");
  assert.match(hook, /AppState\.addEventListener\("change"/);
  assert.match(hook, /if \(state === "active"\) setForegroundCount/);
  assert.match(hook, /\[foregroundCount, isAuthReady, isAuthenticated, userId\]/);
  // Failed fetch, failed cancel, and a check cut short all clear promptedFor.
  assert.match(
    hook,
    /\.catch\(\(error: unknown\) => \{\s*settled = true;\s*reportError\(error, \{ area: "deletion_grace_prompt_load" \}\);\s*retryOnNextForeground\(\);/,
  );
  assert.match(
    hook,
    /\.catch\(\(error: unknown\) => \{\s*reportError\(error, \{ area: "deletion_grace_prompt_cancel" \}\);\s*retryOnNextForeground\(\);\s*Alert\.alert\(/,
  );
  assert.match(hook, /if \(!settled\) retryOnNextForeground\(\);/);
  assert.doesNotMatch(hook, /\.catch\(\(\) => undefined\)/);
});

test("Profile and Settings show a Keep my account banner while deletion is pending", () => {
  const banner = read("src/features/auth/PendingDeletionBanner.tsx");
  assert.match(banner, /auth\.getPendingAccountDeletion\(\)/);
  assert.match(banner, /auth\.cancelAccountDeletion\(\)/);
  assert.match(banner, /label="Keep my account"/);
  assert.match(
    read("src/app/screens/profile/SettingsScreen.tsx"),
    /<PendingDeletionBanner onPendingChange=/,
  );
  assert.match(read("src/app/screens/profile/ProfileHomeScreen.tsx"), /<PendingDeletionBanner \/>/);
});
