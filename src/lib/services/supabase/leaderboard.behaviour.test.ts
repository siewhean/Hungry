// Leaderboard service methods against a fake Supabase client: which RPC each one calls, with
// which arguments, how rows map, and that guests make no call.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

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

test("getLeaderboard sends the board, period, scope and limit, and maps the rows", async () => {
  fake.rpc.get_leaderboard = () => ({
    data: [
      {
        rank: 1,
        user_id: OTHER,
        display_name: "Mei",
        avatar_url: null,
        score: "83.00",
        is_me: false,
      },
      { rank: 2, user_id: ME, display_name: "Me", score: 40, is_me: true },
      { rank: 3, user_id: null, display_name: "Ghost", score: 1 },
    ],
  });
  const rows = await service.leaderboard.getLeaderboard({
    board: "active",
    period: "all",
    scope: "following",
    limit: 20,
  });
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.name),
    ["get_leaderboard"],
  );
  assert.deepEqual(fake.rpcCalls[0].args, {
    p_board: "active",
    p_period: "all",
    p_scope: "following",
    p_limit: 20,
  });
  assert.deepEqual(
    rows.map((row) => [row.rank, row.userId, row.score, row.isMe]),
    [
      [1, OTHER, 83, false],
      [2, ME, 40, true],
    ],
    "a row without an account id is dropped",
  );
});

test("getLeaderboard defaults to this week, everyone, 50 rows", async () => {
  fake.rpc.get_leaderboard = () => ({ data: [] });
  await service.leaderboard.getLeaderboard({ board: "trending" });
  assert.deepEqual(fake.rpcCalls[0].args, {
    p_board: "trending",
    p_period: "week",
    p_scope: "everyone",
    p_limit: 50,
  });
});

test("getLeaderboard throws the server error so the screen can report it", async () => {
  fake.rpc.get_leaderboard = () => ({ error: { message: "rate limit exceeded", code: "P0001" } });
  await assert.rejects(service.leaderboard.getLeaderboard({ board: "active" }), {
    message: "rate limit exceeded",
  });
});

test("getMySummary maps the one row, keeping a missing rank as null", async () => {
  fake.rpc.get_my_leaderboard_summary = () => ({
    data: [
      {
        total_points: "85.00",
        week_points: 83,
        active_week_rank: 4,
        active_all_rank: null,
        trending_rank: null,
        credited_posts_today: 2,
        daily_cap: 6,
        computed_at: "2026-11-07T06:00:00Z",
      },
    ],
  });
  const summary = await service.leaderboard.getMySummary();
  assert.deepEqual(summary, {
    totalPoints: 85,
    weekPoints: 83,
    activeWeekRank: 4,
    activeAllRank: null,
    trendingRank: null,
    creditedPostsToday: 2,
    dailyCap: 6,
    computedAt: "2026-11-07T06:00:00Z",
  });
});

test("listMyPoints sends the limit and maps kinds, tiers and voided rows", async () => {
  fake.rpc.get_my_portfolio_points = () => ({
    data: [
      {
        id: "e1",
        kind: "post",
        points: "10.00",
        post_id: "p1",
        created_at: "2026-11-07T05:00:00Z",
        voided: false,
      },
      {
        id: "e2",
        kind: "achievement",
        points: 15,
        achievement_id: "posted",
        tier: 1,
        created_at: "2026-11-07T05:10:00Z",
        voided: false,
      },
      { id: "e3", kind: "post", points: 10, created_at: "2026-11-06T05:00:00Z", voided: true },
      { id: null, kind: "post", points: 10, created_at: "2026-11-06T05:00:00Z" },
    ],
  });
  const entries = await service.leaderboard.listMyPoints(5);
  assert.deepEqual(fake.rpcCalls[0].args, { p_limit: 5 });
  assert.deepEqual(
    entries.map((entry) => [entry.id, entry.kind, entry.points, entry.tier, entry.voided]),
    [
      ["e1", "post", 10, undefined, false],
      ["e2", "achievement", 15, 1, false],
      ["e3", "post", 10, undefined, true],
    ],
  );
});

test("a guest gets empty results and no call", async () => {
  auth.userId = null;
  assert.deepEqual(await service.leaderboard.getLeaderboard({ board: "active" }), []);
  assert.equal(await service.leaderboard.getMySummary(), null);
  assert.deepEqual(await service.leaderboard.listMyPoints(), []);
  assert.equal(fake.rpcCalls.length, 0);
});
