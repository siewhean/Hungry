import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { getHungryService } from "@/lib/services/serviceProvider";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { flushOnboardingAnswers } from "./flushOnboardingAnswers";

beforeEach(() => useOnboardingAnswersStore.getState().reset());

function spyOnService() {
  const service = getHungryService();
  const originalFeedback = service.recommendations.recordExplicitFeedback;
  const originalPrefs = service.push.updatePreferences;
  const feedback: { dishId?: string; feedbackType: string }[] = [];
  const prefs: unknown[] = [];
  service.recommendations.recordExplicitFeedback = async (input) => {
    feedback.push({ dishId: input.dishId, feedbackType: input.feedbackType });
    return originalFeedback(input);
  };
  service.push.updatePreferences = async (next) => {
    prefs.push(next);
    return originalPrefs(next);
  };
  const restore = () => {
    service.recommendations.recordExplicitFeedback = originalFeedback;
    service.push.updatePreferences = originalPrefs;
  };
  return { feedback, prefs, restore };
}

test("liked and passed dishes are sent once, then the store is empty", async () => {
  const spy = spyOnService();
  try {
    const store = useOnboardingAnswersStore.getState();
    store.recordSwipe("dish-a", true);
    store.recordSwipe("dish-b", false);
    await flushOnboardingAnswers(async () => false);
    await flushOnboardingAnswers(async () => false);
    assert.deepEqual(spy.feedback, [
      { dishId: "dish-a", feedbackType: "dish_like" },
      { dishId: "dish-b", feedbackType: "dismissed" },
    ]);
    assert.deepEqual(spy.prefs, []);
  } finally {
    spy.restore();
  }
});

test("the meal-picks opt-in turns the preference on only when the phone allows alerts", async () => {
  const spy = spyOnService();
  try {
    useOnboardingAnswersStore.getState().setWantsMealPicks(true);
    await flushOnboardingAnswers(async () => false);
    assert.deepEqual(spy.prefs, []);

    useOnboardingAnswersStore.getState().setWantsMealPicks(true);
    let asked: unknown;
    await flushOnboardingAnswers(async (options) => {
      asked = options;
      return true;
    });
    assert.deepEqual(asked, { askPermission: false });
    assert.deepEqual(spy.prefs, [{ mealtimeSuggestions: true }]);
  } finally {
    spy.restore();
  }
});

test("one failed write does not stop the others", async () => {
  const service = getHungryService();
  const original = service.recommendations.recordExplicitFeedback;
  const sent: string[] = [];
  service.recommendations.recordExplicitFeedback = async (input) => {
    if (input.dishId === "bad") throw new Error("offline");
    sent.push(input.dishId ?? "");
    return original(input);
  };
  try {
    const store = useOnboardingAnswersStore.getState();
    store.recordSwipe("bad", true);
    store.recordSwipe("good", true);
    await flushOnboardingAnswers(async () => false);
    assert.deepEqual(sent, ["good"]);
  } finally {
    service.recommendations.recordExplicitFeedback = original;
  }
});

test("with nothing to send it does no work", async () => {
  const spy = spyOnService();
  try {
    await flushOnboardingAnswers(async () => true);
    assert.deepEqual(spy.feedback, []);
    assert.deepEqual(spy.prefs, []);
  } finally {
    spy.restore();
  }
});
