import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking } from "@/app/navigation/linking";

const protectedPaths = ["dish/dish-123", "venue/venue-123"] as const;

test("order and wheel join links resolve for signed-in users when their surfaces ship", () => {
  const linking = createRootLinking("hungry://");
  assert.equal(linking.getStateFromPath("order")?.routes?.[0]?.name, "Post");
  assert.deepEqual(linking.getStateFromPath("join/SAFE_CODE")?.routes?.[0], {
    name: "WheelStack",
    // WheelHome reads the join code from its own params.
    params: { screen: "WheelHome", params: { code: "SAFE_CODE" } },
  });
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
    params: { screen: "Login", pop: true },
  });
  assert.deepEqual(linking.getStateFromPath("signup")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "SignUp", pop: true },
  });
  assert.deepEqual(linking.getStateFromPath("auth/callback")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", pop: true },
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
