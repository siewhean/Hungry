import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  ONBOARDING_DRAFT_TTL_MS,
  ONBOARDING_RESUME_ROUTES,
  getFreshOnboardingDraft,
  useOnboardingDraftStore,
} from "@/store/useOnboardingDraftStore";

beforeEach(() => {
  useOnboardingDraftStore.getState().clearDraft();
});

test("a new device has no draft to resume", () => {
  assert.equal(getFreshOnboardingDraft(), null);
});

test("the route, quiz answers and dietary choices round-trip", () => {
  const draft = useOnboardingDraftStore.getState();
  draft.rememberRoute("DietaryPreferences");
  draft.rememberQuiz({
    answers: { ...NEUTRAL_TASTE_VECTOR, sweet: 8 },
    answeredKeys: ["sweet"],
    step: 2,
  });
  draft.rememberDietary({ dietaryPreferences: ["halal"], maxDishBudget: 6 });

  const fresh = getFreshOnboardingDraft();
  assert.equal(fresh?.route, "DietaryPreferences");
  assert.equal(fresh?.quiz?.answers.sweet, 8);
  assert.deepEqual(fresh?.quiz?.answeredKeys, ["sweet"]);
  assert.equal(fresh?.quiz?.step, 2);
  assert.deepEqual(fresh?.dietary, { dietaryPreferences: ["halal"], maxDishBudget: 6 });
});

test("remembering the route keeps the answers already saved", () => {
  const draft = useOnboardingDraftStore.getState();
  draft.rememberQuiz({ answers: NEUTRAL_TASTE_VECTOR, answeredKeys: ["spicy"], step: 1 });
  draft.rememberRoute("TasteQuiz");
  assert.deepEqual(getFreshOnboardingDraft()?.quiz?.answeredKeys, ["spicy"]);
});

test("a draft older than 24 hours is not resumed", () => {
  useOnboardingDraftStore.getState().rememberRoute("FoodOpenness");
  const savedAt = useOnboardingDraftStore.getState().savedAt!;
  assert.equal(
    getFreshOnboardingDraft(savedAt + ONBOARDING_DRAFT_TTL_MS - 1)?.route,
    "FoodOpenness",
  );
  assert.equal(getFreshOnboardingDraft(savedAt + ONBOARDING_DRAFT_TTL_MS + 1), null);
});

test("an answer given later refreshes the expiry", () => {
  useOnboardingDraftStore.getState().rememberRoute("TasteQuiz");
  useOnboardingDraftStore.setState({ savedAt: Date.now() - ONBOARDING_DRAFT_TTL_MS - 5_000 });
  assert.equal(getFreshOnboardingDraft(), null);
  useOnboardingDraftStore
    .getState()
    .rememberQuiz({ answers: NEUTRAL_TASTE_VECTOR, answeredKeys: [], step: 0 });
  assert.equal(getFreshOnboardingDraft()?.route, "TasteQuiz");
});

test("clearing drops everything", () => {
  const draft = useOnboardingDraftStore.getState();
  draft.rememberRoute("TasteProfileResult");
  draft.rememberDietary({ dietaryPreferences: ["vegan"], maxDishBudget: null });
  draft.clearDraft();
  const state = useOnboardingDraftStore.getState();
  assert.equal(state.route, null);
  assert.equal(state.quiz, null);
  assert.equal(state.dietary, null);
  assert.equal(getFreshOnboardingDraft(), null);
});

test("only steps after Welcome can be resumed, in flow order", () => {
  assert.deepEqual(
    [...ONBOARDING_RESUME_ROUTES],
    ["LocationPermission", "TasteQuiz", "DietaryPreferences", "FoodOpenness", "TasteProfileResult"],
  );
});
