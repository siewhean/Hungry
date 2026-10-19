import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking, parseOrderDeepLinkQuery } from "@/app/navigation/linking";

test("root linking config exposes public dish, venue, and order entry points", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  const screens = linking.config.screens as Record<string, unknown>;
  const authStack = screens.AuthStack as { screens: Record<string, string> };

  assert.equal(authStack.screens.ResetPassword, "auth/reset");
  assert.equal(screens.DishDetail, "dish/:id");
  assert.equal(screens.StallDetail, "venue/:id");
  assert.equal(screens.ActivityPostDetail, "post/:postId");
  assert.equal(screens.Post, "order");
  assert.equal(screens.MerchantTabs, undefined);
  assert.deepEqual(screens.MainTabs, { screens: { Home: "home" } });
});

test("weekly picks /home link opens the Home tab", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  assert.deepEqual(linking.getStateFromPath("home")?.routes?.[0], {
    name: "MainTabs",
    params: { screen: "Home" },
  });
});

test("order deep link parses venueId query parameter", () => {
  assert.deepEqual(parseOrderDeepLinkQuery("order?venueId=venue-tian-tian"), {
    venueId: "venue-tian-tian",
  });
  assert.deepEqual(parseOrderDeepLinkQuery("order"), {});
  assert.deepEqual(parseOrderDeepLinkQuery("order?venueId=<script>alert(1)</script>"), {});
});

test("deep link state rejects unsafe params and redirects protected links after auth is ready", () => {
  const redirected: unknown[] = [];
  const onAuthRedirect = (route: unknown) => redirected.push(route);
  let authState = { isAuthReady: true, isAuthenticated: false, onAuthRedirect };
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => authState);
  const getStateFromPath = linking.getStateFromPath;
  assert.equal(typeof getStateFromPath, "function");

  const protectedState = getStateFromPath("order?venueId=venue-tian-tian");
  assert.deepEqual(protectedState?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login", pop: true },
  });
  assert.deepEqual(redirected, [{ name: "Post", params: { venueId: "venue-tian-tian" } }]);

  // Cold start before auth settles: the link is kept, not dropped to Home.
  authState = { isAuthReady: false, isAuthenticated: false, onAuthRedirect };
  assert.deepEqual(getStateFromPath("order")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login", pop: true },
  });
  assert.deepEqual(redirected[redirected.length - 1], { name: "Post", params: undefined });

  authState = { isAuthReady: false, isAuthenticated: true, onAuthRedirect };
  assert.deepEqual(getStateFromPath("order?venueId=venue-tian-tian")?.routes?.[0], {
    name: "Post",
    params: { venueId: "venue-tian-tian" },
  });

  authState = { isAuthReady: true, isAuthenticated: true, onAuthRedirect };
  assert.equal(getStateFromPath("dish/<script>alert(1)</script>"), undefined);
  assert.equal(getStateFromPath("dish/"), undefined);
  assert.equal(getStateFromPath("venue/"), undefined);
});

test("usehungry.com share links open the matching app screen", () => {
  const redirected: unknown[] = [];
  let authState = {
    isAuthReady: true,
    isAuthenticated: true,
    onAuthRedirect: (route: unknown) => redirected.push(route),
  };
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => authState);

  assert.deepEqual(linking.getStateFromPath("dish/dish-1")?.routes?.[0], {
    name: "DishDetail",
    params: { id: "dish-1" },
  });
  assert.deepEqual(linking.getStateFromPath("stall/venue-1")?.routes?.[0], {
    name: "StallDetail",
    params: { id: "venue-1" },
  });
  assert.deepEqual(linking.getStateFromPath("post/post-1")?.routes?.[0], {
    name: "ActivityPostDetail",
    params: { postId: "post-1" },
  });
  assert.equal(linking.getStateFromPath("post/<script>"), undefined);

  // A shared post opens without an account (public posts only, enforced by
  // get_post_by_id); liking or saving asks the visitor to sign in.
  authState = { ...authState, isAuthenticated: false };
  assert.deepEqual(linking.getStateFromPath("post/post-1")?.routes?.[0], {
    name: "ActivityPostDetail",
    params: { postId: "post-1" },
  });
  assert.deepEqual(redirected, []);
});

test("auth deep links pop to an existing auth screen instead of stacking a new one", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
  }));
  for (const [path, screen] of [
    ["login", "Login"],
    ["signup", "SignUp"],
    ["forgot-password", "ForgotPassword"],
  ]) {
    assert.deepEqual(linking.getStateFromPath(path)?.routes?.[0], {
      name: "AuthStack",
      params: { screen, pop: true },
    });
  }
});

test("email confirm, password reset, and OAuth callbacks use separate paths", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
  }));
  const code = "4f1c2b7e-1a2b-4c3d-9e8f-0a1b2c3d4e5f";

  assert.deepEqual(linking.getStateFromPath(`auth/reset?code=${code}`)?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", params: { code }, pop: true },
  });
  assert.deepEqual(linking.getStateFromPath(`auth/callback?code=${code}`)?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", params: { code }, pop: true },
  });
  assert.deepEqual(linking.getStateFromPath("auth/reset?code=<bad>")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", pop: true },
  });
  assert.deepEqual(linking.getStateFromPath(`auth/confirm?code=${code}`)?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "EmailVerification", params: { code }, pop: true },
  });
  assert.deepEqual(linking.getStateFromPath("auth/confirm")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "Login", pop: true },
  });
  assert.equal(linking.getStateFromPath(`auth/oauth?code=${code}`), undefined);
});
