// Round-three onboarding fixes, checked in a rendered tree (react-native-web + jsdom, mock data).
// Run with `node scripts/test-render.mjs src/app/screens/onboarding/onboarding.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { AccessibilityInfo } from "react-native";

import { clearPendingDishSave, getPendingDishSaveIds } from "@/features/auth/pendingDishSave";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
  clearExperimentOverrides,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { SplashScreen } from "../SplashScreen";
import { FoodOpennessScreen } from "./FoodOpennessScreen";
import { LocationPermissionScreen } from "./LocationPermissionScreen";
import { ManualLocationPickerScreen } from "./ManualLocationPickerScreen";
import { OnboardingAuthScreen } from "./OnboardingAuthScreen";
import { trackOnboardingStepViewed, visibleStepNumber } from "./OnboardingProgress";
import { TasteProfileResultScreen } from "./TasteProfileResultScreen";
import { TasteQuizScreen } from "./TasteQuizScreen";
import { WelcomeScreen } from "./WelcomeScreen";

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((record) => record.event === name);

function allByText(view: RenderResult, text: string) {
  return (Array.from(document.body.querySelectorAll("*")) as HTMLElement[]).filter((el) =>
    Array.from(el.childNodes).some(
      (node) => node.nodeType === 3 && (node.textContent ?? "").trim() === text,
    ),
  );
}

const inputs = () => Array.from(document.querySelectorAll("input")) as HTMLInputElement[];

async function enterGuestOnboarding() {
  await enterScenario("guest");
  useSessionStore.setState({
    isAuthenticated: false,
    hasCompletedOnboarding: false,
    onboardingCompletionPending: false,
  });
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

beforeEach(async () => {
  await enterGuestOnboarding();
  clearTrackedAnalyticsEvents();
  clearPendingDishSave();
});

afterEach(async () => {
  await cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  clearExperimentOverrides();
});

test("ONB-1: signed out, a result dish is not a link into a route the pre-auth navigator lacks", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
    navigation,
  });
  assert.ok(view.findByLabel(/^Save /), "the grid rendered dishes");
  assert.equal(view.findByLabel(/^Open /), null);
  assert.equal(useSessionStore.getState().hasCompletedOnboarding, false);
  assert.ok(!navigation.calls.some((call) => call.args[0] === "DishDetail"));
});

test("ONB-1: signed in, the dish still opens", async () => {
  await enterScenario("user");
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  assert.ok(view.findByLabel(/^Open /));
});

test("ONB-4: a guest's heart fills and the dish waits for sign-up; a second tap takes it back", async () => {
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  const heart = view.findByLabel(/^Save /);
  const dishName = heart!.getAttribute("aria-label")!.replace(/^Save /, "");
  await view.press(heart);
  const saved = view.findByLabel(`Unsave ${dishName}`);
  assert.ok(saved, "the heart shows the dish as saved");
  assert.equal(getPendingDishSaveIds().length, 1);
  await view.press(saved);
  assert.equal(getPendingDishSaveIds().length, 0);
  assert.ok(view.findByLabel(`Save ${dishName}`));
});

test("ONB-X9: the result grid reports what it showed, once", async () => {
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  await view.press(view.findByLabel(/^Save /));
  const shown = events("onboarding_picks_shown");
  assert.equal(shown.length, 1);
  assert.equal(typeof shown[0]?.properties.ranked, "boolean");
  assert.ok(Number(shown[0]?.properties.count) > 0);
  assert.match(String(shown[0]?.properties.source), /^(local|popular)$/);
});

test("experiment onboarding_account_framing_v1: both variants render on the result screen", async () => {
  setExperimentOverride("onboarding_account_framing_v1", "test");
  let view = await renderScreen(TasteProfileResultScreen as never, { name: "TasteProfileResult" });
  assert.ok(view.findByText("Save my picks"));
  assert.equal(view.findByText("Start exploring"), null);
  await view.unmount();

  setExperimentOverride("onboarding_account_framing_v1", "control");
  view = await renderScreen(TasteProfileResultScreen as never, { name: "TasteProfileResult" });
  assert.ok(view.findByText("Start exploring"));
  assert.equal(view.findByText("Save my picks"), null);
});

test("experiment onboarding_account_framing_v1: a signed-out user is exposed; a signed-in one is not", async () => {
  const fake = fakeFlags({ onboarding_account_framing_v1: "test" });
  setExperimentFlagSource(fake.source);
  const view = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  assert.ok(view.findByText("Save my picks"));
  assert.deepEqual(fake.state.exposures, ["onboarding_account_framing_v1"]);
  await view.unmount();

  // The account step reads the frozen variant and never exposes again.
  const auth = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  assert.match(auth.text(), /the dishes picked for you/);
  assert.equal(fake.state.exposures.length, 1);
  await auth.unmount();

  await enterScenario("user");
  resetExperimentSession();
  fake.state.exposures.length = 0;
  const signedIn = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  assert.ok(signedIn.findByText("Start exploring"));
  assert.deepEqual(fake.state.exposures, []);
});

test("ONB-3: a relaunch after onboarding, with no account yet, returns to the account step", async () => {
  useSessionStore.getState().completeOnboarding(false);
  useSessionStore.setState({ isAuthReady: true, hasHydrated: true });
  const navigation = createFakeNavigation();
  const view = await renderScreen(SplashScreen as never, { name: "Splash", navigation });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await view.settle();
  const reset = navigation.calls.find((call) => call.method === "reset");
  assert.deepEqual(reset?.args[0], {
    index: 0,
    routes: [{ name: "OnboardingStack", params: { screen: "OnboardingAuth" } }],
  });
});

test("ONB-3: Welcome's Sign in still relaunches to sign-in", async () => {
  useSessionStore.getState().setReturningAccountIntent(true);
  useSessionStore.setState({ isAuthReady: true, hasHydrated: true });
  const navigation = createFakeNavigation();
  const view = await renderScreen(SplashScreen as never, { name: "Splash", navigation });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  await view.settle();
  const reset = navigation.calls.find((call) => call.method === "reset");
  assert.deepEqual(reset?.args[0], {
    index: 0,
    routes: [{ name: "AuthStack", params: { screen: "Login" } }],
  });
});

test("ONB-6: the signed-out flow runs Welcome to sign-up and keeps the answers", async () => {
  // Welcome -> Location
  const welcomeNav = createFakeNavigation();
  const welcome = await renderScreen(WelcomeScreen as never, {
    name: "OnboardingWelcome",
    navigation: welcomeNav,
  });
  await welcome.press(welcome.findByText("Get started"));
  assert.ok(welcomeNav.calls.some((call) => call.args[0] === "LocationPermission"));
  await welcome.unmount();

  // Location: pick an area, then Continue to the quiz.
  useLocationStore.getState().setManualLocation("Bishan");
  const locationNav = createFakeNavigation();
  const location = await renderScreen(LocationPermissionScreen as never, {
    name: "LocationPermission",
    navigation: locationNav,
  });
  await location.press(location.findByText("Continue"));
  assert.ok(locationNav.calls.some((call) => call.args[0] === "TasteQuiz"));
  await location.unmount();

  // Openness -> result
  const opennessNav = createFakeNavigation();
  const openness = await renderScreen(FoodOpennessScreen as never, {
    name: "FoodOpenness",
    params: { mode: "onboarding" },
    navigation: opennessNav,
  });
  await openness.press(openness.findByText("Continue"));
  assert.ok(opennessNav.calls.some((call) => call.args[0] === "TasteProfileResult"));
  assert.equal(events("food_openness_set")[0]?.properties.changed_from_default, false);
  await openness.unmount();

  // Result: heart one dish, then go to the account step.
  const resultNav = createFakeNavigation();
  const result = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
    navigation: resultNav,
  });
  await result.press(result.findByLabel(/^Save /));
  await result.press(result.findByText("Start exploring"));
  assert.deepEqual(resultNav.calls.at(-1), { method: "navigate", args: ["OnboardingAuth"] });
  await result.unmount();

  // Account step: the mandatory wrapper completes onboarding locally; sign-up sends the event.
  useSessionStore.getState().completeOnboarding(false);
  assert.equal(events("onboarding_completed").length, 0);
  const auth = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  const [name, email, password] = inputs();
  await auth.type(name, "Mei");
  await auth.type(email, "mei.new@example.sg");
  await auth.type(password, "Str0ng-Passw0rd!");
  await auth.press(allByText(auth, "Create account").at(-1) ?? null);
  assert.equal(useSessionStore.getState().isAuthenticated, true);
  assert.equal(events("onboarding_completed").length, 1);
  // The sign-up tests' leading metric counts accounts made on the onboarding account step.
  assert.deepEqual(
    events("sign_up_submitted").map((record) => record.properties),
    [{ screen: "onboarding_auth", method: "email" }],
  );
});

test("ONB-6: the full flow carries the quiz answers, the diet and a saved dish into the new account", async () => {
  // The signed-out profile as the app has it (the mock repository names its guest "guest").
  const { useProfileStore } =
    require("@/store/useProfileStore") as typeof import("@/store/useProfileStore");
  useProfileStore.setState((state) => ({ profile: { ...state.profile, id: "guest-user" } }));
  // Location: open the picker from the Location step and choose an area.
  const locationNav = createFakeNavigation();
  const location = await renderScreen(LocationPermissionScreen as never, {
    name: "LocationPermission",
    navigation: locationNav,
  });
  await location.unmount();
  const pickerNav = createFakeNavigation();
  const picker = await renderScreen(ManualLocationPickerScreen as never, {
    name: "ManualLocationPicker",
    params: { mode: "onboarding" },
    navigation: pickerNav,
  });
  await picker.type(
    picker.findByLabel("Search for an area, mall, hawker centre or address"),
    "Bishan",
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  await picker.settle();
  const area = picker.findByLabel(/^Choose Bishan/);
  assert.ok(area, "the picker lists Bishan");
  await picker.press(area);
  await picker.press(allByText(picker, "Set as my location").at(-1) ?? null);
  await picker.settle();
  assert.ok(pickerNav.calls.some((call) => call.args[0] === "TasteQuiz"));
  assert.match(JSON.stringify(useLocationStore.getState()), /Bishan/);
  await picker.unmount();

  // Taste quiz: answer the first question with the strongest card, then Next to the end.
  const { useUIStore } = require("@/store/useUIStore") as typeof import("@/store/useUIStore");
  useUIStore.setState({ reducedMotionEnabled: true });
  const quizNav = createFakeNavigation();
  const quiz = await renderScreen(TasteQuizScreen as never, {
    name: "TasteQuiz",
    params: { mode: "onboarding" },
    navigation: quizNav,
  });
  const sweetCards = (
    Array.from(document.querySelectorAll("[aria-label]")) as HTMLElement[]
  ).filter((el) =>
    (el.getAttribute("aria-label") ?? "").startsWith("How sweet do you like your food? "),
  );
  const strongest = sweetCards.at(-1) ?? null;
  assert.ok(strongest, "the first question has answer cards");
  await quiz.press(strongest);
  for (let tap = 0; tap < 20; tap += 1) {
    const next = allByText(quiz, "Next").at(-1) ?? null;
    if (!next) break;
    await quiz.press(next);
    // Each step slides out and in before the next tap counts.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await quiz.settle();
    if (quizNav.calls.some((call) => call.args[0] === "DietaryPreferences")) break;
  }
  const toDietary = quizNav.calls.find((call) => call.args[0] === "DietaryPreferences");
  assert.ok(toDietary, "Next on the last question opens the dietary step");
  const dietaryParams = toDietary!.args[1] as {
    answers?: { sweet?: number };
    answeredKeys?: string[];
  };
  assert.deepEqual(dietaryParams.answeredKeys, ["sweet"]);
  assert.equal(dietaryParams.answers?.sweet, 8);
  await quiz.unmount();

  // Dietary: pick Vegetarian and continue.
  const dietaryNav = createFakeNavigation();
  const dietary = await renderScreen(TasteQuizScreen as never, {
    name: "DietaryPreferences",
    params: { mode: "onboarding", initialPhase: "dietary", ...dietaryParams },
    navigation: dietaryNav,
  });
  await dietary.press(dietary.findByLabel("Dietary preference Vegetarian"));
  await dietary.press(allByText(dietary, "Continue").at(-1) ?? null);
  assert.ok(dietaryNav.calls.some((call) => call.args[0] === "FoodOpenness"));
  assert.equal(useProfileStore.getState().profile.tasteVector.sweet, 8);
  assert.ok(useProfileStore.getState().profile.dietaryPreferences.includes("vegetarian"));
  await dietary.unmount();

  // Openness -> result: heart one dish.
  const openness = await renderScreen(FoodOpennessScreen as never, {
    name: "FoodOpenness",
    params: { mode: "onboarding" },
  });
  await openness.press(openness.findByText("Continue"));
  await openness.unmount();
  const result = await renderScreen(TasteProfileResultScreen as never, {
    name: "TasteProfileResult",
  });
  const heart = result.findByLabel(/^Save /);
  assert.ok(heart, "the result grid has a dish to save");
  await result.press(heart);
  const [savedDishId] = getPendingDishSaveIds();
  assert.ok(savedDishId);
  await result.unmount();

  // Account step: sign up; the answers, the diet and the saved dish belong to the account.
  useSessionStore.getState().completeOnboarding(false);
  const auth = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  const [name, email, password] = inputs();
  await auth.type(name, "Mei");
  await auth.type(email, "mei.flow@example.sg");
  await auth.type(password, "Str0ng-Passw0rd!");
  await auth.press(allByText(auth, "Create account").at(-1) ?? null);
  await auth.settle();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(useSessionStore.getState().isAuthenticated, true);
  const profile = useProfileStore.getState().profile;
  // The mock account already has a saved taste, which the quiz recalibrates: the strong
  // sweet answer pulls it up from the account's own value (4.3).
  assert.ok(profile.tasteVector.sweet > 5, `sweet is ${profile.tasteVector.sweet}`);
  assert.ok(profile.dietaryPreferences.includes("vegetarian"));
  assert.ok(profile.favouriteDishIds.includes(savedDishId), "the guest's heart is saved");
  assert.equal(events("onboarding_completed").length, 1);
  assert.equal(events("onboarding_completed")[0]?.properties.is_new_account, true);
});

test("ONB-V1: an unconfirmed sign-in on the account step opens the code screen without a new email", async () => {
  const auth = getHungryService().auth;
  const originalSignIn = auth.signIn;
  const originalResend = auth.resendVerificationEmail;
  const { setConfiguredDataSource } =
    require("@/lib/services/supabase/client") as typeof import("@/lib/services/supabase/client");
  let resends = 0;
  auth.signIn = (async () => {
    throw Object.assign(new Error("refused"), { code: "email_not_confirmed" });
  }) as typeof auth.signIn;
  auth.resendVerificationEmail = (async () => {
    resends += 1;
  }) as typeof auth.resendVerificationEmail;
  try {
    const parent = createFakeNavigation();
    const navigation = { ...createFakeNavigation(), getParent: () => parent };
    const view = await renderScreen(OnboardingAuthScreen as never, {
      name: "OnboardingAuth",
      navigation: navigation as never,
    });
    await view.press(allByText(view, "Sign in")[0] ?? null);
    await view.settle();
    const [email, password] = inputs().slice(-2);
    await view.type(email, "Mei@Example.SG");
    await view.type(password, "secret-password");
    // Sign-in reaches the service only with Supabase configured.
    setConfiguredDataSource("supabase");
    await view.press(allByText(view, "Sign in").at(-1) ?? null);
    await view.settle();
    await view.press(view.findByText("Enter the code from the email"));
    assert.equal(resends, 0);
    assert.deepEqual(parent.calls.at(-1), {
      method: "reset",
      args: [
        {
          index: 0,
          routes: [
            {
              name: "AuthStack",
              params: {
                screen: "EmailVerification",
                params: { email: "mei@example.sg", completedOnboarding: true },
              },
            },
          ],
        },
      ],
    });
  } finally {
    setConfiguredDataSource("mock");
    auth.signIn = originalSignIn;
    auth.resendVerificationEmail = originalResend;
  }
});

test("ONB-PF1: after switching from Create account, the Sign in fields keep what is typed", async () => {
  const view = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  await view.press(allByText(view, "Sign in")[0] ?? null);
  await view.settle();
  const [email, password] = inputs();
  await view.type(email, "mei@example.sg");
  await view.type(password, "secret-password");
  assert.deepEqual(
    inputs().map((input) => input.value),
    ["mei@example.sg", "secret-password"],
  );
});

test("ONB-V3: an offline or rate-limited sign-up on the account step is not sent to Sentry", async () => {
  const auth = getHungryService().auth;
  const original = auth.signUp;
  const reported: unknown[] = [];
  const originalConsoleError = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  // reportError logs to the console in development; that is what this test reads.
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[1]);
  };
  try {
    for (const failure of [
      Object.assign(new TypeError("Network request failed"), {}),
      Object.assign(new Error("too many"), { code: "over_email_send_rate_limit", status: 429 }),
    ]) {
      auth.signUp = (async () => {
        throw failure;
      }) as typeof auth.signUp;
      const view = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
      const [name, email, password] = inputs();
      await view.type(name, "Mei");
      await view.type(email, "mei@example.sg");
      await view.type(password, "Str0ng-Passw0rd!");
      await view.press(allByText(view, "Create account").at(-1) ?? null);
      await view.settle();
      await view.unmount();
    }
    assert.deepEqual(reported, []);
  } finally {
    auth.signUp = original;
    console.error = originalConsoleError;
    globals.__DEV__ = previousDev;
  }
});

test("ONB-V5: the account step follows the framing variant once flags load after mount", async () => {
  let loaded = false;
  const listeners: (() => void)[] = [];
  const exposures: string[] = [];
  setExperimentFlagSource({
    peek: (key) => (loaded && key === "onboarding_account_framing_v1" ? "test" : undefined),
    expose: (key) => {
      exposures.push(key);
      return loaded ? "test" : undefined;
    },
    hasLoaded: () => loaded,
    onChange: (callback) => {
      listeners.push(callback);
      return () => undefined;
    },
  });
  const view = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
  assert.match(view.text(), /keep your preferences and discover more/);
  loaded = true;
  listeners.forEach((callback) => callback());
  await view.settle();
  assert.match(view.text(), /the dishes picked for you/);
  assert.deepEqual(exposures, [], "the account step never exposes");
});

test("ONB-V5: with no picks on screen, the test arm keeps the control label", async () => {
  setExperimentOverride("onboarding_account_framing_v1", "test");
  const { getServiceProvider, resetServiceProvider, setServiceProvider } =
    require("@/lib/services/serviceProvider") as typeof import("@/lib/services/serviceProvider");
  const provider = getServiceProvider();
  // The server picks fail to load, so the grid is empty.
  setServiceProvider({
    ...provider,
    mode: "supabase",
    service: {
      ...provider.service,
      recommendations: {
        ...provider.service.recommendations,
        getSlate: async () => {
          throw new Error("offline");
        },
      },
    },
  });
  try {
    const view = await renderScreen(TasteProfileResultScreen as never, {
      name: "TasteProfileResult",
    });
    await view.settle();
    assert.ok(view.findByText("Try again"), "the load failed");
    assert.ok(view.findByText("Start exploring"));
    assert.equal(view.findByText("Save my picks"), null);
  } finally {
    resetServiceProvider();
  }
});

test("ONB-7: the dietary step scrolls as one, so the budget is reachable at large text", async () => {
  const view = await renderScreen(TasteQuizScreen as never, {
    name: "DietaryPreferences",
    params: { mode: "onboarding", initialPhase: "dietary" },
  });
  const scroll = view.findByTestId("dietary-step-scroll");
  assert.ok(scroll);
  const budget = view.findByLabel(/^Budget /);
  assert.ok(budget && scroll!.contains(budget), "the budget chips are inside the one scroll");
  assert.ok(scroll!.contains(view.findByText("Any dietary needs?")), "the heading scrolls too");
  assert.equal(view.findByText("Dietary preferences"), null, "no repeated heading");
});

test("ONB-17: the first-question button in a Profile retake says Cancel", async () => {
  const navigation = createFakeNavigation();
  const view = await renderScreen(TasteQuizScreen as never, {
    name: "TasteQuiz",
    params: { mode: "profile" },
    navigation,
  });
  assert.equal(view.findByText("Skip"), null);
  await view.press(view.findByText("Cancel"));
  assert.deepEqual(navigation.calls.at(-1), { method: "goBack", args: [] });
});

test("ONB-10: when the phone will not ask again, Open settings is the main action", async () => {
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
    assert.ok(view.findByText("Open settings"));
    assert.equal(view.findByText("Allow location"), null);
    assert.ok(view.findByText("Pick my area"));
  } finally {
    Location.getForegroundPermissionsAsync = originalRead;
    useLocationStore.setState({ grantLocation: originalGrant });
  }
});

test("ONB-11: the picker opened from the Location step is the onboarding step, even when the flag is set", async () => {
  useSessionStore.setState({ hasCompletedOnboarding: true });
  const view = await renderScreen(ManualLocationPickerScreen as never, {
    name: "ManualLocationPicker",
    params: { mode: "onboarding" },
  });
  assert.ok(view.findByLabel("Step 1 of 5"));
});

test("ONB-12, ONB-X8: no autofocus under a screen reader, a usable map label, and a spoken result count", async () => {
  const originalEnabled = AccessibilityInfo.isScreenReaderEnabled;
  const originalAnnounce = AccessibilityInfo.announceForAccessibility;
  const announced: string[] = [];
  AccessibilityInfo.isScreenReaderEnabled = async () => true;
  AccessibilityInfo.announceForAccessibility = (message: string) => {
    announced.push(message);
  };
  try {
    const view = await renderScreen(ManualLocationPickerScreen as never, {
      name: "ManualLocationPicker",
      params: { mode: "onboarding" },
    });
    const search = view.findByLabel("Search for an area, mall, hawker centre or address");
    assert.notEqual(
      document.activeElement,
      search,
      "the search is not focused for a screen reader",
    );
    await view.type(search, "Bishan");
    await new Promise((resolve) => setTimeout(resolve, 600));
    await view.settle();
    assert.ok(
      announced.some((message) => /result|No areas/.test(message)),
      `announced: ${JSON.stringify(announced)}`,
    );
    const clear = view.findByLabel("Clear search");
    if (clear) assert.match(clear.getAttribute("style") ?? "", /height: 44px/);
  } finally {
    AccessibilityInfo.isScreenReaderEnabled = originalEnabled;
    AccessibilityInfo.announceForAccessibility = originalAnnounce;
  }
});

test("ONB-13, ONB-X5: the tabs are a tablist and switching tabs clears the last error", async () => {
  const auth = getHungryService().auth;
  const original = auth.signUp;
  auth.signUp = (async () => {
    throw Object.assign(new Error("taken"), { code: "user_already_exists" });
  }) as typeof auth.signUp;
  try {
    const view = await renderScreen(OnboardingAuthScreen as never, { name: "OnboardingAuth" });
    assert.ok(document.querySelector('[role="tablist"]'));
    const [name, email, password] = inputs();
    await view.type(name, "Mei");
    await view.type(email, "mei@example.sg");
    await view.type(password, "Str0ng-Passw0rd!");
    await view.press(allByText(view, "Create account").at(-1) ?? null);
    const errorText = view.text();
    assert.match(errorText, /already|exists|in use|registered/i);
    await view.press(allByText(view, "Sign in")[0] ?? null);
    await view.press(allByText(view, "Create account")[0] ?? null);
    assert.doesNotMatch(view.text(), /already|exists|in use|registered/i);
  } finally {
    auth.signUp = original;
  }
});

test("ONB-16: step_number is the on-screen counter; step_index is the position in the flow", () => {
  assert.equal(visibleStepNumber("welcome"), 0);
  assert.equal(visibleStepNumber("location"), 1);
  assert.equal(visibleStepNumber("done"), 4);
  assert.equal(visibleStepNumber("account"), 5);
  trackOnboardingStepViewed("location");
  const [viewed] = events("onboarding_step_viewed");
  assert.equal(viewed?.properties.step_number, 1);
  assert.equal(viewed?.properties.step_index, 2);
});
