import assert from "node:assert/strict";
import test from "node:test";

import {
  getDiscoverBiteCollections,
  getDiscoverCardImage,
  isUsableDiscoverImageUrl,
} from "@/features/discover/bites";
import type { Bite } from "@/lib/services/types";
import { readRepoFile } from "@/test/sourceContracts";

const HUNGRY_LOGO_IMAGE_URL =
  "https://raw.githubusercontent.com/siewhean/Hungry/main/assets/images/Logo/hungry_logo_icon_transparent.png";

test("getDiscoverCardImage uses approved dish candidate priority before stall fallbacks", () => {
  const image = getDiscoverCardImage([
    { imageUrl: "https://example.com/dish-image.jpg", imageSourceType: "dish_image" },
    { imageUrl: "https://example.com/dish.jpg", imageSourceType: "dish" },
    { imageUrl: "https://example.com/representative.jpg", imageSourceType: "representative_dish" },
    { imageUrl: "https://example.com/venue.jpg", imageSourceType: "venue" },
    { imageUrl: "https://example.com/building.jpg", imageSourceType: "building" },
  ]);

  assert.equal(image.imageUrl, "https://example.com/dish-image.jpg");
  assert.equal(image.imageSourceType, "dish_image");
  assert.deepEqual(image.candidateUrls, [
    "https://example.com/dish-image.jpg",
    "https://example.com/dish.jpg",
    "https://example.com/representative.jpg",
    "https://example.com/venue.jpg",
    "https://example.com/building.jpg",
  ]);
});

test("getDiscoverCardImage uses stall card priority and de-duplicates candidates", () => {
  const image = getDiscoverCardImage([
    { imageUrl: "https://example.com/venue.jpg", imageSourceType: "venue" },
    { imageUrl: "https://example.com/building.jpg", imageSourceType: "building" },
    { imageUrl: "https://example.com/venue.jpg", imageSourceType: "representative_dish" },
    { imageUrl: "https://example.com/dish.jpg", imageSourceType: "representative_dish" },
  ]);

  assert.equal(image.imageUrl, "https://example.com/venue.jpg");
  assert.equal(image.imageSourceType, "venue");
  assert.deepEqual(image.candidateUrls, [
    "https://example.com/venue.jpg",
    "https://example.com/building.jpg",
    "https://example.com/dish.jpg",
  ]);
});

test("Discover image helper rejects demo providers, logo placeholders, malformed URLs, and blanks", () => {
  const rejected = [
    "",
    "   ",
    HUNGRY_LOGO_IMAGE_URL,
    `${HUNGRY_LOGO_IMAGE_URL},${HUNGRY_LOGO_IMAGE_URL}`,
    "https://images.unsplash.com/photo-demo",
    "https://source.unsplash.com/random/food",
    "https://picsum.photos/300",
    "https://upload.wikimedia.org/wikipedia/commons/7/71/Hainanese_Chicken_Rice.jpg",
    "file:///tmp/food.jpg",
    "not-a-url",
  ];

  rejected.forEach((imageUrl) => {
    assert.equal(isUsableDiscoverImageUrl(imageUrl), false, imageUrl);
  });

  assert.equal(isUsableDiscoverImageUrl("https://example.com/catalog/food.jpg"), true);
});

test("Discover food collections keep image-less live bites visible with local fallback state", () => {
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
      collections[collectionName].every(
        (bite) => bite.photoUrl === "" && bite.imageSourceType === "local_fallback",
      ),
      `${collectionName} should leave image-less rows on local fallback`,
    );
  }
});

test("Discover food collections prioritise real Supabase images before local fallbacks", () => {
  const fallbackBite = createBite({
    id: "bite-fallback",
    dishId: "supabase-fallback",
    dishName: "Fallback Dish",
    price: 6,
    rating: 4.8,
    cravingCount: 100,
    photoUrl: "",
    imageSourceType: "local_fallback",
  });
  const imageBite = createBite({
    id: "bite-real-image",
    dishId: "supabase-real-image",
    dishName: "Real Image Dish",
    price: 6,
    rating: 4.5,
    cravingCount: 10,
    photoUrl: "https://example.com/approved-menu-image.jpg",
    imageSourceType: "dish_image",
  });

  const collections = getDiscoverBiteCollections([fallbackBite, imageBite], {
    getDishById: () => undefined,
  } as never);

  for (const collectionName of ["quickBites", "trending", "editorChoice", "budget"] as const) {
    assert.equal(collections[collectionName][0]?.id, "bite-real-image", collectionName);
    assert.equal(collections[collectionName][1]?.id, "bite-fallback", collectionName);
  }
});

test("Discover source does not hardcode demo image URL fallbacks", () => {
  const discoverBites = readRepoFile("src/features/discover/bites.ts");
  const discoverHome = readRepoFile("src/app/screens/discover/DiscoverHomeScreen.tsx");

  assert.doesNotMatch(discoverBites, /DISCOVER_FOOD_FALLBACK_IMAGES/);
  assert.doesNotMatch(discoverBites, /resolveDiscoverFoodImageUrl/);
  assert.doesNotMatch(discoverHome, /resolveDiscoverFoodImageUrl/);

  for (const source of [discoverBites, discoverHome]) {
    assert.doesNotMatch(source, /https:\/\/images\.unsplash\.com/);
    assert.doesNotMatch(source, /https:\/\/source\.unsplash\.com/);
    assert.doesNotMatch(source, /https:\/\/picsum\.photos/);
    assert.doesNotMatch(source, /https:\/\/upload\.wikimedia\.org/);
    assert.doesNotMatch(source, /Hainanese_Chicken_Rice\.jpg/);
  }
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

test("dish names and dinner metadata never claim verified late-night hours", () => {
  const collections = getDiscoverBiteCollections();
  assert.deepEqual(collections.lateNight, []);
});
