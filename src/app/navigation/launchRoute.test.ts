import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getPreAuthRootRoute,
  resolveLaunchRoute,
  resolveOnboardingExitRoute,
} from "@/app/navigation/launchRoute";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const ready = { isAuthReady: true, isAuthenticated: false, hasCompletedOnboarding: false };

test("fresh install (no onboarding, no session) launches onboarding first", () => {
  assert.deepEqual(resolveLaunchRoute(ready), { kind: "onboarding" });
});

test("returning signed-out user (onboarding done) launches Login, not onboarding", () => {
  assert.deepEqual(resolveLaunchRoute({ ...ready, hasCompletedOnboarding: true }), {
    kind: "auth",
    screen: "Login",
  });
});

test("signed-in user with onboarding done launches the app", () => {
  assert.deepEqual(
    resolveLaunchRoute({ ...ready, isAuthenticated: true, hasCompletedOnboarding: true }),
    { kind: "app" },
  );
});

test("signed-in user without local onboarding finishes onboarding first", () => {
  assert.deepEqual(resolveLaunchRoute({ ...ready, isAuthenticated: true }), {
    kind: "onboarding",
  });
});

test("launch waits while auth is settling or a password recovery is in flight", () => {
  assert.deepEqual(resolveLaunchRoute({ ...ready, isAuthReady: false }), { kind: "wait" });
  assert.deepEqual(
    resolveLaunchRoute({
      isAuthReady: true,
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      passwordRecoveryInProgress: true,
    }),
    { kind: "wait" },
  );
});

test("finishing onboarding signed out goes to Create account; signed in goes to the app", () => {
  assert.deepEqual(resolveOnboardingExitRoute({ isAuthenticated: false }), {
    kind: "auth",
    screen: "SignUp",
  });
  assert.deepEqual(resolveOnboardingExitRoute({ isAuthenticated: true }), { kind: "app" });
});

test("pre-auth destinations map to the mounted root routes", () => {
  assert.deepEqual(getPreAuthRootRoute({ kind: "onboarding" }), {
    name: "OnboardingStack",
    params: { screen: "OnboardingWelcome" },
  });
  assert.deepEqual(getPreAuthRootRoute({ kind: "auth", screen: "SignUp" }), {
    name: "AuthStack",
    params: { screen: "SignUp" },
  });
});

test("Splash, RootNavigator, linking and the onboarding exit all use the launch resolver", () => {
  assert.match(read("src/app/screens/SplashScreen.tsx"), /resolveLaunchRoute\(/);
  const root = read("src/app/navigation/RootNavigator.tsx");
  assert.match(root, /resolveLaunchRoute\(/);
  assert.match(root, /resolveOnboardingExitRoute\(/);
  assert.match(read("src/app/navigation/linking.ts"), /resolveLaunchRoute\(/);
  const finish = read("src/app/screens/onboarding/finishLocationStep.ts");
  assert.match(finish, /resolveOnboardingExitRoute\(/);
  assert.match(finish, /getPreAuthRootRoute\(/);
});
