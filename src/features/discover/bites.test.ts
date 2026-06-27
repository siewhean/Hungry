import assert from "node:assert/strict";
import test from "node:test";

import { getDiscoverBiteCollections, resolveDiscoverFoodImageUrl } from "@/features/discover/bites";
import type { Bite } from "@/lib/services/types";

const HUNGRY_LOGO_IMAGE_URL =
  "https://raw.githubusercontent.com/siewhean/Hungry/main/assets/images/Logo/hungry_logo_icon_transparent.png";

test("Discover food rails replace missing Supabase photos with food imagery", () => {
  const fallback = resolveDiscoverFoodImageUrl(undefined, "Hainanese Chicken Rice");

  assert.match(fallback, /^https?:\/\//);
  assert.notEqual(fallback, HUNGRY_LOGO_IMAGE_URL);
});

test("Discover food rails choose dish-specific fallbacks for common live Supabase menu rows", () => {
  const curryPuffFallback = resolveDiscoverFoodImageUrl(undefined, "Curry Puff");
  const friedChickenFallback = resolveDiscoverFoodImageUrl(undefined, "Original Recipe Chicken");
  const toastFallback = resolveDiscoverFoodImageUrl(undefined, "Kaya Toast");
  const kopiFallback = resolveDiscoverFoodImageUrl(undefined, "Kopi O");

  assert.match(curryPuffFallback, /1509440159596/);
  assert.match(friedChickenFallback, /1562967916/);
  assert.match(toastFallback, /1525351484163/);
  assert.match(kopiFallback, /1544787219/);
  assert.notEqual(curryPuffFallback, friedChickenFallback);
});

test("Discover food collections keep live-style missing-image bites visible in every primary rail", () => {
  const liveStyleBites = [
    createBite({
      id: "bite-curry-puff",
      dishId: "supabase-curry-puff",
      dishName: "Curry Puff",
      price: 6,
      rating: 4.5,
      cravingCount: 20,
      photoUrl: "",
    }),
    createBite({
      id: "bite-original-recipe-chicken",
      dishId: "supabase-original-recipe-chicken",
      dishName: "Original Recipe Chicken",
      price: 6,
      rating: 4.7,
      cravingCount: 24,
      photoUrl: "",
    }),
  ];

  const collections = getDiscoverBiteCollections(liveStyleBites, {
    getDishById: () => undefined,
  } as never);

  for (const collectionName of ["quickBites", "trending", "editorChoice", "budget"] as const) {
    assert.ok(collections[collectionName].length > 0, `${collectionName} should not be empty`);
    assert.ok(
      collections[collectionName].every((bite) => /^https?:\/\//.test(bite.photoUrl)),
      `${collectionName} should resolve food image URLs`,
    );
  }
});

test("Discover food rails reject logo placeholders and malformed comma-joined URLs", () => {
  const logoFallback = resolveDiscoverFoodImageUrl(HUNGRY_LOGO_IMAGE_URL, "Pandan Chiffon Cake");
  const malformedFallback = resolveDiscoverFoodImageUrl(
    `${HUNGRY_LOGO_IMAGE_URL},${HUNGRY_LOGO_IMAGE_URL}`,
    "Flosss Bun",
  );

  assert.match(logoFallback, /^https?:\/\//);
  assert.match(malformedFallback, /^https?:\/\//);
  assert.notEqual(logoFallback, HUNGRY_LOGO_IMAGE_URL);
  assert.notEqual(malformedFallback, HUNGRY_LOGO_IMAGE_URL);
  assert.doesNotMatch(malformedFallback, /,/);
});

test("Discover food rails keep usable approved food URLs unchanged", () => {
  const sourceUrl = "https://example.com/food.jpg";

  assert.equal(resolveDiscoverFoodImageUrl(sourceUrl, "Laksa"), sourceUrl);
});

function createBite(overrides: Partial<Bite>): Bite {
  return {
    id: "bite",
    authorId: "author",
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
    tasteStamp: {
      sweet: 0,
      spicy: 0,
      sour: 0,
      salty: 0,
      rich: 0,
      aromatic: 0,
    },
    cravingCount: 0,
    savedCount: 0,
    rating: 4.5,
    price: 6,
    expiresAt: new Date("2026-06-28T00:00:00.000Z").toISOString(),
    createdAt: new Date("2026-06-27T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}
