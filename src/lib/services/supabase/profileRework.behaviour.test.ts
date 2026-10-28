// Round-four profile rework, against the real Supabase service with a fake client: review
// photos only on your own list, the review totals, taste match and pinned-dish calls (each one
// quiet on a backend that has not shipped the migration yet), and get_item_details chunking.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

let service: typeof import("./supabaseService").supabaseService;
let repository: typeof import("./supabaseRepository");

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
  repository = await import("./supabaseRepository");
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  auth.userId = ME;
});

const missingFunction = { message: "Could not find the function", code: "PGRST202" };
const reviewRow = (userId: string) => ({
  id: "r1",
  dish_id: "d1",
  venue_id: "v1",
  user_id: userId,
  author_name: "Someone",
  created_at: "2026-10-02T00:00:00Z",
  rating: 5,
  text: "Great",
  tags: [],
  would_recommend: true,
});

test("your own review list reads your photos; someone else's never does", async () => {
  fake.tables.reviews = () => ({ data: [reviewRow(ME)], error: null });
  fake.tables.review_photos = () => ({
    data: [{ review_id: "r1", url: "https://img.example/mine.jpg", sort_order: 0 }],
    error: null,
  });
  const own = await service.reviews.getUserReviews(ME);
  assert.equal(fake.queriesOn("review_photos").length > 0, true, "own list asks for photos");
  assert.deepEqual(own[0]?.photos, ["https://img.example/mine.jpg"]);

  fake.queries.length = 0;
  fake.rpc.get_user_profile_reviews = () => ({ data: [reviewRow(OTHER)], error: null });
  const theirs = await service.reviews.getUserReviews(OTHER);
  assert.equal(theirs.length, 1);
  assert.equal(fake.queriesOn("review_photos").length, 0, "other lists read no photos");
});

test("getMyReviewStats maps the totals and histogram", async () => {
  fake.rpc.get_my_review_stats = () => ({
    data: [
      {
        review_count: 12,
        average_rating: "4.3",
        rating_1: 0,
        rating_2: 1,
        rating_3: 2,
        rating_4: 4,
        rating_5: 5,
      },
    ],
    error: null,
  });
  assert.deepEqual(await service.reviews.getMyReviewStats(), {
    reviewCount: 12,
    averageRating: 4.3,
    ratingCounts: [0, 1, 2, 4, 5],
  });
});

test("getMyReviewStats: no reviews means no average; no function means undefined; a rate cap throws", async () => {
  fake.rpc.get_my_review_stats = () => ({
    data: [{ review_count: 0, average_rating: null }],
    error: null,
  });
  const empty = await service.reviews.getMyReviewStats();
  assert.equal(empty?.reviewCount, 0);
  assert.equal(empty?.averageRating, null);

  fake.rpc.get_my_review_stats = () => ({ data: null, error: missingFunction });
  assert.equal(await service.reviews.getMyReviewStats(), undefined);

  fake.rpc.get_my_review_stats = () => ({
    data: null,
    error: { message: "rate limit exceeded", code: "P0001" },
  });
  await assert.rejects(service.reviews.getMyReviewStats());

  auth.userId = null;
  assert.equal(await service.reviews.getMyReviewStats(), undefined, "signed out: nothing to read");
});

test("getTasteMatch returns the score, null when there is none, and throws on a real error", async () => {
  fake.rpc.get_taste_match = () => ({ data: 87, error: null });
  assert.equal(await service.profile.getTasteMatch(OTHER), 87);
  assert.deepEqual(fake.callsTo("get_taste_match")[0]?.args, { p_user_id: OTHER });

  fake.rpc.get_taste_match = () => ({ data: null, error: null });
  assert.equal(await service.profile.getTasteMatch(OTHER), null);

  fake.rpc.get_taste_match = () => ({ data: 140, error: null });
  assert.equal(await service.profile.getTasteMatch(OTHER), 100, "clamped to 0-100");

  fake.rpc.get_taste_match = () => ({ data: null, error: missingFunction });
  assert.equal(await service.profile.getTasteMatch(OTHER), null, "older backend");

  fake.rpc.get_taste_match = () => ({ data: null, error: { message: "slow down", code: "P0001" } });
  await assert.rejects(service.profile.getTasteMatch(OTHER));
});

test("listFavouriteDishIds reads the pins in order; a missing table reads as null (cannot pin)", async () => {
  fake.tables.profile_favourite_dishes = () => ({
    data: [
      { dish_id: "d2", position: 1 },
      { dish_id: "d1", position: 2 },
    ],
    error: null,
  });
  assert.deepEqual(await service.profile.listFavouriteDishIds(OTHER), ["d2", "d1"]);
  const ops = fake.queriesOn("profile_favourite_dishes")[0]?.ops.map(([op]) => op);
  assert.ok(ops?.includes("order"));

  fake.tables.profile_favourite_dishes = () => ({
    data: null,
    error: { message: "relation does not exist", code: "42P01" },
  });
  assert.equal(await service.profile.listFavouriteDishIds(OTHER), null);

  fake.tables.profile_favourite_dishes = () => ({
    data: null,
    error: { message: "boom", code: "XX000" },
  });
  await assert.rejects(service.profile.listFavouriteDishIds(OTHER));
});

test("setFavouriteDishes sends the deduped list in one rpc and throws when it is refused", async () => {
  const stored = await service.profile.setFavouriteDishes(["d1", "d2", "d1", " "]);
  assert.deepEqual(stored, ["d1", "d2"]);
  assert.deepEqual(
    fake.callsTo("set_profile_favourite_dishes").map((call) => call.args),
    [{ p_dish_ids: ["d1", "d2"] }],
  );

  fake.rpc.set_profile_favourite_dishes = () => ({
    data: null,
    error: { message: "pin dishes you saved or reviewed", code: "22023" },
  });
  await assert.rejects(service.profile.setFavouriteDishes(["d9"]));
});

test("getPublicProfile reads created_at for Member since", async () => {
  fake.tables.public_profiles = () => ({
    data: { id: OTHER, display_name: "Ahmad", created_at: "2026-03-14T00:00:00Z" },
    error: null,
  });
  const profile = await service.profile.getPublicProfile(OTHER);
  assert.equal(profile?.createdAt, "2026-03-14T00:00:00Z");
  const selected = fake.queriesOn("public_profiles")[0]?.ops.find(([op]) => op === "select");
  assert.match(String(selected?.[1][0]), /created_at/);
});

test("get_item_details goes out in chunks of 200 ids, together, and one failed chunk fails the lot", async () => {
  const dishIds = Array.from({ length: 450 }, (_, index) => `dish-${index}`);
  fake.rpc.get_item_details = (args) => ({
    data: (args.p_dish_ids as string[]).map((dishId) => ({ dish_id: dishId, name: dishId })),
    error: null,
  });
  const rows = await repository.getItemDetailsViaRpc({ dishIds, stallIds: [] });
  const calls = fake.callsTo("get_item_details");
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.map((call) => (call.args.p_dish_ids as string[]).length),
    [200, 200, 50],
  );
  assert.equal(rows?.length, 450);

  fake.rpcCalls.length = 0;
  let seen = 0;
  fake.rpc.get_item_details = () => {
    seen += 1;
    return seen === 2 ? { data: null, error: { message: "timeout" } } : { data: [], error: null };
  };
  assert.equal(await repository.getItemDetailsViaRpc({ dishIds, stallIds: [] }), undefined);
});
