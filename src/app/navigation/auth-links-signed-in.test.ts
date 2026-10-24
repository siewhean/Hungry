import assert from "node:assert/strict";
import test from "node:test";

import { createRootLinking, isPartialEmailChangeConfirmation } from "@/app/navigation/linking";

const PREFIX = "exp://127.0.0.1:8081/--/";
const signedIn = () => ({ isAuthReady: true, isAuthenticated: true, hasCompletedOnboarding: true });
const signedOut = () => ({
  isAuthReady: true,
  isAuthenticated: false,
  hasCompletedOnboarding: true,
});
const firstRoute = (state: unknown) => (state as { routes: unknown[] } | undefined)?.routes?.[0];

test("AUTH-9: a signed-in user who opens a sign-in, sign-up or reset link goes Home", () => {
  const linking = createRootLinking(PREFIX, signedIn);
  for (const path of ["login", "signup", "forgot-password", "auth/confirm"]) {
    assert.deepEqual(
      firstRoute(linking.getStateFromPath(path)),
      { name: "MainTabs", params: { screen: "Home" } },
      path,
    );
  }
});

test("AUTH-9: links that do work signed in still open their screen", () => {
  const linking = createRootLinking(PREFIX, signedIn);
  const reset = firstRoute(linking.getStateFromPath("auth/reset?code=abc123")) as {
    name: string;
    params: { screen: string };
  };
  assert.equal(reset.name, "AuthStack");
  assert.equal(reset.params.screen, "ResetPassword");
  const confirm = firstRoute(linking.getStateFromPath("auth/confirm?code=abc123")) as {
    params: { screen: string };
  };
  assert.equal(confirm.params.screen, "EmailVerification");
});

test("AUTH-9: signed out, the sign-in link still opens Login", () => {
  const linking = createRootLinking(PREFIX, signedOut);
  const login = firstRoute(linking.getStateFromPath("login")) as { params: { screen: string } };
  assert.equal(login.params.screen, "Login");
});

test("AUTH-6: the first of two email-change links opens the 'one down' state", () => {
  const path =
    "auth/email-change#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email";
  assert.equal(isPartialEmailChangeConfirmation(path), true);
  assert.equal(isPartialEmailChangeConfirmation("auth/email-change"), false);
  const linking = createRootLinking(PREFIX, signedIn);
  const route = firstRoute(linking.getStateFromPath(path)) as {
    params: { screen: string; params?: Record<string, unknown> };
  };
  assert.equal(route.params.screen, "EmailChange");
  assert.deepEqual(route.params.params, { otherLinkPending: true });
});
