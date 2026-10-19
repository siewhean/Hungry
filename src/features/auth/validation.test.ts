import test from "node:test";
import assert from "node:assert/strict";

import {
  getPasswordRuleStatuses,
  getPasswordRules,
  PASSWORD_MIN_LENGTH,
  getPasswordUpdateErrorMessage,
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
  assert.equal(
    validatePassword("aaaaaaaaaaaa"),
    "Password must include at least one uppercase letter",
  );
  assert.equal(
    validatePassword("AAAAAAAAAAAA"),
    "Password must include at least one lowercase letter",
  );
  assert.equal(validatePassword("AaAaAaAaAaAa"), "Password must include at least one number");
  assert.equal(
    validatePassword("AaAaAaAaAaA1"),
    "Password must include at least one special character",
  );
  assert.equal(validatePassword("AaAaAaAaAaA1!"), true);
});

test("validateConfirmPassword requires matching values", () => {
  assert.equal(validateConfirmPassword("abcdefgh", ""), "Confirm password is required");
  assert.equal(validateConfirmPassword("abcdefgh", "abcdefgz"), "Passwords do not match");
  assert.equal(validateConfirmPassword("abcdefgh", "abcdefgh"), true);
});

test("password rule checklist is driven by the same rules as validatePassword", () => {
  const rules = getPasswordRules();
  assert.deepEqual(
    rules.map((rule) => rule.id),
    ["length", "uppercase", "lowercase", "number", "special"],
  );
  assert.equal(rules[0].label, `At least ${PASSWORD_MIN_LENGTH} characters`);

  assert.ok(getPasswordRuleStatuses("").every((status) => !status.met));
  assert.ok(getPasswordRuleStatuses("AaAaAaAaAaA1!").every((status) => status.met));

  // Every partially-valid password reports exactly the first unmet rule's error at submit.
  for (const sample of ["short", "aaaaaaaaaaaa", "AAAAAAAAAAA1", "AaAaAaAaAaAa", "AaAaAaAaAaA1"]) {
    const firstUnmet = getPasswordRuleStatuses(sample).find((status) => !status.met);
    const rule = rules.find((candidate) => candidate.id === firstUnmet?.id);
    assert.equal(validatePassword(sample), rule?.error);
  }

  const statuses = getPasswordRuleStatuses("abcdefghijkl");
  assert.deepEqual(
    statuses.filter((status) => status.met).map((status) => status.id),
    ["length", "lowercase"],
  );
});

test("getPasswordUpdateErrorMessage explains rejected new passwords", () => {
  assert.match(getPasswordUpdateErrorMessage({ code: "same_password" }), /different/);
  assert.match(getPasswordUpdateErrorMessage({ code: "weak_password" }), /too weak/);
  assert.equal(
    getPasswordUpdateErrorMessage(new Error("network")),
    "Password reset failed. Please try again.",
  );
});
