import assert from "node:assert/strict";
import test from "node:test";

import { dishes, venues } from "@/lib/services/mock/data";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import type { DishDetail, VenueSummary } from "@/types/domain";

import { preferOpenStalls, rankDecideCandidates } from "./decideForMeCandidates";

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
