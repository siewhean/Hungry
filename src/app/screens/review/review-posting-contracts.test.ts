import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("review editor subscribes with selectors and never picks a dish for the user", () => {
  const review = read("src/app/screens/review/ReviewScreen.tsx");

  assert.doesNotMatch(review, /useReviewDraftStore\(\)/);
  assert.match(review, /const selectDish = useReviewDraftStore\(\(state\) => state\.selectDish\)/);
  assert.match(review, /<Screen title="Write a review"/);
  assert.doesNotMatch(review, /title="Create Post"/);
  assert.doesNotMatch(review, /dishes\[0\]/);
  assert.match(review, /onPress=\{\(\) => setPickerVenueId\(item\.id\)\}/);
  assert.match(review, /selectDish\(pickerVenue\.id, item\.id\)/);
  // Cold legacy cache falls back to the async service.
  assert.match(review, /\.discovery\.getDish\(selectedDishId\)/);
});

test("review submit sends the recommend choice and a retry-stable client review id", () => {
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(review, /wouldRecommend: draft\.recommend/);
  assert.match(review, /clientReviewId: ensurePendingReviewId\(\)/);
  assert.match(service, /would_recommend: draft\.wouldRecommend \?\? true/);
  assert.doesNotMatch(service, /would_recommend: true,/);
  assert.match(service, /error\?\.code !== "23505"/);
});

test("prototype-only review features stay out of production", () => {
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(review, /const reviewMusicEnabled = FEATURE_FLAGS\.prototypeRoutesEnabled/);
  assert.match(review, /const reviewVideoEnabled = FEATURE_FLAGS\.prototypeRoutesEnabled/);
  assert.match(review, /\{reviewMusicEnabled \? \(/);
  assert.match(review, /const hasVideo = reviewVideoEnabled && Boolean\(draft\.videoUri\)/);
  assert.doesNotMatch(review, /\(draft\.videoUri \? 20 : 0\)/);
  assert.match(stallDetail, /const reviewRepliesEnabled = FEATURE_FLAGS\.prototypeRoutesEnabled/);
  assert.match(stallDetail, /\{reviewRepliesEnabled \? \(/);
  assert.match(stallDetail, /reviewRepliesEnabled && activeReplyReviewId === review\.id/);
});

test("review tab loads one paginated page with refresh, error and empty states", () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");

  assert.match(feed, /reviews\.listRecentReviews\(\{\s*limit: REVIEW_FEED_PAGE_SIZE/);
  assert.doesNotMatch(feed, /getReviewsForDish/);
  assert.match(feed, /<RefreshControl/);
  assert.match(feed, /title="Couldn't load reviews"[\s\S]*ctaLabel="Try again"/);
  assert.match(feed, /ctaLabel="Write a review"/);
  assert.match(feed, /const reviewReactionsEnabled = serviceProviderMode === "mock"/);
});
