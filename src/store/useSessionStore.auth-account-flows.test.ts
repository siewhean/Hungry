import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  clearPendingSignUp,
  getPendingSignUp,
  setPendingSignUp,
} from "@/features/auth/pendingSignUp";
import { setMockServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSearchStore } from "@/store/useSearchStore";
import { SESSION_EXPIRED_NOTICE, useSessionStore } from "@/store/useSessionStore";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

function resetSession() {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useSessionStore.setState({
    hasHydrated: true,
    isAuthReady: true,
    isAuthenticated: true,
    hasCompletedOnboarding: true,
    authenticatedUserId: "user-1",
    sessionExpired: false,
    passwordRecoveryInProgress: false,
    authNotice: null,
  });
}

test.beforeEach(resetSession);
test.afterEach(() => {
  resetSession();
  clearPendingSignUp();
});

test("every sign-out path clears account-scoped search history and review drafts", () => {
  useSearchStore.getState().rememberSearch("laksa");
  useReviewDraftStore.getState().setText("Great broth");
  assert.ok(useSearchStore.getState().recentSearches.length > 0);

  useSessionStore.getState().signOut();

  assert.equal(useSessionStore.getState().isAuthenticated, false);
  assert.deepEqual(useSearchStore.getState().recentSearches, []);
  assert.equal(useReviewDraftStore.getState().draft.text, "");

  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  assert.match(profileHome, /signOut\(\)/);
});

test("session expiry survives the follow-up SIGNED_OUT event and is consumed once on Login", () => {
  useSessionStore.getState().expireSession();
  useSessionStore.getState().applyAuthStateFromSession({ isAuthenticated: false, userId: null });

  assert.equal(useSessionStore.getState().sessionExpired, true);
  assert.deepEqual(useSessionStore.getState().consumeAuthNotice(), SESSION_EXPIRED_NOTICE);
  assert.equal(useSessionStore.getState().sessionExpired, false);
  assert.equal(useSessionStore.getState().consumeAuthNotice(), null);

  const login = read("src/app/screens/auth/LoginScreen.tsx");
  assert.match(login, /consumeAuthNotice\(\)/);
  assert.match(login, /<InlineBanner message=\{authNotice\.message\}/);
});

test("an account notice set before sign-out is still shown on Login afterwards", () => {
  useSessionStore.getState().setAuthNotice({ message: "Deletion requested", tone: "success" });
  useSessionStore.getState().signOut();

  assert.deepEqual(useSessionStore.getState().consumeAuthNotice(), {
    message: "Deletion requested",
    tone: "success",
  });
  assert.equal(useSessionStore.getState().authNotice, null);
});

test("password recovery hold is session-only state", () => {
  useSessionStore.getState().beginPasswordRecovery();
  assert.equal(useSessionStore.getState().passwordRecoveryInProgress, true);
  useSessionStore.getState().endPasswordRecovery();
  assert.equal(useSessionStore.getState().passwordRecoveryInProgress, false);

  const store = read("src/store/useSessionStore.ts");
  const partialize = store.slice(store.indexOf("partialize:"), store.indexOf("onRehydrateStorage"));
  assert.doesNotMatch(partialize, /passwordRecoveryInProgress|authNotice/);
});

test("pending sign-up credentials are memory-only and email-scoped", () => {
  setPendingSignUp({ email: " New@Hungry.sg ", password: "pw", completedOnboarding: true });
  assert.equal(getPendingSignUp("new@hungry.sg")?.password, "pw");
  assert.equal(getPendingSignUp("other@hungry.sg"), null);
  clearPendingSignUp();
  assert.equal(getPendingSignUp(), null);
  assert.doesNotMatch(
    read("src/features/auth/pendingSignUp.ts"),
    /persistStorage|AsyncStorage|SecureStore|zustand/,
  );
});

test("password reset exchanges the deep-link code without the auth swap unmounting the form", () => {
  const reset = read("src/app/screens/auth/ResetPasswordScreen.tsx");
  assert.match(reset, /const recoveryCode = route\.params\?\.code \?\? ""/);
  assert.match(
    reset,
    /beginPasswordRecovery\(\);[\s\S]*auth\.resetPassword\(codeExchanged \? "" : recoveryCode, password\)/,
  );
  assert.match(reset, /if \(codeExchanged\) session\.signOut\(\);/);

  const appBody = read("src/app/AppBody.tsx");
  assert.match(appBody, /passwordRecoveryInProgress\s*\?\s*mountedNavigatorIsRoot\.current/);

  const success = read("src/app/screens/auth/ResetPasswordSuccessScreen.tsx");
  assert.match(success, /title="Password updated"/);
  assert.doesNotMatch(success, /Resend link|Open email client|We sent/);
  assert.match(success, /endPasswordRecovery\(\)/);
});

test("sign-up confirmation uses its own redirect and real sign-in instead of refreshSession", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(read("src/constants/links.ts"), /emailConfirm: "hungry:\/\/auth\/confirm"/);
  assert.match(service, /emailRedirectTo: AUTH_REDIRECTS\.emailConfirm/);
  assert.doesNotMatch(service, /emailRedirectTo: AUTH_REDIRECTS\.passwordReset/);

  const verification = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  assert.doesNotMatch(verification, /refreshSession/);
  assert.doesNotMatch(verification, /james\.cook@chef\.com/);
  assert.match(verification, /auth\.confirmEmail\(confirmationCode\)/);
  assert.match(verification, /auth\.signIn\(\s*credentials\.email,\s*credentials\.password/);

  assert.match(read("src/app/screens/auth/SignUpScreen.tsx"), /setPendingSignUp\(/);
  assert.match(read("tasks/environment.md"), /hungry:\/\/auth\/confirm/);
});

test("EditProfile sends a reset email instead of opening ResetPassword with a fake code", () => {
  const editProfile = read("src/app/screens/profile/EditProfileScreen.tsx");
  assert.doesNotMatch(editProfile, /profile-settings/);
  assert.doesNotMatch(editProfile, /screen: "ResetPassword"/);
  assert.match(editProfile, /auth\.forgotPassword\(email\)/);
  assert.match(editProfile, /accessibilityLabel="Change profile photo"/);
  assert.match(editProfile, /disabled=\{!trimmedDisplayName\}/);
});

test("account deletion purges locally, records a notice, then signs out; confirms are cross-platform", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const deletion = service.slice(
    service.indexOf("async requestAccountDeletion"),
    service.indexOf("async forgotPassword"),
  );
  assert.doesNotMatch(deletion, /signOut\(\)/);

  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.doesNotMatch(
    settings,
    /Alert\.alert\(\s*"(Sign out|Delete account|Deletion request failed)"/,
  );
  assert.match(settings, /<Dialog\s+visible=\{accountDialog === "signOut"\}/);
  assert.match(settings, /<Dialog\s+visible=\{accountDialog === "deleteAccount"\}/);
  const run = settings.slice(settings.indexOf("const runAccountDeletion"));
  const purgeIndex = run.indexOf("await purgePersistedAccountData()");
  const noticeIndex = run.indexOf("setAuthNotice(");
  const signOutIndex = run.indexOf("signOut();");
  assert.ok(purgeIndex > 0 && purgeIndex < noticeIndex && noticeIndex < signOutIndex);
  assert.match(
    run,
    /try \{\s*await purgePersistedAccountData\(\);\s*\} catch \{\s*purgeFailed = true;/,
  );
});

test("auth submit buttons expose a submitting state to block double submits", () => {
  for (const screen of [
    "LoginScreen",
    "SignUpScreen",
    "ForgotPasswordScreen",
    "ResetPasswordScreen",
  ]) {
    const source = read(`src/app/screens/auth/${screen}.tsx`);
    assert.match(source, /formState: \{ errors, isSubmitting \}/, screen);
    assert.match(source, /loading=\{isSubmitting\}/, screen);
  }
});
