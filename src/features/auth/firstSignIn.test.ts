import assert from "node:assert/strict";
import test from "node:test";

import {
  beginSignUpConfirmation,
  endSignUpConfirmation,
  getAuthUserProvider,
  isNewAccount,
  ONBOARDED_STAMP_STARTS_AT,
} from "./firstSignIn";

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

test("the stamp cut-off is not in the future, so accounts created now can be new", () => {
  // A future cut-off (it was 2026-11-01) made every account created before then "existing":
  // onboarding was skipped and the sign-up was logged as sign_in_completed.
  assert.ok(ONBOARDED_STAMP_STARTS_AT <= Date.parse("2026-10-24T00:00:00Z"));
  assert.equal(isNewAccount({ created_at: "2026-10-24T08:00:00Z" }), true);
});

test("confirming a sign-up email is always a new account, unless it is already onboarded", () => {
  const old = { email: "Ana@Example.com", created_at: "2026-01-01T00:00:00Z" };
  assert.equal(isNewAccount(old), false);

  beginSignUpConfirmation("ana@example.com ");
  try {
    assert.equal(isNewAccount(old), true);
    assert.equal(isNewAccount({ ...old, email: "someone@else.com" }), false);
    assert.equal(isNewAccount({ ...old, user_metadata: { onboarded_at: "2026-02-01" } }), false);
  } finally {
    endSignUpConfirmation();
  }
  assert.equal(isNewAccount(old), false);

  // A confirmation link carries no address: any account it signs in is the new one.
  beginSignUpConfirmation(null);
  try {
    assert.equal(isNewAccount(old), true);
  } finally {
    endSignUpConfirmation();
  }
});

test("EmailVerification marks both sign-up confirmations (code and link) as a new account", async () => {
  const { readFileSync } = await import("node:fs");
  const screen = readFileSync("src/app/screens/auth/EmailVerificationScreen.tsx", "utf8");
  assert.match(
    screen,
    /beginSignUpConfirmation\(null\);\s*const session = await getHungryService\(\)\s*\.auth\.confirmEmail\(code\)\s*\.finally\(endSignUpConfirmation\)/,
  );
  assert.match(
    screen,
    /beginSignUpConfirmation\(email\);\s*const session = await getHungryService\(\)\s*\.auth\.verifyEmailCode\(email, code, "signup"\)\s*\.finally\(endSignUpConfirmation\)/,
  );
});
