import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  trackAuthFailed,
  trackEmailCodeRequested,
  trackEmailCodeSubmitted,
  trackPasswordResetCompleted,
  trackSignInSubmitted,
  trackVerificationEmailResent,
} from "@/features/auth/authAnalytics";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";

beforeEach(() => clearTrackedAnalyticsEvents());

const last = () => {
  const events = getTrackedAnalyticsEvents();
  const event = events[events.length - 1];
  return { name: event?.event, properties: event?.properties };
};

test("auth_failed names the screen when it is given, so a failure sets against that screen's views", () => {
  trackAuthFailed("email_code", "email", { code: "otp_expired" }, "login");
  assert.deepEqual(last(), {
    name: "auth_failed",
    properties: { flow: "email_code", method: "email", reason: "otp_expired", screen: "login" },
  });
  trackAuthFailed("sign_in", "email", new Error("User cancelled"));
  assert.deepEqual(last().properties, { flow: "sign_in", method: "email", reason: "cancelled" });
  trackAuthFailed("sign_in", "email", null);
  assert.equal(last().properties?.reason, "unknown");
});

test("the code, sign-in, reset and resend events carry no address and no code", () => {
  trackEmailCodeRequested("onboarding_auth", false);
  assert.deepEqual(last(), {
    name: "email_code_requested",
    properties: { screen: "onboarding_auth", resend: false },
  });
  trackEmailCodeSubmitted("login", { auto: true, paste: true });
  assert.deepEqual(last(), {
    name: "email_code_submitted",
    properties: { screen: "login", auto: true, paste: true },
  });
  trackSignInSubmitted("login", "email");
  assert.deepEqual(last(), {
    name: "sign_in_submitted",
    properties: { screen: "login", method: "email" },
  });
  trackPasswordResetCompleted();
  assert.equal(last().name, "password_reset_completed");
  trackVerificationEmailResent();
  assert.equal(last().name, "verification_email_resent");
});
