import assert from "node:assert/strict";
import test from "node:test";

import {
  MOCK_WRONG_EMAIL_CODE,
  getMockCodeSendFailure,
  getMockLoginFailure,
  getMockSignUpFailure,
} from "@/features/auth/mockAuth";

test("mock login failure detects invalid credentials and offline markers", () => {
  assert.equal(
    getMockLoginFailure("fail-user@hungry.sg", "password123")?.reason,
    "invalid_credentials",
  );
  assert.equal(
    getMockLoginFailure("offline@hungry.sg", "password123")?.reason,
    "network_unavailable",
  );
  assert.equal(getMockLoginFailure("user@hungry.sg", "password123"), null);
});

test("mock sign-up failure detects existing and offline emails", () => {
  assert.equal(getMockSignUpFailure("taken@hungry.sg")?.reason, "email_taken");
  assert.equal(getMockSignUpFailure("offline@hungry.sg")?.reason, "network_unavailable");
  assert.equal(getMockSignUpFailure("new-user@hungry.sg"), null);
});

test("mock code send fails for offline and rate-limited addresses, and one code is always wrong", () => {
  assert.equal(getMockCodeSendFailure("offline@hungry.sg")?.reason, "network_unavailable");
  const limited = getMockCodeSendFailure("ratelimit@hungry.sg");
  assert.equal(limited?.reason, "over_email_send_rate_limit");
  assert.equal(limited?.status, 429);
  assert.equal(getMockCodeSendFailure("mei@hungry.sg"), null);
  assert.equal(MOCK_WRONG_EMAIL_CODE, "00000000");
});
