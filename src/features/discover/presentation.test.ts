import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDiscoverDistance,
  formatDiscoverPrice,
  getDiscoverAvailabilityLabel,
  getDishFallbackImageKey,
  getEffectiveCuisineTags,
  getUsableDiscoverImageFrames,
  matchesDiscoverCategory,
} from "./presentation";

test("Discover cuisine presentation preserves canonical cuisine and maps Singaporean to Local", () => {
  assert.deepEqual(getEffectiveCuisineTags({ cuisineTags: ["Singaporean", "Western"] }), [
    "Local",
    "Western",
  ]);
  assert.deepEqual(getEffectiveCuisineTags({ cuisineTags: ["Japanese"] }), ["Japanese"]);
  assert.deepEqual(getEffectiveCuisineTags({ cuisineTags: ["Italian", "Western"] }), [
    "Western",
    "Italian",
  ]);
});

test("image frames keep visible media and card metadata aligned", () => {
  const frames = [
    { id: "blocked", imageUrl: "blocked" },
    { id: "valid", imageUrl: "valid" },
    { id: "duplicate", imageUrl: "valid" },
  ];
  assert.deepEqual(
    getUsableDiscoverImageFrames(frames, (imageUrl) => imageUrl === "valid"),
    [{ id: "valid", imageUrl: "valid" }],
  );
});

test("Discover cuisine presentation infers mock cuisine only when source metadata is absent", () => {
  assert.deepEqual(getEffectiveCuisineTags({ name: "Chicken Rice", foodTypeTag: "chicken rice" }), [
    "Local",
  ]);
  assert.deepEqual(
    getEffectiveCuisineTags({ name: "Monster Combo Curry", venueName: "Monster Curry" }),
    ["Japanese"],
  );
  assert.deepEqual(getEffectiveCuisineTags({ name: "Wagyu Burger" }), ["Western"]);
});

test("Discover values never present missing price or distance as zero", () => {
  assert.equal(formatDiscoverPrice({ price: 0, priceRange: "" }), "Price unavailable");
  assert.equal(
    formatDiscoverPrice({ price: 6.5, priceRange: "S$6.50 – S$9.00" }),
    "S$6.50 – S$9.00",
  );
  assert.equal(formatDiscoverPrice({ price: 5, priceRange: "S$5.00" }), "S$5.00");
  assert.equal(formatDiscoverDistance(0), undefined);
  assert.equal(formatDiscoverDistance(180), "180 m");
  assert.equal(formatDiscoverDistance(1_420), "1.4 km");
  assert.equal(
    getDiscoverAvailabilityLabel({ isOpen: false, operatingHours: "" }),
    "Hours unavailable",
  );
  assert.equal(
    getDiscoverAvailabilityLabel({ isOpen: true, operatingHours: "10:00 AM – 8:00 PM" }),
    "Open",
  );
});

test("fallback images are dish-representative rather than arbitrary rail rotation", () => {
  assert.equal(getDishFallbackImageKey({ name: "Signature Laksa" }), "laksa");
  assert.equal(getDishFallbackImageKey({ name: "Salmon Don", cuisineTags: ["Japanese"] }), "ramen");
  assert.equal(
    getDishFallbackImageKey({ name: "Wagyu Burger", cuisineTags: ["Western"] }),
    "burger",
  );
  assert.equal(getDishFallbackImageKey({ name: "Unknown Food" }), "generic");
});

test("Discover category predicates keep cuisine, dietary, food type, and taste distinct", () => {
  const japaneseDish = {
    cuisineTags: ["Japanese"],
    dietaryFlags: [] as string[],
    foodTypeTag: "ramen",
    name: "Shoyu Ramen",
    spicyLevel: 2,
  };
  assert.equal(matchesDiscoverCategory(japaneseDish, "Japanese"), true);
  assert.equal(matchesDiscoverCategory(japaneseDish, "Local"), false);
  assert.equal(matchesDiscoverCategory(japaneseDish, "Noodles"), true);
  assert.equal(
    matchesDiscoverCategory({ ...japaneseDish, dietaryFlags: ["halal"] }, "Halal"),
    true,
  );
  assert.equal(matchesDiscoverCategory({ ...japaneseDish, spicyLevel: 8 }, "Spicy"), true);
});
