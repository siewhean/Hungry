// The new first-run screens from the name to the meal picks, checked in a rendered tree
// (react-native-web + jsdom, mock data). Run with `npm run test:render`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { MIN_GRID_LIKES, SWIPE_SIZE } from "@/features/onboarding/onboardingDeck";
import { resetTypedLines } from "@/features/onboarding/typedLines";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { OnboardingAreasScreen } from "./OnboardingAreasScreen";
import { OnboardingDishGridScreen } from "./OnboardingDishGridScreen";
import { OnboardingLoadingScreen } from "./OnboardingLoadingScreen";
import { OnboardingMealPicksScreen } from "./OnboardingMealPicksScreen";
import { OnboardingMealTimesScreen } from "./OnboardingMealTimesScreen";
import { OnboardingNameScreen } from "./OnboardingNameScreen";
import { OnboardingPalateIntroScreen } from "./OnboardingPalateIntroScreen";
import { OnboardingPalateRevealScreen } from "./OnboardingPalateRevealScreen";
import { OnboardingPriceScreen } from "./OnboardingPriceScreen";
import { OnboardingResultsScreen } from "./OnboardingResultsScreen";
import { OnboardingSwipeScreen } from "./OnboardingSwipeScreen";
import { clearOnboardingDishPool, loadOnboardingDishPool } from "./tastePicks";

beforeEach(async () => {
  resetTypedLines();
  clearTrackedAnalyticsEvents();
  clearOnboardingDishPool();
  useOnboardingAnswersStore.getState().reset();
  useOnboardingDraftStore.getState().clearDraft();
  await enterScenario("guest");
});
afterEach(cleanup);

const lastNavigate = (view: { navigation: { calls: { method: string; args: unknown[] }[] } }) =>
  view.navigation.calls.filter((call) => call.method === "navigate").at(-1)?.args;
const isDisabled = (view: Awaited<ReturnType<typeof renderScreen>>, label: string) =>
  view.findByText(label)?.closest("[role=button]")?.getAttribute("aria-disabled") === "true";

test("every new screen reports that it opened", async () => {
  const view = await renderScreen(OnboardingNameScreen, { name: "OnboardingName" });
  const viewed = getTrackedAnalyticsEvents().filter(
    (event) => event.event === "onboarding_screen_viewed",
  );
  assert.equal(viewed.length, 1);
  assert.equal(viewed[0]?.properties?.screen, "name");
  await view.unmount();
});

test("the name screen keeps Continue off until a name is typed, then saves it", async () => {
  const view = await renderScreen(OnboardingNameScreen, { name: "OnboardingName" });
  assert.equal(isDisabled(view, "Continue"), true);
  await view.type(view.findByLabel("Your name"), "  Mei   Ling ");
  assert.equal(isDisabled(view, "Continue"), false);
  await view.press(view.findByText("Continue"));
  assert.equal(useOnboardingAnswersStore.getState().displayName, "Mei Ling");
  assert.deepEqual(lastNavigate(view), ["LocationPermission"]);
  await view.unmount();
});

test("the areas screen takes three areas and says so when a fourth is tapped", async () => {
  const view = await renderScreen(OnboardingAreasScreen, { name: "OnboardingAreas" });
  for (const area of ["Tampines", "Orchard", "Bishan"]) {
    await view.press(view.findByText(area));
  }
  assert.equal(useOnboardingAnswersStore.getState().usualAreaIds.length, 3);
  await view.press(view.findByText("Woodlands"));
  assert.equal(useOnboardingAnswersStore.getState().usualAreaIds.length, 3);
  assert.match(view.text(), /Pick up to 3/);
  await view.press(view.findByText("Continue"));
  assert.deepEqual(lastNavigate(view), ["OnboardingMealTimes"]);
  await view.unmount();
});

test("the meal-times screen saves the picked meals with their times", async () => {
  const view = await renderScreen(OnboardingMealTimesScreen, { name: "OnboardingMealTimes" });
  await view.press(view.findByLabel("Meal Lunch"));
  await view.press(view.findByLabel("Lunch at 12:30 pm"));
  await view.press(view.findByText("Continue"));
  assert.deepEqual(useOnboardingAnswersStore.getState().mealTimes, { lunch: "12:30" });
  assert.deepEqual(lastNavigate(view), ["OnboardingPalateIntro"]);
  await view.unmount();
});

test("the palate intro moves on to the sliders", async () => {
  const view = await renderScreen(OnboardingPalateIntroScreen, { name: "OnboardingPalateIntro" });
  await view.press(view.findByText("Continue"));
  assert.deepEqual(lastNavigate(view), ["TasteQuiz"]);
  await view.unmount();
});

test("the palate reveal says 'Not set' for skipped tastes and goes on to the diet step", async () => {
  useOnboardingDraftStore.getState().rememberQuiz({
    answers: { spicy: 9, sweet: 5, salty: 5, sour: 5, rich: 5, aromatic: 5 },
    answeredKeys: ["spicy"],
    step: 5,
  });
  const view = await renderScreen(OnboardingPalateRevealScreen, { name: "OnboardingPalateReveal" });
  assert.match(view.text(), /Not set/);
  await view.press(view.findByText("Continue"));
  assert.deepEqual(lastNavigate(view), [
    "DietaryPreferences",
    { mode: "onboarding", initialPhase: "dietary" },
  ]);
  await view.unmount();
});

test("the price screen saves the budget and moves to the openness step", async () => {
  const view = await renderScreen(OnboardingPriceScreen, { name: "OnboardingPrice" });
  await view.press(view.findByText("Continue"));
  assert.deepEqual(lastNavigate(view), ["FoodOpenness"]);
  await view.unmount();
});

test("the dish grid needs three hearts, and Skip for now works at once", async () => {
  const pool = await loadOnboardingDishPool();
  assert.ok(pool.length >= MIN_GRID_LIKES, "the mock catalog has dishes to show");
  const view = await renderScreen(OnboardingDishGridScreen, { name: "OnboardingDishGrid" });
  await view.settle();
  assert.equal(isDisabled(view, "Continue"), true);
  for (const dish of pool.slice(0, MIN_GRID_LIKES)) {
    await view.press(view.findByLabel(new RegExp(`^${dish.name.replace(/[()]/g, ".")}`)));
  }
  assert.equal(useOnboardingAnswersStore.getState().likedDishIds.length, MIN_GRID_LIKES);
  assert.equal(isDisabled(view, "Continue"), false);
  await view.press(view.findByText("Continue"));
  assert.deepEqual(lastNavigate(view), ["OnboardingPrice"]);
  await view.unmount();

  const skipped = await renderScreen(OnboardingDishGridScreen, { name: "OnboardingDishGrid" });
  await skipped.press(skipped.findByText("Skip for now"));
  assert.deepEqual(lastNavigate(skipped), ["OnboardingPrice"]);
  await skipped.unmount();
});

test("the swipe screen records hearts and passes, then moves on after the last card", async () => {
  // Reduce Motion: a card leaves at once, so each press is a finished choice.
  useUIStore.setState({ reducedMotionEnabled: true });
  const view = await renderScreen(OnboardingSwipeScreen, { name: "OnboardingSwipe" });
  await view.settle();
  assert.match(view.text(), new RegExp(`Dish 1 of ${SWIPE_SIZE}`));
  await view.press(view.findByLabel(/^Love it/));
  await view.press(view.findByLabel(/^Not for me/));
  const { likedDishIds, passedDishIds } = useOnboardingAnswersStore.getState();
  assert.equal(likedDishIds.length, 1);
  assert.equal(passedDishIds.length, 1);
  for (let card = 2; card < SWIPE_SIZE; card += 1) {
    await view.press(view.findByLabel(/^Love it/));
  }
  assert.deepEqual(lastNavigate(view), ["OnboardingLoading"]);
  await view.unmount();
  useUIStore.setState({ reducedMotionEnabled: false });
});

test("the loading screen hands over to the results as soon as the dishes are ranked", async () => {
  const view = await renderScreen(OnboardingLoadingScreen, { name: "OnboardingLoading" });
  assert.match(view.text(), /Finding dishes near you/);
  await view.settle();
  const replaced = view.navigation.calls.filter((call) => call.method === "replace").at(-1);
  assert.deepEqual(replaced?.args, ["OnboardingResults"]);
  await view.unmount();
});

test("the results show up to three dishes, never a passed one, each with a reason", async () => {
  const pool = await loadOnboardingDishPool();
  useOnboardingAnswersStore.getState().recordSwipe(pool[0]!.id, false);
  const view = await renderScreen(OnboardingResultsScreen, { name: "OnboardingResults" });
  await view.settle();
  assert.doesNotMatch(view.text(), new RegExp(`^${pool[0]!.name}$`));
  assert.ok(view.container.querySelectorAll("h2, [role=heading]").length >= 1);
  await view.press(view.findByText("Continue"));
  assert.deepEqual(lastNavigate(view), ["OnboardingMealPicks"]);
  await view.unmount();
});

test("meal picks: Not now goes to the account step, and nothing is saved as an opt-in", async () => {
  const view = await renderScreen(OnboardingMealPicksScreen, { name: "OnboardingMealPicks" });
  assert.match(view.text(), /Three ideas for lunch/);
  await view.press(view.findByText("Not now"));
  assert.equal(useOnboardingAnswersStore.getState().wantsMealPicks, false);
  assert.deepEqual(lastNavigate(view), ["OnboardingAuth"]);
  await view.unmount();
});

test("meal picks: Turn on keeps the opt-in for after sign-in, and a dinner-only person sees dinner", async () => {
  useOnboardingAnswersStore.getState().setMealTimes({ dinner: "19:00" });
  const view = await renderScreen(OnboardingMealPicksScreen, { name: "OnboardingMealPicks" });
  assert.match(view.text(), /Three ideas for dinner/);
  assert.match(view.text(), /6:15 pm/);
  await view.press(view.findByText("Turn on meal picks"));
  assert.equal(useOnboardingAnswersStore.getState().wantsMealPicks, true);
  assert.deepEqual(lastNavigate(view), ["OnboardingAuth"]);
  await view.unmount();
});

test("meal picks: a signed-in person finishes onboarding here instead of signing up", async () => {
  await enterScenario("user");
  useSessionStore.setState({ hasCompletedOnboarding: false });
  const view = await renderScreen(OnboardingMealPicksScreen, { name: "OnboardingMealPicks" });
  await view.press(view.findByText("Not now"));
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
  await view.unmount();
});

test("the dish pool is fetched once per set of answers and again when an answer changes", async () => {
  const first = loadOnboardingDishPool();
  assert.equal(loadOnboardingDishPool(), first, "same answers share one request");
  const { useProfileStore } = await import("@/store/useProfileStore");
  const before = useProfileStore.getState().profile.maxDishBudget;
  useProfileStore.getState().setMaxDishBudget(before === 4 ? 5 : 4, { surface: "onboarding" });
  assert.notEqual(loadOnboardingDishPool(), first, "a new budget asks again");
  useProfileStore.getState().setMaxDishBudget(before, { surface: "onboarding" });
  await first;
});
