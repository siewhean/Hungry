import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(process.cwd(), "src/app/screens/profile/EditProfileScreen.tsx"),
  "utf8",
);

test("profile password changes use the verified recovery-email path", () => {
  assert.match(source, /getHungryService\(\)\.auth\.forgotPassword\(accountEmail\)/);
  assert.match(source, /const accountEmail = profile\.email\.trim\(\)/);
  assert.match(source, /Password reset email sent to \$\{accountEmail\}/);
  assert.doesNotMatch(source, /code: "profile-settings"/);
  assert.doesNotMatch(source, /navigate\("AuthStack",[\s\S]*ResetPassword/);
});

test("profile password reset prevents duplicate submissions and reports failure", () => {
  assert.match(source, /disabled=\{isRequestingPasswordReset\}/);
  assert.match(source, /accessibilityState=\{\{ busy: isRequestingPasswordReset \}\}/);
  assert.match(source, /Could not send a password reset email right now\./);
});
