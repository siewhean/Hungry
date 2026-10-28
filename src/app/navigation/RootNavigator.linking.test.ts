import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getPathFromState } from "@react-navigation/core";

import {
  createRootLinking,
  parseAuthCallbackParams,
  parseOrderDeepLinkQuery,
  stripEmailQuery,
  withoutEmailParam,
} from "@/app/navigation/linking";

test("linking exposes authenticated dish, venue, post and order entry points", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  const screens = linking.config.screens as Record<string, unknown>;
  const authStack = screens.AuthStack as { screens: Record<string, string> };

  assert.equal(authStack.screens.ResetPassword, "auth/reset");
  assert.equal(authStack.screens.EmailVerification, undefined);
  // Path params must match the params callers navigate with (dishId/venueId).
  assert.equal(screens.DishDetail, "dish/:dishId");
  assert.equal(screens.StallDetail, "venue/:venueId");
  // Activity (and its post pages) is archived, so its links are off.
  assert.equal(screens.ActivityPostDetail, undefined);
  // The composer is named for what it does; /order still works as an alias.
  assert.equal(screens.Post, "post");
  assert.equal(screens.ReviewDetail, "review/:reviewId");
  assert.equal(screens.ActivityInbox, undefined);
  assert.equal(screens.FollowRequests, "follow-requests");
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

test("a deep-link cold start with the account step pending resumes OnboardingAuth, not Login", () => {
  let capturedRoute: { name: string; params?: Record<string, unknown> } | undefined;
  const linking = createRootLinking(
    "exp://127.0.0.1:8081/--/",
    () => ({
      isAuthReady: true,
      isAuthenticated: false,
      hasCompletedOnboarding: true,
      onboardingCompletionPending: true,
    }),
    (route) => {
      capturedRoute = route;
    },
  );

  assert.deepEqual(linking.getStateFromPath("dish/dish-123")?.routes?.[0], {
    name: "OnboardingStack",
    params: { screen: "OnboardingAuth" },
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

  // Cold start before auth settles: nothing opens, but the link is remembered.
  authState = { ...authState, isAuthReady: false };
  assert.equal(linking.getStateFromPath("order"), undefined);
  assert.deepEqual(capturedRoute, { name: "Post", params: undefined });

  authState = { ...authState, isAuthReady: true, isAuthenticated: true };
  assert.deepEqual(linking.getStateFromPath("dish/dish-123")?.routes?.[1], {
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
  assert.deepEqual(linking.getStateFromPath("venue/venue-tian-tian")?.routes?.[1], {
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
    params: { screen: "ResetPassword", params: { code: "abc-123" }, pop: true },
  });
  assert.deepEqual(
    linking.getStateFromPath(
      "auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid",
    )?.routes?.[0],
    {
      name: "AuthStack",
      params: { screen: "ResetPassword", params: { error: "expired" }, pop: true },
    },
  );
  assert.deepEqual(linking.getStateFromPath("auth/callback")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", pop: true },
  });
  // auth/reset is the current password-reset redirect (AUTH_REDIRECTS.passwordReset).
  assert.deepEqual(linking.getStateFromPath("auth/reset?code=abc-123")?.routes?.[0], {
    name: "AuthStack",
    params: { screen: "ResetPassword", params: { code: "abc-123" }, pop: true },
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
    params: { screen: "EmailVerification", params: { code: "xyz-789" }, pop: true },
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
  assert.equal(linking.getStateFromPath("dish/dish-1")?.routes?.[1]?.name, "DishDetail");
  const source = readFileSync(path.join(process.cwd(), "src/app/navigation/linking.ts"), "utf8");
  assert.doesNotMatch(source, /catalogReadV2/);
  assert.match(source, /getServiceProvider\(\)\.mode === "supabase"/);
});

test("wheel /join/:code link puts the code on the WheelHome route", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  assert.deepEqual(linking.getStateFromPath("join/ABC123")?.routes?.[0], {
    name: "WheelStack",
    params: { screen: "WheelHome", params: { code: "ABC123" } },
  });
  assert.equal(linking.getStateFromPath("join/%3Cscript%3E"), undefined);
});

test("cold-start shared links open on top of Home so Back leads somewhere", () => {
  // Signed in: the app is sign-in only, so signed-out links go to Login instead.
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: true,
  }));
  const home = { name: "MainTabs", params: { screen: "Home" } };
  for (const [path, name] of [
    ["dish/dish-1", "DishDetail"],
    ["venue/venue-1", "StallDetail"],
    ["user/user-1", "UserProfile"],
    ["search?q=laksa", "SearchResults"],
  ]) {
    const state = linking.getStateFromPath(path);
    assert.equal(state?.index, 1, path);
    assert.deepEqual(state?.routes?.[0], home, path);
    assert.equal(state?.routes?.[1]?.name, name, path);
  }
  // Home is the linking initial route, so on a running app the two-route state
  // becomes a navigate to the target rather than a reset of the whole stack.
  assert.equal((linking.config as { initialRouteName?: string }).initialRouteName, "MainTabs");
});

test("/post opens the composer like /order; /post/:id is off while Activity is archived", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  const getStateFromPath = linking.getStateFromPath;
  assert.deepEqual(getStateFromPath("post?venueId=venue-tian-tian")?.routes?.[0], {
    name: "Post",
    params: { venueId: "venue-tian-tian" },
  });
  assert.deepEqual(getStateFromPath("order?venueId=venue-tian-tian")?.routes?.[0], {
    name: "Post",
    params: { venueId: "venue-tian-tian" },
  });
  assert.notEqual(getStateFromPath("post/abc-123")?.routes?.[1]?.name, "ActivityPostDetail");
});

test("review/:id links open the review page once signed in (sign-in only)", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: true,
  }));
  const getStateFromPath = linking.getStateFromPath;
  const id = "11111111-2222-3333-4444-555555555555";
  assert.deepEqual(getStateFromPath(`review/${id}?src=whatsapp`)?.routes, [
    { name: "MainTabs", params: { screen: "Home" } },
    { name: "ReviewDetail", params: { reviewId: id } },
  ]);
  const signedOut = createRootLinking("exp://127.0.0.1:8081/--/", () => ({
    isAuthReady: true,
    isAuthenticated: false,
  })).getStateFromPath(`review/${id}`);
  assert.notEqual(signedOut?.routes?.at(-1)?.name, "ReviewDetail");
  assert.equal(getStateFromPath("review/"), undefined);
  assert.equal(getStateFromPath("review/%3Cscript%3E"), undefined);
});

test("a web URL never carries the email a screen was opened with (AUTH4-19)", () => {
  const linking = createRootLinking("exp://127.0.0.1:8081/--/");
  const options = linking.config as Parameters<typeof getPathFromState>[1];
  const pathFor = withoutEmailParam(getPathFromState);
  for (const [screen, params] of [
    ["Login", { email: "mei@example.sg" }],
    ["ForgotPassword", { email: "mei@example.sg" }],
    ["ResetPassword", { email: "mei@example.sg", code: "pkce-code" }],
  ] as const) {
    const state = {
      routes: [{ name: "AuthStack", state: { routes: [{ name: screen, params }] } }],
    };
    const raw = getPathFromState(state, options);
    assert.match(raw, /email=/, `${screen}: the default path would carry the address`);
    const clean = pathFor(state, options);
    assert.doesNotMatch(clean, /email/i, screen);
    assert.ok(clean.startsWith("/"), clean);
  }
  // The rest of the query is kept.
  assert.equal(stripEmailQuery("/auth/reset?code=abc&email=a%40b.sg"), "/auth/reset?code=abc");
  assert.equal(stripEmailQuery("/login?email=a%40b.sg"), "/login");
  assert.equal(stripEmailQuery("/login?email=a%40b.sg#top"), "/login#top");
  assert.equal(stripEmailQuery("/search?q=email&mode=stalls"), "/search?q=email&mode=stalls");
  assert.equal(stripEmailQuery("/home"), "/home");
});

test("both navigators build web URLs without the email", () => {
  for (const file of ["RootNavigator.tsx", "PreAuthNavigator.tsx"]) {
    const source = readFileSync(path.join(process.cwd(), "src/app/navigation", file), "utf8");
    assert.match(source, /getPathFromState: withoutEmailParam\(getPathFromState\)/, file);
  }
});
