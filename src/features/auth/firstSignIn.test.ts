import assert from "node:assert/strict";
import test from "node:test";

import { getAuthUserProvider, isNewAccount, ONBOARDED_STAMP_STARTS_AT } from "./firstSignIn";

const AFTER_STAMP = new Date(ONBOARDED_STAMP_STARTS_AT + 60_000).toISOString();

test("an account without the onboarded stamp, created after the stamp shipped, is new", () => {
  assert.equal(isNewAccount({ created_at: AFTER_STAMP }), true);
  assert.equal(isNewAccount({ created_at: AFTER_STAMP, user_metadata: {} }), true);
});

test("a new account is new however late its first sign-in is (confirmed on a computer first)", () => {
  // No clock window: the account is new until it has finished onboarding, whether the
  // first phone sign-in comes a minute or a day after confirmation.
  assert.equal(
    isNewAccount({ created_at: AFTER_STAMP, user_metadata: { onboarded_at: undefined } }),
    true,
  );
});

test("an account that finished onboarding is not new", () => {
  assert.equal(
    isNewAccount({
      created_at: AFTER_STAMP,
      user_metadata: { onboarded_at: "2026-11-02T09:00:00Z" },
    }),
    false,
  );
});

test("accounts from before the stamp existed count as existing", () => {
  assert.equal(isNewAccount({ created_at: "2026-01-01T00:00:00Z" }), false);
  assert.equal(isNewAccount({}), false);
  assert.equal(isNewAccount({ created_at: "not a date" }), false);
});

test("the auth provider defaults to email", () => {
  assert.equal(getAuthUserProvider({ app_metadata: { provider: "apple" } }), "apple");
  assert.equal(getAuthUserProvider({}), "email");
});
