import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  getPasswordRuleStatuses,
  getPasswordRules,
  PASSWORD_MIN_LENGTH,
  getPasswordUpdateErrorMessage,
  isReservedDisplayName,
  isWeakPasswordError,
  MAX_DISPLAY_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES,
  RESERVED_DISPLAY_NAME_MESSAGE,
  RESERVED_DISPLAY_NAME_PATTERN,
  WEAK_PASSWORD_MESSAGE,
  suggestEmailDomain,
  validateConfirmPassword,
  validateDisplayName,
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

test("password rule checklist is driven by the same rules as validatePassword", () => {
  // Length is the only client rule; Supabase rejects leaked or weak passwords.
  const rules = getPasswordRules();
  assert.deepEqual(
    rules.map((rule) => rule.id),
    ["length"],
  );
  assert.equal(PASSWORD_MIN_LENGTH, 10);
  assert.equal(rules[0].label, `At least ${PASSWORD_MIN_LENGTH} characters`);

  assert.ok(getPasswordRuleStatuses("").every((status) => !status.met));
  assert.ok(getPasswordRuleStatuses("abcdefghij").every((status) => status.met));
  assert.equal(validatePassword("short"), rules[0].error);
  assert.equal(validatePassword("abcdefghij"), true);
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

test("suggestEmailDomain fixes a one-slip typo of a common provider and nothing else", () => {
  const cases: [string, string | null][] = [
    ["mei@gmial.com", "mei@gmail.com"],
    ["mei@gmail.con", "mei@gmail.com"],
    ["mei@gnail.com", "mei@gmail.com"],
    ["mei@hotmial.com", "mei@hotmail.com"],
    ["mei@outlok.com", "mei@outlook.com"],
    ["mei@yaho.com", "mei@yahoo.com"],
    ["  mei@gmial.com  ", "mei@gmail.com"],
    ["Mei.Tan@GMIAL.com", "Mei.Tan@gmail.com"],
    // Valid as typed, or a different real provider: never "corrected".
    ["mei@gmail.com", null],
    ["mei@yahoo.com.sg", null],
    ["mei@proton.me", null],
    ["mei@company.sg", null],
    ["mei@example.com", null],
    // Not an address yet.
    ["mei", null],
    ["mei@", null],
    ["@gmial.com", null],
    ["", null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(suggestEmailDomain(input), expected, input);
  }
});

test("validateDisplayName needs a name of at most 40 characters that is not reserved", () => {
  assert.equal(validateDisplayName("Mei"), true);
  assert.equal(validateDisplayName("  Mei Tan  "), true);
  assert.equal(validateDisplayName("   "), "Name is required");
  assert.equal(validateDisplayName("", "Display name"), "Display name is required");
  assert.equal(validateDisplayName("a".repeat(MAX_DISPLAY_NAME_LENGTH)), true);
  assert.equal(
    validateDisplayName("a".repeat(MAX_DISPLAY_NAME_LENGTH + 1)),
    `Name can be up to ${MAX_DISPLAY_NAME_LENGTH} characters`,
  );
  for (const reserved of ["Admin", "4dm1n", "hungry_team", "S.u.p.p.o.r.t", "Hungry Official 2"]) {
    assert.equal(validateDisplayName(reserved), RESERVED_DISPLAY_NAME_MESSAGE, reserved);
  }
  assert.equal(isReservedDisplayName("Admiral"), false);
  assert.equal(isReservedDisplayName("Hungry Hippo"), false);
});

test("the reserved-name pattern matches the one the database enforces", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261022100200_profile_text_guards.sql"),
    "utf8",
  );
  const serverPattern = migration.match(/~ '(\^\(hungry\|admin[^']*)';/)?.[1];
  assert.ok(serverPattern, "pattern not found in the profile text guards migration");
  assert.equal(RESERVED_DISPLAY_NAME_PATTERN.source, serverPattern);
  assert.match(migration, /translate\(lower\(coalesce\(p_name, ''\)\), '01345', 'oieas'\)/);
});
