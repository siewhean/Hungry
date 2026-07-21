import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking, parseOrderDeepLinkQuery } from "@/app/navigation/linking";

test("root linking config exposes authenticated dish, venue, and order entry points", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  const screens = linking.config.screens as Record<string, unknown>;
  const authStack = screens.AuthStack as { screens: Record<string, string> };

  assert.equal(authStack.screens.ResetPassword, "auth/callback");
  assert.equal(screens.DishDetail, "dish/:id");
  assert.equal(screens.StallDetail, "venue/:id");
  assert.equal(screens.Post, "order");
  assert.equal(screens.MerchantTabs, undefined);
});

test("order deep link parses venueId query parameter", () => {
  assert.deepEqual(parseOrderDeepLinkQuery("order?venueId=venue-tian-tian"), {
    venueId: "venue-tian-tian",
  });
  assert.deepEqual(parseOrderDeepLinkQuery("order"), {});
  assert.deepEqual(parseOrderDeepLinkQuery("order?venueId=<script>alert(1)</script>"), {});
});

test("fresh users are sent to onboarding before protected deep links", () => {
  let capturedRoute: { name: string; params?: Record<string, unknown> } | undefined;
  const linking = createRootLinking(
    "exp://127.0.0.1:8081/--/",
    () => ({
      isAuthReady: true,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
    }),
    (route) => {
      capturedRoute = route;
    },
  );

  assert.deepEqual(linking.getStateFromPath("order")?.routes?.[0], {
    name: "OnboardingStack",
    params: { screen: "OnboardingWelcome" },
  });
  assert.equal(capturedRoute?.name, "Post");
});

test("onboarded signed-out users are sent to login and retain a safe return route", () => {
  let authState = {
    isAuthReady: true,
    isAuthenticated: false,
    hasCompletedOnboarding: true,
  };
  let capturedRoute: { name: string; params?: Record<string, unknown> } | undefined;
  const linking = createRootLinking(
    "exp://127.0.0.1:8081/--/",
    () => authState,
    (route) => {
      capturedRoute = route;
    },
  );

  assert.deepEqual(linking.getStateFromPath("dish/dish-123")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login" },
  });
  assert.deepEqual(capturedRoute, { name: "DishDetail", params: { id: "dish-123" } });

  authState = { ...authState, isAuthReady: false };
  assert.equal(linking.getStateFromPath("order"), undefined);

  authState = { ...authState, isAuthReady: true, isAuthenticated: true };
  assert.deepEqual(linking.getStateFromPath("dish/dish-123")?.routes?.[0], {
    name: "DishDetail",
    params: { id: "dish-123" },
  });
});

test("deep-link sanitization rejects unsafe and malformed parameters", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  assert.equal(linking.getStateFromPath("dish/<script>alert(1)</script>"), undefined);
  assert.equal(linking.getStateFromPath("dish/"), undefined);
  assert.equal(linking.getStateFromPath("venue/"), undefined);
});
