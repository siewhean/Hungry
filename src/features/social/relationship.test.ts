import assert from "node:assert/strict";
import test from "node:test";

import {
  GREAT_MATCH_FROM,
  LOW_MATCH_BELOW,
  followButtonLabel,
  followedByLine,
  suggestionReason,
  tasteMatchBand,
  tasteMatchLabel,
} from "@/features/social/relationship";
import type { PeopleSuggestion } from "@/lib/services/types";

test("taste match bands follow Vivino's cut-offs", () => {
  assert.equal(tasteMatchBand(GREAT_MATCH_FROM), "great");
  assert.equal(tasteMatchBand(GREAT_MATCH_FROM - 1), "good");
  assert.equal(tasteMatchBand(LOW_MATCH_BELOW), "good");
  assert.equal(tasteMatchBand(LOW_MATCH_BELOW - 1), "low");
  assert.equal(tasteMatchLabel(87), "87% · Great match");
  assert.equal(tasteMatchLabel(55), "55% · Good match");
  assert.equal(tasteMatchLabel(12), "12% · Low match");
});

test("follow button: requested beats following, and a follower gets Follow back", () => {
  assert.equal(
    followButtonLabel({ isFollowing: true, isRequested: true, followsYou: true }),
    "Requested",
  );
  assert.equal(
    followButtonLabel({ isFollowing: true, isRequested: false, followsYou: true }),
    "Following",
  );
  assert.equal(
    followButtonLabel({ isFollowing: false, isRequested: false, followsYou: true }),
    "Follow back",
  );
  assert.equal(
    followButtonLabel({ isFollowing: false, isRequested: false, followsYou: false }),
    "Follow",
  );
});

test("followed-by line names up to two people and counts the rest", () => {
  const mei = { userId: "a", displayName: "Mei" };
  const sam = { userId: "b", displayName: "Sam" };
  assert.equal(followedByLine(null), "");
  assert.equal(followedByLine({ followsYou: false, mutualCount: 0, mutuals: [] }), "");
  assert.equal(
    followedByLine({ followsYou: false, mutualCount: 1, mutuals: [mei] }),
    "Followed by Mei",
  );
  assert.equal(
    followedByLine({ followsYou: false, mutualCount: 2, mutuals: [mei, sam] }),
    "Followed by Mei and Sam",
  );
  assert.equal(
    followedByLine({ followsYou: false, mutualCount: 3, mutuals: [mei, sam] }),
    "Followed by Mei, Sam and 1 other you follow",
  );
  assert.equal(
    followedByLine({
      followsYou: false,
      mutualCount: 5,
      mutuals: [mei, sam, { userId: "c", displayName: "Arun" }],
    }),
    "Followed by Mei, Sam and 3 others you follow",
  );
  assert.equal(
    followedByLine({ followsYou: false, mutualCount: 4, mutuals: [] }),
    "Followed by 4 people you follow",
  );
});

test("suggestion reason: mutuals first, then a great taste match, then activity", () => {
  const base: PeopleSuggestion = {
    userId: "u",
    displayName: "Mei",
    mutualCount: 0,
    recentActivity: 0,
    reason: "active",
  };
  assert.equal(
    suggestionReason({ ...base, reason: "mutual", mutualCount: 1 }),
    "Followed by 1 person you follow",
  );
  assert.equal(suggestionReason({ ...base, reason: "taste", tasteMatch: 91 }), "91% taste match");
  assert.equal(
    suggestionReason({ ...base, tasteMatch: 50, recentActivity: 3 }),
    "Reviewing and posting lately",
  );
  assert.equal(suggestionReason(base), "New on Hungry");
});
