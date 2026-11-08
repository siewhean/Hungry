// The composer's "Posted to your Food Portfolio. +13 points." (postAnnouncement): points add up
// a post's live ledger rows, and a slow or failed read never holds the toast back.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";

import {
  loadPostPoints,
  pointsForPost,
  postedToastMessage,
} from "@/features/foodPortfolio/postAnnouncement";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PortfolioPointsEntry } from "@/lib/services/types";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}
afterEach(() => {
  while (restores.length) restores.pop()!();
});

function entry(id: string, points: number, postId?: string, voided = false): PortfolioPointsEntry {
  return { id, kind: "post", points, postId, voided, createdAt: "2026-11-08T10:00:00Z" };
}

test("a post's points add up its live rows only", () => {
  const entries = [
    entry("1", 10, "p1"),
    entry("2", 3, "p1"),
    entry("3", 5, "p1", true),
    entry("4", 10, "p2"),
  ];
  assert.equal(pointsForPost(entries, "p1"), 13);
  assert.equal(pointsForPost(entries, "p3"), null);
  assert.equal(pointsForPost([entry("5", 0, "p4")], "p4"), null);
});

test("the toast names the points when there are some", () => {
  assert.equal(postedToastMessage(13), "Posted to your Food Portfolio. +13 points.");
  assert.equal(postedToastMessage(1), "Posted to your Food Portfolio. +1 point.");
  assert.equal(postedToastMessage(null), "Posted to your Food Portfolio.");
});

test("loadPostPoints reads the ledger, and gives up on a failure or a slow read", async () => {
  stub(getHungryService().leaderboard, "listMyPoints", async () => [entry("1", 10, "p1")]);
  assert.equal(await loadPostPoints("p1"), 10);

  stub(getHungryService().leaderboard, "listMyPoints", async () => {
    throw new Error("offline");
  });
  assert.equal(await loadPostPoints("p1"), null);

  stub(getHungryService().leaderboard, "listMyPoints", () => new Promise(() => undefined));
  const started = Date.now();
  assert.equal(await loadPostPoints("p1", 20), null);
  assert.ok(Date.now() - started < 1000);
});

test("the composer announces the post with its points and a See it action to your Profile", () => {
  const composer = readFileSync("src/app/screens/post/PostComposerScreen.tsx", "utf8");
  assert.match(composer, /await loadPostPoints\(published\.id\)/);
  assert.match(composer, /message: postedToastMessage\(points\)/);
  assert.match(
    composer,
    /label: "See it"[\s\S]{0,200}screen: "Profile",\s*params: \{ screen: "ProfileHome" \}/,
  );
});
