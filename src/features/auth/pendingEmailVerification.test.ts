import assert from "node:assert/strict";
import test from "node:test";

import {
  rememberPendingEmailVerification,
  resetPendingEmailVerificationMemoryForTests,
  takePendingEmailVerificationCompletesOnboarding,
} from "./pendingEmailVerification";

const flush = () => new Promise((done) => setTimeout(done, 10));

test("an OnboardingAuth sign-up survives a cold start from the confirmation link", async () => {
  rememberPendingEmailVerification(true);
  await flush();
  resetPendingEmailVerificationMemoryForTests();
  assert.equal(await takePendingEmailVerificationCompletesOnboarding(), true);
  // Consumed once.
  resetPendingEmailVerificationMemoryForTests();
  assert.equal(await takePendingEmailVerificationCompletesOnboarding(), false);
});

test("a later plain SignUp resets a stale onboarding flag", async () => {
  rememberPendingEmailVerification(true);
  rememberPendingEmailVerification(false);
  await flush();
  assert.equal(await takePendingEmailVerificationCompletesOnboarding(), false);
  resetPendingEmailVerificationMemoryForTests();
  assert.equal(await takePendingEmailVerificationCompletesOnboarding(), false);
});
