import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hungryService as service } from "@/lib/services/mock/mockService";
import { reviewHelpfulState, toggleReviewHelpful } from "./reviewHelpful";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function migration(): string {
  const name = readdirSync(path.join(root, "supabase/migrations")).find((file) =>
    file.endsWith("_review_helpful_votes.sql"),
  );
  assert.ok(name, "review_helpful_votes migration is missing");
  return read(`supabase/migrations/${name}`);
}

test("helpful toggle flips the vote and never counts below zero", () => {
  assert.deepEqual(reviewHelpfulState({}), { helpful: false, count: 0 });
  assert.deepEqual(toggleReviewHelpful({ helpful: false, count: 2 }), { helpful: true, count: 3 });
  assert.deepEqual(toggleReviewHelpful({ helpful: true, count: 3 }), { helpful: false, count: 2 });
  assert.deepEqual(toggleReviewHelpful({ helpful: true, count: 0 }), { helpful: false, count: 0 });
});

test("mock service saves helpful votes and returns them with the feed", async () => {
  const [first] = await service.reviews.listRecentReviews({ limit: 1 });
  assert.ok(first, "mock feed has a review");
  const baseCount = first.review.helpfulCount ?? 0;

  await service.reviews.setReviewHelpful(first.review.id, true);
  await service.reviews.setReviewHelpful(first.review.id, true);
  let [after] = await service.reviews.listRecentReviews({ limit: 1 });
  assert.equal(after?.review.viewerFoundHelpful, true);
  assert.equal(after?.review.helpfulCount, baseCount + 1);

  await service.reviews.setReviewHelpful(first.review.id, false);
  [after] = await service.reviews.listRecentReviews({ limit: 1 });
  assert.equal(after?.review.viewerFoundHelpful, false);
  assert.equal(after?.review.helpfulCount, baseCount);
});

test("helpful votes live in an RLS table with a trigger-kept public count", () => {
  const sql = migration();
  assert.match(sql, /create table if not exists public\.review_helpful_votes/);
  assert.match(sql, /primary key \(review_id, user_id\)/);
  assert.match(sql, /alter table public\.review_helpful_votes enable row level security/);
  assert.match(sql, /add column if not exists helpful_count integer not null default 0/);
  assert.match(
    sql,
    /revoke all on table public\.review_helpful_votes from public, anon, authenticated/,
  );
  assert.match(
    sql,
    /grant select, insert, delete on table public\.review_helpful_votes to authenticated/,
  );
  assert.doesNotMatch(sql, /to anon\b/);
  // Votes only on readable reviews that are not the voter's own.
  assert.match(sql, /r\.user_id is distinct from \(select auth\.uid\(\)\)/);
  // SECURITY DEFINER only in app_private.
  assert.match(sql, /create or replace function app_private\.sync_review_helpful_count\(\)/);
  assert.doesNotMatch(sql, /function public\.[a-z_]+\([^)]*\)\s*returns[^$]*security definer/i);
  // Authors and merchants cannot write the count; votes don't recompute dish totals.
  assert.equal(
    (sql.match(/new\.helpful_count is distinct from old\.helpful_count/g) ?? []).length,
    2,
  );
  assert.match(sql, /after insert or delete or update of rating, dish_id on public\.reviews/);
  assert.ok(existsSync(path.join(root, "supabase/smoke/review_helpful_votes.sql")));
});

test("nothing limits how many reviews a user writes for one dish", () => {
  const sql = migration();
  assert.doesNotMatch(sql, /unique\s*\(\s*user_id\s*,\s*dish_id/i);
  // The unused cooldown helper in gamificationLimits must never gate the review submit.
  for (const file of [
    "src/app/screens/review/ReviewScreen.tsx",
    "src/store/useReviewDraftStore.ts",
    "src/features/post/publishing.ts",
  ]) {
    assert.doesNotMatch(read(file), /reviewCooldownPassed|minSecondsBetweenReviews/);
  }
});

test("review feed has no Helpful button and its chips follow taste, food and area", () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  // Round 6: the A–Z chips gave way to taste, food and area chips.
  assert.match(
    feed,
    /buildReviewExploreChips\(allReviews, \{[^}]*userVector: tasteVector[^}]*areaOf/,
  );
  assert.doesNotMatch(feed, /By Dish|By Location|A–Z dish/);
  // Owner decision (round 2): the Helpful vote is gone from review cards.
  assert.doesNotMatch(feed, /<ThumbsUp|Sign in to mark reviews helpful/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /merchant_replied_at,helpful_count/);
  assert.match(service, /\.from\("review_helpful_votes"\)/);
});

test("unused review files and the Reads feed are gone", () => {
  for (const file of [
    "src/app/screens/review/ReviewScreenShell.tsx",
    "src/app/screens/review/ReviewStars.tsx",
    "src/components/review/MusicPicker.tsx",
    "src/components/review/PhotoPicker.tsx",
    "src/components/review/TasteTagSelector.tsx",
    "src/app/screens/reads/ReadsFeedScreen.tsx",
    "src/features/reads/feed.ts",
  ]) {
    assert.equal(existsSync(path.join(root, file)), false, `${file} should be deleted`);
  }
  assert.doesNotMatch(read("src/constants/featureFlags.ts"), /readsEnabled/);
});
