// Round-two highs, group D (detail pages, reviews and posting: H27-H36).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  formatDietaryFlag,
  orderDietaryFlags,
  summarizeStallDietaryFlags,
} from "@/features/detail/dietaryLabels";
import { deriveStallCommunityReviews } from "@/features/detail/detailTransforms";
import { isOwnReview, normalizeReviewPatch } from "@/features/review/reviewEdit";
import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = (name: string) => read(`supabase/migrations/${name}`);

const repository = read("src/lib/services/supabase/supabaseRepository.ts");
const service = read("src/lib/services/supabase/supabaseService.ts");
const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");
// The review card is its own component: read it with the screen.
const stallDetail =
  read("src/app/screens/detail/StallDetailScreen.tsx") +
  read("src/components/stall/StallReviewCard.tsx");

test("H27: get_dish_detail returns the dish photo only, never the stall photo", () => {
  const sql = migration("20261021160000_get_dish_detail_dish_photo_only.sql");
  assert.match(sql, /create or replace function public\.get_dish_detail\(p_dish_id text\)/);
  assert.match(sql, /security invoker/);
  assert.doesNotMatch(sql, /v\.image_url/);
  assert.doesNotMatch(sql, /v\.media_approved_for_display/);
  assert.match(
    sql,
    /grant execute on function public\.get_dish_detail\(text\) to anon, authenticated/,
  );
  // search_dishes is not redefined here; the stall menu strips its venue fallback.
  assert.doesNotMatch(sql, /function public\.search_dishes/);
  assert.match(repository, /function withoutVenuePhotoFallback\(row: Row, venueImageUrl: string\)/);
  assert.match(repository, /mapRpcDish\(withoutVenuePhotoFallback\(row, venueImageUrl\)\)/);
});

test("H28: a failed stall read is an error with Retry, not 'Stall not found' or 'No menu'", () => {
  assert.match(repository, /throw new Error\("Couldn't load this stall\."\)/);
  assert.match(
    repository,
    /getVenueByIdViaRpc[\s\S]{0,120}await getVenueDetailRowsOrThrow\(venueId\)/,
  );
  assert.match(
    repository,
    /listDishesByVenueViaRpc[\s\S]{0,160}await getVenueDetailRowsOrThrow\(venueId\)/,
  );
  // The service keeps cached data when there is some, otherwise rethrows.
  assert.match(
    service,
    /async getVenue\(id\) \{\s*try \{[\s\S]{0,400}if \(cached\) return cached;\s*throw error;/,
  );
  assert.match(
    service,
    /async listDishesByVenue\(venueId\) \{\s*try \{[\s\S]{0,500}if \(cached\.length > 0\) return cached;\s*throw error;/,
  );
  assert.match(stallDetail, /title="Couldn't load this stall"/);
  assert.match(stallDetail, /if \(!venue && venueLoadFailed\)/);
  assert.match(stallDetail, /setVenueReloadKey\(\(key\) => key \+ 1\)/);
  assert.match(dishDetail, /Couldn&apos;t load stall details\. Tap to retry\./);
});

test("H29: Tried is saved on the server, rolls back on failure and is not a review", async () => {
  const sql = migration("20261021164000_set_dish_tried.sql");
  assert.match(
    sql,
    /create or replace function public\.set_dish_tried\(p_dish_id text, p_tried boolean\)/,
  );
  assert.match(sql, /security invoker/);
  assert.match(sql, /array_remove\(up\.reviewed_dish_ids, v_dish_id\)/);
  assert.match(sql, /coalesce\(p_tried, true\) or v_has_review/);
  assert.match(
    sql,
    /grant execute on function public\.set_dish_tried\(text, boolean\) to authenticated/,
  );
  assert.match(service, /client\.rpc\("set_dish_tried"/);

  const store = read("src/store/useProfileStore.ts");
  assert.match(store, /setDishTried: async \(dishId, tried\) =>/);
  assert.match(store, /reviewedDishIds: previousIds/);
  // The Tried mark (shared by a signed-in tap and a guest's tap after sign-in, DISH-V4).
  assert.match(dishDetail, /await markDishTried\(dish, triedDishFacts\(dish, hasTasteSignal\)\)/);
  assert.match(
    read("src/features/auth/finishGuestAction.ts"),
    /await useProfileStore\.getState\(\)\.setDishTried\(dish\.id, true\)/,
  );
  assert.doesNotMatch(dishDetail, /removeReviewedDish\(dish\.id\)/);

  // Mock mirror: a reviewed dish stays Tried; an unreviewed one is removed.
  await hungryService.auth.signIn("tried-d@hungry.sg", "password");
  const profile = await hungryService.profile.getProfile();
  const dish = dishes[0];
  assert.ok(dish);
  assert.ok((await hungryService.profile.setDishTried(dish.id, true)).includes(dish.id));
  assert.ok(!(await hungryService.profile.setDishTried(dish.id, false)).includes(dish.id));
  dish.reviews = [
    ...dish.reviews,
    {
      id: "review-tried-d",
      authorId: profile.id,
      authorName: "Tried D",
      rating: 4,
      createdAt: new Date().toISOString(),
      text: "Good",
      tags: [],
      wouldRecommend: true,
      photos: [],
    },
  ];
  try {
    assert.ok((await hungryService.profile.setDishTried(dish.id, false)).includes(dish.id));
  } finally {
    dish.reviews = dish.reviews.filter((review) => review.id !== "review-tried-d");
  }
});

test("H30: review photos are signed and shown on both detail pages", () => {
  assert.doesNotMatch(service, /includePhotos: !options\?\.dishIds/);
  assert.match(dishDetail, /<ReviewPhotoStrip\s+photos=\{review\.photos\}/);
  assert.match(dishDetail, /Photos from reviews/);
  assert.match(stallDetail, /<ReviewPhotoStrip\s+photos=\{review\.photos\}/);
  assert.match(stallDetail, /Photos from reviews/);

  const [entry] = deriveStallCommunityReviews([
    {
      review: {
        id: "r1",
        authorId: "u1",
        authorName: "A",
        rating: 5,
        createdAt: "2026-10-01T00:00:00.000Z",
        text: "Nice",
        tags: [],
        wouldRecommend: true,
        photos: ["https://example.test/p.jpg"],
      },
      dishId: "d1",
      dishName: "Laksa",
      venueId: "v1",
      venueName: "Stall",
    },
  ]);
  assert.deepEqual(entry?.photos, ["https://example.test/p.jpg"]);
  assert.equal(entry?.reviewId, "r1");
  assert.equal(entry?.authorId, "u1");
});

test("H31: dietary labels render on the dish and as a stall summary, halal first", () => {
  assert.equal(formatDietaryFlag("pork_free"), "Pork-free");
  assert.equal(formatDietaryFlag("something_new"), "Something new");
  assert.deepEqual(orderDietaryFlags(["vegan", "nut_free", "halal", "halal"]), [
    "halal",
    "vegan",
    "nut_free",
  ]);
  const summary = summarizeStallDietaryFlags([
    { dietaryFlags: ["halal", "vegetarian"] },
    { dietaryFlags: ["halal"] },
  ]);
  assert.deepEqual(
    summary.map(({ flag, dishCount, allDishes }) => [flag, dishCount, allDishes]),
    [
      ["halal", 2, true],
      ["vegetarian", 1, false],
    ],
  );
  assert.match(dishDetail, /<DietaryFlagChips flags=\{dish\.dietaryFlags\} \/>/);
  assert.match(stallDetail, /summarizeStallDietaryFlags\(dishes\)/);
  const chips = read("src/components/dish/DietaryFlagChips.tsx");
  assert.match(chips, /const isHalal = flag === "halal"/);
});

test("H32: post authors come from public_profiles, never from generated_content", () => {
  assert.doesNotMatch(service, /author: \{\s*displayName: author\.displayName/);
  assert.doesNotMatch(service, /authorMeta/);
  assert.match(service, /authorName: asString\(authorRow\?\.display_name\) \?\? "Hungry User"/);
  assert.match(repository, /authorName: toString\(author\?\.display_name\) \|\| "Hungry User"/);
  assert.doesNotMatch(repository, /toRecord\(meta\.author\)/);
  const sql = migration("20261021165000_posts_strip_client_author.sql");
  assert.match(sql, /new\.generated_content := new\.generated_content - 'author'/);
  assert.match(sql, /before insert or update of generated_content on public\.posts/);
});

test("H33: authors can edit and delete their own review; deletes stop counting", async () => {
  assert.deepEqual(normalizeReviewPatch({ rating: 4, text: "  <b>Good</b> laksa  " }), {
    rating: 4,
    text: "Good laksa",
  });
  assert.throws(() => normalizeReviewPatch({ rating: 0 }), /1 to 5/);
  assert.throws(() => normalizeReviewPatch({}), /Nothing to update/);
  assert.equal(isOwnReview({ authorId: "u1" }, "u1"), true);
  assert.equal(isOwnReview({ authorId: "u1" }, "u2"), false);
  assert.equal(isOwnReview({}, "u1"), false);

  const types = read("src/lib/services/types.ts");
  assert.match(types, /updateReview\(reviewId: string, patch: UpdateReviewInput\): Promise<void>;/);
  assert.match(types, /deleteReview\(reviewId: string\): Promise<void>;/);
  assert.match(
    service,
    /\.from\("reviews"\)\s*\.update\(payload\)\s*\.eq\("id", reviewId\)\s*\.eq\("user_id", userId\)/,
  );
  assert.match(
    service,
    /\.from\("reviews"\)\s*\.delete\(\)\s*\.eq\("id", reviewId\)\s*\.eq\("user_id", userId\)/,
  );
  assert.match(service, /client\.storage\.from\("review-media"\)\.remove\(paths\)/);
  assert.match(dishDetail, /<OwnReviewActions/);
  assert.match(stallDetail, /<OwnReviewActions/);

  const sql = migration("20261021161000_review_edit_delete_latest_rating.sql");
  // Totals run as definer: diners have no UPDATE on dishes.
  assert.match(
    sql,
    /create or replace function app_private\.sync_dish_review_stats\(\)[\s\S]*?security definer/,
  );
  assert.match(
    sql,
    /after insert or delete or update of rating, dish_id, user_id, created_at on public\.reviews[\s\S]*?execute function app_private\.sync_dish_review_stats\(\)/,
  );
  // Guard keeps the account-deletion branch and locks author_name for authors.
  assert.match(
    sql,
    /current_user not in \('anon', 'authenticated'\)\s*and old\.user_id is not null\s*and new\.user_id is null/,
  );
  assert.match(
    sql,
    /if old\.user_id = auth\.uid\(\) then[\s\S]*?new\.author_name is distinct from old\.author_name/,
  );

  // Mock: only the author can edit or delete.
  await hungryService.auth.signIn("editor-d@hungry.sg", "password");
  const profile = await hungryService.profile.getProfile();
  const dish = dishes[1];
  assert.ok(dish);
  const base = {
    authorName: "Editor D",
    createdAt: new Date().toISOString(),
    tags: [],
    wouldRecommend: true,
    photos: [],
  };
  dish.reviews = [
    ...dish.reviews,
    { ...base, id: "review-own-d", authorId: profile.id, rating: 2, text: "Meh" },
    { ...base, id: "review-other-d", authorId: "someone-else", rating: 5, text: "Great" },
  ];
  try {
    await hungryService.reviews.updateReview("review-own-d", { rating: 4, text: "Better" });
    const edited = dish.reviews.find((review) => review.id === "review-own-d");
    assert.equal(edited?.rating, 4);
    assert.equal(edited?.text, "Better");
    await assert.rejects(
      hungryService.reviews.updateReview("review-other-d", { rating: 1 }),
      /isn't yours/,
    );
    await assert.rejects(hungryService.reviews.deleteReview("review-other-d"), /isn't yours/);
    await hungryService.reviews.deleteReview("review-own-d");
    assert.equal(
      dish.reviews.some((review) => review.id === "review-own-d"),
      false,
    );
  } finally {
    dish.reviews = dish.reviews.filter(
      (review) => review.id !== "review-own-d" && review.id !== "review-other-d",
    );
  }
});

test("H34: auto-hide counts only established, independent reporters", () => {
  const sql = migration("20261021162000_review_report_established_reporters.sql");
  assert.match(sql, /create or replace function app_private\.report_content\(/);
  assert.match(sql, /security definer\s*set search_path = public, pg_temp/);
  assert.match(sql, /join auth\.users au on au\.id = cr\.reporter_id/);
  assert.match(sql, /au\.created_at <= now\(\) - interval '7 days'/);
  assert.match(sql, /cr\.reporter_id is distinct from review_author_id/);
  assert.match(
    sql,
    /mo\.venue_id = review_venue_id\s*and \(ma\.user_id = cr\.reporter_id or mr\.user_id = cr\.reporter_id\)/,
  );
  assert.match(sql, /report_count >= 3/);
  // Ops restore is untouched.
  assert.doesNotMatch(sql, /function app_private\.set_review_moderation_state/);
});

test("H35: each reviewer's latest review is the only one in the dish average", () => {
  const sql = migration("20261021161000_review_edit_delete_latest_rating.sql");
  assert.match(sql, /create or replace function app_private\.dish_review_stats\(p_dish_id text\)/);
  assert.match(sql, /distinct on \(coalesce\(r\.user_id::text, r\.id::text\)\)/);
  assert.match(
    sql,
    /order by coalesce\(r\.user_id::text, r\.id::text\), r\.created_at desc, r\.id desc/,
  );
  assert.match(sql, /not app_private\.review_is_moderation_hidden\(r\.id\)/);
});

test("H36: review text is checked on the server before it goes public", () => {
  const sql = migration("20261021163000_review_text_filter.sql");
  assert.match(sql, /create table if not exists app_private\.review_blocked_terms/);
  assert.match(sql, /before insert or update of text on public\.reviews/);
  assert.match(sql, /if v_links > 1 then/);
  assert.match(sql, /errcode = '23514'/);
  assert.match(sql, /if current_user not in \('anon', 'authenticated'\) then\s*return new;/);
  assert.match(
    sql,
    /revoke all on table app_private\.review_blocked_terms from public, anon, authenticated/,
  );
});
