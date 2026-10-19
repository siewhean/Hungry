import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readBlockMigration(): string {
  const file = readdirSync(resolve(process.cwd(), "supabase/migrations")).find((name) =>
    name.endsWith("_user_blocks_by_user_id.sql"),
  );
  assert.ok(file, "user_blocks_by_user_id migration is missing");
  return readRepoFile(`supabase/migrations/${file}`);
}

test("blocks are keyed by the author's user id, never the display name", () => {
  const helper = readRepoFile("src/lib/security/communitySafety.ts");
  const types = readRepoFile("src/lib/services/types.ts");
  const supabase = readRepoFile("src/lib/services/supabase/supabaseService.ts");

  assert.match(types, /export interface BlockUserRequest \{[\s\S]*?blockedUserId: string;/);
  assert.doesNotMatch(types, /blockedUserKey/);
  assert.match(helper, /blockedUserId: blockedAuthorId/);
  assert.doesNotMatch(helper, /blockedUserKey/);
  assert.doesNotMatch(helper, /blockedAuthorKeys/);
  // Hiding by author compares ids only.
  assert.match(helper, /blockedAuthorIds\.has\(authorId\)/);
  // Saved blocks are reloaded so they survive an app restart.
  assert.match(helper, /communitySafety\.getBlockedUsers\(\)/);

  assert.match(supabase, /UUID_PATTERN\.test\(request\.blockedUserId\)/);
  assert.match(supabase, /blocked_user_key: request\.blockedUserId\.toLowerCase\(\)/);
  assert.match(supabase, /ignoreDuplicates: true/);
  assert.match(supabase, /authorId: userId,/);
});

test("feeds filter blocked authors by id and drop reported reviews", () => {
  const home = readRepoFile("src/app/screens/home/HomeFeedScreen.tsx");
  const reviewFeed = readRepoFile("src/app/screens/review/ReviewFeedScreen.tsx");
  const socialPost = readRepoFile("src/app/screens/profile/SocialPostDetailScreen.tsx");

  assert.doesNotMatch(home, /targetAuthorKey/);
  assert.match(home, /item\.authorId\?\.trim\(\) !== blockedAuthorId/);
  assert.match(home, /authorId: item\.authorId,/);
  assert.match(home, /authorId: comment\.userId,/);
  assert.doesNotMatch(socialPost, /targetAuthorKey/);
  assert.match(socialPost, /authorId: feedPost\.authorId,/);

  assert.match(reviewFeed, /loadBlockedAuthorsForSession/);
  assert.match(
    reviewFeed,
    /isContentHiddenForSession\(\{ id: item\.review\.id, authorId: item\.review\.authorId \}\)/,
  );
  assert.match(reviewFeed, /authorId: item\.review\.authorId,\s*onHidden: onSafetyHidden/);
  assert.match(reviewFeed, /authorId: item\.review\.authorId,\s*onBlocked: onSafetyHidden/);
});

test("migration makes server block checks match and filters review reads", () => {
  const migration = readBlockMigration();

  assert.match(migration, /delete from public\.user_blocks/);
  assert.match(migration, /constraint user_blocks_blocked_user_key_is_user_id/);
  assert.match(migration, /constraint user_blocks_no_self_block/);
  assert.match(migration, /create or replace function app_private\.can_read_review/);
  assert.match(migration, /app_private\.app_user_block_exists\(auth\.uid\(\), p_author_id\)/);
  assert.match(migration, /cr\.target_type = 'review'/);
  assert.match(
    migration,
    /create policy reviews_select_hide_blocked_or_reported\s+on public\.reviews\s+as restrictive/,
  );
  assert.match(migration, /create policy post_comments_select_hide_blocked/);

  const smoke = readRepoFile("supabase/smoke/user_blocks_by_user_id.sql");
  assert.match(smoke, /get_home_social_feed_v2|can_read_author_content/);
  assert.match(smoke, /rollback;/);
});

test("mock service hides blocked authors and reported reviews like the server", async () => {
  const feedBefore = await hungryService.social.getBitesFeed();
  const blockedAuthorId = feedBefore.find((bite) => bite.authorId)?.authorId;
  assert.ok(blockedAuthorId, "mock feed needs an author to block");

  await hungryService.communitySafety.blockUser({
    blockedUserId: blockedAuthorId,
    reason: "test",
  });

  const feedAfter = await hungryService.social.getBitesFeed();
  assert.ok(feedAfter.every((bite) => bite.authorId !== blockedAuthorId));
  const blocked = await hungryService.communitySafety.getBlockedUsers();
  assert.ok(blocked.some((entry) => entry.blockedUserId === blockedAuthorId));

  const [firstReview] = await hungryService.reviews.listRecentReviews({ limit: 5 });
  assert.ok(firstReview, "mock data needs at least one review");
  await hungryService.communitySafety.reportContent({
    targetType: "review",
    targetId: firstReview.review.id,
    reason: "test",
  });
  const reviewsAfter = await hungryService.reviews.listRecentReviews({ limit: 100 });
  assert.ok(reviewsAfter.every((entry) => entry.review.id !== firstReview.review.id));
  const dishReviews = await hungryService.reviews.getReviewsForDish(firstReview.dishId);
  assert.ok(dishReviews.every((review) => review.id !== firstReview.review.id));
});
