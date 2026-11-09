// Food Portfolio service methods against a fake Supabase client: which RPC each one calls, with
// which arguments, and how rows and errors come back.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST_A = "33333333-3333-4333-8333-333333333331";
const POST_B = "33333333-3333-4333-8333-333333333332";

let service: typeof import("./supabaseService").supabaseService;

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  auth.userId = ME;
});

function postRow(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    author_id: OTHER,
    venue_id: "venue-1",
    dish_id: "dish-1",
    caption: "Crispy edges",
    generated_content: {},
    like_count: 4,
    save_count: 1,
    media: [],
    author_display_name: "Mei",
    venue_name: "Hill Street Char Kway Teow",
    dish_name: "Char kway teow",
    published_at: "2026-11-06T10:00:00Z",
    created_at: "2026-11-06T09:59:00Z",
    viewer_has_liked: false,
    viewer_has_saved: false,
    ...extra,
  };
}

test("getTopPosts reads the top three in one call and reports which are pinned", async () => {
  fake.rpc.get_food_portfolio_top_posts = () => ({
    data: [postRow(POST_A, { is_pinned: true }), postRow(POST_B, { is_pinned: false })],
  });
  const result = await service.foodPortfolio.getTopPosts(OTHER);
  assert.deepEqual(
    result.posts.map((post) => post.id),
    [POST_A, POST_B],
  );
  assert.deepEqual(result.pinnedPostIds, [POST_A]);
  assert.equal(result.posts[0].dishName, "Char kway teow");
  assert.equal(fake.rpcCalls.length, 1);
  assert.deepEqual(fake.rpcCalls[0].args, { p_user_id: OTHER });
});

test("getTopPosts skips the call for an id that is not an account id", async () => {
  const result = await service.foodPortfolio.getTopPosts("mock-user");
  assert.deepEqual(result, { posts: [], pinnedPostIds: [] });
  assert.equal(fake.rpcCalls.length, 0);
});

test("getTopPosts throws the server error so the screen can report it", async () => {
  fake.rpc.get_food_portfolio_top_posts = () => ({
    error: { message: "rate limit exceeded", code: "P0001" },
  });
  await assert.rejects(service.foodPortfolio.getTopPosts(OTHER), {
    message: "rate limit exceeded",
  });
});

test("setPinnedPosts sends at most three distinct account ids and returns what the server kept", async () => {
  fake.rpc.set_pinned_posts = () => ({ data: [POST_B] });
  const kept = await service.foodPortfolio.setPinnedPosts([
    POST_A,
    POST_A,
    "not-a-uuid",
    POST_B,
    "33333333-3333-4333-8333-333333333333",
    "33333333-3333-4333-8333-333333333334",
  ]);
  assert.deepEqual(kept, [POST_B]);
  assert.deepEqual(fake.rpcCalls[0].args, {
    p_post_ids: [POST_A, POST_B, "33333333-3333-4333-8333-333333333333"],
  });
});

test("getMyRanking reads the whole ranking in one call", async () => {
  fake.rpc.get_my_portfolio_ranking = () => ({ data: [POST_B, POST_A] });
  assert.deepEqual(await service.foodPortfolio.getMyRanking(), [POST_B, POST_A]);
  assert.equal(fake.rpcCalls.length, 1);
  fake.rpc.get_my_portfolio_ranking = () => ({ error: { message: "nope", code: "42501" } });
  await assert.rejects(service.foodPortfolio.getMyRanking(), { message: "nope" });
});

test("rankPost sends one post and a whole-number place of at least 1, and returns the ranking", async () => {
  fake.rpc.rank_portfolio_post = () => ({ data: [POST_B, POST_A] });
  assert.deepEqual(await service.foodPortfolio.rankPost(POST_A, 2.7), [POST_B, POST_A]);
  await service.foodPortfolio.rankPost(POST_A, 0);
  assert.deepEqual(fake.rpcCalls[0].args, { p_post_id: POST_A, p_position: 2 });
  assert.deepEqual(fake.rpcCalls[1].args, { p_post_id: POST_A, p_position: 1 });
  await assert.rejects(service.foodPortfolio.rankPost("not-a-uuid", 1));
  assert.equal(fake.rpcCalls.length, 2, "a bad id never reaches the server");
});

test("getReviewPortfolioRanks asks once with up to 50 distinct review ids and maps the rows", async () => {
  fake.rpc.get_review_portfolio_ranks = () => ({
    data: [
      { review_id: POST_A, portfolio_rank: 2, dish_count: 7 },
      { review_id: POST_B, portfolio_rank: null, dish_count: 7 },
    ],
  });
  const many = Array.from(
    { length: 60 },
    (_, index) => `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
  );
  const rows = await service.foodPortfolio.getReviewPortfolioRanks([
    POST_A,
    POST_A,
    "bad",
    ...many,
  ]);
  assert.deepEqual(rows, [{ reviewId: POST_A, rank: 2, dishCount: 7 }]);
  assert.equal(fake.rpcCalls.length, 1);
  const ids = (fake.rpcCalls[0].args as { p_review_ids: string[] }).p_review_ids;
  assert.equal(ids.length, 50);
  assert.equal(ids[0], POST_A);
  assert.deepEqual(await service.foodPortfolio.getReviewPortfolioRanks(["bad"]), []);
  assert.equal(fake.rpcCalls.length, 1, "nothing valid, nothing sent");
});

test("listStalls maps the grouped rows and drops rows without a stall", async () => {
  fake.rpc.get_food_portfolio_stalls = () => ({
    data: [
      {
        venue_id: "venue-1",
        venue_name: "Hill Street",
        building_id: "b1",
        building_name: "Chinatown Complex",
        dish_count: 3,
        last_posted_at: "2026-11-06T10:00:00Z",
      },
      { venue_id: null, dish_count: 1 },
    ],
  });
  const stalls = await service.foodPortfolio.listStalls(OTHER);
  assert.deepEqual(stalls, [
    {
      venueId: "venue-1",
      venueName: "Hill Street",
      buildingId: "b1",
      buildingName: "Chinatown Complex",
      dishCount: 3,
      lastPostedAt: "2026-11-06T10:00:00Z",
    },
  ]);
  assert.deepEqual(fake.rpcCalls[0].args, { p_user_id: OTHER, p_limit: 60 });
});

test("getFollowingFeed pages with the last post as the cursor", async () => {
  fake.rpc.get_following_dish_feed = () => ({ data: [postRow(POST_B)] });
  const posts = await service.foodPortfolio.getFollowingFeed({
    limit: 20,
    cursor: { createdAt: "2026-11-06T10:00:00Z", postId: POST_A },
  });
  assert.deepEqual(
    posts.map((post) => post.id),
    [POST_B],
  );
  assert.deepEqual(fake.rpcCalls[0].args, {
    p_limit: 20,
    p_cursor_published_at: "2026-11-06T10:00:00Z",
    p_cursor_post_id: POST_A,
  });
});

test("getFollowingFeed is empty for a guest and makes no call", async () => {
  auth.userId = null;
  assert.deepEqual(await service.foodPortfolio.getFollowingFeed(), []);
  assert.equal(fake.rpcCalls.length, 0);
});
