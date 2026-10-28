// The slider taste questions: skipping, the "skip the rest" link, going back. Run with
// `npm run test:render`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { resetTypedLines } from "@/features/onboarding/typedLines";
import { cleanup, renderScreen } from "@/test/render";
import { TasteQuizRoute } from "./TasteQuizRoute";
import { TasteSliderQuizScreen } from "./TasteSliderQuizScreen";

beforeEach(() => {
  resetTypedLines();
  useOnboardingDraftStore.getState().clearDraft();
});
afterEach(cleanup);

const show = () => renderScreen(TasteSliderQuizScreen, { name: "TasteQuiz" });

test("it opens on the spice question with Continue off until the person answers", async () => {
  const view = await show();
  assert.match(view.text(), /How spicy do you usually go\?/);
  assert.match(view.text(), /Skip for now/);
  assert.doesNotMatch(view.text(), /Skip the rest/);
  assert.ok(view.findByLabel("Screen 7 of 22"));
  const continueButton = view.findByText("Continue")?.closest("[role=button]");
  assert.equal(continueButton?.getAttribute("aria-disabled"), "true");
  await view.unmount();
});

test("skipping all six questions goes to the dietary step with no taste answers", async () => {
  const view = await show();
  for (let question = 0; question < 6; question += 1) {
    await view.press(view.findByText("Skip for now"));
  }
  const last = view.navigation.calls.at(-1);
  assert.equal(last?.method, "navigate");
  assert.deepEqual(last?.args, [
    "DietaryPreferences",
    { mode: "onboarding", initialPhase: "dietary" },
  ]);
  assert.deepEqual(useOnboardingDraftStore.getState().quiz?.answeredKeys, []);
  await view.unmount();
});

test("it reopens on the question a relaunch left off, with a fresh draft", async () => {
  const draft = useOnboardingDraftStore.getState();
  draft.rememberRoute("TasteQuiz");
  draft.rememberQuiz({
    answers: { spicy: 8, sweet: 5, salty: 5, sour: 5, rich: 5, aromatic: 5 },
    answeredKeys: ["spicy"],
    step: 1,
  });
  const view = await show();
  assert.match(view.text(), /How sweet do you like your food and drinks\?/);
  await view.unmount();
});

test("the skip-the-rest link appears from the fourth question and ends the questions", async () => {
  const view = await show();
  for (let question = 0; question < 3; question += 1) {
    await view.press(view.findByText("Skip for now"));
  }
  assert.match(view.text(), /How much sourness do you enjoy\?/);
  await view.press(view.findByText("Skip the rest, use my defaults"));
  assert.equal(view.navigation.calls.at(-1)?.args[0], "DietaryPreferences");
  await view.unmount();
});

test("Back returns to the previous question, and from the first question leaves the quiz", async () => {
  const view = await show();
  await view.press(view.findByText("Skip for now"));
  assert.match(view.text(), /How sweet do you like your food and drinks\?/);
  await view.press(view.findByLabel("Back"));
  assert.match(view.text(), /How spicy do you usually go\?/);
  await view.press(view.findByLabel("Back"));
  assert.equal(view.navigation.calls.at(-1)?.method, "goBack");
  await view.unmount();
});

test("the TasteQuiz route shows the sliders for onboarding and the card quiz for a Profile retake", async () => {
  const onboarding = await renderScreen(TasteQuizRoute, { name: "TasteQuiz" });
  assert.match(onboarding.text(), /How spicy do you usually go\?/);
  await onboarding.unmount();

  const retake = await renderScreen(TasteQuizRoute, {
    name: "TasteQuiz",
    params: { mode: "profile" },
  });
  assert.doesNotMatch(retake.text(), /How spicy do you usually go\?/);
  await retake.unmount();
});
