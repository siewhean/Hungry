import assert from "node:assert/strict";
import test from "node:test";

import type { DiscoveryLocationFeed } from "@/lib/services/types";
import type { DishDetail, VenueSummary } from "@/types/domain";
import { buildBoundedDiscoverStallCollections } from "./boundedDiscoverStallCollections";

const venue = (id: string, name: string): VenueSummary => ({
  id,
  buildingId: `building-${id}`,
  buildingName: `${name} Centre`,
  name,
  unitNumber: "#01-01",
  floor: "L1",
  isOpen: true,
  topDishId: `dish-${id}`,
  operatingHours: "09:00–20:00",
  deliveryLinks: [],
});

const dish = (id: string, venueId: string, name: string, distanceMeters: number): DishDetail => ({
  id,
  venueId,
  buildingId: `building-${venueId}`,
  venueName: venueId,
  unitNumber: "#01-01",
  floor: "L1",
  name,
  imageUrl: "",
  distanceMeters,
  rating: 4.5,
  reviewCount: 10,
  price: 6,
  priceRange: "S$6.00",
  tasteTags: ["Savory"],
  tasteVector: { sweet: 2, spicy: 3, sour: 1, salty: 5, rich: 4, aromatic: 5 },
  dietaryFlags: [],
  gallery: [],
  mustOrder: false,
  availabilityFlags: [],
  reviews: [],
});

test("bounded Supabase stall collections are built only from the returned location feed", () => {
  const feed: DiscoveryLocationFeed = {
    venues: [venue("a", "Laksa House"), venue("b", "Ramen Bar")],
    results: [
      { dish: dish("dish-a", "a", "Katong Laksa", 320), score: 0.7 },
      { dish: dish("dish-b", "b", "Shoyu Ramen", 180), score: 0.9 },
    ],
  };

  const collections = buildBoundedDiscoverStallCollections(feed, "", 4);

  assert.deepEqual(
    collections.map((collection) => collection.venue.id),
    ["b", "a"],
  );
  assert.equal(collections[0]?.topDishes[0]?.name, "Shoyu Ramen");
  assert.deepEqual(collections[0]?.posts, []);
});

test("bounded Supabase stall collections apply query and result caps without repository hydration", () => {
  const feed: DiscoveryLocationFeed = {
    venues: [venue("a", "Laksa House"), venue("b", "Ramen Bar")],
    results: [
      { dish: dish("dish-a", "a", "Katong Laksa", 320), score: 0.7 },
      { dish: dish("dish-b", "b", "Shoyu Ramen", 180), score: 0.9 },
    ],
  };

  assert.deepEqual(
    buildBoundedDiscoverStallCollections(feed, "laksa", 1).map((collection) => collection.venue.id),
    ["a"],
  );
});
