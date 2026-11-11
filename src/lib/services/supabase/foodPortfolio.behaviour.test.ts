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

test("getPicks reads picks once and splits them into the top three and the bests", async () => {
  fake.rpc.get_portfolio_picks = () => ({
    data: [
      postRow(POST_B, { kind: "overall", slot: "2" }),
      postRow(POST_A, { kind: "overall", slot: "1" }),
      postRow(POST_A, { kind: "dish_type", slot: "Laksa" }),
      postRow(POST_B, { kind: "overall", slot: "9" }),
    ],
  });
  const picks = await service.foodPortfolio.getPicks(OTHER);
  assert.deepEqual(
    picks.topThree.map((pick) => [pick.place, pick.post.id]),
    [
      [1, POST_A],
      [2, POST_B],
    ],
  );
  assert.deepEqual(
    picks.bests.map((pick) => [pick.foodType, pick.post.id]),
    [["Laksa", POST_A]],
  );
  assert.equal(fake.rpcCalls.length, 1);
  assert.deepEqual(fake.rpcCalls[0].args, { p_user_id: OTHER });
  assert.deepEqual(await service.foodPortfolio.getPicks("mock-user"), { topThree: [], bests: [] });
  assert.equal(fake.rpcCalls.length, 1, "a non-account id makes no call");
});

test("setPick sends the kind and a place only for the top three, and maps what it replaced", async () => {
  fake.rpc.set_portfolio_pick = () => ({
    data: { kind: "dish_type", slot: "Laksa", post_id: POST_A, replaced_post_id: POST_B },
  });
  assert.deepEqual(await service.foodPortfolio.setPick(POST_A, "dish_type", 2), {
    kind: "dish_type",
    slot: "Laksa",
    postId: POST_A,
    replacedPostId: POST_B,
  });
  assert.deepEqual(fake.rpcCalls[0].args, {
    p_post_id: POST_A,
    p_kind: "dish_type",
    p_place: null,
  });
  fake.rpc.set_portfolio_pick = () => ({
    data: { kind: "overall", slot: "3", post_id: POST_A, replaced_post_id: null },
  });
  const moved = await service.foodPortfolio.setPick(POST_A, "overall", 3.4);
  assert.equal(moved.replacedPostId, undefined);
  assert.deepEqual(fake.rpcCalls[1].args, { p_post_id: POST_A, p_kind: "overall", p_place: 3 });
  await assert.rejects(service.foodPortfolio.setPick(POST_A, "overall", 4));
  await assert.rejects(service.foodPortfolio.setPick("not-a-uuid", "dish_type"));
  assert.equal(fake.rpcCalls.length, 2, "bad input never reaches the server");
  fake.rpc.set_portfolio_pick = () => ({
    error: { message: "Make this dish public before choosing it as a best.", code: "22023" },
  });
  await assert.rejects(service.foodPortfolio.setPick(POST_A, "dish_type"), {
    message: "Make this dish public before choosing it as a best.",
  });
});

test("removePick sends one kind or all kinds and returns how many went", async () => {
  fake.rpc.remove_portfolio_pick = () => ({ data: 2 });
  assert.equal(await service.foodPortfolio.removePick(POST_A), 2);
  await service.foodPortfolio.removePick(POST_A, "overall");
  assert.deepEqual(fake.rpcCalls[0].args, { p_post_id: POST_A, p_kind: null });
  assert.deepEqual(fake.rpcCalls[1].args, { p_post_id: POST_A, p_kind: "overall" });
  assert.equal(await service.foodPortfolio.removePick("not-a-uuid"), 0);
  assert.equal(fake.rpcCalls.length, 2);
});

test("setEntryVisibility sends Public or Only me and returns what the server set", async () => {
  fake.rpc.set_post_visibility = () => ({ data: "private" });
  assert.equal(await service.foodPortfolio.setEntryVisibility(POST_A, "private"), "private");
  assert.deepEqual(fake.rpcCalls[0].args, { p_post_id: POST_A, p_visibility: "private" });
  fake.rpc.set_post_visibility = () => ({
    error: { message: "Only your own dishes can be changed.", code: "42501" },
  });
  await assert.rejects(service.foodPortfolio.setEntryVisibility(POST_A, "public"), {
    message: "Only your own dishes can be changed.",
  });
  await assert.rejects(service.foodPortfolio.setEntryVisibility("not-a-uuid", "public"));
  assert.equal(fake.rpcCalls.length, 2);
});

test("getDiary pages on the last entry and maps visibility, dish type and picks", async () => {
  fake.rpc.get_portfolio_diary = () => ({
    data: [
      postRow(POST_A, { visibility: "private", dish_food_type: "Laksa", pick_kinds: [] }),
      postRow(POST_B, { visibility: "public", pick_kinds: ["dish_type", "overall", "other"] }),
    ],
  });
  const entries = await service.foodPortfolio.getDiary(OTHER, {
    limit: 500,
    before: { publishedAt: "2026-11-06T10:00:00Z", id: POST_A },
  });
  assert.deepEqual(
    entries.map((entry) => [entry.post.id, entry.visibility, entry.dishFoodType, entry.pickKinds]),
    [
      [POST_A, "private", "Laksa", []],
      [POST_B, "public", undefined, ["dish_type", "overall"]],
    ],
  );
  assert.deepEqual(fake.rpcCalls[0].args, {
    p_user_id: OTHER,
    p_limit: 60,
    p_before_published_at: "2026-11-06T10:00:00Z",
    p_before_id: POST_A,
  });
  await service.foodPortfolio.getDiary(OTHER);
  assert.deepEqual(fake.rpcCalls[1].args, {
    p_user_id: OTHER,
    p_limit: 30,
    p_before_published_at: null,
    p_before_id: null,
  });
  assert.deepEqual(await service.foodPortfolio.getDiary("mock-user"), []);
  assert.equal(fake.rpcCalls.length, 2);
});

test("getReviewPortfolioLabels asks once with up to 50 distinct ids and drops empty labels", async () => {
  fake.rpc.get_review_portfolio_labels = () => ({
    data: [
      { review_id: POST_A, food_type: "Laksa", overall_place: null, dish_count: 6 },
      { review_id: POST_B, food_type: null, overall_place: 2, dish_count: 9 },
      { review_id: OTHER, food_type: null, overall_place: 7, dish_count: 9 },
    ],
  });
  const ids = Array.from(
    { length: 60 },
    (_, i) => `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`,
  );
  const labels = await service.foodPortfolio.getReviewPortfolioLabels([
    POST_A,
    POST_A,
    "bad",
    ...ids,
  ]);
  assert.deepEqual(labels, [
    { reviewId: POST_A, foodType: "Laksa", overallPlace: undefined, dishCount: 6 },
    { reviewId: POST_B, foodType: undefined, overallPlace: 2, dishCount: 9 },
  ]);
  const sent = fake.rpcCalls[0].args as { p_review_ids: string[] };
  assert.equal(sent.p_review_ids.length, 50);
  assert.equal(sent.p_review_ids[0], POST_A);
  assert.deepEqual(await service.foodPortfolio.getReviewPortfolioLabels(["bad"]), []);
  assert.equal(fake.rpcCalls.length, 1);
});

test("the entry made with a review is looked up among your own live posts", async () => {
  const REVIEW = "44444444-4444-4444-8444-444444444441";
  fake.tables.posts = (call) => {
    const filters = call.ops.filter(([op]) => op === "eq" || op === "is").map(([, args]) => args);
    assert.deepEqual(filters, [
      ["review_id", REVIEW],
      ["author_id", ME],
      ["deleted_at", null],
    ]);
    return { data: { id: POST_A }, error: null };
  };
  assert.equal(await service.foodPortfolio.getEntryForReview(REVIEW), POST_A);
  fake.tables.posts = () => ({ data: null, error: null });
  assert.equal(await service.foodPortfolio.getEntryForReview(REVIEW), null);
  assert.equal(await service.foodPortfolio.getEntryForReview("not-a-uuid"), null);
});

test("the review behind an entry is null once the review is gone; signed out reads nothing", async () => {
  const REVIEW = "44444444-4444-4444-8444-444444444442";
  fake.tables.posts = (call) => {
    assert.ok(call.ops.some(([op, args]) => op === "eq" && args[0] === "id" && args[1] === POST_B));
    return { data: { review_id: REVIEW }, error: null };
  };
  assert.equal(await service.foodPortfolio.getReviewForEntry(POST_B), REVIEW);
  fake.tables.posts = () => ({ data: { review_id: null }, error: null });
  assert.equal(await service.foodPortfolio.getReviewForEntry(POST_B), null);
  auth.userId = null;
  fake.queries.length = 0;
  assert.equal(await service.foodPortfolio.getReviewForEntry(POST_B), null);
  assert.equal(fake.queries.length, 0);
});
