import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getPathFromState } from "@react-navigation/core";

import {
  createRootLinking,
  parseAuthCallbackParams,
  parseOrderDeepLinkQuery,
} from "@/app/navigation/linking";

test("Release 0.1 linking exposes authenticated dish and venue entry points only", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  const screens = linking.config.screens as Record<string, unknown>;
  const authStack = screens.AuthStack as { screens: Record<string, string> };

  assert.equal(authStack.screens.ResetPassword, "auth/callback");
  assert.equal(authStack.screens.EmailVerification, undefined);
  // Path params must match the params callers navigate with (dishId/venueId).
  assert.equal(screens.DishDetail, "dish/:dishId");
  assert.equal(screens.StallDetail, "venue/:venueId");
  assert.equal(screens.Post, undefined);
  assert.equal(screens.MerchantTabs, undefined);
  assert.equal(linking.getStateFromPath("order"), undefined);
});

test("order deep link parses venueId query parameter", () => {
  assert.deepEqual(parseOrderDeepLinkQuery("order?venueId=venue-tian-tian"), {
    venueId: "venue-tian-tian",
  });
  assert.deepEqual(parseOrderDeepLinkQuery("order"), {});
  assert.deepEqual(parseOrderDeepLinkQuery("order?venueId=<script>alert(1)</script>"), {});
});

test("fresh users are sent to onboarding before protected catalog deep links", () => {
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

  assert.deepEqual(linking.getStateFromPath("dish/dish-123")?.routes?.[0], {
    name: "OnboardingStack",
    params: { screen: "OnboardingWelcome" },
  });
  assert.deepEqual(capturedRoute, { name: "DishDetail", params: { dishId: "dish-123" } });
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
  assert.deepEqual(capturedRoute, { name: "DishDetail", params: { dishId: "dish-123" } });

  authState = { ...authState, isAuthReady: false };
  assert.equal(linking.getStateFromPath("order"), undefined);

  authState = { ...authState, isAuthReady: true, isAuthenticated: true };
  assert.deepEqual(linking.getStateFromPath("dish/dish-123")?.routes?.[0], {
    name: "DishDetail",
    params: { dishId: "dish-123" },
  });
});

test("deep-link sanitization rejects unsafe and malformed parameters", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  assert.equal(linking.getStateFromPath("dish/<script>alert(1)</script>"), undefined);
  assert.equal(linking.getStateFromPath("dish/"), undefined);
  assert.equal(linking.getStateFromPath("venue/"), undefined);
});

test("venue and dish deep links round-trip with the params callers navigate with", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  assert.deepEqual(linking.getStateFromPath("venue/venue-tian-tian")?.routes?.[0], {
    name: "StallDetail",
    params: { venueId: "venue-tian-tian" },
  });
  const options = linking.config as Parameters<typeof getPathFromState>[1];
  assert.equal(
    getPathFromState(
      { routes: [{ name: "StallDetail", params: { venueId: "venue-tian-tian" } }] },
      options,
    ),
    "/venue/venue-tian-tian",
  );
  assert.equal(
    getPathFromState({ routes: [{ name: "DishDetail", params: { dishId: "dish-1" } }] }, options),
    "/dish/dish-1",
  );
  assert.equal(linking.getStateFromPath("venue/<script>"), undefined);
});

test("password reset callback carries the PKCE code into ResetPassword params", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
    hasCompletedOnboarding: true,
  }));
  assert.deepEqual(linking.getStateFromPath("auth/callback?code=abc-123")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", params: { code: "abc-123" } },
  });
  assert.deepEqual(
    linking.getStateFromPath(
      "auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
    )?.routes?.[0],
    { name: "AuthStack", params: { screen: "ResetPassword", params: { error: "expired" } } },
  );
  assert.deepEqual(linking.getStateFromPath("auth/callback")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword" },
  });
});

test("sign-up confirmation uses a distinct path that opens email verification", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
    hasCompletedOnboarding: false,
  }));
  assert.deepEqual(linking.getStateFromPath("auth/confirm?code=xyz-789")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "EmailVerification", params: { code: "xyz-789" } },
  });
  assert.deepEqual(parseAuthCallbackParams("auth/confirm#error=server_error"), {
    error: "invalid",
  });
  assert.deepEqual(parseAuthCallbackParams("auth/confirm?code=<script>"), { error: "invalid" });
  assert.deepEqual(parseAuthCallbackParams("auth/confirm"), {});
});

test("catalog detail deep links validate kind and id", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  assert.deepEqual(linking.getStateFromPath("catalog/venue/venue-1")?.routes?.[0], {
    name: "CatalogRawDetail",
    params: { kind: "venue", id: "venue-1" },
  });
  assert.equal(linking.getStateFromPath("catalog/menu/venue-1"), undefined);
  assert.equal(linking.getStateFromPath("catalog/dish/<script>"), undefined);
  // Mock provider: legacy dish/venue routes stay on the classic detail screens.
  assert.equal(linking.getStateFromPath("dish/dish-1")?.routes?.[0]?.name, "DishDetail");
  const source = readFileSync(path.join(process.cwd(), "src/app/navigation/linking.ts"), "utf8");
  assert.match(source, /FEATURE_FLAGS\.catalogReadV2/);
  assert.match(source, /getServiceProvider\(\)\.mode === "supabase"/);
});
