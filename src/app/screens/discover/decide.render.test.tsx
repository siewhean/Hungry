// Decide for Me quiz and result, clicked through with a controlled search pool.
// Run with `node scripts/test-render.mjs src/app/screens/discover/decide.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { act } from "react";
import { AccessibilityInfo } from "react-native";

import { DecideForMeQuizScreen } from "@/app/screens/discover/DecideForMeQuizScreen";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  EXPERIMENTS,
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { WheelResultModal } from "@/app/screens/wheel/WheelResultModal";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useWheelStore } from "@/store/useWheelStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail, SearchFilters, TasteVector } from "@/types/domain";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const HERE = { latitude: 1.3521, longitude: 103.8198 };

function dish(id: string, name: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id,
    venueId: `venue-${id}`,
    buildingId: "b",
    venueName: `${name} Stall`,
    unitNumber: "01-01",
    floor: "L1",
    name,
    imageUrl: "",
    distanceMeters: 120,
    rating: 4.5,
    reviewCount: 10,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: { sweet: 8, spicy: 2, sour: 3, salty: 6, rich: 7, aromatic: 4 },
    tasteConfidence: 1,
    dietaryFlags: [],
    gallery: [],
    mustOrder: false,
    availabilityFlags: [],
    reviews: [],
    ...overrides,
  };
}

const discovery = getHungryService().discovery;
const originals = {
  searchDishes: discovery.searchDishes,
  getVenuesByIds: discovery.getVenuesByIds,
  getVenue: discovery.getVenue,
};
let searchCalls: SearchFilters[] = [];

function serve(pool: DishDetail[] | (() => Promise<DishDetail[]>)) {
  searchCalls = [];
  discovery.searchDishes = (async (filters: SearchFilters) => {
    searchCalls.push(filters);
    const dishes = typeof pool === "function" ? await pool() : pool;
    return dishes.map((item) => ({ dish: item, score: 1 }));
  }) as typeof discovery.searchDishes;
  discovery.getVenuesByIds = (async () => []) as typeof discovery.getVenuesByIds;
  discovery.getVenue = (async () => {
    throw new Error("no venue");
  }) as typeof discovery.getVenue;
}

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((record) => record.event === name);

beforeEach(async () => {
  await enterScenario("guest");
  useLocationStore.setState({ permission: "granted", currentLocation: HERE });
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, tasteVector: NEUTRAL, favouriteDishIds: [] },
    tasteInteractionEvents: [],
  }));
  useSessionStore.setState({ hasSkippedTasteQuiz: true });
  useDiscoveryStore.getState().setDecideForMe(undefined);
  clearTrackedAnalyticsEvents();
});

afterEach(async () => {
  await cleanup();
  Object.assign(discovery, originals);
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

const renderResult = (params?: object, navigation = createFakeNavigation()) =>
  renderScreen(DecideForMeResultScreen as never, { name: "DecideForMeResult", params, navigation });

test("a guest without a taste profile sees Popular nearby, and the app's pick is not logged as a click", async () => {
  serve([dish("a", "Chicken Rice"), dish("b", "Laksa")]);
  const view = await renderResult({ surface: "push" });
  assert.match(view.text(), /Chicken Rice/);
  assert.match(view.text(), /Popular nearby/);
  assert.doesNotMatch(view.text(), /taste match|dialled in/);
  assert.equal(useProfileStore.getState().tasteInteractionEvents.length, 0);
  assert.deepEqual(useProfileStore.getState().profile.tasteVector, NEUTRAL);
});

test("Not for me does not refetch the pool, and never offers a turned-down dish again", async () => {
  serve([dish("a", "Chicken Rice"), dish("b", "Laksa")]);
  const view = await renderResult({ surface: "push" });
  assert.equal(searchCalls.length, 1);
  assert.equal(searchCalls[0].limit, 50, "Decide asks for the full pool");

  await view.press(view.findByText("Not for me"));
  assert.match(view.text(), /Laksa/);
  assert.equal(searchCalls.length, 1, "the taste signal does not reload the pool");
  assert.equal(useProfileStore.getState().tasteInteractionEvents.length, 1);
  assert.doesNotMatch(view.text(), /taste match/, "a dismissal does not make a profile");

  // The second dismissal empties the pool: the radius widens, the same two dishes come back and
  // stay hidden, so the screen says so instead of looping A, B, A.
  await view.press(view.findByText("Not for me"));
  assert.equal(searchCalls.length, 2);
  assert.equal(searchCalls[1].radius, 1000);
  assert.match(view.text(), /That's everything nearby/);
  assert.match(view.text(), /You've seen every match within 1\.0 km/);
  assert.equal(view.findByText("Chicken Rice"), null);
  assert.equal(events("decide_for_me_no_match").length, 0, "seen everything is not no-match");
});

test("a failed load says so and retries, instead of claiming no match", async () => {
  let fail = true;
  serve(async () => {
    if (fail) throw new Error("offline");
    return [dish("a", "Chicken Rice")];
  });
  const view = await renderResult({ surface: "push" });
  assert.match(view.text(), /Couldn't load picks/);
  assert.doesNotMatch(view.text(), /No match found/);
  assert.equal(events("decide_for_me_no_match").length, 0);

  fail = false;
  await view.press(view.findByText("Try again"));
  assert.match(view.text(), /Chicken Rice/);
});

test("a pick left from an earlier visit is not shown or logged while the pool loads", async () => {
  useDiscoveryStore.getState().setDecideForMe(dish("stale", "Old Lunch Pick"));
  let release: (dishes: DishDetail[]) => void = () => undefined;
  serve(() => new Promise<DishDetail[]>((resolve) => (release = resolve)));
  const view = await renderResult({ surface: "push" });
  assert.match(view.text(), /Finding a dish near you/);
  assert.doesNotMatch(view.text(), /Old Lunch Pick/);
  assert.equal(events("decide_for_me_result_shown").length, 0);

  await act(async () => release([dish("a", "Chicken Rice")]));
  await view.settle();
  assert.match(view.text(), /Chicken Rice/);
  assert.deepEqual(
    events("decide_for_me_result_shown").map((record) => record.properties.dish_id),
    ["a"],
  );
});

test("a dish with no price says Price not listed, never S$0.00", async () => {
  serve([
    dish("a", "Mystery Noodles", { price: 0, priceRange: "" }),
    dish("b", "Laksa", { price: 0 }),
  ]);
  const view = await renderResult({ surface: "push" });
  assert.match(view.text(), /Price not listed/);
  assert.doesNotMatch(view.text(), /S\$0\.00/);
  assert.equal(view.findByLabel(/S\$0\.00/), null);
});

test("quiz answers are sent to the search, shown as chips, and a dropped answer is called out", async () => {
  serve([dish("a", "Chicken Rice", { price: 4 }), dish("b", "Fish Soup", { price: 6 })]);
  const navigation = createFakeNavigation();
  const answers = { cuisine: "japanese-korean", price: "under5" };
  const view = await renderResult({ surface: "discover", answers }, navigation);
  assert.equal(searchCalls[0].maxPrice, 5);
  assert.match(view.text(), /Chicken Rice/);
  assert.match(view.text(), /Japanese or Korean \(left out\)/);
  assert.match(view.text(), /Under S\$5/);
  assert.match(view.text(), /fits Japanese or Korean as well as your other answers/);

  await view.press(view.findByText("Change answers"));
  assert.deepEqual(navigation.calls.at(-1), {
    method: "replace",
    args: ["DecideForMeQuiz", { answers }],
  });
});

test("the price answer is dropped and retried once when nothing nearby is under it", async () => {
  serve(async () =>
    searchCalls.at(-1)?.maxPrice ? [] : [dish("a", "Wagyu Ramen", { price: 18 })],
  );
  const view = await renderResult({ surface: "discover", answers: { price: "under5" } });
  assert.deepEqual(
    searchCalls.map((call) => call.maxPrice),
    [5, undefined],
  );
  assert.match(view.text(), /Wagyu Ramen/);
  assert.match(view.text(), /Under S\$5 \(left out\)/);
});

// ---- Quiz ----

function navigationWithListeners() {
  const navigation = createFakeNavigation();
  const listeners: Record<string, ((event: { preventDefault(): void }) => void)[]> = {};
  Object.assign(navigation, {
    addListener: (name: string, callback: (event: { preventDefault(): void }) => void) => {
      (listeners[name] ??= []).push(callback);
      return () => {
        listeners[name] = listeners[name].filter((item) => item !== callback);
      };
    },
  });
  /** Fires beforeRemove as a hardware back would; true when the screen stopped it. */
  const systemBack = async () => {
    let prevented = false;
    await act(async () => {
      for (const listener of listeners.beforeRemove ?? []) {
        listener({ preventDefault: () => (prevented = true) });
      }
    });
    return prevented;
  };
  return { navigation, systemBack };
}

/** Lets taps through the double-tap guard by moving the clock on. */
function advanceClock() {
  const realNow = Date.now;
  let offset = 0;
  Date.now = () => realNow() + offset;
  return {
    step: () => (offset += 1000),
    restore: () => (Date.now = realNow),
  };
}

const renderQuiz = (navigation = createFakeNavigation(), params?: object) =>
  renderScreen(DecideForMeQuizScreen as never, { name: "DecideForMeQuiz", navigation, params });

test("system back steps back through the quiz, and leaves only from the first question", async () => {
  const clock = advanceClock();
  try {
    const { navigation, systemBack } = navigationWithListeners();
    const view = await renderQuiz(navigation as never);
    await view.press(view.findByLabel("Malay"));
    assert.match(view.text(), /QUESTION 2 OF 4/);
    assert.equal(await systemBack(), true);
    assert.match(view.text(), /QUESTION 1 OF 4/);
    assert.equal(await systemBack(), false, "at question 1 back leaves the quiz");
  } finally {
    clock.restore();
  }
});

test("MAP-V1: the iOS swipe is blocked natively (usePreventRemove) only after question 1", async () => {
  const clock = advanceClock();
  try {
    const navigation = createFakeNavigation();
    const view = await renderQuiz(navigation);
    assert.equal(navigation.isRemovePrevented(), false, "question 1: the swipe leaves the quiz");
    await view.press(view.findByLabel("Malay"));
    assert.match(view.text(), /QUESTION 2 OF 4/);
    assert.equal(navigation.isRemovePrevented(), true, "question 2: native dismiss is prevented");
  } finally {
    clock.restore();
  }
});

test("MAP-V1: the last answer still reaches the result, with removal no longer prevented", async () => {
  const clock = advanceClock();
  try {
    const navigation = createFakeNavigation();
    const preventedAtReplace: boolean[] = [];
    const record = navigation.replace;
    navigation.replace = (...args: unknown[]) => {
      preventedAtReplace.push(navigation.isRemovePrevented());
      record(...args);
    };
    const view = await renderQuiz(navigation);
    for (const label of ["Malay", "Rice", "Under S$8", "Spicy"]) {
      clock.step();
      await view.press(view.findByLabel(label));
    }
    assert.equal(navigation.calls.filter((call) => call.method === "replace").length, 1);
    assert.deepEqual(preventedAtReplace, [false]);
  } finally {
    clock.restore();
  }
});

test("a double tap answers one question, not the next one too", async () => {
  const view = await renderQuiz();
  await view.press(view.findByLabel("Malay"));
  // The next question's tile in the same slot, tapped straight after.
  await view.press(view.findByLabel("Rice"));
  assert.match(view.text(), /QUESTION 2 OF 4/);
});

test("finishing the quiz sends decide_quiz_completed once, announces each question, and passes the answers on", async () => {
  const clock = advanceClock();
  const announced: string[] = [];
  const originalAnnounce = AccessibilityInfo.announceForAccessibility;
  AccessibilityInfo.announceForAccessibility = (message: string) => announced.push(message);
  try {
    const navigation = createFakeNavigation();
    const view = await renderQuiz(navigation);
    for (const label of ["Malay", "Rice", "Under S$8", "Spicy"]) {
      clock.step();
      await view.press(view.findByLabel(label));
    }
    assert.ok(announced.includes("Question 2 of 4. Rice, noodles or something else?"));
    assert.deepEqual(
      navigation.calls.filter((call) => call.method === "replace"),
      [
        {
          method: "replace",
          args: [
            "DecideForMeResult",
            {
              surface: "discover",
              answers: { cuisine: "malay", staple: "rice", price: "under8", flavour: "spicy" },
            },
          ],
        },
      ],
    );
    assert.equal(events("decide_quiz_completed").length, 1);
    assert.equal(events("decide_quiz_completed")[0].properties.answered, 4);
    assert.equal(events("decide_for_me_triggered").length, 0, "Discover already counted the tap");
  } finally {
    AccessibilityInfo.announceForAccessibility = originalAnnounce;
    clock.restore();
  }
});

test("Change answers reopens the quiz with the earlier answers selected", async () => {
  const view = await renderQuiz(createFakeNavigation(), { answers: { cuisine: "malay" } });
  // react-native-web drops aria-selected on buttons; the selected tile has the 2 px border.
  assert.match(view.findByLabel("Malay")?.getAttribute("style") ?? "", /border-top-width: 2px/);
  assert.match(view.findByLabel("Chinese")?.getAttribute("style") ?? "", /border-top-width: 1px/);
});

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: 0 };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures += 1;
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  return { state, source };
}

test("decide_quiz_v1: two_questions asks cuisine and price only; control asks all four", async () => {
  // A draft never reads PostHog, so preview the arms with QA overrides.
  setExperimentOverride("decide_quiz_v1", "two_questions");
  const view = await renderQuiz();
  assert.match(view.text(), /QUESTION 1 OF 2/);
  await view.press(view.findByLabel("Malay"));
  assert.match(view.text(), /How much do you want to spend\?/);
  await view.unmount();

  setExperimentOverride("decide_quiz_v1", "control");
  const controlView = await renderQuiz();
  assert.match(controlView.text(), /QUESTION 1 OF 4/);
  setExperimentOverride("decide_quiz_v1", null);
});

test("WheelResultModal shows the winner with the dark-on-amber Winner badge", async () => {
  const repository = getDataRepository();
  const venue = repository.getVenueById(repository.listPopularNearby()[0].venueId)!;
  useWheelStore.setState({
    entries: [
      {
        id: "entry-1",
        partyId: "p1",
        addedByMemberId: "m1",
        venueId: venue.id,
        buildingId: venue.buildingId,
        label: venue.name,
        imageUrl: "",
        isEliminated: false,
        position: 0,
        addedAt: new Date().toISOString(),
      },
    ],
  });
  const view = await renderScreen(WheelResultModal as never, {
    name: "WheelResult",
    params: { winnerEntryId: "entry-1" },
  });
  assert.match(view.text(), /Winner/);
  assert.match(view.text(), new RegExp(venue.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

/** Runs `body` as if decide_quiz_v1 were live, so the flag source is really consulted. */
async function whileRunning(body: () => Promise<void>) {
  const definition = EXPERIMENTS.decide_quiz_v1 as { status: string };
  const status = definition.status;
  definition.status = "running";
  try {
    await body();
  } finally {
    definition.status = status;
  }
}

test("decide_quiz_v1: the quiz exposes once, people who only see the result screen are not exposed", async () => {
  await whileRunning(async () => {
    const flags = fakeFlags({ decide_quiz_v1: "two_questions" });
    setExperimentFlagSource(flags.source);
    const quiz = await renderQuiz();
    assert.match(quiz.text(), /QUESTION 1 OF 2/);
    assert.equal(flags.state.exposures, 1, "the quiz exposes the arm it shows");
    await quiz.unmount();
    resetExperimentSession();

    const resultFlags = fakeFlags({ decide_quiz_v1: "two_questions" });
    setExperimentFlagSource(resultFlags.source);
    serve([dish("a", "Chicken Rice")]);
    await renderResult({ surface: "push" });
    assert.equal(resultFlags.state.exposures, 0);
  });
});

test("MAP-V5: flags that load after the quiz opens keep the four questions and expose no one", async () => {
  await whileRunning(async () => {
    let loaded = false;
    const changeListeners: (() => void)[] = [];
    let exposures = 0;
    setExperimentFlagSource({
      peek: () => (loaded ? "two_questions" : undefined),
      expose: () => {
        exposures += 1;
        return loaded ? "two_questions" : undefined;
      },
      hasLoaded: () => loaded,
      onChange: (listener) => {
        changeListeners.push(listener);
        return () => undefined;
      },
    });
    const view = await renderQuiz();
    assert.match(view.text(), /QUESTION 1 OF 4/);
    await act(async () => {
      loaded = true;
      for (const listener of changeListeners) listener();
    });
    assert.match(view.text(), /QUESTION 1 OF 4/);
    assert.equal(exposures, 0, "nobody is counted in two_questions after seeing four questions");
  });
});
