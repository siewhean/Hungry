import assert from "node:assert/strict";
import test from "node:test";

import { searchBrowseDishes, type BrowseIndex } from "@/features/search/browseIndex";
import type { DishDetail } from "@/types/domain";

const tasteVector = { aromatic: 5, rich: 5, salty: 5, sour: 5, spicy: 5, sweet: 5 };

function createDish(overrides: Partial<DishDetail>): DishDetail {
  return {
    availabilityFlags: [],
    buildingId: "building",
    dietaryFlags: [],
    distanceMeters: 120,
    floor: "L1",
    gallery: [],
    id: "dish",
    imageUrl: "",
    mustOrder: false,
    name: "Dish",
    price: 5,
    priceRange: "S$5.00",
    rating: 4.5,
    reviewCount: 12,
    reviews: [],
    tasteTags: [],
    tasteVector,
    unitNumber: "#01-01",
    venueId: "venue",
    venueName: "Venue",
    ...overrides,
  };
}

function createIndex(dishes: DishDetail[]): BrowseIndex {
  return {
    allDishes: dishes,
    allVenues: [],
    dishById: new Map(dishes.map((dish) => [dish.id, dish])),
    dishesByVenueId: new Map(),
    postByDishId: new Map(),
    postByVenueId: new Map(),
    searchTextByDishId: new Map(
      dishes.map((dish) => [
        dish.id,
        [
          dish.name,
          dish.foodTypeTag,
          dish.venueName,
          dish.priceRange,
          dish.tasteTags.join(" "),
          dish.dietaryFlags.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      ]),
    ),
    sortedDishesByVenueId: new Map(),
    stallPosts: [],
    venueById: new Map(),
    venuesByBuildingId: new Map(),
  };
}

test("popular food tag matching falls back to dish search text", () => {
  const fishballNoodles = createDish({
    foodTypeTag: "noodles",
    id: "fishball-noodles",
    name: "Fishball Noodles",
  });
  const chickenRice = createDish({
    foodTypeTag: "chicken rice",
    id: "chicken-rice",
    name: "Hainanese Chicken Rice",
  });

  const results = searchBrowseDishes(createIndex([fishballNoodles, chickenRice]), {
    foodTypeTag: "fishball noodle",
  });

  assert.deepEqual(
    results.map((dish) => dish.id),
    ["fishball-noodles"],
  );
});
