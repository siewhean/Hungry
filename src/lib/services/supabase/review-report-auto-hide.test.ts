import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readMigration(): string {
  const file = readdirSync(resolve(process.cwd(), "supabase/migrations")).find((name) =>
    name.endsWith("_review_report_auto_hide.sql"),
  );
  assert.ok(file, "review_report_auto_hide migration is missing");
  return readRepoFile(`supabase/migrations/${file}`);
}

test("reviews auto-hide at the same distinct-reporter threshold as posts and comments", () => {
  const migration = readMigration();
  const safety = readRepoFile("supabase/migrations/0041_full_audit_social_safety.sql");

  // Posts and comments hide at 3 distinct open reporters; reviews mirror it.
  assert.match(safety, /if report_count >= 3 then/);
  assert.match(migration, /create or replace function app_private\.report_content\(/);
  assert.match(
    migration,
    /target_type = 'review'\s+and lower\(btrim\(target_id\)\) = target_uuid::text\s+and status in \('open', 'reviewing'\)/,
  );
  assert.match(migration, /report_count >= 3 and coalesce\(review_state, 'visible'\) not in/);
  assert.match(migration, /'source', 'auto_report_threshold', 'report_count', report_count/);
  // The post and comment branches are kept.
  assert.match(migration, /return public\.report_post\(p_target_id::uuid/);
  assert.match(migration, /insert into post_comment_moderation_states/);
  assert.match(migration, /check \(target_type in \('post', 'post_comment', 'review'\)\)/);
});

test("hidden reviews leave every read path and the dish totals", () => {
  const migration = readMigration();

  assert.match(
    migration,
    /create policy reviews_select_hide_moderated\s+on public\.reviews\s+as restrictive\s+for select\s+to anon, authenticated\s+using \(\s+user_id = \(select auth\.uid\(\)\)\s+or not app_private\.review_is_moderation_hidden\(id\)/,
  );
  // No merchant exemption: hidden posts have none either.
  const policy = migration.match(/create policy reviews_select_hide_moderated[\s\S]*?\);/)?.[0];
  assert.ok(policy);
  assert.doesNotMatch(policy, /merchant_can_manage/);
  assert.match(migration, /create policy popular_visitor_pins_anon_hide_moderated_reviews/);
  assert.match(migration, /create policy popular_visitor_pins_hide_moderated_reviews/);
  assert.match(
    migration,
    /where r\.dish_id = p_dish_id\s+and not app_private\.review_is_moderation_hidden\(r\.id\)/,
  );
  assert.match(migration, /perform app_private\.refresh_dish_review_stats\(review_dish_id\)/);
  // PR #77's per-reporter hiding policy is not touched.
  assert.doesNotMatch(migration, /reviews_select_hide_blocked_or_reported/);
});

test("ops restore goes through a service-role or ops-admin moderation RPC", () => {
  const migration = readMigration();

  assert.match(migration, /create or replace function public\.set_review_moderation_state\(/);
  assert.match(
    migration,
    /coalesce\(auth\.role\(\), ''\) <> 'service_role'\s+and not public\.app_is_current_user_ops_admin\(\)/,
  );
  assert.match(
    migration,
    /revoke all on function public\.set_review_moderation_state\(uuid, text, text, jsonb\)\s+from public, anon, authenticated;/,
  );
  assert.match(migration, /set status = 'dismissed'/);

  const smoke = readRepoFile("supabase/smoke/review_report_auto_hide.sql");
  assert.match(smoke, /public\.set_review_moderation_state\(/);
  assert.match(smoke, /A reporter should still not see the review they reported/);
  assert.match(smoke, /rollback;/);
});

test("mock service hides a review after 3 distinct reporters, except from its author", async () => {
  const [entry] = await hungryService.reviews.listRecentReviews({ limit: 1 });
  assert.ok(entry, "mock data needs at least one review");
  const reviewId = entry.review.id;
  const dishBefore = await hungryService.discovery.getDish(entry.dishId);
  assert.ok(dishBefore);

  const report = () =>
    hungryService.communitySafety.reportContent({
      targetType: "review",
      targetId: reviewId,
      reason: "spam",
    });

  await hungryService.auth.signUp("reporter-one@example.com", "pw", "Reporter One");
  await report();
  await report();
  await hungryService.auth.signUp("reporter-two@example.com", "pw", "Reporter Two");
  await report();

  await hungryService.auth.signUp("bystander@example.com", "pw", "Bystander");
  let feed = await hungryService.reviews.listRecentReviews({ limit: 100 });
  assert.ok(
    feed.some((item) => item.review.id === reviewId),
    "2 reporters must not hide it",
  );

  await hungryService.auth.signUp("reporter-three@example.com", "pw", "Reporter Three");
  await report();

  await hungryService.auth.signUp("bystander@example.com", "pw", "Bystander");
  feed = await hungryService.reviews.listRecentReviews({ limit: 100 });
  assert.ok(feed.every((item) => item.review.id !== reviewId));
  const dishReviews = await hungryService.reviews.getReviewsForDish(entry.dishId);
  assert.ok(dishReviews.every((review) => review.id !== reviewId));
  const dishAfter = await hungryService.discovery.getDish(entry.dishId);
  assert.ok(dishAfter);
  assert.ok(dishAfter.reviews.every((review) => review.id !== reviewId));
  assert.equal(dishAfter.reviewCount, Math.max(0, dishBefore.reviewCount - 1));
});

function readFollowupMigration(): string {
  const file = readdirSync(resolve(process.cwd(), "supabase/migrations")).find((name) =>
    name.endsWith("_review_auto_hide_merchant_followup.sql"),
  );
  assert.ok(file, "review_auto_hide_merchant_followup migration is missing");
  return readRepoFile(`supabase/migrations/${file}`);
}

test("merchants can still unpin or reorder a pin whose review was hidden", () => {
  const migration = readFollowupMigration();

  assert.match(
    migration,
    /create or replace function app_private\.review_belongs_to_venue\([\s\S]*?security definer/,
  );
  const policy = migration.match(
    /create policy popular_visitor_pins_merchant_update[\s\S]*?\n\);/,
  )?.[0];
  assert.ok(policy);
  // The review check must not read reviews through RLS (hidden reviews are invisible to merchants).
  assert.doesNotMatch(policy, /from public\.reviews/);
  assert.match(policy, /app_private\.review_belongs_to_venue\(/);
  assert.match(policy, /public\.merchant_can_manage_outlet_v2\(outlet_id\)/);
});

test("merchant analytics leave hidden reviews out of counts, ratings and tags", () => {
  const migration = readFollowupMigration();

  // Replace the app_private definer body; the public invoker wrapper from
  // 20260527144633 must stay a wrapper (no definer body in the API schema).
  assert.match(migration, /create or replace function app_private\.get_merchant_analytics\(/);
  assert.doesNotMatch(migration, /create or replace function public\.get_merchant_analytics\(/);
  assert.equal(
    migration.match(/and not app_private\.review_is_moderation_hidden\(r\.id\)/g)?.length,
    3,
  );
  assert.match(
    migration,
    /grant execute on function app_private\.get_merchant_analytics\(uuid, timestamptz, timestamptz\)\s+to authenticated, service_role;/,
  );
  assert.match(
    migration,
    /alter function app_private\.report_content\(text, text, text, text\)\s+set search_path = public, pg_temp;/,
  );
});

test("mock merchant inbox and pin candidates drop a report-hidden review", async () => {
  const outletId = "outlet-wonton-mee";
  const inboxBefore = await hungryService.merchant.getInbox(outletId);
  const target = inboxBefore.find((item) => item.type === "review");
  assert.ok(target, "mock inbox needs a review");
  const reviewId = target.sourceId ?? target.id;

  for (const email of ["inbox-r1@example.com", "inbox-r2@example.com", "inbox-r3@example.com"]) {
    await hungryService.auth.signUp(email, "pw", email);
    await hungryService.communitySafety.reportContent({
      targetType: "review",
      targetId: reviewId,
      reason: "spam",
    });
  }

  const inboxAfter = await hungryService.merchant.getInbox(outletId);
  assert.ok(inboxAfter.every((item) => (item.sourceId ?? item.id) !== reviewId));
  const candidates = await hungryService.merchant.listPopularVisitorCandidates(outletId);
  assert.ok(candidates.every((candidate) => candidate.reviewId !== reviewId));
});
