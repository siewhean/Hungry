import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking } from "@/app/navigation/linking";

const protectedPaths = ["dish/dish-123", "venue/venue-123"] as const;

test("deferred deep links do not resolve when their release flags are disabled", () => {
  const linking = createRootLinking("hungry://");
  assert.equal(linking.getStateFromPath("order"), undefined);
  assert.equal(linking.getStateFromPath("join/SAFE_CODE"), undefined);
});

test("all main deep links resolve to onboarding for a fresh signed-out user", () => {
  for (const path of protectedPaths) {
    const linking = createRootLinking("hungry://", () => ({
      isAuthReady: true,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
    }));
    assert.deepEqual(linking.getStateFromPath(path)?.routes?.[0], {
      name: "OnboardingStack",
      params: { screen: "OnboardingWelcome" },
    });
  }
});

test("all main deep links resolve to login after local onboarding", () => {
  for (const path of protectedPaths) {
    const linking = createRootLinking("hungry://", () => ({
      isAuthReady: true,
      isAuthenticated: false,
      hasCompletedOnboarding: true,
    }));
    assert.deepEqual(linking.getStateFromPath(path)?.routes?.[0], {
      name: "AuthStack",
      params: { screen: "Login" },
    });
  }
});

test("auth routes remain reachable without an account", () => {
  const linking = createRootLinking("hungry://", () => ({
    isAuthReady: true,
    isAuthenticated: false,
    hasCompletedOnboarding: true,
  }));

  assert.deepEqual(linking.getStateFromPath("login")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login" },
  });
  assert.deepEqual(linking.getStateFromPath("signup")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "SignUp" },
  });
  assert.deepEqual(linking.getStateFromPath("auth/callback")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword" },
  });
});

test("unsafe return destinations are rejected before authentication", () => {
  let captured = false;
  const linking = createRootLinking(
    "hungry://",
    () => ({
      isAuthReady: true,
      isAuthenticated: false,
      hasCompletedOnboarding: true,
    }),
    () => {
      captured = true;
    },
  );

  assert.equal(linking.getStateFromPath("dish/%3Cscript%3Ealert(1)%3C%2Fscript%3E"), undefined);
  assert.equal(linking.getStateFromPath("join/unsafe%20code"), undefined);
  assert.equal(captured, false);
});
