import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_EMAIL_RATE_LIMITED_MESSAGE,
  AUTH_OFFLINE_MESSAGE,
  AUTH_RATE_LIMITED_MESSAGE,
  getAuthErrorCode,
  getAuthErrorKind,
  getAuthFailureMessage,
  isUnexpectedAuthError,
} from "./authErrors";

test("AUTH-2: the project-wide email cap does not say 'wait a minute'", () => {
  assert.equal(
    getAuthFailureMessage({ code: "over_email_send_rate_limit", status: 429 }, "x"),
    AUTH_EMAIL_RATE_LIMITED_MESSAGE,
  );
  assert.doesNotMatch(AUTH_EMAIL_RATE_LIMITED_MESSAGE, /minute/);
  assert.equal(
    getAuthFailureMessage({ code: "over_request_rate_limit" }, "x"),
    AUTH_RATE_LIMITED_MESSAGE,
  );
});

test("AUTH-X4: only unexpected auth failures are reported to Sentry", () => {
  // Answers a person can act on, and network / rate-limit trouble, are not bugs.
  for (const error of [
    { code: "invalid_credentials", status: 400 },
    { code: "email_not_confirmed" },
    { code: "otp_expired", status: 403 },
    { code: "weak_password" },
    { name: "AuthWeakPasswordError" },
    { status: 429 },
    { name: "AuthRetryableFetchError", status: 0 },
    new TypeError("Network request failed"),
    new Error("Sign in was cancelled"),
  ]) {
    assert.equal(isUnexpectedAuthError(error), false, JSON.stringify(error));
  }
  // A server fault, a broken send-email hook or an unknown failure is.
  for (const error of [
    { code: "unexpected_failure", status: 500 },
    { code: "email_hook_not_configured" },
    new Error("boom"),
  ]) {
    assert.equal(isUnexpectedAuthError(error), true, JSON.stringify(error));
  }
});

test("auth failures sort into offline, rate limited and other, whatever their shape", () => {
  assert.equal(getAuthErrorKind(null), "other");
  assert.equal(getAuthErrorKind("Network request failed"), "other", "a bare string is not read");
  assert.equal(getAuthErrorKind({ status: 429 }), "rate_limited");
  assert.equal(getAuthErrorKind({ code: "over_request_rate_limit" }), "rate_limited");
  assert.equal(getAuthErrorKind({ error_code: "over_sms_send_rate_limit" }), "rate_limited");
  assert.equal(getAuthErrorKind({ name: "AuthRetryableFetchError" }), "offline");
  assert.equal(getAuthErrorKind({ status: 0 }), "offline");
  assert.equal(getAuthErrorKind(new TypeError("Network request failed")), "offline");
  assert.equal(getAuthErrorKind({ message: 42 }), "other");
  assert.equal(getAuthErrorCode({ error_code: "a", code: "b" }), "a", "error_code wins");
  assert.equal(getAuthErrorCode({ code: 7 }), undefined);
  assert.equal(getAuthFailureMessage({ status: 0 }, "Fallback"), AUTH_OFFLINE_MESSAGE);
  assert.equal(getAuthFailureMessage({ status: 429 }, "Fallback"), AUTH_RATE_LIMITED_MESSAGE);
  assert.equal(getAuthFailureMessage({ status: 500 }, "Fallback"), "Fallback");
  assert.equal(isUnexpectedAuthError({ status: 0 }), false);
  assert.equal(isUnexpectedAuthError({ name: "AuthWeakPasswordError" }), false);
  assert.equal(isUnexpectedAuthError({ message: "User cancelled the sign-in" }), false);
  assert.equal(isUnexpectedAuthError(null), true);
  assert.equal(isUnexpectedAuthError({ code: "email_hook_not_configured" }), true);
});
