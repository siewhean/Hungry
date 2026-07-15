import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRoot), "utf8");
}

test("profile and onboarding catalog surfaces use async service reads", () => {
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");
  const visited = read("src/app/screens/profile/VisitedStallsScreen.tsx");
  const reviews = read("src/app/screens/profile/ReviewHistoryScreen.tsx");
  const onboarding = read("src/app/screens/onboarding/TasteProfileResultScreen.tsx");

  assert.match(favourites, /service\.discovery\s*\.getDishes/);
  assert.doesNotMatch(favourites, /service\.discovery\.getDish\(|service\.discovery\.getVenue\(/);
  assert.doesNotMatch(favourites, /repository\.getDishById/);

  assert.match(visited, /service\.discovery\s*\.getDishes/);
  assert.doesNotMatch(visited, /service\.discovery\.getDish\(|service\.discovery\.getVenue\(/);
  assert.doesNotMatch(visited, /repository\.getDishById|repository\.getVenueById/);

  assert.match(reviews, /service\.discovery\.getDishes/);
  assert.doesNotMatch(reviews, /service\.discovery\.getDish\(/);
  assert.doesNotMatch(reviews, /remoteReviews\.map[\s\S]*repository\.getDishById/);

  assert.match(onboarding, /service\.discovery\s*\.searchDishes/);
  assert.doesNotMatch(onboarding, /dataRepository\.listPopularNearby/);
});

test("decide, publishing, and feedback avoid cold synchronous catalog resolution", () => {
  const decide = read("src/app/screens/discover/DecideForMeResultScreen.tsx");
  const publish = read("src/features/post/publishing.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(decide, /service\.discovery\s*\.searchDishes/);
  assert.doesNotMatch(decide, /repository\.searchDishes|setDecideForMe\(undefined\)/);
  assert.match(publish, /await service\.discovery\.getDish/);
  assert.match(publish, /await service\.discovery\.getVenue/);
  assert.match(service, /await getDishByIdViaRpc\(feedback\.dishId\)/);
});

test("batch detail migration is additive, invoker-safe, and client executable", () => {
  const migration = read("supabase/migrations/20260715053000_batch_dish_detail_reads.sql");

  assert.match(migration, /create or replace function public\.get_dish_details/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /cross join lateral public\.get_dish_detail/);
  assert.match(migration, /grant execute[\s\S]*to anon, authenticated/);
  assert.doesNotMatch(migration, /security definer|drop table|truncate table/i);
});
