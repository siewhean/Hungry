import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("detail screens hydrate specific Supabase records before showing not-found states", () => {
  const dishDetail = read("src/app/screens/detail/DishDetailScreen.tsx");
  const dishDetailV2 = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(dishDetail, /discovery\.getDish\(deepLinkedDishId\)/);
  assert.match(dishDetail, /discovery\.getVenue\(dish\.venueId\)/);
  assert.match(dishDetail, /!dish && !hasLoadedDishDetail/);
  assert.match(dishDetail, /!venue && !hasLoadedVenueDetail/);

  assert.match(dishDetailV2, /discovery\.getDish\(dishId\)/);
  assert.match(dishDetailV2, /discovery\.getVenue\(dish\.venueId\)/);
  assert.match(dishDetailV2, /!dish && !hasLoadedDishDetail/);
  assert.match(dishDetailV2, /!venue && !hasLoadedVenueDetail/);

  assert.match(stallDetail, /discovery\.getVenue\(venueId\)/);
  assert.match(stallDetail, /discovery\.listDishesByVenue\(venue\.id\)/);
  assert.match(stallDetail, /!venue && !hasLoadedVenueDetail/);
});
