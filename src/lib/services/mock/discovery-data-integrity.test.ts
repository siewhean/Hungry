import assert from "node:assert/strict";
import test from "node:test";

import { dishes, stallPosts, venues } from "./data";

test("mock discovery venues and dishes keep relational card values consistent", () => {
  const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

  for (const venue of venues) {
    const topDish = dishesById.get(venue.topDishId);
    assert.ok(topDish, `${venue.name} must reference an existing top dish`);
    assert.equal(topDish.venueId, venue.id, `${venue.name} top dish must belong to the venue`);
    assert.ok(venue.cuisineTags?.length, `${venue.name} must expose cuisine tags`);
  }

  for (const dish of dishes) {
    const venue = venuesById.get(dish.venueId);
    assert.ok(venue, `${dish.name} must reference an existing venue`);
    assert.equal(dish.venueName, venue.name, `${dish.name} venue name must match`);
    assert.equal(dish.unitNumber, venue.unitNumber, `${dish.name} unit must match`);
    assert.equal(dish.floor, venue.floor, `${dish.name} floor must match`);
    assert.ok(dish.foodTypeTag, `${dish.name} must expose a food type`);
    assert.ok(dish.cuisineTags?.length, `${dish.name} must expose cuisine tags`);
    assert.ok(dish.price > 0, `${dish.name} must have a positive display price`);
    assert.ok(dish.distanceMeters > 0, `${dish.name} must have a positive display distance`);
  }

  for (const post of stallPosts) {
    for (const dishId of post.dishIds) {
      assert.equal(
        dishesById.get(dishId)?.venueId,
        post.venueId,
        `${post.id} must only reference dishes from its venue`,
      );
    }
  }
});
