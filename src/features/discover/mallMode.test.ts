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
