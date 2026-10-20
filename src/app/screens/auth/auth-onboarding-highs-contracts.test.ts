import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { createRootLinking } from "@/app/navigation/linking";
import { completeVerifiedSignUp } from "@/features/auth/completeVerifiedSignUp";
import { rememberShareAttribution, getShareAttribution } from "@/features/share/shareAttribution";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("H106: the signup confirmation link is exchanged for a session, not refreshSession()", async () => {
  const linking = createRootLinking("hungry://");
  const code = "4f1c2b7e-1a2b-4c3d-9e8f-0a1b2c3d4e5f";
  assert.deepEqual(linking.getStateFromPath(`auth/confirm?code=${code}`)?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "EmailVerification", params: { code }, pop: true },
  });

  const screen = read("src/app/screens/auth/EmailVerificationScreen.tsx");
  assert.match(screen, /getHungryService\(\)\.auth\.confirmEmail\(code\)/);
  assert.doesNotMatch(screen, /refreshSession|I Verified My Email|james\.cook@chef\.com/);
  assert.match(
    read("src/lib/services/supabase/supabaseService.ts"),
    /async confirmEmail\(code\) \{\s*const client = requireSupabaseClient\(\);\s*const \{ error \} = await client\.auth\.exchangeCodeForSession\(code\);/,
  );

  const session = await getHungryService().auth.confirmEmail("mock-confirmation");
  assert.ok(session.profile);
});

test("H108/H110: a reset holds the signed-in redirect until the success screen continues", () => {
  const navigator = read("src/app/navigation/RootNavigator.tsx");
  assert.match(
    navigator,
    /if \(currentTopRoute === "AuthStack"\) \{[\s\S]*?if \(passwordRecoveryInProgress\) \{\s*return;/,
  );
  const reset = read("src/app/screens/auth/ResetPasswordScreen.tsx");
  assert.match(
    reset,
    /setPasswordRecoveryInProgress\(true\);[\s\S]*exchangeRecoveryCode\([\s\S]*updatePassword\(/,
  );
  // Only a failed exchange (no session) releases the hold; a rejected password keeps it.
  assert.match(
    reset,
    /exchangeRecoveryCode\([^)]*\);\s*recoveryCodeExchangedRef\.current = true;\s*\} catch \(error\) \{[\s\S]*?setPasswordRecoveryInProgress\(false\);/,
  );
  const updateCatch = reset.match(
    /await auth\.updatePassword\(password\);\s*\} catch \(error\) \{([\s\S]*?)\n {6}\}/,
  );
  assert.ok(updateCatch, "updatePassword failure is handled");
  assert.doesNotMatch(updateCatch[1], /setPasswordRecoveryInProgress\(false\)/);
  assert.match(updateCatch[1], /getPasswordUpdateErrorMessage\(error\)/);
  assert.match(reset, /if \(!recoveryCodeExchangedRef\.current\)/);

  const success = read("src/app/screens/auth/ResetPasswordSuccessScreen.tsx");
  assert.match(success, /title="Password updated"/);
  assert.match(success, /label="Continue"/);
  assert.match(success, /setPasswordRecoveryInProgress\(false\)/);
  assert.doesNotMatch(success, /Check your inbox|Open email client|Resend link|Reset link resent/);
});

test("H109: sign_up_completed is logged once from the session store with share attribution", async () => {
  clearTrackedAnalyticsEvents();
  rememberShareAttribution({ source: "whatsapp", route: "DishDetail" });
  useSessionStore.getState().completeAuth({ authProvider: "email", isNewUser: true });
  useSessionStore.getState().completeAuth({ authProvider: "email" });
  await new Promise((done) => setTimeout(done, 20));

  const events = getTrackedAnalyticsEvents();
  const signUps = events.filter((record) => record.event === "sign_up_completed");
  assert.equal(signUps.length, 1);
  assert.equal(signUps[0]?.properties.share_source, "whatsapp");
  assert.equal(
    events.filter((record) => record.event === "sign_in_completed").length,
    0,
    "the same login must not also count as a sign-in",
  );
  assert.equal(getShareAttribution(), null);
  useSessionStore.getState().signOut();

  const bootstrap = read("src/hooks/useAppBootstrap.ts");
  assert.match(bootstrap, /const isNewUser = event === "SIGNED_IN" && isFirstSignIn\(user\)/);
  // An existing account that signs in skips first-run onboarding; a new one runs it.
  assert.match(bootstrap, /completedOnboarding: isFreshSignIn && !isNewUser \? true : undefined/);
});

test("H109: a SIGNED_IN replayed for a restored session does not log sign_up_completed", async () => {
  useSessionStore.getState().signOut();
  await new Promise((done) => setTimeout(done, 20));
  // Cold start: the persisted session is already authenticated, and the
  // in-memory dedupe has been reset.
  useSessionStore.setState({ isAuthenticated: true, authenticatedUserId: "restored-user" });
  clearTrackedAnalyticsEvents();
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: "restored-user",
    authProvider: "email",
    isNewUser: true,
  });
  await new Promise((done) => setTimeout(done, 20));
  assert.equal(
    getTrackedAnalyticsEvents().filter((record) => record.event === "sign_up_completed").length,
    0,
  );
  useSessionStore.getState().signOut();
});

test("H111/H112/H113/H114/H120/H121: auth forms hide disabled OAuth, autofill, show loading and avoid the keyboard", () => {
  const input = read("src/components/ui/Input.tsx");
  assert.doesNotMatch(input, /isSecureField \? "off"/);

  const screen = read("src/components/ui/Screen.tsx");
  assert.match(screen, /keyboardShouldPersistTaps="handled"/);
  assert.match(screen, /keyboardAvoiding \? \(\s*<KeyboardAvoidingView/);
  const shell = read("src/app/screens/auth/AuthScreenShell.tsx");
  assert.match(shell, /<Screen keyboardAvoiding>/);
  assert.doesNotMatch(shell, /contentOffsetTop|scroll=\{scroll\}/);

  const onboardingAuth = read("src/app/screens/onboarding/OnboardingAuthScreen.tsx");
  assert.match(onboardingAuth, /\{oauthEnabled \? \(/);
  assert.doesNotMatch(onboardingAuth, /disabled=\{!oauthEnabled\}/);
  assert.match(onboardingAuth, /<KeyboardAvoidingView/);
  assert.match(onboardingAuth, /keyboardShouldPersistTaps="handled"/);
  assert.match(onboardingAuth, /loading=\{signUpForm\.formState\.isSubmitting\}/);
  assert.match(onboardingAuth, /loading=\{loginForm\.formState\.isSubmitting\}/);
  assert.match(onboardingAuth, /autoCorrect=\{false\}/);
  assert.match(onboardingAuth, /autoComplete="new-password"/);

  for (const path of [
    "src/app/screens/auth/ForgotPasswordScreen.tsx",
    "src/app/screens/auth/ResetPasswordScreen.tsx",
  ]) {
    assert.match(read(path), /loading=\{isSubmitting\}/, path);
  }
});

test("H115/H116: quiz answers stay a draft until finish and a Profile retake starts from the saved vector", () => {
  const quiz = read("src/app/screens/onboarding/TasteQuizScreen.tsx");
  assert.equal(quiz.match(/setTasteVector\(/g)?.length, 1);
  assert.match(quiz, /flowMode === "profile" \? profile\.tasteVector : INITIAL/);
});

test("H117: cuisines picked before the cuisine step was cut are still sent with the quiz response", () => {
  assert.ok(
    !existsSync(resolve(process.cwd(), "src/app/screens/onboarding/CuisineSelectionScreen.tsx")),
  );
  assert.match(
    read("src/app/screens/onboarding/TasteQuizScreen.tsx"),
    /cuisineIds: profile\.onboardingCuisineIds \?\? \[\]/,
  );
});

test("H119: picking a location from Settings returns there instead of re-completing onboarding", () => {
  const picker = read("src/app/screens/onboarding/ManualLocationPickerScreen.tsx");
  assert.match(
    picker,
    /if \(!isOnboarding\) \{[\s\S]*?navigation\.goBack\(\);\s*return;\s*\}[\s\S]*?navigation\.navigate\("TasteQuiz"\);/,
  );
});

test("H122: onboarding_completed fires once and a returning user's onboarding state is kept", () => {
  clearTrackedAnalyticsEvents();
  useSessionStore.setState({ hasCompletedOnboarding: false, hasSkippedTasteQuiz: false });
  useSessionStore.getState().completeOnboarding(true);
  useSessionStore.getState().completeOnboarding(false);

  const completions = getTrackedAnalyticsEvents().filter(
    (record) => record.event === "onboarding_completed",
  );
  assert.equal(completions.length, 1);
  assert.equal(completions[0]?.properties.skipped_quiz, true);
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
  assert.equal(useSessionStore.getState().hasSkippedTasteQuiz, true);
});

test("H122: a guest who signs up from onboarding and confirms their email completes onboarding once", () => {
  clearTrackedAnalyticsEvents();
  useSessionStore.setState({
    hasCompletedOnboarding: false,
    hasSkippedTasteQuiz: true,
    isAuthenticated: false,
  });

  // EmailVerification's confirm for a sign-up that started in OnboardingAuth.
  completeVerifiedSignUp(true);

  const completions = getTrackedAnalyticsEvents().filter(
    (record) => record.event === "onboarding_completed",
  );
  assert.equal(completions.length, 1);
  assert.equal(completions[0]?.properties.skipped_quiz, true);
  const session = useSessionStore.getState();
  assert.equal(session.hasCompletedOnboarding, true);
  assert.equal(session.hasSkippedTasteQuiz, true);
  assert.equal(session.isAuthenticated, true);

  // A plain SignUp confirmation does not complete onboarding.
  clearTrackedAnalyticsEvents();
  useSessionStore.setState({ hasCompletedOnboarding: false, isAuthenticated: false });
  completeVerifiedSignUp(false);
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, false);
  assert.equal(
    getTrackedAnalyticsEvents().filter((record) => record.event === "onboarding_completed").length,
    0,
  );
});
