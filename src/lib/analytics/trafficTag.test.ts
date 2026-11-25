import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERNAL_EMAIL_DOMAIN,
  getAnalyticsEnvironment,
  isInternalAccountEmail,
  isInternalBuild,
} from "./trafficTag";

test("only a production build that was not made for the team counts as diners", () => {
  assert.equal(isInternalBuild("production", undefined), false);
  assert.equal(isInternalBuild("production", "0"), false);
  assert.equal(isInternalBuild("production", " 1 "), true);
  assert.equal(isInternalBuild("staging", undefined), true);
  assert.equal(isInternalBuild("development", undefined), true);
});

test("the environment tag is one of the three known environments", () => {
  assert.ok(["development", "staging", "production"].includes(getAnalyticsEnvironment()));
});

test("staging test diners are internal accounts and nobody else is", () => {
  assert.equal(isInternalAccountEmail(`test-diner-01@${INTERNAL_EMAIL_DOMAIN}`), true);
  assert.equal(
    isInternalAccountEmail(`Test-Diner-02@${INTERNAL_EMAIL_DOMAIN.toUpperCase()}`),
    true,
  );
  assert.equal(isInternalAccountEmail("diner@gmail.com"), false);
  assert.equal(isInternalAccountEmail(`diner@x${INTERNAL_EMAIL_DOMAIN}`), false);
  assert.equal(isInternalAccountEmail(`${INTERNAL_EMAIL_DOMAIN}@gmail.com`), false);
  assert.equal(isInternalAccountEmail(""), false);
  assert.equal(isInternalAccountEmail(undefined), false);
});
