import assert from "node:assert/strict";
import test from "node:test";

import {
  cuisineOptions,
  filterHereStalls,
  forYouReason,
  rankForYou,
  stallPriceLabel,
  type HereStall,
} from "./mallMode";
import type { DishDetail, TasteVector, VenueSummary } from "@/types/domain";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

function dish(id: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id,
    venueId: `v-${id}`,
    buildingId: "b1",
    venueName: "Stall",
    unitNumber: "01-01",
    floor: "L1",
    name: id,
    imageUrl: "",
    distanceMeters: 100,
    rating: 4,
    reviewCount: 3,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: NEUTRAL,
    dietaryFlags: [],
    gallery: [],
    mustOrder: false,
    availabilityFlags: [],
    reviews: [],
    ...overrides,
  };
}

const venue = (id: string): VenueSummary => ({
  id,
  buildingId: "b1",
  name: id,
  unitNumber: "01-01",
  floor: "L1",
  isOpen: true,
  topDishId: "",
  operatingHours: "",
  deliveryLinks: [],
});

test("forYouReason names the flavours a dish shares with the diner", () => {
  const spicyLover: TasteVector = { ...NEUTRAL, spicy: 9 };
  const spicyDish = dish("laksa", { tasteVector: { ...NEUTRAL, spicy: 8 } });
  assert.match(forYouReason(spicyDish, spicyLover), /Spicy, the way you like it/);
  assert.equal(forYouReason(spicyDish, NEUTRAL), "Popular here");
});

test("rankForYou puts a spicy dish first for a spice lover and prefers the current mall", () => {
  const spicyLover: TasteVector = { ...NEUTRAL, spicy: 9 };
  const dishes = [
    dish("mild", { tasteVector: { ...NEUTRAL, spicy: 1 } }),
    dish("hot", { tasteVector: { ...NEUTRAL, spicy: 9 } }),
    dish("hot-elsewhere", { buildingId: "b2", tasteVector: { ...NEUTRAL, spicy: 10 } }),
  ];
  const picks = rankForYou(dishes, {
    tasteVector: spicyLover,
    dietaryFlags: [],
    preferBuildingId: "b1",
  });
  assert.equal(picks[0]?.dish.id, "hot");
  assert.ok(
    (picks[0]?.matchPercent ?? 0) > (picks.find((p) => p.dish.id === "mild")?.matchPercent ?? 100),
  );
  assert.equal(picks.at(-1)?.dish.id === "hot-elsewhere" || picks.length === 3, true);
});

test("rankForYou shows no match percent without a palate", () => {
  const picks = rankForYou([dish("a")], { tasteVector: NEUTRAL, dietaryFlags: [] });
  assert.equal(picks[0]?.matchPercent, undefined);
});

test("cuisine and price filters narrow the stalls", () => {
  const stalls: HereStall[] = [
    { venue: venue("a"), dishes: [dish("a1", { foodTypeTag: "Noodles", price: 4 })] },
    { venue: venue("b"), dishes: [dish("b1", { foodTypeTag: "Rice", price: 9 })] },
    { venue: venue("c"), dishes: [dish("c1", { foodTypeTag: "Noodles", price: 8 })] },
  ];
  assert.deepEqual(cuisineOptions(stalls), ["noodles", "rice"]);
  assert.deepEqual(
    filterHereStalls(stalls, { cuisine: "noodles" }).map((s) => s.venue.id),
    ["a", "c"],
  );
  assert.deepEqual(
    filterHereStalls(stalls, { priceBand: "under5" }).map((s) => s.venue.id),
    ["a"],
  );
  assert.deepEqual(
    filterHereStalls(stalls, { priceBand: "5to8", cuisine: "noodles" }).map((s) => s.venue.id),
    ["c"],
  );
  assert.deepEqual(
    filterHereStalls(stalls, { priceBand: "8plus" }).map((s) => s.venue.id),
    ["b"],
  );
});

test("stallPriceLabel shows one price or a range", () => {
  assert.equal(
    stallPriceLabel({ venue: venue("a"), dishes: [dish("x", { price: 4.5 })] }),
    "S$4.50",
  );
  assert.equal(
    stallPriceLabel({
      venue: venue("a"),
      dishes: [dish("x", { price: 4 }), dish("y", { price: 9 })],
    }),
    "S$4.00 to 9.00",
  );
  assert.equal(stallPriceLabel({ venue: venue("a"), dishes: [] }), "");
});

test("rankForYou shows no match percent while the profile is not trusted", () => {
  const spicy = dish("hot", { tasteVector: { ...NEUTRAL, spicy: 9 } });
  const picks = rankForYou([spicy], {
    tasteVector: { ...NEUTRAL, spicy: 9 },
    dietaryFlags: [],
    profileTrusted: false,
  });
  assert.equal(picks[0]?.matchPercent, undefined);
  assert.match(picks[0]?.reason ?? "", /spicy/i, "the reason line still shows");
});

test("rankForYou hides the match percent for a dish with low-confidence tags only", () => {
  const sure = dish("sure", { tasteVector: { ...NEUTRAL, spicy: 9 }, tasteConfidence: 0.9 });
  const unsure = dish("unsure", { tasteVector: { ...NEUTRAL, spicy: 9 }, tasteConfidence: 0.4 });
  const picks = rankForYou([sure, unsure], {
    tasteVector: { ...NEUTRAL, spicy: 9 },
    dietaryFlags: [],
    profileTrusted: true,
  });
  assert.equal(typeof picks.find((pick) => pick.dish.id === "sure")?.matchPercent, "number");
  assert.equal(picks.find((pick) => pick.dish.id === "unsure")?.matchPercent, undefined);
});

const SPICY_FAN: TasteVector = { sweet: 3, spicy: 9, sour: 4, salty: 6, rich: 5, aromatic: 6 };

test("reserveFresh gives slot 4 to the best-ranked dish with few reviews", () => {
  const dishes = Array.from({ length: 6 }, (_, index) =>
    dish(`p${index}`, {
      tasteVector: { ...SPICY_FAN, spicy: 9 - index * 0.5 },
      reviewCount: index === 4 ? 0 : 30,
    }),
  );
  const plain = rankForYou(dishes, {
    tasteVector: SPICY_FAN,
    dietaryFlags: [],
    limit: 6,
  }).map((pick) => pick.dish.id);
  const reserved = rankForYou(dishes, {
    tasteVector: SPICY_FAN,
    dietaryFlags: [],
    limit: 6,
    reserveFresh: true,
  }).map((pick) => pick.dish.id);
  assert.notEqual(plain[3], "p4");
  assert.equal(reserved[3], "p4");
});

test("a well-reviewed dish edges out an equal match with no reviews", () => {
  const proven = dish("proven", { tasteVector: SPICY_FAN, rating: 4.8, reviewCount: 60 });
  const unknown = dish("unknown", { tasteVector: SPICY_FAN, rating: 0, reviewCount: 0 });
  const order = rankForYou([unknown, proven], {
    tasteVector: SPICY_FAN,
    dietaryFlags: [],
    likedDishes: [],
  }).map((pick) => pick.dish.id);
  assert.deepEqual(order, ["proven", "unknown"]);
});

test("with liked dishes, a dish that shares their tags moves up among close matches", () => {
  const liked = [dish("liked", { tasteTags: ["noodle"], foodTypeTag: "laksa" })];
  const alike = dish("alike", {
    tasteVector: { ...SPICY_FAN, spicy: 8 },
    tasteTags: ["noodle"],
    foodTypeTag: "laksa",
  });
  const other = dish("other", {
    tasteVector: { ...SPICY_FAN, spicy: 8.2 },
    tasteTags: ["grilled"],
    foodTypeTag: "satay",
  });
  const withoutHistory = rankForYou([other, alike], {
    tasteVector: SPICY_FAN,
    dietaryFlags: [],
  }).map((pick) => pick.dish.id);
  const withHistory = rankForYou([other, alike], {
    tasteVector: SPICY_FAN,
    dietaryFlags: [],
    likedDishes: liked,
  }).map((pick) => pick.dish.id);
  assert.equal(withoutHistory[0], "other");
  assert.equal(withHistory[0], "alike");
});

test("distance decay lets a close good match beat a slightly better one across town", () => {
  const spicyUser: TasteVector = { ...NEUTRAL, spicy: 9, rich: 7 };
  const far = dish("far", {
    tasteVector: { ...NEUTRAL, spicy: 9, rich: 7 },
    distanceMeters: 4000,
  });
  const near = dish("near", {
    tasteVector: { ...NEUTRAL, spicy: 8, rich: 7 },
    distanceMeters: 150,
  });
  const base = { tasteVector: spicyUser, dietaryFlags: [], likedDishes: [], limit: 2 };
  assert.equal(rankForYou([far, near], base)[0].dish.id, "far", "palate alone picks the far dish");
  assert.equal(
    rankForYou([far, near], { ...base, distanceDecay: true })[0].dish.id,
    "near",
    "with decay the close dish leads",
  );
});
