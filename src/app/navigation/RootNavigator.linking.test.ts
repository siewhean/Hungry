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
});
