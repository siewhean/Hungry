import assert from "node:assert/strict";
import test from "node:test";

import { dishes, venues } from "@/lib/services/mock/data";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import type { DishDetail, VenueSummary } from "@/types/domain";

import { tasteMatchPercent } from "@/lib/ai/tasteEngine";
import { clearExperimentOverrides, setExperimentOverride } from "@/lib/experiments/experiments";

import {
  decideInitialRadiusMeters,
  formatOpenLabel,
  isVenueOpenNow,
  keepScoreOrder,
  minutesUntilOpening,
  preferOpenStalls,
  rankDecideCandidates,
} from "./decideForMeCandidates";

const baseDish = dishes[0]!;
const baseVenue = venues[0]!;

function dish(id: string, venueId: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return { ...baseDish, id, venueId, distanceMeters: 100, ...overrides };
}

function venue(id: string, operatingHours: string, isOpen = true): VenueSummary {
  return { ...baseVenue, id, operatingHours, isOpen, openingSchedule: undefined };
}

// Tuesday 22:00 in Singapore (14:00 UTC).
const TEN_PM_SGT = new Date("2026-10-20T14:00:00Z");

test("the map's open check uses the merchant's weekly schedule over the listed hours", () => {
  // Listed hours say lunch only, but the merchant now opens for supper on Tuesdays.
  const stall: VenueSummary = {
    ...venue("schedule-stall", "Mon-Sun 11am-2pm"),
    openingSchedule: { weekly: { tue: [{ open: "18:00", close: "23:30" }] } },
  };
  assert.equal(isVenueOpenNow(stall, TEN_PM_SGT), true);
  assert.equal(isVenueOpenNow(venue("lunch-only", "Mon-Sun 11am-2pm"), TEN_PM_SGT), false);
  assert.equal(isVenueOpenNow(venue("no-hours", "", false), TEN_PM_SGT), false);
});

test("Decide for Me skips a stall that closed hours ago", () => {
  const lunchOnly = venue("lunch-stall", "Mon-Sun 11am-2pm");
  const supper = venue("supper-stall", "Mon-Sun 6pm-11:30pm");
  const result = preferOpenStalls(
    [dish("lunch-dish", lunchOnly.id), dish("supper-dish", supper.id)],
    new Map([
      [lunchOnly.id, lunchOnly],
      [supper.id, supper],
    ]),
    TEN_PM_SGT,
  );
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["supper-dish"],
  );
  assert.equal(result.onlyClosed, false);
  assert.equal(result.openStateByVenueId.get(supper.id)?.status, "open");
});

test("Decide for Me keeps stalls with unknown hours after open ones", () => {
  const open = venue("open-stall", "Mon-Sun 6pm-11:30pm");
  const result = preferOpenStalls(
    [dish("unknown-dish", "no-hours-stall"), dish("open-dish", open.id)],
    new Map([[open.id, open]]),
    TEN_PM_SGT,
  );
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["open-dish", "unknown-dish"],
  );
});

test("Decide for Me falls back to closed stalls only when nothing is open", () => {
  const lunchOnly = venue("lunch-stall", "Mon-Sun 11am-2pm");
  const result = preferOpenStalls(
    [dish("lunch-dish", lunchOnly.id)],
    new Map([[lunchOnly.id, lunchOnly]]),
    TEN_PM_SGT,
  );
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["lunch-dish"],
  );
  assert.equal(result.onlyClosed, true);
  assert.equal(result.openStateByVenueId.get(lunchOnly.id)?.status, "closed");
});

test("Decide for Me ranks server results by taste and treats budget as a preference", () => {
  const cheap = dish("cheap", "v1", { price: 4 });
  const pricey = dish("pricey", "v2", { price: 20 });
  const ranked = rankDecideCandidates([cheap, pricey], {
    tasteVector: NEUTRAL_TASTE_VECTOR,
    dietaryFlags: [],
    radiusMeters: 500,
    maxDishBudget: 5,
  });
  assert.deepEqual(
    ranked.map((candidate) => candidate.id),
    ["cheap"],
  );
  const noneFit = rankDecideCandidates([pricey], {
    tasteVector: NEUTRAL_TASTE_VECTOR,
    dietaryFlags: [],
    radiusMeters: 500,
    maxDishBudget: 5,
  });
  assert.deepEqual(
    noneFit.map((candidate) => candidate.id),
    ["pricey"],
  );
  const tooFar = rankDecideCandidates([dish("far", "v3", { distanceMeters: 5_000 })], {
    tasteVector: NEUTRAL_TASTE_VECTOR,
    dietaryFlags: [],
    radiusMeters: 500,
  });
  assert.equal(tooFar.length, 0);
});

const spicyLover = { ...NEUTRAL_TASTE_VECTOR, spicy: 9, rich: 8 };

test("MD-D2 Decide's order follows the match it shows (mock Maxwell pool)", () => {
  const user = { sweet: 4, spicy: 8, sour: 3, salty: 6, rich: 7, aromatic: 9 };
  const ranked = rankDecideCandidates(
    dishes.filter((item) => item.distanceMeters <= 500),
    { tasteVector: user, dietaryFlags: [], radiusMeters: 500 },
  );
  const shown = ranked.map((item) => tasteMatchPercent(user, item.tasteVector));
  assert.deepEqual(
    shown,
    [...shown].sort((a, b) => b - a),
  );
});

test("equal matches rank nearer first, then better rated", () => {
  const far = dish("far", "v1", { distanceMeters: 400, tasteVector: spicyLover });
  const near = dish("near", "v2", { distanceMeters: 100, tasteVector: spicyLover });
  const ranked = rankDecideCandidates([far, near], {
    tasteVector: spicyLover,
    dietaryFlags: [],
    radiusMeters: 500,
  });
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["near", "far"],
  );
});

test("without a taste profile picks rank by rating, then distance", () => {
  const unrated = dish("unrated", "v1", { rating: 0, reviewCount: 0, distanceMeters: 50 });
  const liked = dish("liked", "v2", { rating: 4.8, reviewCount: 20, distanceMeters: 300 });
  const ranked = rankDecideCandidates([unrated, liked], {
    tasteVector: spicyLover,
    hasTasteProfile: false,
    dietaryFlags: [],
    radiusMeters: 500,
  });
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["liked", "unrated"],
  );
});

test("keepScoreOrder lets near-equal picks swap but never lifts a worse pick over a better one", () => {
  const scores: Record<string, number> = { a: 100, b: 97, c: 96, d: 60, e: 58 };
  const list = ["e", "c", "d", "b", "a"].map((id) => dish(id, `v-${id}`));
  const ordered = keepScoreOrder(list, (item) => scores[item.id]!);
  assert.deepEqual(
    ordered.map((item) => item.id),
    ["a", "c", "b", "d", "e"],
  );
});

test("when everything is closed the stall that opens soonest comes first", () => {
  const late = venue("late", "Mon-Sun 6am-11pm");
  const soon = venue("soon", "Mon-Sun 10:30pm-2am");
  const stalls = new Map([
    [late.id, late],
    [soon.id, soon],
  ]);
  // 05:00 SGT: both closed; the 6am stall opens in an hour, the other in 17.5 hours.
  const result = preferOpenStalls(
    [dish("second", soon.id), dish("first", late.id)],
    stalls,
    new Date("2026-10-20T21:00:00Z"),
  );
  assert.equal(result.onlyClosed, true);
  assert.deepEqual(
    result.candidates.map((item) => item.id),
    ["first", "second"],
  );
});

test("open labels never repeat Closed", () => {
  assert.equal(formatOpenLabel({ status: "open", detail: "Closes 9pm" }), "Open now · Closes 9pm");
  assert.equal(formatOpenLabel({ status: "closed", detail: "Closed today" }), "Closed today");
  assert.equal(formatOpenLabel({ status: "closed", detail: "Opens 7am" }), "Closed · Opens 7am");
  assert.equal(formatOpenLabel({ status: "closed" }), "Closed");
  assert.equal(formatOpenLabel({ status: "unknown" }), undefined);
});

test("decide_initial_radius_v1: 1 km for the shipped arm, 0.5 km for the control arm", () => {
  try {
    assert.equal(decideInitialRadiusMeters(), 1000);
    setExperimentOverride("decide_initial_radius_v1", "control");
    assert.equal(decideInitialRadiusMeters(), 500);
    setExperimentOverride("decide_initial_radius_v1", "one_km");
    assert.equal(decideInitialRadiusMeters(), 1000);
  } finally {
    clearExperimentOverrides();
  }
});

test("a stall with no readable hours is open exactly when its own flag says so", () => {
  assert.equal(isVenueOpenNow(venue("flag-open", "", true), TEN_PM_SGT), true);
  assert.equal(isVenueOpenNow(venue("flag-closed", "", false), TEN_PM_SGT), false);
});

test("minutesUntilOpening reads the opening time from the label, wrapping past midnight", () => {
  // 22:00 in Singapore.
  assert.equal(minutesUntilOpening({ status: "closed", detail: "Opens 11pm" }, TEN_PM_SGT), 60);
  assert.equal(minutesUntilOpening({ status: "closed", detail: "Opens 5:30am" }, TEN_PM_SGT), 450);
  assert.equal(minutesUntilOpening({ status: "closed", detail: "Opens 12am" }, TEN_PM_SGT), 120);
  assert.equal(minutesUntilOpening({ status: "closed", detail: "Opens 10pm" }, TEN_PM_SGT), 0);
  assert.equal(
    minutesUntilOpening({ status: "closed", detail: "Closed today" }, TEN_PM_SGT),
    Infinity,
  );
  assert.equal(minutesUntilOpening({ status: "closed" }, TEN_PM_SGT), Infinity);
});
