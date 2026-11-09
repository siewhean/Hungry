import assert from "node:assert/strict";
import test from "node:test";

import { groupPostsByDay } from "@/features/foodPortfolio/followingFeedDays";
import type { Bite } from "@/lib/services/types";

const post = (id: string, createdAt: string) => ({ id, createdAt }) as Bite;

test("groupPostsByDay labels Today, Yesterday, then the date, keeping the feed's order", () => {
  const now = new Date(2026, 10, 8, 12, 0);
  const days = groupPostsByDay(
    [
      post("a", new Date(2026, 10, 8, 9, 0).toISOString()),
      post("b", new Date(2026, 10, 8, 7, 0).toISOString()),
      post("c", new Date(2026, 10, 7, 20, 0).toISOString()),
      post("d", new Date(2026, 10, 3, 13, 0).toISOString()),
    ],
    now,
  );
  assert.deepEqual(
    days.map((day) => [day.key, day.posts.map((entry) => entry.id)]),
    [
      ["2026-11-8", ["a", "b"]],
      ["2026-11-7", ["c"]],
      ["2026-11-3", ["d"]],
    ],
  );
  assert.equal(days[0].label, "Today");
  assert.equal(days[1].label, "Yesterday");
  assert.match(days[2].label, /3/);
  assert.match(days[2].label, /Nov/);
});

test("groupPostsByDay puts a post with a broken date under Earlier", () => {
  const days = groupPostsByDay([post("x", "not a date")], new Date(2026, 10, 8));
  assert.deepEqual(
    days.map((day) => [day.key, day.label]),
    [["unknown", "Earlier"]],
  );
});
