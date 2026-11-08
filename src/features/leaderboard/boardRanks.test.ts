// Ranks away from the Leaderboard (boardRanks): one shared read of this week's board, reused for
// a minute, retried after a failure, and chips only for the top 50.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import {
  BOARD_RANKS_LIMIT,
  BOARD_RANKS_TTL_MS,
  loadWeeklyRanks,
  rankChipLabel,
  resetWeeklyRanks,
} from "@/features/leaderboard/boardRanks";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LeaderboardQuery } from "@/lib/services/types";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(() => resetWeeklyRanks());
afterEach(() => {
  while (restores.length) restores.pop()!();
  resetWeeklyRanks();
});

test("one board read serves every caller within a minute, then refreshes", async () => {
  const queries: LeaderboardQuery[] = [];
  stub(getHungryService().leaderboard, "getLeaderboard", async (query) => {
    queries.push(query);
    return [
      { rank: 1, userId: "a", displayName: "A", score: 90, isMe: false },
      { rank: 2, userId: "b", displayName: "B", score: 80, isMe: false },
    ];
  });
  const [first, second] = await Promise.all([loadWeeklyRanks(1_000), loadWeeklyRanks(2_000)]);
  assert.equal(first.get("a"), 1);
  assert.equal(second.get("b"), 2);
  assert.equal(queries.length, 1, "callers share one read");
  assert.deepEqual(queries[0], { board: "active", period: "week", limit: BOARD_RANKS_LIMIT });

  await loadWeeklyRanks(1_000 + BOARD_RANKS_TTL_MS);
  assert.equal(queries.length, 2, "a minute later the board is read again");
});

test("a failed read is not kept, so the next caller tries again", async () => {
  let calls = 0;
  stub(getHungryService().leaderboard, "getLeaderboard", async () => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return [{ rank: 3, userId: "c", displayName: "C", score: 10, isMe: false }];
  });
  await assert.rejects(loadWeeklyRanks(5_000), /offline/);
  const ranks = await loadWeeklyRanks(5_001);
  assert.equal(ranks.get("c"), 3);
  assert.equal(calls, 2);
});

test("rank chips show only for the top 50", () => {
  assert.equal(rankChipLabel(4), "#4");
  assert.equal(rankChipLabel(50), "#50");
  assert.equal(rankChipLabel(51), null);
  assert.equal(rankChipLabel(null), null);
  assert.equal(rankChipLabel(0), null);
});
