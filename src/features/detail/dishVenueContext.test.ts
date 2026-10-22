import assert from "node:assert/strict";
import test from "node:test";
import { getDishVenueContext } from "./dishVenueContext";
import { dishes } from "@/lib/services/mock/data";
import { mockRepository } from "@/lib/services/mock/repositories";
import { hungryService } from "@/lib/services/mock/mockService";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";

test("search Laksa to service detail preserves Katong ownership and related menu", async () => {
  const results = await hungryService.discovery.searchDishes(
    {
      query: "Laksa",
      categories: [],
      dietaryFlags: [],
      tasteValues: NEUTRAL_TASTE_VECTOR,
      radius: 100_000,
    },
    NEUTRAL_TASTE_VECTOR,
  );
  const suggestion = results.find((result) => result.dish.id === "dish-laksa");
  assert.ok(suggestion);
  const dish = await hungryService.discovery.getDish(suggestion.dish.id);
  assert.ok(dish);
  const context = getDishVenueContext(dish, mockRepository);
  assert.equal(context.venue?.id, "venue-katong-laksa-maxwell");
  assert.equal(context.venue?.name, suggestion.dish.venueName);
  assert.equal(context.venue?.unitNumber, suggestion.dish.unitNumber);
  assert.deepEqual(
    context.dishes.map((item) => item.id),
    ["dish-laksa"],
  );
  assert.ok(
    !context.dishes.some((item) => ["dish-chicken-rice", "dish-pandan-cake"].includes(item.id)),
  );
});

test("canonical fixture ownership agrees with denormalized dish attribution", () => {
  for (const dish of dishes) {
    const context = getDishVenueContext(dish, mockRepository);
    assert.ok(context.venue, `Missing venue for ${dish.id}`);
    assert.equal(context.venue.name, dish.venueName, dish.id);
    assert.equal(context.venue.buildingId, dish.buildingId, dish.id);
    assert.equal(context.venue.unitNumber, dish.unitNumber, dish.id);
    assert.equal(context.venue.floor, dish.floor, dish.id);
    assert.ok(context.dishes.every((item) => item.venueId === context.venue?.id));
  }
});

test("detail context rejects another venue's cached attribution and menu rows", () => {
  const laksa = dishes.find((dish) => dish.id === "dish-laksa");
  assert.ok(laksa);
  const context = getDishVenueContext(laksa, {
    getVenueById: () => mockRepository.getVenueById("venue-tian-tian"),
    listDishesByVenue: () => dishes,
  });
  assert.equal(context.venue, undefined);
  assert.deepEqual(
    context.dishes.map((dish) => dish.id),
    ["dish-laksa"],
  );
});
