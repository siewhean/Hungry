import assert from "node:assert/strict";
import test from "node:test";

import { completeVerifiedSignUp } from "@/features/auth/completeVerifiedSignUp";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
} from "@/lib/analytics/mockAnalytics";
import { setMockServiceProvider } from "@/lib/services/serviceProvider";
import { setConfiguredDataSource } from "@/lib/services/supabase/client";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";

// In Supabase mode the profile id is the auth user id; the mock profile stands in for it.
const userId = () => useProfileStore.getState().profile?.id ?? "user-1";

function signedOut() {
  setConfiguredDataSource("mock");
  setMockServiceProvider();
  useSessionStore.getState().applyAuthStateFromSession({ isAuthenticated: false, userId: null });
  useSessionStore.setState({
    hasHydrated: true,
    isAuthReady: true,
    isAuthenticated: false,
    authenticatedUserId: null,
    hasCompletedOnboarding: false,
    signOutPending: false,
  });
  clearTrackedAnalyticsEvents();
}

const flushIdleWork = () => new Promise((resolve) => setTimeout(resolve, 20));
const authEvents = () =>
  getTrackedAnalyticsEvents()
    .map((record) => record.event)
    .filter((name) => name === "sign_up_completed" || name === "sign_in_completed");

test.beforeEach(signedOut);
test.after(signedOut);

test("a sign-up confirmed right after a SIGNED_IN read as existing is logged as sign_up_completed once", async () => {
  // supabase-js raises SIGNED_IN inside verifyOtp, so the listener reports first.
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: userId(),
    isNewUser: false,
  });
  completeVerifiedSignUp(false);
  await flushIdleWork();

  assert.deepEqual(authEvents(), ["sign_up_completed"]);
});

test("a plain sign-in still logs sign_in_completed", async () => {
  useSessionStore.getState().applyAuthStateFromSession({ isAuthenticated: true, userId: userId() });
  await flushIdleWork();

  assert.deepEqual(authEvents(), ["sign_in_completed"]);
});

test("an explicit sign-up still reports after a sign_in_completed for the same user already went out", async () => {
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: userId(),
    isNewUser: false,
  });
  // The listener's idle work has already sent sign_in_completed.
  await flushIdleWork();
  completeVerifiedSignUp(false);
  await flushIdleWork();
  // A repeat report is still deduped.
  completeVerifiedSignUp(false);
  await flushIdleWork();

  assert.deepEqual(authEvents(), ["sign_in_completed", "sign_up_completed"]);
});

const onboardingCompleted = () =>
  getTrackedAnalyticsEvents().filter((record) => record.event === "onboarding_completed");

test("onboarding_completed tells an existing account from a new one", async () => {
  useSessionStore.setState({ hasCompletedOnboarding: true, onboardingCompletionPending: true });
  useSessionStore.getState().applyAuthStateFromSession({ isAuthenticated: true, userId: userId() });
  await flushIdleWork();
  assert.equal(onboardingCompleted().length, 1);
  assert.equal(onboardingCompleted()[0]?.properties.is_new_account, false);

  signedOut();
  useSessionStore.setState({ hasCompletedOnboarding: true, onboardingCompletionPending: true });
  useSessionStore.getState().completeAuth({ authProvider: "email", isNewUser: true });
  await flushIdleWork();
  assert.equal(onboardingCompleted().length, 1);
  assert.equal(onboardingCompleted()[0]?.properties.is_new_account, true);
});
