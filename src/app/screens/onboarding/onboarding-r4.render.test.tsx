// Round-four onboarding fixes (R4-ONB-1 to 18), checked in a rendered tree
// (react-native-web + jsdom, mock data). Run with
// `node scripts/test-render.mjs src/app/screens/onboarding/onboarding-r4.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { clearPendingDishSave, getPendingDishSaveIds } from "@/features/auth/pendingDishSave";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  EXPERIMENTS,
  clearExperimentOverrides,
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { useLocationStore } from "@/store/useLocationStore";
import { getFreshOnboardingDraft, useOnboardingDraftStore } from "@/store/useOnboardingDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import {
  cleanup,
  createFakeNavigation,
  render,
  renderScreen,
  type RenderResult,
} from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { createElement } from "react";
import { SignUpScreen } from "../auth/SignUpScreen";
import { SplashScreen } from "../SplashScreen";
import { FoodOpennessScreen } from "./FoodOpennessScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { ManualLocationPickerScreen } from "./ManualLocationPickerScreen";
import { OnboardingAuthScreen } from "./OnboardingAuthScreen";
import { DishPreviewSheet } from "./DishPreviewSheet";
import { ResultDishCard, ResultDishPhoto } from "./ResultDishCard";
import { WelcomeScreen } from "./WelcomeScreen";
import { TasteProfileResultScreen } from "./TasteProfileResultScreen";
import { TasteQuizScreen } from "./TasteQuizScreen";
import type { DishDetail } from "@/types/domain";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const labelled = (prefix: RegExp) =>
  (Array.from(document.querySelectorAll("[aria-label]")) as HTMLElement[]).filter((el) =>
    prefix.test(el.getAttribute("aria-label") ?? ""),
  );

function allByText(text: string) {
  return (Array.from(document.body.querySelectorAll("*")) as HTMLElement[]).filter((el) =>
    Array.from(el.childNodes).some(
      (node) => node.nodeType === 3 && (node.textContent ?? "").trim() === text,
    ),
  );
}

// The four new experiments ship as drafts (nothing is exposed until sh creates the flags), so a
// test that checks exposure runs them as "running" for its duration.
const runningOverrides = new Map<string, string>();
function runExperiment(key: keyof typeof EXPERIMENTS) {
  const definition = EXPERIMENTS[key] as { status: string };
  if (!runningOverrides.has(key)) runningOverrides.set(key, definition.status);
  definition.status = "running";
}

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: [] as string[] };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures.push(key);
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  return { state, source };
}

async function enterGuestOnboarding() {
  await enterScenario("guest");
  useSessionStore.setState({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    onboardingCompletionPending: false,
    returningAccountIntent: false,
  });
}

beforeEach(async () => {
  // These tests drive the password forms; the emailed-code default has its own tests.
  setExperimentOverride("auth_email_code_first_v1", "control");
  await enterGuestOnboarding();
  clearTrackedAnalyticsEvents();
  clearPendingDishSave();
  useOnboardingDraftStore.getState().clearDraft();
  useUIStore.setState({ reducedMotionEnabled: true });
});

afterEach(async () => {
  for (const [key, status] of runningOverrides) {
    (EXPERIMENTS[key as keyof typeof EXPERIMENTS] as { status: string }).status = status;
  }
  runningOverrides.clear();
  await cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  clearExperimentOverrides();
  useUIStore.setState({ reducedMotionEnabled: false });
});

async function renderResult(navigation = createFakeNavigation()) {
  return renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
    navigation,
  });
}

async function renderQuiz(
  params: Record<string, unknown> = { mode: "onboarding" },
  name = "TasteQuiz",
) {
  const navigation = createFakeNavigation();
  const view = await renderScreen(TasteQuizScreen as never, { name, params, navigation });
  return { view, navigation };
}

const progressLabel = () =>
  (document.querySelector('[role="progressbar"]') as HTMLElement | null)?.getAttribute(
    "aria-label",
  );

// ─── Result screen (R4-ONB-1, 2, 15) ────────────────────────────────────────────────────────────

test("R4-ONB-1: the payoff design shows six cards with the stall, the price and a preview tap", async () => {
  const view = await renderResult();
  const previews = labelled(/^Preview /);
  assert.equal(previews.length, 6);
  assert.equal(view.findByLabel(/^Open /), null);
  assert.match(view.text(), /S\$\d+\.\d\d/);
  const dishName = previews[0]!.getAttribute("aria-label")!.replace(/^Preview /, "");
  assert.ok(view.text().includes(dishName));
});

test("R4-ONB-1: the card shows how far the stall is when the distance is known", async () => {
  const dish = {
    id: "dish-d",
    name: "Laksa",
    venueName: "Katong Stall",
    price: 6,
    priceRange: "",
    imageUrl: "",
    tasteTags: [],
  } as unknown as DishDetail;
  const view = await render(
    createElement(ResultDishCard, {
      dish,
      details: true,
      distanceLabel: "320m away",
      popular: false,
      isSaved: false,
      openLabel: "Preview Laksa",
      onToggleSave: () => undefined,
    }),
  );
  assert.ok(view.findByText("S$6.00 · 320m away"));
  assert.ok(view.findByText("Katong Stall"));
});

test("R4-ONB-1: a dish with no photo, price or distance shows a cuisine tile and no filler text", async () => {
  const dish = {
    id: "dish-e",
    name: "Rojak",
    venueName: "Tiong Bahru Stall",
    price: 0,
    priceRange: "",
    imageUrl: "",
    foodTypeTag: "Rojak",
    tasteTags: [],
  } as unknown as DishDetail;
  const view = await render(
    createElement(ResultDishCard, {
      dish,
      details: true,
      popular: true,
      isSaved: false,
      openLabel: "Preview Rojak",
      onToggleSave: () => undefined,
    }),
  );
  assert.ok(view.findByLabel("Rojak, no photo yet"));
  assert.ok(view.findByText("Tiong Bahru Stall"));
  assert.doesNotMatch(view.text(), /Price not listed|S\$0|away/);
  assert.ok(view.findByText("Popular on Hungry"));
});

test("R4-ONB-1: without a known place no distance is shown", async () => {
  const view = await renderResult();
  assert.doesNotMatch(view.text(), /m away|km away/);
});

test("R4-ONB-1: the control design keeps four plain cards that are not links", async () => {
  setExperimentOverride("onboarding_result_payoff_v1", "control");
  const view = await renderResult();
  assert.equal(labelled(/^Save /).length, 4);
  assert.equal(labelled(/^Preview /).length, 0);
  assert.equal(view.findByLabel(/^Open /), null);
});

test("R4-ONB-1: the budget is applied to the first picks", async () => {
  useProfileStore.setState((state) => ({ profile: { ...state.profile, maxDishBudget: 6 } }));
  const view = await renderResult();
  const prices = [...view.text().matchAll(/S\$(\d+\.\d\d)/g)].map((match) => Number(match[1]));
  assert.ok(prices.length > 0, "dishes with a listed price are shown");
  assert.ok(
    prices.every((price) => price <= 6),
    `all prices within S$6, got ${prices.join(", ")}`,
  );
});

test("R4-ONB-1: a diet that leaves few dishes says so instead of looking broken", async () => {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, dietaryPreferences: ["halal"] },
  }));
  const view = await renderResult();
  const cards = labelled(/^Preview /);
  assert.ok(cards.length >= 1 && cards.length < 6);
  assert.match(view.text(), /tagged halal so far\. More appear on Home as stalls add them\./);
});

test("R4-ONB-1: a signed-out tap opens a read-only preview with a way to save and close", async () => {
  const view = await renderResult();
  const card = labelled(/^Preview /)[0]!;
  const dishName = card.getAttribute("aria-label")!.replace(/^Preview /, "");
  await view.press(card);
  assert.ok(view.findByLabel("Close preview"), "the preview sheet opened");
  assert.match(view.text(), /Create your account to open the full dish page/);
  assert.equal(view.findByLabel("Dismiss")?.tagName ?? null, null);
  await view.press(view.findByText("Save this dish"));
  assert.equal(getPendingDishSaveIds().length, 1);
  assert.ok(view.findByText("Saved for after sign-up"));
  assert.ok(view.findByLabel(`Unsave ${dishName}`), "the card heart fills too");
  await view.press(view.findByText("Close"));
  assert.equal(view.findByLabel("Close preview"), null);
});

test("R4-ONB-1: the preview sheet shows nothing without a dish and states the price when it has none", async () => {
  const closed = await render(
    createElement(DishPreviewSheet, {
      dish: null,
      isSaved: false,
      onToggleSave: () => undefined,
      onClose: () => undefined,
    }),
  );
  assert.equal(closed.findByLabel("Close preview"), null);
  await closed.unmount();
  const dish = {
    id: "dish-f",
    name: "Rojak",
    venueName: "Stall",
    price: 0,
    priceRange: "",
    imageUrl: "",
    tasteTags: ["Tangy"],
  } as unknown as DishDetail;
  let closedCalls = 0;
  const open = await render(
    createElement(DishPreviewSheet, {
      dish,
      isSaved: false,
      onToggleSave: () => undefined,
      onClose: () => {
        closedCalls += 1;
      },
    }),
  );
  assert.ok(open.findByText("Price not listed"));
  await open.press(open.findByLabel("Close preview"));
  assert.equal(closedCalls, 1);
});

test("R4-ONB-1: a photo that fails to load shows the shared no-photo tile", async () => {
  const dish = {
    id: "dish-x",
    name: "Hokkien Mee",
    imageUrl: "https://example.sg/laksa.jpg",
    tasteTags: [],
  } as unknown as DishDetail;
  const view = await render(createElement(ResultDishPhoto, { dish, height: 120 }));
  const image = document.querySelector('[data-stub="expo-image.Image"]') as
    | (HTMLElement & { __triggerError?: () => void })
    | null;
  assert.ok(image, "the dish photo is drawn");
  assert.equal(view.findByLabel(/no photo yet/), null);
  const { act } = require("react") as typeof import("react");
  await act(async () => {
    image!.__triggerError!();
  });
  assert.ok(view.findByLabel("Hokkien Mee, no photo yet"));
});

test("R4-ONB-1: a dish with no photo at all shows the no-photo tile at once", async () => {
  const dish = {
    id: "dish-y",
    name: "Rojak",
    imageUrl: "",
    tasteTags: [],
  } as unknown as DishDetail;
  const view = await render(createElement(ResultDishPhoto, { dish, height: 120 }));
  assert.ok(view.findByLabel("Rojak, no photo yet"));
});

test("R4-ONB-2: signed out, the screen says first picks and never 'all set'", async () => {
  const view = await renderResult();
  assert.ok(view.findByText("Your first picks"));
  assert.doesNotMatch(view.text(), /all set/i);
  assert.equal(progressLabel(), "Step 4 of 5");
});

test("R4-ONB-2: signed in, the setup really is done", async () => {
  await enterScenario("user");
  const view = await renderResult();
  assert.ok(view.findByText("You're all set"));
});

test("R4-ONB-15: the result screen has a back arrow", async () => {
  const navigation = createFakeNavigation();
  const view = await renderResult(navigation);
  await view.press(view.findByLabel("Back"));
  assert.deepEqual(navigation.calls.at(-1), { method: "goBack", args: [] });
});

test("experiment onboarding_result_payoff_v1: a signed-out user is exposed, a signed-in one is not", async () => {
  runExperiment("onboarding_result_payoff_v1");
  const fake = fakeFlags({ onboarding_result_payoff_v1: "control" });
  setExperimentFlagSource(fake.source);
  await renderResult();
  assert.ok(fake.state.exposures.includes("onboarding_result_payoff_v1"));
  assert.equal(labelled(/^Save /).length, 4, "the flag's control arm renders four cards");
  await cleanup();
  resetExperimentSession();
  fake.state.exposures.length = 0;
  await enterScenario("user");
  await renderResult();
  assert.ok(!fake.state.exposures.includes("onboarding_result_payoff_v1"));
});

// ─── One progress bar (R4-ONB-2, 8) ────────────────────────────────────────────────────────────

test("R4-ONB-2: the real account step shows Step 5 of 5 with every segment up to it filled", async () => {
  clearExperimentOverrides();
  const view = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  assert.equal(progressLabel(), "Step 5 of 5");
  for (const index of [1, 2, 3, 4, 5]) {
    const fill = (
      view.findByTestId(`onboarding-progress-segment-${index}`)!.firstElementChild as HTMLElement
    ).style.width;
    assert.equal(fill, "100%", `segment ${index} is filled on the last step`);
  }
});

test("R4-ONB-2: the account step uses the shared email-code form with visible labels", async () => {
  clearExperimentOverrides();
  const view = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  const text = view.container.textContent ?? "";
  assert.match(text, /Email/, "the email field has a visible label, not just a placeholder");
  assert.match(text, /Name/, "the sign-up form asks for a name with a visible label");
  assert.match(text, /Use a password instead/);
});

test("R4-ONB-2: the account step reports onboarding_step_viewed as step 5", async () => {
  clearExperimentOverrides();
  clearTrackedAnalyticsEvents();
  await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  const [viewed] = getTrackedAnalyticsEvents().filter((r) => r.event === "onboarding_step_viewed");
  assert.deepEqual(viewed?.properties, {
    step: "account",
    step_number: 5,
    step_index: 6,
    surface: "onboarding",
  });
});

test("R4-ONB-8: the quiz fills the Taste segment of the shared bar, one question at a time", async () => {
  const { view } = await renderQuiz();
  assert.equal(progressLabel(), "Step 2 of 5 · Question 1 of 6");
  const fill = () =>
    (view.findByTestId("onboarding-progress-segment-2")!.firstElementChild as HTMLElement).style
      .width;
  assert.equal(fill(), "14%");
  assert.equal(
    view
      .findByTestId("onboarding-progress-segment-1")!
      .firstElementChild?.getAttribute("style")
      ?.includes("100%"),
    true,
  );
  await view.press(view.findByText("Next"));
  await wait(60);
  await view.settle();
  assert.equal(progressLabel(), "Step 2 of 5 · Question 2 of 6");
  assert.equal(fill(), "29%");
});

test("R4-ONB-8: one heading per quiz screen, and no second 'What flavours' title", async () => {
  const { view } = await renderQuiz();
  assert.equal(view.findByText(/What flavours do/), null);
  assert.ok(view.findByText("How sweet do you like your food?"));
});

test("R4-ONB-8: the dietary step is the end of the Taste segment", async () => {
  const { view } = await renderQuiz(
    { mode: "onboarding", initialPhase: "dietary" },
    "DietaryPreferences",
  );
  assert.equal(progressLabel(), "Step 2 of 5");
  assert.ok(view.findByText("Any dietary needs?"));
});

test("R4-ONB-8: a retake from Profile has no onboarding bar", async () => {
  await enterScenario("user");
  const { view } = await renderQuiz({ mode: "profile" });
  assert.equal(document.querySelector('[role="progressbar"]'), null);
  assert.ok(view.findByText("Question 1 of 6"));
});

// ─── The quiz (R4-ONB-5, 6, 7) ─────────────────────────────────────────────────────────────────

test("R4-ONB-5: all three options are on screen at once, with the example food under each", async () => {
  const { view } = await renderQuiz();
  const options = labelled(/^How sweet do you like your food\? /);
  assert.equal(options.length, 3);
  assert.deepEqual(
    options.map((el) =>
      el.getAttribute("aria-label")!.replace("How sweet do you like your food? ", ""),
    ),
    ["Light", "Balanced", "Sweet-forward"],
  );
  assert.ok(view.findByTestId("taste-tile-0") && view.findByTestId("taste-tile-2"));
});

test("R4-ONB-5, 6: a tap answers; the picked tile is checked and the others are not", async () => {
  const { view } = await renderQuiz();
  const tiles = labelled(/^How sweet do you like your food\? /);
  assert.ok(tiles.every((el) => el.getAttribute("aria-checked") !== "true"));
  await view.press(tiles[2]!);
  const after = labelled(/^How sweet do you like your food\? /);
  assert.deepEqual(
    after.map((el) => el.getAttribute("aria-checked")),
    ["false", "false", "true"],
  );
  assert.ok(view.findByText("Picked: Sweet-forward"));
  const saved = getFreshOnboardingDraft;
  void saved;
  assert.deepEqual(useOnboardingDraftStore.getState().quiz?.answeredKeys, ["sweet"]);
});

test("R4-ONB-7: the helper line keeps its place before and after the first answer", async () => {
  const { view } = await renderQuiz();
  const before = view.findByText(/Tap one to answer/);
  assert.ok(before, "the line is there before an answer");
  await view.press(labelled(/^How sweet do you like your food\? /)[0]!);
  const after = view.findByText(/^Picked: /);
  assert.ok(after, "and still there after");
  assert.equal(before!.parentElement, after!.parentElement, "in the same place in the layout");
  // A line is always reserved, so the tiles sit at the same height on every question.
  assert.equal(before!.style.minHeight, "18px");
});

test("R4-ONB-5: the next question slides in by itself after an answer", async () => {
  useUIStore.setState({ reducedMotionEnabled: false });
  const { view } = await renderQuiz();
  await view.press(labelled(/^How sweet do you like your food\? /)[1]!);
  assert.ok(view.findByText("How sweet do you like your food?"), "the answer is shown first");
  await wait(1400);
  await view.settle();
  assert.ok(view.findByText("How spicy do you usually go?"));
  assert.equal(progressLabel(), "Step 2 of 5 · Question 2 of 6");
});

test("N1: each answer is a full-width row whose label is never cut short", async () => {
  const { view } = await renderQuiz();
  for (const index of [0, 1, 2]) {
    const tile = view.findByTestId(`taste-tile-${index}`) as HTMLElement;
    const texts = Array.from(tile.querySelectorAll("*")).filter((el) =>
      Array.from(el.childNodes).some((node) => node.nodeType === 3 && node.textContent?.trim()),
    ) as HTMLElement[];
    assert.ok(texts.length >= 2, "the answer and its example dish are both in the row");
    for (const text of texts) {
      const style = window.getComputedStyle(text);
      assert.notEqual(style.textOverflow, "ellipsis", text.textContent ?? "");
      assert.ok(!style.webkitLineClamp || style.webkitLineClamp === "none", text.textContent ?? "");
    }
  }
  // Rows stack: the options share one column instead of three side by side.
  const group = view.findByTestId("taste-tile-0")!.parentElement as HTMLElement;
  assert.equal(window.getComputedStyle(group).flexDirection, "column");
});

test("N2: the next question crossfades in well under a second and the options never unmount", async () => {
  useUIStore.setState({ reducedMotionEnabled: false });
  const { view } = await renderQuiz();
  await view.press(labelled(/^How sweet do you like your food\? /)[1]!);
  const startedAt = Date.now();
  let advancedAt = 0;
  while (Date.now() - startedAt < 1200) {
    assert.ok(view.findByTestId("taste-tile-1"), "the options stay mounted during the fade");
    if (view.findByText("How spicy do you usually go?")) {
      advancedAt = Date.now();
      break;
    }
    await wait(20);
  }
  assert.ok(advancedAt > 0, "the second question appeared");
  // 400 ms pause + 100 ms fade out, with room for slow test machines; the old slide took 1.3 s.
  assert.ok(advancedAt - startedAt < 1000, `took ${advancedAt - startedAt} ms`);
  await wait(300);
  await view.settle();
  assert.ok(view.findByTestId("taste-tile-1"));
});

test("N4: Next opens the diet step with plain route params; the answers travel in the draft", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const { view, navigation } = await renderQuiz();
  await view.press(labelled(/^How sweet do you like your food\? /)[2]!);
  for (let tap = 0; tap < 8; tap += 1) {
    const next = allByText("Next").at(-1) ?? null;
    if (!next) break;
    await view.press(next);
    await wait(60);
    await view.settle();
    if (navigation.calls.some((call) => call.args[0] === "DietaryPreferences")) break;
  }
  const toDietary = navigation.calls.find((call) => call.args[0] === "DietaryPreferences");
  assert.ok(toDietary);
  const params = toDietary!.args[1] as Record<string, unknown>;
  assert.deepEqual(Object.keys(params).sort(), ["initialPhase", "mode"]);
  assert.ok(Object.values(params).every((value) => typeof value !== "object"));
  assert.deepEqual(useOnboardingDraftStore.getState().quiz?.answeredKeys, ["sweet"]);
  assert.equal(useOnboardingDraftStore.getState().quiz?.answers.sweet, 8);
});

test("N4: the diet step saves the drafted taste answers and leaves the vector alone after a skip", async () => {
  useOnboardingDraftStore.getState().rememberRoute("DietaryPreferences");
  useOnboardingDraftStore.getState().rememberQuiz({
    answers: { ...useProfileStore.getState().profile.tasteVector, sweet: 8 },
    answeredKeys: ["sweet"],
    step: 0,
  });
  const dietary = await renderDietary();
  await dietary.view.press(allByText("Continue").at(-1) ?? null);
  assert.equal(useProfileStore.getState().profile.tasteVector.sweet, 8);
  await dietary.view.unmount();

  // Skip leaves the draft with no answered question: the dietary step must not touch the vector.
  useProfileStore.getState().setTasteVector({
    ...useProfileStore.getState().profile.tasteVector,
    sweet: 3,
  });
  useOnboardingDraftStore.getState().rememberQuiz({
    answers: { ...useProfileStore.getState().profile.tasteVector, sweet: 9 },
    answeredKeys: [],
    step: 0,
  });
  const skipped = await renderDietary();
  await skipped.view.press(allByText("Continue").at(-1) ?? null);
  assert.equal(useProfileStore.getState().profile.tasteVector.sweet, 3);
});

test("R4-ONB-5: every taste question but the last moves on by itself after an answer", async () => {
  useUIStore.setState({ reducedMotionEnabled: false });
  const { view } = await renderQuiz();
  // Six taste questions; the diet step is not counted as a question.
  for (let question = 1; question <= 5; question += 1) {
    assert.match(progressLabel() ?? "", new RegExp(`Question ${question} of 6`));
    await view.press(view.findByTestId("taste-tile-1"));
    await wait(1400);
    await view.settle();
  }
  assert.match(progressLabel() ?? "", /Question 6 of 6/);
  await view.press(view.findByTestId("taste-tile-1"));
  await wait(1400);
  await view.settle();
  assert.match(progressLabel() ?? "", /Question 6 of 6/, "the last taste question waits for Next");
});

test("R4-ONB-5: with a screen reader on the quiz waits for Next instead of moving on by itself", async () => {
  useUIStore.setState({ reducedMotionEnabled: false });
  const { AccessibilityInfo, Platform } = require("react-native") as typeof import("react-native");
  const original = AccessibilityInfo.isScreenReaderEnabled;
  const originalOs = Platform.OS;
  AccessibilityInfo.isScreenReaderEnabled = () => Promise.resolve(true);
  // react-native-web reports a screen reader as always on, so the screen skips the check there.
  (Platform as { OS: string }).OS = "ios";
  try {
    const { view } = await renderQuiz();
    await wait(30);
    await view.settle();
    await view.press(labelled(/^How sweet do you like your food\? /)[1]!);
    await wait(1400);
    await view.settle();
    assert.ok(view.findByText("How sweet do you like your food?"), "still on the same question");
  } finally {
    AccessibilityInfo.isScreenReaderEnabled = original;
    (Platform as { OS: string }).OS = originalOs;
  }
});

test("R4-ONB-5: with Reduce Motion the quiz waits for Next instead of moving on by itself", async () => {
  const { view } = await renderQuiz();
  await view.press(labelled(/^How sweet do you like your food\? /)[1]!);
  await wait(900);
  await view.settle();
  assert.ok(view.findByText("How sweet do you like your food?"));
});

test("R4-ONB-5: the carousel (control arm) answers on a tap and shows the same selected state", async () => {
  setExperimentOverride("onboarding_quiz_layout_v1", "control");
  const { view } = await renderQuiz();
  assert.equal(view.findByTestId("taste-tile-0"), null, "no tiles in the control arm");
  const cards = labelled(/^How sweet do you like your food\? /);
  assert.equal(cards.length, 3);
  assert.deepEqual(useOnboardingDraftStore.getState().quiz?.answeredKeys, []);
  await view.press(cards[0]!);
  assert.deepEqual(
    labelled(/^How sweet do you like your food\? /).map((el) => el.getAttribute("aria-checked")),
    ["true", "false", "false"],
  );
});

test("experiment onboarding_quiz_layout_v1 and _length_v1: exposed in onboarding, not on a Profile retake", async () => {
  runExperiment("onboarding_quiz_layout_v1");
  runExperiment("onboarding_quiz_length_v1");
  const fake = fakeFlags({
    onboarding_quiz_layout_v1: "control",
    onboarding_quiz_length_v1: "test",
  });
  setExperimentFlagSource(fake.source);
  await renderQuiz();
  assert.ok(fake.state.exposures.includes("onboarding_quiz_layout_v1"));
  assert.ok(fake.state.exposures.includes("onboarding_quiz_length_v1"));
  await cleanup();
  resetExperimentSession();
  fake.state.exposures.length = 0;
  await enterScenario("user");
  await renderQuiz({ mode: "profile" });
  assert.deepEqual(fake.state.exposures, []);
});

test("experiment onboarding_quiz_length_v1: the test arm asks the three questions that matter most", async () => {
  setExperimentOverride("onboarding_quiz_length_v1", "test");
  const { view, navigation } = await renderQuiz();
  assert.equal(progressLabel(), "Step 2 of 5 · Question 1 of 3");
  assert.ok(view.findByText("How spicy do you usually go?"));
  await view.press(view.findByText("Next"));
  await wait(60);
  assert.ok(view.findByText("How sweet do you like your food?"));
  await view.press(view.findByText("Next"));
  await wait(60);
  assert.ok(view.findByText("How rich do you like your food?"));
  await view.press(view.findByText("Next"));
  const toDietary = navigation.calls.find((call) => call.args[0] === "DietaryPreferences");
  assert.ok(toDietary, "Next on the third question opens the dietary step");
});

test("experiment onboarding_quiz_length_v1: the control arm asks all six", async () => {
  setExperimentOverride("onboarding_quiz_length_v1", "control");
  await renderQuiz();
  assert.equal(progressLabel(), "Step 2 of 5 · Question 1 of 6");
});

test("R4-ONB-17: the quiz has one Back (the header arrow), not an arrow and a button", async () => {
  const { view } = await renderQuiz();
  assert.equal(labelled(/^Back$/).length, 1);
  assert.equal(view.findByText("Back"), null);
});

// ─── Resume (R4-ONB-3) ──────────────────────────────────────────────────────────────────────────

test("R4-ONB-3: the quiz reopens on the question the user was on, with the answers given", async () => {
  useOnboardingDraftStore.getState().rememberRoute("TasteQuiz");
  useOnboardingDraftStore.getState().rememberQuiz({
    answers: { sweet: 8, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
    answeredKeys: ["sweet"],
    step: 1,
  });
  const { view } = await renderQuiz();
  assert.ok(view.findByText("How spicy do you usually go?"));
  assert.equal(progressLabel(), "Step 2 of 5 · Question 2 of 6");
  await view.press(view.findByLabel("Back"));
  await wait(60);
  await view.settle();
  assert.ok(view.findByText("Picked: Sweet-forward"), "the first answer survived the restart");
});

test("R4-ONB-3: the dietary choices and budget reopen as they were left", async () => {
  useOnboardingDraftStore.getState().rememberRoute("DietaryPreferences");
  useOnboardingDraftStore
    .getState()
    .rememberDietary({ dietaryPreferences: ["vegan"], maxDishBudget: 12 });
  const { view } = await renderQuiz(
    { mode: "onboarding", initialPhase: "dietary" },
    "DietaryPreferences",
  );
  assert.equal(view.findByLabel("Dietary preference Vegan")?.getAttribute("aria-checked"), "true");
  assert.equal(view.findByLabel("Dietary preference None")?.getAttribute("aria-checked"), "false");
  await view.press(view.findByText("Continue"));
  assert.equal(useProfileStore.getState().profile.maxDishBudget, 12);
});

async function splashEntry() {
  useSessionStore.setState({ isAuthReady: true, hasHydrated: true });
  const navigation = createFakeNavigation();
  const view = await renderScreen(SplashScreen as never, { name: "Splash", navigation });
  await wait(3000);
  await view.settle();
  return navigation.calls.find((call) => call.method === "reset")?.args[0] as {
    routes: {
      name: string;
      params?: unknown;
      state?: { index: number; routes: { name: string }[] };
    }[];
  };
}

test("R4-ONB-3: a relaunch with a fresh draft opens the step the user was on", async () => {
  useOnboardingDraftStore.getState().rememberRoute("DietaryPreferences");
  const reset = await splashEntry();
  assert.equal(reset.routes[0]?.name, "OnboardingStack");
  assert.deepEqual(
    reset.routes[0]?.state?.routes.map((route) => route.name),
    ["OnboardingWelcome", "LocationPermission", "TasteQuiz", "DietaryPreferences"],
  );
});

test("R4-ONB-3: a relaunch with no draft starts at Welcome", async () => {
  const reset = await splashEntry();
  assert.deepEqual(reset.routes, [
    { name: "OnboardingStack", params: { screen: "OnboardingWelcome" } },
  ]);
});

test("R4-ONB-3: a draft older than a day is dropped", async () => {
  useOnboardingDraftStore.getState().rememberRoute("FoodOpenness");
  useOnboardingDraftStore.setState({ savedAt: Date.now() - 25 * 60 * 60 * 1000 });
  const reset = await splashEntry();
  assert.deepEqual(reset.routes[0]?.params, { screen: "OnboardingWelcome" });
});

// ─── Welcome > Sign in > Create account (R4-ONB-4) ──────────────────────────────────────────────

test("R4-ONB-4: Welcome's Sign in stores the intent and leaves onboarding open", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(WelcomeScreen as never, {
    name: "OnboardingWelcome",
    navigation,
  });
  await view.press(allByText("Sign in").at(-1) ?? null);
  const state = useSessionStore.getState();
  assert.equal(state.returningAccountIntent, true);
  assert.equal(state.hasCompletedOnboarding, false);
});

test("R4-ONB-4: a relaunch after Sign in returns to Login", async () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  const reset = await splashEntry();
  assert.deepEqual(reset.routes, [{ name: "AuthStack", params: { screen: "Login" } }]);
});

test("R4-ONB-4: Get started drops the intent, so a relaunch resumes onboarding", async () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  const navigation = createFakeNavigation();
  const view = await renderScreen(WelcomeScreen as never, {
    name: "OnboardingWelcome",
    navigation,
  });
  await view.press(allByText("Get started").at(-1) ?? null);
  assert.equal(useSessionStore.getState().returningAccountIntent, false);
});

test("R4-ONB-4: an account made at the end of a normal run keeps onboarding done", async () => {
  useSessionStore.getState().completeOnboarding(false);
  const navigation = createFakeNavigation();
  const view = await renderScreen(SignUpScreen as never, { name: "SignUp", navigation });
  const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
  await view.type(inputs[0]!, "Mei");
  await view.type(inputs[1]!, "mei.normal@example.sg");
  await view.type(inputs[2]!, "Str0ng-Passw0rd!");
  await view.press(allByText("Create account").at(-1) ?? null);
  await view.settle();
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, true);
  const verify = navigation.calls.find((call) => call.args[0] === "EmailVerification");
  assert.equal((verify?.args[1] as { completedOnboarding?: boolean }).completedOnboarding, true);
});

// ─── Dietary and budget (R4-ONB-9, 18) ──────────────────────────────────────────────────────────

async function renderDietary() {
  return renderQuiz({ mode: "onboarding", initialPhase: "dietary" }, "DietaryPreferences");
}

test("R4-ONB-9: the popular diets, 'No restrictions' and the budget are all on the first screen", async () => {
  const { view } = await renderDietary();
  assert.equal(view.findByLabel("Dietary preference None")?.getAttribute("aria-checked"), "true");
  assert.equal(labelled(/^Dietary preference /).length, 10, "None plus nine popular diets");
  assert.ok(view.findByText("Usual budget per dish"));
  for (const label of ["Under S$6", "Under S$12", "Any price"]) {
    assert.ok(view.findByLabel(`Budget ${label}`), `${label} chip`);
  }
});

test("R4-ONB-9: choosing a diet unchecks 'No restrictions', and 'No restrictions' clears the diet", async () => {
  const { view } = await renderDietary();
  await view.press(view.findByLabel("Dietary preference Halal"));
  assert.equal(view.findByLabel("Dietary preference Halal")?.getAttribute("aria-checked"), "true");
  assert.equal(view.findByLabel("Dietary preference None")?.getAttribute("aria-checked"), "false");
  assert.deepEqual(useOnboardingDraftStore.getState().dietary?.dietaryPreferences, ["halal"]);
  await view.press(view.findByLabel("Dietary preference None"));
  assert.equal(view.findByLabel("Dietary preference Halal")?.getAttribute("aria-checked"), "false");
  assert.equal(view.findByLabel("Dietary preference None")?.getAttribute("aria-checked"), "true");
});

test("R4-ONB-9: More diets opens the other 20 with a search", async () => {
  const { view } = await renderDietary();
  assert.equal(view.findByLabel("Dietary preference Keto"), null);
  await view.press(view.findByLabel(/^Show \d+ more dietary preferences$/));
  assert.ok(view.findByLabel("Dietary preference Keto"));
  await view.type(view.findByLabel("Search dietary restrictions"), "peanut");
  assert.deepEqual(
    labelled(/^Dietary preference /).map((el) => el.getAttribute("aria-label")),
    ["Dietary preference Nut Free", "Dietary preference Peanut Free"],
  );
  await view.type(view.findByLabel("Search dietary restrictions"), "zzz");
  assert.ok(view.findByText("No match"));
});

test("R4-ONB-9: Continue saves the diet and the budget and moves on", async () => {
  const { view, navigation } = await renderDietary();
  await view.press(view.findByLabel("Dietary preference Halal"));
  await view.press(view.findByLabel("Budget Under S$6"));
  await view.press(view.findByText("Continue"));
  const profile = useProfileStore.getState().profile;
  assert.deepEqual(profile.dietaryPreferences, ["halal"]);
  assert.equal(profile.maxDishBudget, 6);
  assert.ok(navigation.calls.some((call) => call.args[0] === "FoodOpenness"));
});

test("R4-ONB-18: the allergen note is one short line", async () => {
  const { view } = await renderDietary();
  assert.ok(view.findByText("Allergen details can be incomplete, so always check with the stall."));
  assert.equal(view.findByText(/Select any that apply/), null);
});

// ─── Location (R4-ONB-10, 11, 17) ───────────────────────────────────────────────────────────────

test("R4-ONB-10: the short primer keeps two benefits and drops Directions", async () => {
  const view = await renderScreen(LocationPermissionScreen as never, {
    name: "LocationPermission",
  });
  assert.ok(view.findByText("Dishes and stalls near you"));
  assert.ok(view.findByText("What diners nearby rate highly"));
  assert.equal(view.findByText("Directions"), null);
  assert.ok(view.findByText("Allow location"));
});

test("experiment onboarding_location_primer_v1: the control arm is the three-card primer", async () => {
  setExperimentOverride("onboarding_location_primer_v1", "control");
  const view = await renderScreen(LocationPermissionScreen as never, {
    name: "LocationPermission",
  });
  assert.ok(view.findByText("Directions"));
  assert.ok(view.findByText("Nearby dish discovery"));
  assert.ok(view.findByText("Local favourites"));
});

test("experiment onboarding_location_primer_v1: exposed on the Location step", async () => {
  runExperiment("onboarding_location_primer_v1");
  const fake = fakeFlags({ onboarding_location_primer_v1: "test" });
  setExperimentFlagSource(fake.source);
  await renderScreen(LocationPermissionScreen as never, { name: "LocationPermission" });
  assert.deepEqual(fake.state.exposures, ["onboarding_location_primer_v1"]);
});

test("R4-ONB-17: the Location header is the back arrow only, like the other steps", async () => {
  const view = await renderScreen(LocationPermissionScreen as never, {
    name: "LocationPermission",
  });
  assert.ok(view.findByLabel("Back to welcome"));
  assert.equal(view.findByLabel(/wordmark|Hungry logo/i), null);
});

test("R4-ONB-11: when location is denied the picker opens with an inline note and no toast", async () => {
  const originalGrant = useLocationStore.getState().grantLocation;
  useLocationStore.setState({ manualLocation: undefined, grantLocation: async () => false });
  useUIStore.setState({ toast: null } as never);
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(LocationPermissionScreen as never, {
      name: "LocationPermission",
      navigation,
    });
    await view.press(view.findByText("Allow location"));
    const open = navigation.calls.find((call) => call.args[0] === "ManualLocationPicker");
    assert.deepEqual(open?.args[1], {
      mode: "onboarding",
      notice: "No problem. Pick your area instead; you can turn location on anytime.",
    });
    assert.equal((useUIStore.getState() as { toast?: unknown }).toast ?? null, null);
  } finally {
    useLocationStore.setState({ grantLocation: originalGrant });
  }
});

test("R4-ONB-11: the picker shows that note above the search", async () => {
  const view = await renderScreen(ManualLocationPickerScreen as never, {
    name: "ManualLocationPicker",
    params: { mode: "onboarding", notice: "No problem. Pick your area instead." },
  });
  const note = view.findByText("No problem. Pick your area instead.");
  assert.ok(note);
  assert.equal(
    note!.closest('[role="alert"]') !== null || note!.getAttribute("role") === "alert",
    true,
  );
});

test("R4-ONB-11: the picker opened from Settings shows no onboarding note", async () => {
  const view = await renderScreen(ManualLocationPickerScreen as never, {
    name: "ManualLocationPicker",
    params: { mode: "settings", notice: "Not for settings." },
  });
  assert.equal(view.findByText("Not for settings."), null);
});

test("R4-ONB-11: when the phone will not ask again the note sits by the buttons, not in a toast", async () => {
  const Location = require("expo-location") as Record<string, unknown>;
  const originalRead = Location.getForegroundPermissionsAsync;
  const originalGrant = useLocationStore.getState().grantLocation;
  Location.getForegroundPermissionsAsync = async () => ({ status: "denied", canAskAgain: false });
  useLocationStore.setState({ manualLocation: undefined, grantLocation: async () => false });
  try {
    const view = await renderScreen(LocationPermissionScreen as never, {
      name: "LocationPermission",
    });
    await view.press(view.findByText("Allow location"));
    assert.ok(
      view.findByText("Location is off for Hungry. Turn it on in Settings, or pick your area."),
    );
    assert.ok(view.findByText("Open settings"));
  } finally {
    Location.getForegroundPermissionsAsync = originalRead;
    useLocationStore.setState({ grantLocation: originalGrant });
  }
});

// ─── Openness (R4-ONB-16) ───────────────────────────────────────────────────────────────────────

test("R4-ONB-16: openness has Continue only; the pre-selected 'Mix it up' is the default", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(FoodOpennessScreen as never, {
    name: "FoodOpenness",
    params: { mode: "onboarding" },
    navigation,
  });
  assert.equal(view.findByText("Skip"), null);
  assert.equal(progressLabel(), "Step 3 of 5");
  await view.press(view.findByText("Continue"));
  assert.ok(navigation.calls.some((call) => call.args[0] === "TasteProfileResult"));
});
