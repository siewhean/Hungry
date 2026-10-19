import assert from "node:assert/strict";
import test from "node:test";

import { getAuthUserProvider, isFirstSignIn } from "./firstSignIn";

test("a sign-in right after confirmation counts as the account's first sign-in", () => {
  assert.equal(
    isFirstSignIn({
      created_at: "2026-10-19T08:00:00Z",
      confirmed_at: "2026-10-19T09:00:00Z",
      last_sign_in_at: "2026-10-19T09:00:01Z",
    }),
    true,
  );
  assert.equal(
    isFirstSignIn({
      created_at: "2026-10-19T09:00:00Z",
      last_sign_in_at: "2026-10-19T09:00:02Z",
      app_metadata: { provider: "google" },
    }),
    true,
  );
});

test("a returning user's sign-in is not a sign-up", () => {
  assert.equal(
    isFirstSignIn({
      created_at: "2026-01-01T00:00:00Z",
      confirmed_at: "2026-01-01T00:01:00Z",
      last_sign_in_at: "2026-10-19T09:00:00Z",
    }),
    false,
  );
  assert.equal(isFirstSignIn({ created_at: "2026-01-01T00:00:00Z" }), false);
});

test("the auth provider defaults to email", () => {
  assert.equal(getAuthUserProvider({ app_metadata: { provider: "apple" } }), "apple");
  assert.equal(getAuthUserProvider({}), "email");
});
