import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("validatePassword enforces minimum length", () => {
  assert.equal(validatePassword(""), "Password is required");
  assert.equal(validatePassword("1234567", 8), "Password must be at least 8 characters");
  assert.equal(validatePassword("12345678", 8), true);
});

test("validateConfirmPassword requires matching values", () => {
  assert.equal(validateConfirmPassword("abcdefgh", ""), "Confirm password is required");
  assert.equal(validateConfirmPassword("abcdefgh", "abcdefgz"), "Passwords do not match");
  assert.equal(validateConfirmPassword("abcdefgh", "abcdefgh"), true);
});
