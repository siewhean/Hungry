import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createRootLinking } from "@/app/navigation/linking";
import {
  AUTH_OFFLINE_MESSAGE,
  AUTH_RATE_LIMITED_MESSAGE,
  getAuthErrorKind,
  getAuthFailureMessage,
} from "@/features/auth/authErrors";
import { formatCooldown } from "@/features/auth/useResendCooldown";
import { hungryService } from "@/lib/services/mock/mockService";
import { useSessionStore } from "@/store/useSessionStore";
import { AUTH_COPY, getSignUpProviderSuccessMessage } from "./authCopy";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
  isAuthReady: true,
  isAuthenticated: false,
}));

// ── M1 ───────────────────────────────────────────────────────────────────────

test("auth-M1: a profile read that fails after sign-in does not fail the sign-in", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const toAppSession = service.slice(
    service.indexOf("async function toAppSession("),
    service.indexOf("function provisionalProfileFromAuthSession"),
  );
  assert.match(
    toAppSession,
    /try \{\s*return toAppSessionFromAuthSession\(session, await hydrateProfile\(\)\);/,
  );
  assert.match(
    toAppSession,
    /\} catch \{[\s\S]*provisionalProfileFromAuthSession\(session\)[\s\S]*profileReady/,
  );
});

// ── M2 / L5 / L6 / L17 ───────────────────────────────────────────────────────

test("auth-M2: signing up never says 'Account created' before the email is confirmed", () => {
  assert.equal(AUTH_COPY.signUp.emailVerificationToast, "Check your email");
  const verify = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  assert.match(verify, /Already have an account\?/);
  assert.match(verify, /label="Sign in"[\s\S]*navigate\("Login", \{ email \}\)/);
  assert.match(verify, /label="Reset password"[\s\S]*navigate\("ForgotPassword"\)/);
});

test("auth-L5: one wording for sign in, sentence case, no unused strings", () => {
  const copy = read("src/app/screens/auth/authCopy.ts");
  assert.doesNotMatch(copy, /Log in|Back to login|OR USE EMAIL|helperText:|emailPlaceholder/);
  assert.equal(AUTH_COPY.signUp.footerAction, "Sign in");
  assert.equal(AUTH_COPY.forgotPassword.backToLogin, "Back to sign in");
  assert.equal(getSignUpProviderSuccessMessage("google"), "Signed in with Google");
  assert.doesNotMatch(
    read("src/app/screens/auth/EmailVerificationScreen.tsx"),
    /Change Email Address/,
  );
  assert.throws(() => read("src/features/auth/authContent.ts"));
});

test("auth-L6: the verify screen has one primary action", () => {
  const verify = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  assert.doesNotMatch(verify, /<Button/);
  assert.match(verify, /label="I've confirmed my email"/);
  assert.match(read("src/features/auth/EmailCodeField.tsx"), /<Button/);
});

test("auth-L17/L16: pushed auth screens get a back control and a theme-aware wordmark", () => {
  const shell = read("src/app/screens/auth/AuthScreenShell.tsx");
  assert.match(shell, /onBack\?: \(\) => void/);
  assert.match(shell, /wordmarkColor \?\? palette\.text/);
  assert.doesNotMatch(shell, /palette\.navy;/);
  for (const screen of ["SignUpScreen", "EmailVerificationScreen", "ResetPasswordScreen"]) {
    assert.match(read(`src/app/screens/auth/${screen}.tsx`), /onBack=\{/, screen);
  }
  for (const screen of [
    "LoginScreen",
    "SignUpScreen",
    "ForgotPasswordScreen",
    "ResetPasswordScreen",
  ]) {
    assert.doesNotMatch(read(`src/app/screens/auth/${screen}.tsx`), /wordmarkColor=/, screen);
  }
});

// ── M3 / L4 ──────────────────────────────────────────────────────────────────

test("auth-M3/L4: the name field says it is public; fields have visible labels and 44pt targets", () => {
  assert.equal(AUTH_COPY.signUp.displayNameLabel, "Name shown on your reviews");
  assert.match(AUTH_COPY.signUp.displayNameHelper, /nickname/i);
  for (const screen of ["LoginScreen", "SignUpScreen", "ForgotPasswordScreen"]) {
    const source = read(`src/app/screens/auth/${screen}.tsx`);
    assert.match(source, /label=\{AUTH_COPY\./, screen);
    assert.doesNotMatch(source, /placeholder=\{AUTH_COPY/, screen);
  }
  const eye = read("src/app/screens/auth/authEyeButton.ts");
  assert.match(eye, /minHeight: 44/);
  assert.match(eye, /minWidth: 44/);
  for (const screen of ["LoginScreen", "SignUpScreen", "ResetPasswordScreen"]) {
    assert.match(
      read(`src/app/screens/auth/${screen}.tsx`),
      /style=\{AUTH_EYE_BUTTON_STYLE\}/,
      screen,
    );
  }
  const login = read("src/app/screens/auth/LoginScreen.tsx");
  assert.match(login, /accessibilityHint="Opens the account creation screen"[\s\S]*?minHeight: 44/);
});

// ── M4 ───────────────────────────────────────────────────────────────────────

test("auth-M4: an email change has its own redirect and screen, not the sign-up path", () => {
  const code = "4f1c2b7e-1a2b-4c3d-9e8f-0a1b2c3d4e5f";
  assert.deepEqual(linking.getStateFromPath(`auth/email-change?code=${code}`)?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "EmailChange", params: { code }, pop: true },
  });
  assert.match(read("src/constants/links.ts"), /emailChange: "hungry:\/\/auth\/email-change"/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /\{ email: newEmail\.trim\(\)\.toLowerCase\(\) \},\s*\{ emailRedirectTo: AUTH_REDIRECTS\.emailChange \}/,
  );
  assert.match(read("supabase/config.toml"), /"hungry:\/\/auth\/email-change"/);
  const screen = read("src/app/screens/auth/EmailChangeScreen.tsx");
  assert.doesNotMatch(screen, /completeVerifiedSignUp|Welcome to Hungry/);
  assert.match(read("src/app/screens/auth/AuthStack.tsx"), /name="EmailChange"/);
});

// ── M5 / L15 ─────────────────────────────────────────────────────────────────

test("auth-M5: email sign-in leaves the onboarding decision to the account, not the screen", () => {
  const login = read("src/app/screens/auth/LoginScreen.tsx");
  assert.doesNotMatch(login, /completeAuth\(\{ completedOnboarding: true \}\)/);
  assert.match(login, /completedOnboarding: getConfiguredDataSource\(\) !== "supabase"/);
  const store = read("src/store/useSessionStore.ts");
  assert.match(store, /function markAccountOnboarded\(\)/);
  assert.match(store, /markOnboarded\(\)/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /async markOnboarded\(\) \{[\s\S]*?data: \{ onboarded_at: new Date\(\)\.toISOString\(\) \}/,
  );
  assert.doesNotMatch(read("src/hooks/useAppBootstrap.ts"), /isFirstSignIn/);
});

test("auth-L15: a reset-link sign-in counts as an existing account", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  assert.match(
    bootstrap,
    /\(event === "SIGNED_IN" \|\| event === "PASSWORD_RECOVERY"\) &&\s*!useSessionStore\.getState\(\)\.isAuthenticated/,
  );
  assert.match(bootstrap, /!useSessionStore\.getState\(\)\.passwordRecoveryInProgress/);
});

// ── M6 / L14 / L12 ───────────────────────────────────────────────────────────

test("auth-M6: reset links report errors, and a dead link is shown before any typing", () => {
  assert.deepEqual(
    linking.getStateFromPath("auth/reset?error=access_denied&error_code=otp_expired")?.routes?.[0],
    {
      name: "AuthStack",
      params: { screen: "ResetPassword", params: { linkError: "expired" }, pop: true },
    },
  );
  assert.deepEqual(
    linking.getStateFromPath("auth/reset#error=access_denied&error_code=other")?.routes?.[0],
    {
      name: "AuthStack",
      params: { screen: "ResetPassword", params: { linkError: "invalid" }, pop: true },
    },
  );
  const reset = read("src/app/screens/auth/ResetPasswordScreen.tsx");
  // Exchanged on mount, not on submit; no code and no verified recovery means expired at once.
  assert.match(reset, /useEffect\(\(\) => \{[\s\S]*?void exchangeLinkCode\(\)/);
  assert.match(
    reset,
    /if \(!recoveryCodeExchangedRef\.current && !route\.params\?\.code\) \{\s*setLinkProblem\("expired"\)/,
  );
  assert.match(reset, /AuthPKCECodeVerifierMissingError/);
  assert.match(reset, /8-digit code/);
});

test("auth-L14: leaving reset with a recovery session signs it out", () => {
  const reset = read("src/app/screens/auth/ResetPasswordScreen.tsx");
  assert.match(reset, /hasRecoverySession \? "Cancel" : "Back to sign in"/);
  assert.match(
    reset,
    /const leaveReset = \(\) => \{\s*if \(hasRecoverySession[\s\S]*?\.signOut\(\);/,
  );
});

test("auth-L12: demo reset button, mock branches in screens and the reset/success link are gone", async () => {
  assert.doesNotMatch(read("src/app/screens/auth/ForgotPasswordScreen.tsx"), /\(demo\)/);
  assert.doesNotMatch(read("src/app/screens/auth/LoginScreen.tsx"), /getMockLoginFailure/);
  assert.doesNotMatch(read("src/app/screens/auth/SignUpScreen.tsx"), /getMockSignUpFailure/);
  assert.doesNotMatch(
    read("src/app/screens/onboarding/OnboardingAuthScreen.tsx"),
    /getMockSignUpFailure/,
  );
  assert.equal(linking.getStateFromPath("auth/reset/success"), undefined);
  const screens = linking.config.screens as unknown as Record<
    string,
    { screens: Record<string, string> }
  >;
  const authStack = screens.AuthStack;
  assert.equal(authStack.screens.ResetPasswordSuccess, undefined);

  // The mock service now raises the failures with supabase-js error shapes.
  await assert.rejects(
    () => hungryService.auth.signIn("fail-user@hungry.sg", "pw"),
    (error: { code?: string }) => error.code === "invalid_credentials",
  );
  await assert.rejects(
    () => hungryService.auth.signIn("offline@hungry.sg", "pw"),
    (error: unknown) => getAuthErrorKind(error) === "offline",
  );
  await assert.rejects(
    () => hungryService.auth.signUp("taken@hungry.sg", "pw", "Name"),
    (error: { code?: string }) => error.code === "user_already_exists",
  );
  await hungryService.auth.signOut();
});

// ── M7 / L7 ──────────────────────────────────────────────────────────────────

test("auth-M7/L7: server errors are one inline banner, and OnboardingAuth draws real field errors", () => {
  for (const screen of ["LoginScreen", "SignUpScreen"]) {
    const source = read(`src/app/screens/auth/${screen}.tsx`);
    assert.match(source, /accessibilityRole="alert"/, screen);
    assert.doesNotMatch(
      source,
      /setFormError\([^;]*\);\s*showToast\(\{ message, tone: "error" \}\)/,
      screen,
    );
  }
  const onboarding = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  assert.match(onboarding, /<AuthTermsNotice \/>/);
  assert.match(onboarding, /accessibilityRole="alert"/);
  assert.match(onboarding, /error=\{!!signUpErrors\.email\}/);
  assert.match(onboarding, /error=\{!!loginErrors\.password\}/);
  assert.doesNotMatch(
    onboarding,
    /showToast\(\{ message: (WEAK_PASSWORD_MESSAGE|AUTH_COPY\.login\.genericErrorToast)/,
  );
});

// ── M8 ───────────────────────────────────────────────────────────────────────

test("auth-M8: the guest sheet offers sign-up and sign-in, and a dish save survives a cold start", () => {
  const sheet = read("src/features/auth/SignInPromptSheet.tsx");
  assert.match(sheet, /label="Create account"/);
  assert.match(sheet, /label="Sign in"/);
  assert.match(sheet, /params: \{ title \}/);
  assert.match(sheet, /clearPendingDishSave\(\)/);
  assert.match(
    read("src/app/screens/auth/LoginScreen.tsx"),
    /route\.params\?\.title \?\? AUTH_COPY\.login\.title/,
  );
  assert.match(
    read("src/app/screens/detail/DishDetailScreenV2.tsx"),
    /if \(!isAuthenticated\) rememberPendingDishSave\(dish\)/,
  );
  assert.match(read("src/store/useSessionStore.ts"), /returnRoute: state\.returnRoute,/);
});

// ── M9 / L10 ─────────────────────────────────────────────────────────────────

test("auth-L10: offline and rate-limit failures get their own message", () => {
  const offline = Object.assign(new Error("Failed to fetch"), {
    name: "AuthRetryableFetchError",
    status: 0,
  });
  assert.equal(getAuthErrorKind(offline), "offline");
  assert.equal(getAuthErrorKind(new TypeError("Network request failed")), "offline");
  assert.equal(getAuthErrorKind({ status: 429 }), "rate_limited");
  assert.equal(getAuthErrorKind({ code: "over_email_send_rate_limit" }), "rate_limited");
  assert.equal(getAuthErrorKind({ code: "invalid_credentials", status: 400 }), "other");
  assert.equal(getAuthFailureMessage(offline, "x"), AUTH_OFFLINE_MESSAGE);
  assert.equal(getAuthFailureMessage({ status: 429 }, "x"), AUTH_RATE_LIMITED_MESSAGE);
  assert.equal(getAuthFailureMessage(new Error("boom"), "fallback"), "fallback");
  for (const file of [
    "src/app/screens/auth/LoginScreen.tsx",
    "src/app/screens/auth/SignUpScreen.tsx",
    "src/app/screens/auth/ForgotPasswordScreen.tsx",
    "src/app/screens/onboarding/OnboardingAuthScreen.tsx",
  ]) {
    assert.match(read(file), /getAuthFailureMessage\(/, file);
  }
  // The code box no longer calls every failure "wrong or expired".
  assert.match(
    read("src/features/auth/EmailCodeField.tsx"),
    /getAuthFailureMessage\(error, errorText\)/,
  );
});

test("auth-M9: Send again waits out the server's 60s limit and the sent state has one primary action", () => {
  const forgot = read("src/app/screens/auth/ForgotPasswordScreen.tsx");
  assert.match(forgot, /useResendCooldown\(false\)/);
  assert.match(forgot, /disabled=\{resendSeconds > 0 \|\| isSubmitting\}/);
  assert.match(forgot, /getAuthErrorKind\(error\) === "rate_limited"\) restartResendCooldown\(\)/);
  const sentState = forgot.slice(
    forgot.indexOf("{sentTo ? ("),
    forgot.indexOf(") : (\n          <View"),
  );
  assert.doesNotMatch(
    sentState,
    /<Button\s+label=\{AUTH_COPY\.forgotPassword\.(resend|useDifferent)/,
  );
  assert.equal(formatCooldown(65), "1:05");
  assert.equal(formatCooldown(9), "0:09");
  assert.match(
    read("src/app/screens/auth/EmailVerificationScreen.tsx"),
    /useResendCooldown\(true\)/,
  );
});

// ── L1 / L2 / L13 ────────────────────────────────────────────────────────────

test("auth-L1/L2/L13: config.toml enforces the recorded decisions", () => {
  const config = read("supabase/config.toml");
  assert.match(config, /\[auth\.email\][\s\S]*?secure_password_change = true/);
  assert.match(config, /\[auth\.mfa\.totp\]\s*enroll_enabled = false\s*verify_enabled = false/);
  assert.doesNotMatch(config, /^\s*"https:\/\/hungry-\*/m);
  // CAPTCHA stays a documented, disabled template: turning it on needs site keys first.
  assert.doesNotMatch(config, /^\[auth\.captcha\]/m);
  assert.match(config, /auth-L13/);
});

// ── L3 ───────────────────────────────────────────────────────────────────────

test("auth-L3: the counter guard also holds favourites_count", () => {
  const migration = read("supabase/migrations/20261022010000_guard_favourites_count.sql");
  assert.match(migration, /new\.favourites_count := old\.favourites_count;/);
  assert.match(migration, /new\.favourites_count := 0;/);
  assert.match(read("supabase/smoke/guard_favourites_count.sql"), /rollback;\s*$/);
});

// ── L8 / L11 ─────────────────────────────────────────────────────────────────

test("auth-L8: an unrequested sign-out is reported as an expired session", () => {
  useSessionStore.getState().signOut();
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: false,
    userId: null,
    sessionExpired: true,
  });
  assert.equal(useSessionStore.getState().sessionExpired, true);
  assert.equal(useSessionStore.getState().isAuthenticated, false);

  // A sign-out the user asked for (signOutPending) is not an expiry.
  useSessionStore.getState().signOut();
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "user-1" });
  useSessionStore.setState({ signOutPending: true });
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: false,
    userId: null,
    sessionExpired: true,
  });
  assert.equal(useSessionStore.getState().sessionExpired, false);
  useSessionStore.getState().signOut();

  assert.match(
    read("src/app/navigation/RootNavigator.tsx"),
    /if \(sessionExpired && navigationRef\.isReady\(\)\) \{[\s\S]*?showToast\(\{[\s\S]*?dismissSessionExpiry\(\)/,
  );
  assert.match(read("src/app/screens/profile/SettingsScreen.tsx"), /expectSignOut\(\);/);
});

test("auth-L11: restoring the session cannot hold Splash for longer than a few seconds", () => {
  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  assert.match(bootstrap, /AUTH_RESTORE_TIMEOUT_MS = 5000/);
  assert.match(bootstrap, /Promise\.race\(\[client\.auth\.getSession\(\), timeout\]\)/);
  // The timeout looks like a network failure, so the restored state is kept.
  assert.match(bootstrap, /name: "AuthRetryableFetchError",\s*status: 0/);
});

// ── L9 ───────────────────────────────────────────────────────────────────────

test("auth-L9: change password suits password managers and reports real errors", () => {
  const screen = read("src/app/screens/profile/ChangePasswordScreen.tsx");
  assert.match(screen, /textContentType="password"[\s\S]*autoComplete="current-password"/);
  assert.match(screen, /textContentType="newPassword"[\s\S]*autoComplete="new-password"/);
  assert.match(screen, /Show passwords/);
  assert.match(screen, /Forgot current password\?/);
  assert.match(screen, /getAuthFailureMessage\(/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /getAuthErrorCode\(reauthError\) === "invalid_credentials"\) \{\s*throw new Error\("Current password is incorrect\."\);\s*\}\s*throw reauthError;/,
  );
});
