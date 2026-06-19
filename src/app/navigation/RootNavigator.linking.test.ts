import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking, parseOrderDeepLinkQuery } from "@/app/navigation/linking";

test("root linking config exposes public dish, venue, and order entry points", () => {
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

test("deep link state rejects unsafe params and redirects protected links after auth is ready", () => {
  let authState = { isAuthReady: true, isAuthenticated: false };
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => authState);
  const getStateFromPath = linking.getStateFromPath;
  assert.equal(typeof getStateFromPath, "function");

  const protectedState = getStateFromPath("order");
  assert.deepEqual(protectedState?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login" },
  });

  authState = { isAuthReady: false, isAuthenticated: false };
  assert.equal(getStateFromPath("order"), undefined);

  authState = { isAuthReady: true, isAuthenticated: true };
  assert.equal(getStateFromPath("dish/<script>alert(1)</script>"), undefined);
});
