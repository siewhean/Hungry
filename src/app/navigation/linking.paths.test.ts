import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking, type LinkingRoute } from "@/app/navigation/linking";

const signedIn = createRootLinking("exp://127.0.0.1:8081/--/");
const target = (path: string) => {
  const state = signedIn.getStateFromPath(path);
  return state?.routes[state.routes.length - 1];
};

test("shared content links open their screen over Home", () => {
  assert.deepEqual(target("catalog/dish/d1"), {
    name: "CatalogRawDetail",
    params: { kind: "dish", id: "d1" },
  });
  assert.deepEqual(target("decide"), {
    name: "DecideForMeResult",
    params: { surface: "push" },
  });
  assert.deepEqual(target("venue/v1"), { name: "StallDetail", params: { venueId: "v1" } });
  assert.deepEqual(target("stall/v1"), { name: "StallDetail", params: { venueId: "v1" } });
  assert.deepEqual(target("review/r1"), { name: "ReviewDetail", params: { reviewId: "r1" } });
  assert.deepEqual(target("user/u1"), { name: "UserProfile", params: { authorId: "u1" } });
  assert.deepEqual(target("portfolio/p1"), {
    name: "PortfolioPublicView",
    params: { portfolioId: "p1" },
  });
  assert.deepEqual(target("search?q=laksa&mode=stalls"), {
    name: "SearchResults",
    params: { initialQuery: "laksa", browseMode: "stalls" },
  });
  assert.equal(signedIn.getStateFromPath("venue/v1")?.routes[0]?.name, "MainTabs");
  assert.deepEqual(target("post"), { name: "Post", params: undefined });
  assert.deepEqual(target("order?venueId=v1"), { name: "Post", params: { venueId: "v1" } });
  assert.deepEqual(target("join/abc"), {
    name: "WheelStack",
    params: { screen: "WheelHome", params: { code: "abc" } },
  });
});

test("links with a missing, undecodable or unsafe id, or an unknown path, open nothing", () => {
  for (const path of [
    "catalog/venue",
    "dish/",
    "dish/%E0%A4%A",
    "review",
    "user/bad%20id",
    "join/bad%20code",
    "auth/oauth",
    "nowhere",
    // Archived or switched-off areas.
    "post/p1",
    "merchant/inbox",
  ]) {
    assert.equal(signedIn.getStateFromPath(path), undefined, path);
  }
});

test("auth links carry only a safe code or a coarse error", () => {
  const auth = (path: string) =>
    (target(path)?.params as { screen?: string; params?: unknown } | undefined) ?? {};
  assert.deepEqual(auth("auth/reset?code=abc").params, { code: "abc" });
  assert.deepEqual(auth("auth/reset#error=x&error_code=otp_expired").params, {
    error: "expired",
  });
  assert.deepEqual(auth("auth/reset?code=bad%20code").params, { error: "invalid" });
  assert.deepEqual(auth("auth/confirm?code=c1"), {
    screen: "EmailVerification",
    params: { code: "c1" },
    pop: true,
  });
  assert.deepEqual(auth("auth/email-change?code=c2").params, { code: "c2" });
  assert.deepEqual(auth("auth/email-change?message=Confirmation%20link%20accepted").params, {
    otherLinkPending: true,
  });
  assert.deepEqual(auth("auth/email-change"), { screen: "EmailChange", pop: true });
  // Signed-out-only auth screens send a signed-in user Home.
  for (const path of ["login", "forgot-password", "auth/confirm"]) {
    assert.deepEqual(target(path), { name: "MainTabs", params: { screen: "Home" } }, path);
  }
});

test("signed out, a protected link is remembered and the user resumes where Splash would", () => {
  const remembered: LinkingRoute[] = [];
  const linkingFor = (state: Parameters<typeof createRootLinking>[1]) =>
    createRootLinking("exp://127.0.0.1:8081/--/", state, (route) => remembered.push(route));

  const settling = linkingFor(() => ({ isAuthReady: false, isAuthenticated: false }));
  assert.equal(settling.getStateFromPath("user/u1"), undefined);

  const pending = linkingFor(() => ({
    isAuthReady: true,
    isAuthenticated: false,
    onboardingCompletionPending: true,
  }));
  assert.deepEqual(pending.getStateFromPath("user/u1")?.routes[0], {
    name: "OnboardingStack",
    params: { screen: "OnboardingAuth" },
  });

  const returning = linkingFor(() => ({
    isAuthReady: true,
    isAuthenticated: false,
    hasCompletedOnboarding: true,
  }));
  assert.deepEqual(returning.getStateFromPath("user/u1")?.routes[0], {
    name: "AuthStack",
    params: { screen: "Login" },
  });
  // Auth links still open while signed out.
  assert.equal(
    (returning.getStateFromPath("login")?.routes[0]?.params as { screen?: string }).screen,
    "Login",
  );

  assert.deepEqual(
    remembered.map((route) => route.name),
    ["UserProfile", "UserProfile", "UserProfile"],
  );
});
