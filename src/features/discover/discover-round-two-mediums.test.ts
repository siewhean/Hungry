import assert from "node:assert/strict";
import test from "node:test";

import { getDiscoverAreaCountLabel } from "@/features/discover/areaCount";
import {
  getDiscoverBiteCollections,
  isLateNightDish,
  isLateNightHour,
} from "@/features/discover/bites";
import {
  hasPersonalTasteProfile,
  tasteAxisMatchPercent,
  tasteMatchPercent,
} from "@/lib/ai/tasteEngine";
import { getNearestSingaporeAreaWithin } from "@/lib/geo/singaporeBuildings";
import type { Bite } from "@/lib/services/types";
import { getEffectiveLocation } from "@/store/useLocationStore";
import { getSingaporeHour, runsPastHour } from "@/utils/operatingHours";
import type { TasteVector } from "@/types/domain";

const taste = (v: number[]): TasteVector => ({
  sweet: v[0],
  spicy: v[1],
  sour: v[2],
  salty: v[3],
  rich: v[4],
  aromatic: v[5],
});

test("M1: a guest's neutral vector scores by plain per-axis distance, not an inflated 88", () => {
  const guest = taste([5, 5, 5, 5, 5, 5]);
  const dish = taste([8, 2, 3, 6, 7, 4]);
  assert.equal(hasPersonalTasteProfile(guest), false);
  assert.equal(tasteMatchPercent(guest, dish), 60);
});

test("M1: a real profile still separates a match from its opposite", () => {
  const user = taste([9, 1, 2, 7, 8, 3]);
  assert.equal(hasPersonalTasteProfile(user), true);
  assert.ok(tasteMatchPercent(user, user) >= 99);
  assert.ok(tasteMatchPercent(user, taste([1, 9, 8, 3, 2, 7])) <= 10);
  assert.equal(tasteAxisMatchPercent(7, 7), 100);
  assert.equal(tasteAxisMatchPercent(0, 5), 0);
});

test("M5: the area label is dropped when the phone is far from every anchor", () => {
  assert.equal(getNearestSingaporeAreaWithin(1.3526, 103.9448), "Tampines");
  // Bangkok is not "at Woodlands".
  assert.equal(getNearestSingaporeAreaWithin(13.7563, 100.5018), undefined);
});

test("M6: granted permission on the default point is approximate, a real fix is not", () => {
  const maxwell = { latitude: 1.2813, longitude: 103.8458 };
  assert.equal(
    getEffectiveLocation({
      permission: "granted",
      currentLocation: maxwell,
      manualCoordinate: undefined,
    }).isApproximate,
    true,
  );
  assert.equal(
    getEffectiveLocation({
      permission: "granted",
      currentLocation: { latitude: 1.3526, longitude: 103.9448 },
      manualCoordinate: undefined,
    }).isApproximate,
    false,
  );
  assert.equal(
    getEffectiveLocation({
      permission: "denied",
      currentLocation: maxwell,
      manualCoordinate: { latitude: 1.3526, longitude: 103.9448 },
    }).isApproximate,
    false,
  );
});

test("L2: late night is one window, judged on Singapore time and the stall's hours", () => {
  assert.equal(isLateNightHour(21), true);
  assert.equal(isLateNightHour(3), true);
  assert.equal(isLateNightHour(4), false);
  assert.equal(isLateNightHour(20), false);
  // 16:30 UTC is 00:30 in Singapore whatever the device zone is.
  assert.equal(getSingaporeHour(new Date("2026-10-21T16:30:00Z")), 0);
  assert.equal(runsPastHour("Mon-Sun 10am-11pm", 22), true);
  assert.equal(runsPastHour("Mon-Sun 10am-6pm", 22), false);
  assert.equal(runsPastHour(undefined, 22), undefined);
  assert.equal(isLateNightDish(undefined, "Mon-Sun 10am-6pm"), false);
  // Unreadable hours fall back to the dinner flag.
  assert.equal(isLateNightDish({ availabilityFlags: ["dinner"] }, undefined), true);
  assert.equal(isLateNightDish({ availabilityFlags: ["lunch"] }, undefined), false);
});

test("M17: an empty offline fallback shows no count instead of 0 places", () => {
  const base = { feedLimit: 100, rpcCount: null, isFeedLoaded: true };
  assert.equal(getDiscoverAreaCountLabel({ ...base, isFallback: true, feedVenueCount: 0 }), null);
  assert.equal(getDiscoverAreaCountLabel({ ...base, feedVenueCount: 12 }), "12");
  assert.equal(getDiscoverAreaCountLabel({ ...base, feedVenueCount: 100 }), "100+");
});

function bite(overrides: Partial<Bite>): Bite {
  return {
    id: "bite",
    authorId: "a",
    authorName: "Hungry",
    authorAvatar: "",
    dishId: "dish",
    dishName: "Dish",
    venueId: "venue",
    venueName: "Venue",
    unitNumber: "01-01",
    buildingId: "building",
    buildingName: "Building",
    photoUrl: "",
    caption: "Dish",
    tasteStamp: { sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 },
    cravingCount: 0,
    savedCount: 0,
    rating: 4.5,
    price: 6,
    expiresAt: "2026-06-28T00:00:00.000Z",
    createdAt: "2026-06-27T00:00:00.000Z",
    ...overrides,
  };
}

test("M3: rails hold what their titles say", () => {
  const repo = { getDishById: () => undefined } as never;
  const collections = getDiscoverBiteCollections(
    [
      bite({
        id: "a",
        dishId: "a",
        cravingCount: 0,
        rating: 4.9,
        photoUrl: "https://x.test/a.jpg",
      }),
      bite({ id: "b", dishId: "b", cravingCount: 8, rating: 4.0 }),
      bite({ id: "c", dishId: "c", cravingCount: 2, rating: 5 }),
      bite({ id: "d", dishId: "d", cravingCount: 30, rating: 4.6 }),
    ],
    repo,
    () => undefined,
  );
  // Most reviewed: by review count only, and never a dish with no reviews.
  assert.deepEqual(
    collections.trending.map((entry) => entry.id),
    ["d", "b", "c"],
  );
  // Top rated: one 5-star review (or none) is not enough.
  assert.deepEqual(
    collections.editorChoice.map((entry) => entry.id),
    ["d"],
  );
});
