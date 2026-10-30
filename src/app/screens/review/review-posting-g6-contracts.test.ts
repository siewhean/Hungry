// Round-two medium and low fixes for Reviews and posting (G6).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildReviewAppealMailto,
  describeReviewModeration,
} from "@/features/review/reviewModeration";
import { webShareUrl } from "@/constants/links";
import { hungryService } from "@/lib/services/mock/mockService";
import { readHomeSource } from "@/test/sourceContracts";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("M5: the feed pages by the service's cursor, so a dropped review is not the end", async () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(feed, /listRecentReviewsPage\(\{/);
  assert.match(feed, /feedCursorRef\.current = page\.nextCursor/);
  assert.match(feed, /setHasMoreServiceReviews\(page\.hasMore\)/);
  assert.doesNotMatch(feed, /entries\.length >= REVIEW_FEED_PAGE_SIZE/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  // hasMore comes from the raw row count, before unreadable dishes are dropped.
  assert.match(service, /hasMore: rows\.length >= limit/);

  const all = await hungryService.reviews.listRecentReviews({ limit: 100 });
  const first = await hungryService.reviews.listRecentReviewsPage({ limit: 1 });
  assert.equal(first.entries.length, 1);
  assert.equal(first.hasMore, all.length > 1);
  assert.ok(first.nextCursor);
  const second = await hungryService.reviews.listRecentReviewsPage({
    limit: 1,
    before: first.nextCursor?.before,
    beforeId: first.nextCursor?.beforeId,
  });
  assert.ok(second.entries.every((entry) => entry.review.id !== first.entries[0]?.review.id));
});

test("M6: returning to the tab adds newer reviews on top instead of replacing the pages", () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(feed, /loadServiceReviews\("prepend"\)/);
  assert.match(feed, /after: newestCreatedAtRef\.current/);
  // Only the first load, pull to refresh and retry start over.
  assert.doesNotMatch(
    feed,
    /Date\.now\(\) - lastServiceLoadAtRef\.current > REVIEW_FEED_STALE_MS\s*\) \{\s*void loadServiceReviews\("replace"\)/,
  );
});

test("M5/M6: the mock feed returns only newer reviews for `after` and keeps paging stable", async () => {
  const all = await hungryService.reviews.listRecentReviews({ limit: 100 });
  const newest = all[0];
  assert.ok(newest);
  const newer = await hungryService.reviews.listRecentReviewsPage({
    limit: 50,
    after: newest.review.createdAt,
  });
  assert.ok(newer.entries.length >= 1);
  assert.ok(
    newer.entries.every(
      (entry) => new Date(entry.review.createdAt) >= new Date(newest.review.createdAt),
    ),
  );
});

test("M1: a review has its own page, deep link, web page and share link", async () => {
  assert.equal(webShareUrl("review", "abc-123"), "https://usehungry.com/review/abc-123");
  // The Reviews grid opens each review on its own page, which carries the share link.
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(feed, /navigation\.navigate\("ReviewDetail", \{ reviewId: item\.review\.id \}\)/);
  assert.doesNotMatch(feed, /webShareUrl\("dish"/);
  assert.match(
    read("src/app/screens/review/ReviewDetailScreen.tsx"),
    /url: webShareUrl\("review", review\.id\)/,
  );
  const types = read("src/app/navigation/navigationTypes.ts");
  assert.match(types, /ReviewDetail: \{ reviewId: string \}/);
  const navigator = read("src/app/navigation/RootNavigator.tsx");
  assert.match(navigator, /name="ReviewDetail"/);
  assert.match(read("app.json"), /"pathPrefix": "\/review\/"/);
  const web = "marketing/website/web-v2/src";
  assert.match(
    read(`${web}/app/.well-known/apple-app-site-association/route.ts`),
    /"\/review\/\*"/,
  );
  const page = read(`${web}/app/review/[id]/page.tsx`);
  assert.match(page, /getSharedReview/);
  assert.match(page, /appPath=\{`review\/\$\{encodeURIComponent\(review\.id\)\}`\}/);
  assert.match(read(`${web}/lib/share/sharedLinks.ts`), /"reviews", \{/);

  const [entry] = await hungryService.reviews.listRecentReviews({ limit: 1 });
  assert.ok(entry);
  const found = await hungryService.reviews.getReviewById(entry.review.id);
  assert.equal(found?.review.id, entry.review.id);
  assert.equal(found?.dishName, entry.dishName);
  assert.equal(await hungryService.reviews.getReviewById("no-such-review"), null);
});

test("M1/L12: the share events are named for what is shared", () => {
  const sheet = read("src/app/screens/review/ReviewShareSheet.tsx");
  assert.match(sheet, /trackAnalyticsEvent\("review_shared"/);
  const events = read("src/lib/analytics/types.ts");
  for (const name of [
    "review_shared",
    "review_helpful_toggled",
    "post_publish_failed",
    "post_abandoned",
  ]) {
    assert.match(events, new RegExp(`"${name}"`));
  }
  const composer = read("src/app/screens/post/PostComposerScreen.tsx");
  assert.match(composer, /"post_publish_failed"/);
  assert.match(composer, /"post_abandoned"/);
});

test("M3: authors are told when their review is hidden or removed, with a way to ask again", () => {
  assert.match(describeReviewModeration("hidden").title, /Hidden after reports/);
  assert.match(describeReviewModeration("removed").title, /Removed/);
  const mailto = buildReviewAppealMailto({ reviewId: "r-1", dishName: "Laksa" });
  assert.match(mailto, /^mailto:usehungrysingapore@gmail\.com\?subject=/);
  assert.match(decodeURIComponent(mailto), /Review reference: r-1/);
  // The Reviews grid has no text; its tiles open ReviewDetail, which shows the notice.
  for (const file of [
    "src/components/profile/ProfileReviewCard.tsx",
    "src/app/screens/review/ReviewDetailScreen.tsx",
  ]) {
    assert.match(read(file), /<ReviewModerationNotice/, file);
  }
  // Review history and Profile both draw their cards with the shared card.
  for (const file of [
    "src/app/screens/profile/ReviewHistoryScreen.tsx",
    "src/app/screens/profile/ProfileHomeScreen.tsx",
  ]) {
    assert.match(read(file), /<ProfileReviewCard/, file);
  }
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /get_my_review_moderation_states/);
});

test("M9/M10/M11: write button, every photo, tappable reviewer", () => {
  // Round 6: writing starts from the centre tab button; the grid marks multi-photo reviews
  // and each review's page shows every photo and links to the reviewer.
  const tabs = read("src/app/navigation/SwipeableTabNavigator.tsx");
  assert.match(tabs, /isCreateAction: true, icon: PenLine, label: "Write"/);
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(feed, /photoCount > 1 \? \([\s\S]*?<Images/);
  const detail = read("src/app/screens/review/ReviewDetailScreen.tsx");
  assert.match(detail, /<ReviewPhotoViewer/);
  assert.match(detail, /navigation\.navigate\("UserProfile", \{/);
});

test("M12: guests are sent to sign in or email support instead of a failing report", () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(
    feed,
    /if \(!isAuthenticated\) \{[\s\S]*Sign in to report this review or block its author\./,
  );
  assert.match(feed, /text: "Email support"/);
});

test("L1/L9/L10: cards take primitives and 44pt targets, with no Helpful vote", () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.doesNotMatch(feed, /helpfulActive|createHelpfulVoteQueue|review_helpful_toggled/);
  assert.doesNotMatch(feed, /interaction: InteractionState/);
  // Grid tiles are a third of the screen wide, well over 44pt.
  assert.match(
    feed,
    /const tileSize = \(screenWidth - GRID_GAP \* \(GRID_COLUMNS - 1\)\) \/ GRID_COLUMNS;/,
  );
});

test("L8: the success modal offers to share the new review", () => {
  const modal = read("src/app/screens/review/ReviewSuccessModal.tsx");
  assert.match(modal, /label="Share your review"/);
  assert.match(modal, /webShareUrl\("review", reviewId\)/);
  assert.match(modal, /Your review is live on/);
  assert.doesNotMatch(modal, /Profile updated/);
  const editor = read("src/app/screens/review/ReviewScreen.tsx");
  assert.match(editor, /reviewId,\s*dishId: selectedDish\.id/);
});

test("L11: dead review code is gone", () => {
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  assert.equal(existsSync(path.join(root, "src/components/review/ReviewCard.tsx")), false);
  assert.equal(existsSync(path.join(root, "src/features/review/reviewContent.ts")), false);
  assert.doesNotMatch(read("src/components/review/index.ts"), /ReviewCard/);
  const store = read("src/store/useReviewDraftStore.ts");
  assert.doesNotMatch(store, /failedPhotoUris|markPhotoFailed|clearFailedPhoto/);
});

test("L13: the share sheet is short without in-app recipients and the link is sent once", () => {
  const sheet = read("src/app/screens/review/ReviewShareSheet.tsx");
  assert.match(sheet, /directMessagesEnabled \? "62%" : "42%"/);
  assert.match(
    sheet,
    /Platform\.OS === "ios"\s*\? \{ message: activeReview\.message, url: link \}/,
  );
  const messaging = read("src/features/share/messagingShare.ts");
  assert.match(messaging, /Platform\.OS === "ios"\s*\? \{ message: target\.message, url \}/);
});

test("L14: /post opens the composer, with /order kept as an alias", () => {
  const linking = read("src/app/navigation/linking.ts");
  assert.match(linking, /path === "post" \|\| path === "order"/);
  assert.match(linking, /Post: "post"/);
});

test("M4: a photo post without a rating shows no star", () => {
  const discover = readHomeSource();
  assert.match(discover, /bite\.cravingCount > 0 && bite\.rating > 0/);
  const publishing = read("src/features/post/publishing.ts");
  assert.match(publishing, /state\.rating > 0 \? state\.rating : 0/);
});

test("M8/M13/L6/L7: editor waits for the saved draft, searches dishes, offers hawker tags", () => {
  const screen = read("src/app/screens/review/ReviewScreen.tsx");
  assert.match(screen, /useReviewDraftHydrated\(\)/);
  assert.match(screen, /placeholder="Search dishes or stalls\.\.\."/);
  assert.match(screen, /label="Suggest a dish"/);
  assert.match(screen, /showDescriptor/);
  const taste = read("src/constants/taste.ts");
  assert.match(taste, /REVIEW_EDITOR_TAGS/);
  // Queue wording is retired from the editor; the server list still accepts the old tag.
  assert.match(taste, /RETIRED_REVIEW_TAGS = \["Worth the queue"\]/);
  assert.doesNotMatch(taste, /REVIEW_VALUE_TAGS = \[[^\]]*queue/);
  assert.match(taste, /Good value/);
  assert.match(taste, /REVIEW_MAX_TAGS = 8/);
});
