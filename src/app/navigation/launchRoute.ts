/**
 * Single source of truth for where the app lands (mandatory sign-in, no guest
 * browsing). Pure so every rule is unit tested (launchRoute.test.ts):
 *
 * - Auth not settled yet, or a password-recovery update in flight → wait.
 * - Onboarding never completed on this device → onboarding (first launch).
 * - Onboarding completed, signed out (returning user / after sign-out) → Login.
 * - Signed in with onboarding completed → the app.
 *
 * Finishing onboarding is a separate transition: a signed-out user who just
 * completed onboarding has no account yet, so they go to Create account
 * (SignUp), not Login. See resolveOnboardingExitRoute.
 */

export type LaunchRouteInput = {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  passwordRecoveryInProgress?: boolean;
};

export type AuthEntryScreen = "Login" | "SignUp";

export type LaunchRoute =
  | { kind: "wait" }
  | { kind: "onboarding" }
  | { kind: "auth"; screen: AuthEntryScreen }
  | { kind: "app" };

export function resolveLaunchRoute(input: LaunchRouteInput): LaunchRoute {
  if (!input.isAuthReady || input.passwordRecoveryInProgress) return { kind: "wait" };
  if (!input.hasCompletedOnboarding) return { kind: "onboarding" };
  if (!input.isAuthenticated) return { kind: "auth", screen: "Login" };
  return { kind: "app" };
}

export function resolveOnboardingExitRoute(input: {
  isAuthenticated: boolean;
}): Extract<LaunchRoute, { kind: "app" } | { kind: "auth" }> {
  return input.isAuthenticated ? { kind: "app" } : { kind: "auth", screen: "SignUp" };
}

export type PreAuthRootRoute =
  | { name: "OnboardingStack"; params: { screen: "OnboardingWelcome" } }
  | { name: "AuthStack"; params: { screen: AuthEntryScreen } };

/** Root route for the signed-out destinations; "app" and "wait" are handled by callers. */
export function getPreAuthRootRoute(
  route: Extract<LaunchRoute, { kind: "onboarding" } | { kind: "auth" }>,
): PreAuthRootRoute {
  return route.kind === "onboarding"
    ? { name: "OnboardingStack", params: { screen: "OnboardingWelcome" } }
    : { name: "AuthStack", params: { screen: route.screen } };
}
