import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { dishes } from "../../lib/services/mock/data";
import { getHungryService } from "../../lib/services/serviceProvider";
import {
  formatDistanceFromUser,
  formatStallPriceBand,
  summarizeStallRating,
} from "../../features/detail/stallLocation";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");
const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");

test("stall reviews are one newest-first query naming each dish, with a write-review path", () => {
  assert.doesNotMatch(stallDetail, /getReviewsForDish/);
  assert.match(stallDetail, /reviews\.listRecentReviews\(\{\s*venueId: sideLoadVenueId,/);
  assert.match(stallDetail, /on \{review\.dishName\}/);
  assert.match(stallDetail, /navigation\.navigate\("DishDetail", \{ dishId: review\.dishId \}\)/);
  assert.match(stallDetail, /Couldn&apos;t load reviews for this stall\./);
  assert.match(stallDetail, /ctaLabel="Write a review"\s*onPress=\{openWriteReview\}/);
  assert.match(
    stallDetail,
    /const openWriteReview = \(\) => \{[\s\S]*?if \(!requireAuthForProtectedAction\(/,
  );
});

test("mock listRecentReviews scopes to the given dishes, newest first", async () => {
  const dishIds = dishes.slice(0, 3).map((dish) => dish.id);
  const entries = await getHungryService().reviews.listRecentReviews({ dishIds, limit: 6 });
  assert.ok(entries.every((entry) => dishIds.includes(entry.dishId)));
  for (let index = 1; index < entries.length; index += 1) {
    assert.ok(
      new Date(entries[index - 1].review.createdAt).getTime() >=
        new Date(entries[index].review.createdAt).getTime(),
    );
  }
  assert.deepEqual(
    await getHungryService().reviews.listRecentReviews({ dishIds: [], limit: 6 }),
    [],
  );
});

test("Supabase dish and stall review reads sign photos in one request (H30)", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(
    service,
    /if \(options\?\.dishIds\) \{\s*query = query\.in\("dish_id", options\.dishIds\)/,
  );
  assert.doesNotMatch(service, /includePhotos: !options\?\.dishIds/);
  assert.match(service, /mapSupabaseReviewRows\(client, rows, \{ includePhotos: true \}\)/);
  assert.match(service, /One signing request for the whole page instead of one per photo/);
});

test("stall page has no fake save, timer skeleton, or menu-empty flash while loading", () => {
  assert.doesNotMatch(stallDetail, /toggleFavourite/);
  // One fixed action bar for everyone; a guest is asked to sign in on tap (detail-L13).
  assert.match(
    stallDetail,
    /<StallInteractionBar[\s\S]{0,400}isAuthenticated=\{isAuthenticated\}[\s\S]{0,200}onRequireAuth=/,
  );
  assert.doesNotMatch(stallDetail, /<Heart/);
  assert.doesNotMatch(stallDetail, /setTimeout\(\(\) => setIsLoading\(false\), 800\)/);
  assert.match(stallDetail, /menuStatus === "loading"/);
  assert.match(stallDetail, /Couldn&apos;t load this stall&apos;s menu\./);
  assert.match(stallDetail, /if \(active\) setMenuLoadFailed\(true\)/);
  assert.doesNotMatch(stallDetail, /if \(active\) setHydratedDishes\(\[\]\)/);
});

test("stall header shows rating, price, status, actions and delivery links", () => {
  assert.match(stallDetail, /summarizeStallRating\(dishes\)/);
  assert.match(stallDetail, /formatStallPriceBand\(dishes\)/);
  // Directions, Save and Share live in the sticky bottom bar, not in the header.
  assert.match(stallDetail, /<StallInteractionBar[\s\S]*?layout="sticky"/);
  assert.match(stallDetail, /onDirections=/);
  assert.match(read("src/components/stall/StallInteractionBar.tsx"), /label: "Directions"/);
  // Phone and email sit in a Contact details card; delivery uses the wide button row.
  assert.match(stallDetail, /Contact details/);
  assert.match(stallDetail, /label="Call"/);
  assert.match(stallDetail, /<DeliveryButtonRow/);
  assert.match(stallDetail, /cachedVenue && serviceProviderMode !== "supabase"/);
  assert.match(stallDetail, /merchantProfile\?\.coverPhotoUrl,\s*venue\.imageUrl/);
  assert.doesNotMatch(stallDetail, /hero dish photo/);
});

test("stall distance is measured from the user and hidden when unknown", () => {
  assert.doesNotMatch(stallDetail, /leadDish\.distanceMeters/);
  assert.match(
    stallDetail,
    /formatDistanceFromUser\(userOrigin, stallPin \?\? buildingCoordinate\)/,
  );

  const building = { latitude: 1.3, longitude: 103.85 };
  assert.equal(formatDistanceFromUser(undefined, building), undefined);
  assert.equal(formatDistanceFromUser(building, undefined), undefined);
  assert.equal(formatDistanceFromUser(building, { latitude: 0, longitude: 0 }), undefined);
  assert.equal(formatDistanceFromUser(building, building), "0m away");
  assert.match(
    formatDistanceFromUser({ latitude: 1.31, longitude: 103.85 }, building) ?? "",
    /^1\.1km away$/,
  );
});

test("stall rating and price summaries come from the menu, and are absent without data", () => {
  assert.equal(summarizeStallRating([{ rating: 0, reviewCount: 0 }]), undefined);
  assert.deepEqual(
    summarizeStallRating([
      { rating: 4, reviewCount: 1 },
      { rating: 5, reviewCount: 3 },
    ]),
    { rating: 4.75, reviewCount: 4 },
  );
  assert.equal(formatStallPriceBand([{ price: 0 }]), undefined);
  assert.equal(formatStallPriceBand([{ price: 4.5 }, { price: 8 }]), "S$4.50–S$8.00");
});

test("dish detail always reads its reviews and only says 'No reviews yet' at zero", () => {
  assert.match(dishDetail, /reviews\.listRecentReviews\(\{ dishIds: \[reviewDishId\]/);
  assert.match(dishDetail, /See all \$\{dishReviews\.length\} reviews/);
  // Past the first page the button pages with the createdAt cursor instead of claiming a total.
  assert.match(dishDetail, /setHasMoreReviews\(entries\.length === DISH_REVIEW_PAGE_SIZE\)/);
  assert.match(dishDetail, /before: last\.createdAt,\s*beforeId: last\.id,/);
  assert.match(dishDetail, /label="Show more reviews"/);
  assert.match(dishDetail, /dish\.reviewCount === 0 \? \(\s*<EmptyState\s*title="No reviews yet"/);
  assert.match(dishDetail, /formatTimeAgo\(review\.createdAt\)/);
  assert.match(dishDetail, /Reply from the owner/);
  assert.doesNotMatch(dishDetail, /dish\.reviews\.slice/);
});

test("dish attributes never present placeholder taste data as fact", () => {
  assert.match(dishDetail, /hasDishTasteSignal\(dish\)/);
  assert.doesNotMatch(dishDetail, /"Signature"|"House style"/);
  assert.doesNotMatch(dishDetail, /% taste match/);
  // The taste matrix box is gone; the "how it tastes to you" rows come from the dish's own vector.
  assert.doesNotMatch(dishDetail, /showTasteMatch|tasteMatch/);
  assert.match(dishDetail, /perceivedTasteRows\(dish\.tasteVector, profile\.tasteVector\)/);
  const disclosure = read("src/lib/services/dataTrustDisclosure.ts");
  assert.doesNotMatch(disclosure, /Live wait estimate/);
});

test("dish Tried is per dish and never clears the stall; Food Cred copy uses awarded points", () => {
  assert.match(
    dishDetail,
    /getInteraction\(dish\.venueId\)\?\.isTried\) \{\s*try \{\s*const result = await markTried/,
  );
  assert.doesNotMatch(dishDetail, /-5 Food Cred|"\+5 Food Cred"|adjustPoints/);
  assert.match(dishDetail, /FEATURE_FLAGS\.gamificationEnabled && pointsAwarded > 0/);
  const store = read("src/store/useStallInteractionStore.ts");
  assert.doesNotMatch(store, /pointsAwarded = 5;/);
  // Points come from what the award call actually credited, not a stale before/after total.
  assert.match(store, /pointsAwarded = useFoodCredStore\.getState\(\)\.lastEarnedPoints;/);
  assert.doesNotMatch(store, /totalAfter - totalBefore/);
});

test("detail back buttons fall back to Home on cold-start links", () => {
  for (const source of [stallDetail, dishDetail]) {
    assert.match(source, /const goBackOrHome = \(\) => \{\s*if \(navigation\.canGoBack\(\)\)/);
    assert.doesNotMatch(source, /onPress=\{\(\) => navigation\.goBack\(\)\}/);
  }
  assert.match(dishDetail, /ctaLabel="Search dishes"/);
});

test("award_food_cred ignores client-chosen amounts and dedupes per entity", () => {
  const migration = read("supabase/migrations/20261019140000_award_food_cred_server_points.sql");
  const smoke = read("supabase/smoke/award_food_cred_server_points.sql");
  assert.match(migration, /create or replace function app_private\.award_food_cred\(/);
  assert.doesNotMatch(migration, /create or replace function public\.award_food_cred/);
  assert.match(
    migration,
    /coalesce\(auth\.role\(\), ''\) = 'service_role' and p_points is not null/,
  );
  assert.doesNotMatch(migration, /resolved_points := coalesce\(p_points/);
  assert.match(migration, /fce\.related_entity_id = normalized_entity_id/);
  // 0-point dedupe rows must not use up the daily cap.
  assert.match(
    migration,
    /into today_count[\s\S]*?and fce\.points > 0[\s\S]*?if today_count >= cap/,
  );
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
});
