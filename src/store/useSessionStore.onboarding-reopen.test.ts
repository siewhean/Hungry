// Welcome > Sign in used to mark onboarding done, so Login > Create account made an account with
// no location, taste or diet (R4-ONB-4). Sign in now stores a "returning account" intent only,
// and the account decides after sign-in whether onboarding runs.
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useSessionStore } from "@/store/useSessionStore";

beforeEach(() => {
  useSessionStore.setState({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    hasSkippedTasteQuiz: false,
    onboardingCompletionPending: false,
    returningAccountIntent: false,
  });
  useOnboardingDraftStore.getState().clearDraft();
  clearTrackedAnalyticsEvents();
});

test("the intent is stored without marking onboarding done", () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  const state = useSessionStore.getState();
  assert.equal(state.returningAccountIntent, true);
  assert.equal(state.hasCompletedOnboarding, false);
  assert.equal(state.onboardingCompletionPending, false);
});

test("an existing account that signs in goes Home: onboarding is marked done, intent cleared", () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: "00000000-0000-4000-8000-000000000001",
    completedOnboarding: true,
    isNewUser: false,
  });
  const state = useSessionStore.getState();
  assert.equal(state.hasCompletedOnboarding, true);
  assert.equal(state.returningAccountIntent, false);
});

test("a new account that signs in still goes through onboarding", () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: "00000000-0000-4000-8000-000000000002",
    isNewUser: true,
  });
  const state = useSessionStore.getState();
  assert.equal(state.hasCompletedOnboarding, false);
  assert.equal(state.returningAccountIntent, false);
});

test("no onboarding_completed event comes from the intent", () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  useSessionStore.getState().completeAuth();
  assert.equal(
    getTrackedAnalyticsEvents().filter((record) => record.event === "onboarding_completed").length,
    0,
  );
});

test("signing in as another account drops a half-finished onboarding draft", () => {
  useSessionStore.setState({
    isAuthenticated: true,
    authenticatedUserId: "00000000-0000-4000-8000-000000000003",
  });
  useOnboardingDraftStore.getState().rememberDietary({
    dietaryPreferences: ["halal"],
    maxDishBudget: null,
  });
  useSessionStore.getState().applyAuthStateFromSession({
    isAuthenticated: true,
    userId: "00000000-0000-4000-8000-000000000004",
    completedOnboarding: true,
  });
  assert.equal(useOnboardingDraftStore.getState().dietary, null);
});
