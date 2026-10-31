// Decide for Me quiz and result, clicked through with a controlled search pool.
// Run with `node scripts/test-render.mjs src/app/screens/discover/decide.render.test.tsx`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach } from "node:test";
import { act } from "react";
import { AccessibilityInfo } from "react-native";

import { DecideForMeQuizScreen } from "@/app/screens/discover/DecideForMeQuizScreen";
import { DecideForMeResultScreen } from "@/app/screens/discover/DecideForMeResultScreen";
import { DAY_ORDER, getSingaporeDay } from "@/utils/operatingHours";
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

  await view.press(view.findByText("Another pick"));
  assert.match(view.text(), /Laksa/);
  assert.equal(searchCalls.length, 1, "the taste signal does not reload the pool");
  assert.equal(useProfileStore.getState().tasteInteractionEvents.length, 1);
  assert.doesNotMatch(view.text(), /taste match/, "a dismissal does not make a profile");

  // The second dismissal empties the pool: the radius widens, the same two dishes come back and
  // stay hidden, so the screen says so instead of looping A, B, A.
  await view.press(view.findByText("Another pick"));
  assert.equal(searchCalls.length, 2);
  assert.equal(searchCalls[1].radius, 2000);
  assert.match(view.text(), /You've seen every match within 2\.0 km/);
  assert.doesNotMatch(view.text(), /That's every match|That's everything nearby/, "said once");
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

test("the price answer is dropped only after wider radii also hold nothing under it", async () => {
  serve(async () =>
    searchCalls.at(-1)?.maxPrice ? [] : [dish("a", "Wagyu Ramen", { price: 18 })],
  );
  const view = await renderResult({ surface: "discover", answers: { price: "under5" } });
  assert.deepEqual(
    searchCalls.map((call) => [call.radius, call.maxPrice]),
    [
      [1000, 5],
      [2000, 5],
      [4000, 5],
      [1000, undefined],
    ],
  );
  assert.match(view.text(), /Wagyu Ramen/);
  assert.match(view.text(), /Under S\$5 \(left out\)/);
});

test("MD-D4 cuisine and staple answers go to the server, and a wider radius is tried before an answer is dropped", async () => {
  serve(async () =>
    searchCalls.at(-1)?.radius === 2000
      ? [dish("a", "Wanton Mee", { foodTypeTag: "Noodles", cuisineTags: ["Chinese"] })]
      : [],
  );
  const view = await renderResult({
    surface: "discover",
    answers: { cuisine: "chinese", staple: "noodles" },
  });
  assert.deepEqual(
    searchCalls.map((call) => call.radius),
    [1000, 2000],
  );
  assert.ok(searchCalls[0].cuisineKeywords?.includes("chinese"));
  assert.ok(searchCalls[0].stapleKeywords?.includes("noodle"));
  assert.match(view.text(), /Wanton Mee/);
  assert.doesNotMatch(view.text(), /left out/, "a match one step out keeps every answer");
  assert.ok(view.container.querySelector('[aria-label="Your answers: Chinese, Noodles"]'));
});

test("MD-D4 when no radius fits, answers are dropped staple first, cuisine next", async () => {
  serve(async () => {
    const last = searchCalls.at(-1);
    return last?.stapleKeywords || last?.cuisineKeywords
      ? []
      : [dish("a", "Chicken Rice", { foodTypeTag: "Rice Dishes" })];
  });
  const view = await renderResult({
    surface: "discover",
    answers: { cuisine: "malay", staple: "soup" },
  });
  const shape = searchCalls.map((call) => [
    call.radius,
    Boolean(call.cuisineKeywords),
    Boolean(call.stapleKeywords),
  ]);
  assert.deepEqual(shape.slice(-2), [
    [1000, true, false],
    [1000, false, false],
  ]);
  assert.match(view.text(), /Chicken Rice/);
  assert.match(view.text(), /Malay \(left out\)/);
  assert.match(view.text(), /Soup \(left out\)/);
});

test("MD-D12 the radius starts at 1 km and the chips pick another one", async () => {
  serve([dish("a", "Chicken Rice")]);
  const view = await renderResult({ surface: "push" });
  assert.equal(searchCalls[0].radius, 1000);
  const chips = view.container.querySelectorAll('[aria-label^="Search within"]');
  assert.equal(chips.length, 4);
  assert.ok(
    view.container.querySelector('[aria-label="Search within 1 kilometres, selected"]'),
    "the radius in use is announced as selected",
  );
  await view.press(view.container.querySelector('[aria-label="Search within 4 kilometres"]'));
  assert.equal(searchCalls.at(-1)?.radius, 4000);
  assert.ok(view.container.querySelector('[aria-label="Search within 4 kilometres, selected"]'));
  assert.equal(events("decide_for_me_radius_picked").length, 1);
  // Picking the radius already shown looks again rather than doing nothing.
  const before = searchCalls.length;
  await view.press(
    view.container.querySelector('[aria-label="Search within 4 kilometres, selected"]'),
  );
  assert.equal(searchCalls.length, before + 1);
});

test("MD-B10 opening hours are read once per stall for the visit, not again for every radius", async () => {
  serve([dish("a", "Chicken Rice"), dish("b", "Laksa")]);
  const asked: string[][] = [];
  discovery.getVenuesByIds = (async (ids: string[]) => {
    asked.push(ids);
    return ids.map((id) => ({
      id,
      name: id,
      operatingHours: "Daily 12am-11:59pm",
      isOpen: true,
    }));
  }) as unknown as typeof discovery.getVenuesByIds;
  const view = await renderResult({ surface: "push" });
  assert.equal(asked.length, 1);
  await view.press(view.container.querySelector('[aria-label="Search within 4 kilometres"]'));
  assert.equal(asked.length, 1, "the same two stalls are not read again");
});

test("MD-D8 Other picks name the stall and say why they are offered", async () => {
  serve([
    dish("a", "Laksa", { distanceMeters: 100, price: 6 }),
    dish("b", "Chicken Rice", { venueName: "Tian Tian", distanceMeters: 300, price: 4 }),
    dish("c", "Chicken Rice", {
      venueName: "Ah Tai",
      distanceMeters: 250,
      price: 7,
      rating: 4.9,
    }),
  ]);
  const view = await renderResult({ surface: "push" });
  // The best rated stall leads; the backups name their stalls and what they beat it on.
  assert.match(view.text(), /Tian Tian · S\$4\.00 · 300 m away/);
  assert.match(view.text(), /Laksa Stall · S\$6\.00 · 100 m away/);
  assert.match(view.text(), /Closer · Cheaper/);
});

test("MD-D11 Directions is offered, and opens the stall's Google Maps search, when the stall read fails", async () => {
  serve([dish("a", "Chicken Rice", { venueName: "Tian Tian" })]);
  const view = await renderResult({ surface: "push" });
  await view.settle();
  assert.ok(view.findByText("Directions"));
});

test("MD-D7 when every stall is closed the screen says so first and does not repeat Closed", async () => {
  const today = getSingaporeDay();
  const otherDay = DAY_ORDER[(DAY_ORDER.indexOf(today) + 3) % 7];
  serve([dish("a", "Chicken Rice")]);
  discovery.getVenuesByIds = (async () => [
    {
      id: "venue-a",
      name: "Chicken Rice Stall",
      operatingHours: `${otherDay} 10am-11am`,
      isOpen: false,
    },
  ]) as unknown as typeof discovery.getVenuesByIds;
  const view = await renderResult({ surface: "push" });
  await view.settle();
  assert.match(view.text(), /Everything within 1\.0 km is closed right now/);
  assert.match(view.text(), /Closed/);
  assert.doesNotMatch(view.text(), /Closed · Closed/);
});

test("MD-D13 skipping the questions offers Answer a few questions, not Change answers", async () => {
  serve([dish("a", "Chicken Rice")]);
  const navigation = createFakeNavigation();
  const view = await renderResult({ surface: "discover", answers: {} }, navigation);
  await view.settle();
  assert.equal(view.findByText("Change answers"), null);
  await view.press(view.findByText("Answer a few questions"));
  assert.equal(navigation.calls.at(-1)?.method, "replace");
});

test("MD-D1 the headline match sits between the lowest and highest Palate match bar", async () => {
  useSessionStore.setState({ hasSkippedTasteQuiz: false });
  const user = { sweet: 6, spicy: 6, sour: 6, salty: 6, rich: 6, aromatic: 6 };
  useProfileStore.setState((state) => ({ profile: { ...state.profile, tasteVector: user } }));
  serve([
    dish("a", "Chicken Rice", {
      tasteVector: { sweet: 9, spicy: 9, sour: 8, salty: 7, rich: 9, aromatic: 8 },
    }),
  ]);
  const view = await renderResult({ surface: "push" });
  await view.settle();
  const headline = Number(/(\d+)% taste match/.exec(view.text())?.[1]);
  const bars = [...view.text().matchAll(/(?:Sweet|Spicy|Sour|Salty|Rich|Aroma\w*)(\d+)%/g)].map(
    (match) => Number(match[1]),
  );
  assert.equal(bars.length, 6, view.text());
  assert.ok(
    headline <= Math.max(...bars) && headline >= Math.min(...bars),
    `${headline} vs ${bars}`,
  );
});

test("MD-D5 the dish name and stall come before the badges, chips and explanation", async () => {
  serve([dish("a", "Chicken Rice", { venueName: "Tian Tian" })]);
  const view = await renderResult({ surface: "discover", answers: { price: "under5" } });
  const text = view.text();
  const nameAt = text.indexOf("Chicken Rice");
  assert.ok(nameAt >= 0);
  for (const later of ["Popular nearby", "Under S$5", "Within", "Why this dish?"]) {
    assert.ok(text.indexOf(later) > nameAt, `${later} comes after the dish name`);
  }
});

test("MD-D6 Another pick sits in the dock next to Directions and asks for the next dish", async () => {
  serve([dish("a", "Chicken Rice"), dish("b", "Laksa")]);
  const view = await renderResult({ surface: "push" });
  const dock = view.findByLabel("Another pick instead of Chicken Rice")!.parentElement!;
  assert.ok(dock.textContent?.includes("Directions"), "same row as Directions");
  await view.press(view.findByText("Another pick"));
  assert.match(view.text(), /Laksa/);
});

test("decide_initial_radius_v1: the control arm starts at 0.5 km, the shipped arm at 1 km", async () => {
  setExperimentOverride("decide_initial_radius_v1", "control");
  try {
    serve([dish("a", "Chicken Rice")]);
    const view = await renderResult({ surface: "push" });
    assert.equal(searchCalls[0].radius, 500);
    assert.ok(
      view.container.querySelector('[aria-label="Search within 0.5 kilometres, selected"]'),
    );
  } finally {
    setExperimentOverride("decide_initial_radius_v1", null);
  }
});

test("MD-A1 Another pick and an Other pick are each counted", async () => {
  serve([dish("a", "Chicken Rice"), dish("b", "Laksa"), dish("c", "Fish Soup")]);
  const view = await renderResult({ surface: "push" });
  await view.press(view.findByText("Another pick"));
  assert.deepEqual(
    events("decide_reroll").map((record) => record.properties),
    [{ surface: "push", seen: 1 }],
  );
  await view.press(view.findByLabel(/^Pick /));
  assert.equal(events("decide_other_pick").length, 1);
  assert.equal(events("decide_other_pick")[0].properties.position, 0);
});

test("MD-D9 picking an Other pick or Another pick scrolls back to the top", async () => {
  const scrolls: unknown[] = [];
  const original = HTMLElement.prototype.scroll;
  HTMLElement.prototype.scroll = function (arg?: unknown) {
    scrolls.push(arg);
  } as typeof HTMLElement.prototype.scroll;
  try {
    serve([dish("a", "Chicken Rice"), dish("b", "Laksa"), dish("c", "Fish Soup")]);
    const view = await renderResult({ surface: "push" });
    await view.press(view.findByLabel(/^Pick Laksa|^Pick Fish Soup/));
    assert.ok(scrolls.length >= 1, "scrolled after an Other pick");
    const before = scrolls.length;
    await view.press(view.findByText("Another pick"));
    assert.ok(scrolls.length > before, "scrolled after Another pick");
  } finally {
    HTMLElement.prototype.scroll = original;
  }
});

test("MD-D10 the end state offers Change answers and Start over", async () => {
  serve([dish("a", "Chicken Rice")]);
  const navigation = createFakeNavigation();
  const view = await renderResult(
    { surface: "discover", answers: { price: "under5" } },
    navigation,
  );
  await view.press(view.findByText("Another pick"));
  await view.settle();
  assert.match(view.text(), /You've seen every match within/);
  assert.ok(view.findByText("Change answers"), "Change answers is offered");
  await view.press(view.findByText("Start over"));
  assert.deepEqual(navigation.calls.at(-1), {
    method: "replace",
    args: ["DecideForMeQuiz", {}],
  });
});

test("MD-D3 with no location the result screen asks for it instead of the area picker", async () => {
  useLocationStore.setState({ permission: "unknown", manualCoordinate: undefined });
  serve([dish("a", "Chicken Rice")]);
  const view = await renderResult({ surface: "push" });
  assert.ok(view.findByTestId("location-gate"));
  assert.equal(view.findByText("Choose your area"), null);
  assert.equal(searchCalls.length, 0, "nothing is searched without a location");
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

test("MD-D3 with no location fix the quiz asks for location before question 1", async () => {
  useLocationStore.setState({ permission: "unknown", manualCoordinate: undefined });
  const view = await renderQuiz();
  assert.ok(view.findByTestId("location-gate"));
  assert.doesNotMatch(view.text(), /QUESTION 1 OF/);
  assert.match(view.text(), /Where are you eating\?/);
});

test("MD-D3 once a location is known the quiz starts at question 1", async () => {
  const view = await renderQuiz();
  assert.equal(view.findByTestId("location-gate"), null);
  assert.match(view.text(), /QUESTION 1 OF/);
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

test("MD-A1 each question reached is counted once, so the drop-off step can be read", async () => {
  const clock = advanceClock();
  try {
    const view = await renderQuiz();
    await view.press(view.findByLabel("Malay"));
    clock.step();
    await view.press(view.findByLabel("Rice"));
    assert.deepEqual(
      events("decide_quiz_step_viewed").map((record) => record.properties),
      [
        { step: 1, questions: 4 },
        { step: 2, questions: 4 },
        { step: 3, questions: 4 },
      ],
    );
  } finally {
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

test("R5-9 the page is called Your pick, and the end state says it once", async () => {
  serve([dish("a", "Chicken Rice")]);
  const view = await renderResult({ surface: "push" });
  await view.settle();
  assert.match(view.text(), /Your pick/);
  assert.doesNotMatch(view.text(), /Recommended/);
});

test("R5-1 a pick with no photo shows the designed plate and a short hero", async () => {
  serve([dish("a", "Chicken Rice")]);
  const view = await renderResult({ surface: "push" });
  await view.settle();
  assert.ok(view.findByLabel("Chicken Rice, no photo yet"));
  const src = readFileSync("src/app/screens/discover/DecideForMeResultScreen.tsx", "utf8");
  assert.match(src, /NO_PHOTO_HERO_HEIGHT = 120/);
  assert.match(
    src,
    /dish\?\.imageUrl\s*\? screenWidth \* HERO_HEIGHT_RATIO\s*: insets\.top \+ NO_PHOTO_HERO_HEIGHT/,
  );
});

test("R5-8 a pick that is closed until later puts Another pick first and Directions second", async () => {
  const today = getSingaporeDay();
  const otherDay = DAY_ORDER[(DAY_ORDER.indexOf(today) + 3) % 7];
  serve([dish("a", "Chicken Rice")]);
  discovery.getVenuesByIds = (async () => [
    {
      id: "venue-a",
      name: "Chicken Rice Stall",
      operatingHours: `${otherDay} 10am-11am`,
      isOpen: false,
    },
  ]) as unknown as typeof discovery.getVenuesByIds;
  const view = await renderResult({ surface: "push" });
  await view.settle();
  assert.ok(view.findByText("Directions"), "Directions is still offered");
  assert.ok(view.findByLabel("Another pick instead of Chicken Rice"));
  const src = readFileSync("src/app/screens/discover/DecideForMeResultScreen.tsx", "utf8");
  assert.match(src, /label="Directions"\s+variant=\{isClosedPick \? "secondary" : "primary"\}/);
  assert.match(src, /label="Another pick"\s+variant=\{isClosedPick \? "primary" : "secondary"\}/);
});

test("R5-10 the open answer is a row under the grid labelled Any is fine, not a tile", async () => {
  const navigation = createFakeNavigation();
  const view = await renderQuiz(navigation);
  assert.ok(view.findByLabel("Any is fine"));
  assert.equal(view.findByLabel("Decide for me"), null, "no Decide for me tile in the grid");
  await view.press(view.findByLabel("Any is fine"));
  assert.match(view.text(), /QUESTION 2 OF 4/);
});

test("R5-5 the Decide back button is 44 pt, and distances read '120 m away'", async () => {
  serve([dish("a", "Chicken Rice")]);
  const view = await renderResult({ surface: "push" });
  await view.settle();
  assert.match(view.text(), /120 m away/);
  const src = readFileSync("src/app/screens/discover/DecideForMeResultScreen.tsx", "utf8");
  assert.match(src, /const BACK_BUTTON_SIZE = 44;/);
  assert.match(src, /width: BACK_BUTTON_SIZE,\s+height: BACK_BUTTON_SIZE/);
});
