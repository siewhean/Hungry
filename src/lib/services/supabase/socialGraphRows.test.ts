import assert from "node:assert/strict";
import test from "node:test";

import {
  mapNetworkStallPicks,
  mapPeopleSuggestions,
  mapProfileRelationship,
  mapTasteComparison,
  mapTasteMatches,
} from "@/lib/services/supabase/socialGraphRows";

test("relationship: reads the row, pairs mutual ids with names, and counts at least the sample", () => {
  assert.equal(mapProfileRelationship([]), null);
  assert.equal(mapProfileRelationship(null), null);
  assert.deepEqual(
    mapProfileRelationship([
      {
        follows_you: true,
        mutual_count: 1,
        mutual_user_ids: ["a", "b", ""],
        mutual_names: ["Mei", null, "Ghost"],
      },
    ]),
    {
      followsYou: true,
      mutualCount: 2,
      mutuals: [
        { userId: "a", displayName: "Mei" },
        { userId: "b", displayName: "Hungry User" },
      ],
    },
  );
});

test("taste matches: keyed by user, rounded and clamped, bad rows dropped", () => {
  assert.deepEqual(mapTasteMatches(null), {});
  assert.deepEqual(
    mapTasteMatches([
      { user_id: "a", score: 86.6 },
      { user_id: "b", score: "140" },
      { user_id: "c", score: null },
      { user_id: "", score: 50 },
    ]),
    { a: 87, b: 100 },
  );
});

test("people suggestions: fallback name, null match stays undefined, unknown reason is active", () => {
  assert.deepEqual(mapPeopleSuggestions({}), []);
  assert.deepEqual(
    mapPeopleSuggestions([
      {
        user_id: "a",
        display_name: " Mei ",
        avatar_url: "",
        taste_match: 91.2,
        mutual_count: 2,
        recent_activity: "3",
        reason: "mutual",
      },
      { user_id: "b", taste_match: null, reason: "weird" },
      { display_name: "No id" },
    ]),
    [
      {
        userId: "a",
        displayName: "Mei",
        avatarUrl: undefined,
        tasteMatch: 91,
        mutualCount: 2,
        recentActivity: 3,
        reason: "mutual",
      },
      {
        userId: "b",
        displayName: "Hungry User",
        avatarUrl: undefined,
        tasteMatch: undefined,
        mutualCount: 0,
        recentActivity: 0,
        reason: "active",
      },
    ],
  );
});

test("network picks: source defaults to following and the count covers the sample", () => {
  assert.deepEqual(
    mapNetworkStallPicks([
      {
        venue_id: "v1",
        source: "taste_twin",
        people_count: 3,
        sample_user_ids: ["a"],
        sample_names: ["Mei"],
        last_at: "2026-11-01T00:00:00Z",
      },
      {
        venue_id: "v2",
        source: "other",
        people_count: 0,
        sample_user_ids: ["a", "b"],
        sample_names: [],
      },
      { venue_id: null },
    ]),
    [
      {
        venueId: "v1",
        source: "taste_twin",
        peopleCount: 3,
        people: [{ userId: "a", displayName: "Mei" }],
        lastAt: "2026-11-01T00:00:00Z",
      },
      {
        venueId: "v2",
        source: "following",
        peopleCount: 2,
        people: [
          { userId: "a", displayName: "Hungry User" },
          { userId: "b", displayName: "Hungry User" },
        ],
        lastAt: undefined,
      },
    ],
  );
});

test("taste comparison: both palates, clamped; nothing without a score or a full palate", () => {
  const row = {
    score: 72.4,
    sweet: 3,
    spicy: 9,
    sour: 5,
    salty: 6,
    rich: 12,
    aromatic: 4,
    my_sweet: 5,
    my_spicy: 8,
    my_sour: 5,
    my_salty: 5,
    my_rich: 6,
    my_aromatic: 4,
  };
  assert.deepEqual(mapTasteComparison([row]), {
    score: 72,
    theirs: { sweet: 3, spicy: 9, sour: 5, salty: 6, rich: 10, aromatic: 4 },
    mine: { sweet: 5, spicy: 8, sour: 5, salty: 5, rich: 6, aromatic: 4 },
  });
  assert.equal(mapTasteComparison([{ ...row, score: null }]), null);
  assert.equal(mapTasteComparison([{ ...row, my_spicy: "x" }]), null);
  assert.equal(mapTasteComparison([{ ...row, sour: null }]), null);
  assert.equal(mapTasteComparison([]), null);
});
