import test from "node:test";
import assert from "node:assert/strict";

import {
  getPasswordUpdateErrorMessage,
  isWeakPasswordError,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES,
  WEAK_PASSWORD_MESSAGE,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateRequired,
} from "./validation";

test("validateRequired rejects blank input", () => {
  assert.equal(validateRequired("   ", "Display name"), "Display name is required");
  assert.equal(validateRequired("Wei Ming", "Display name"), true);
});

test("validateEmail enforces required and format checks", () => {
  assert.equal(validateEmail(""), "Email is required");
  assert.equal(validateEmail("invalid@"), "Enter a valid email address");
  assert.equal(validateEmail("weiming@example.com"), true);
});

test("validatePassword needs only 10 characters; leaked passwords are Supabase's job", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10);
  assert.equal(validatePassword(""), "Password is required");
  assert.equal(validatePassword("1234567", 8), "Password must be at least 8 characters");
  assert.equal(validatePassword("abcdefghi"), "Password must be at least 10 characters");
  assert.equal(validatePassword("abcdefghij"), true);
  assert.equal(PASSWORD_RULES, "minlength: 10;");
});

test("validateConfirmPassword requires matching values", () => {
  assert.equal(validateConfirmPassword("abcdefgh", ""), "Confirm password is required");
  assert.equal(validateConfirmPassword("abcdefgh", "abcdefgz"), "Passwords do not match");
  assert.equal(validateConfirmPassword("abcdefgh", "abcdefgh"), true);
});

test("getPasswordUpdateErrorMessage explains rejected new passwords", () => {
  assert.match(getPasswordUpdateErrorMessage({ code: "same_password" }), /different/);
  assert.equal(getPasswordUpdateErrorMessage({ code: "weak_password" }), WEAK_PASSWORD_MESSAGE);
  assert.match(WEAK_PASSWORD_MESSAGE, /data breach/);
  assert.equal(
    isWeakPasswordError({ message: "Password is known to be weak and easy to guess" }),
    true,
  );
  assert.equal(isWeakPasswordError({ code: "invalid_credentials" }), false);
  assert.equal(
    getPasswordUpdateErrorMessage(new Error("network")),
    "Password reset failed. Please try again.",
  );
});
