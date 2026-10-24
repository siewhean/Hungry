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
  assert.match(review, /setPickerVenueId\(item\.venue\.id\)/);
  assert.match(review, /chooseDish\(pickerVenue\.id, item\.id\)/);
  assert.match(review, /selectDish\(venueId, dishId\)/);
  // Cold legacy cache falls back to the async service.
  assert.match(review, /\.discovery\.getDish\(selectedDishId\)/);
});

test("review submit sends the recommend choice and a retry-stable client review id", () => {
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(review, /wouldRecommend: resolveWouldRecommend\(draft\.recommend, draft\.rating\)/);
  assert.match(
    review,
    /const reviewId = ensurePendingReviewId\(\);[\s\S]*clientReviewId: reviewId/,
  );
  assert.match(service, /would_recommend: draft\.wouldRecommend \?\? true/);
  assert.doesNotMatch(service, /would_recommend: true,/);
  assert.match(service, /error\.code !== "23505"/);
});

test("photos upload before the public review row is written", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const submit = service.slice(
    service.indexOf("async submitReview(draft: SubmitReviewInput)"),
    service.indexOf("async listRecentReviews(options)"),
  );
  const uploadAt = submit.indexOf("await uploadReviewPhotos(");
  const insertAt = submit.indexOf('.from("reviews").insert(reviewRow)');
  assert.ok(uploadAt > 0 && insertAt > uploadAt, "upload must run before the review insert");
  assert.match(submit, /code: REVIEW_PHOTOS_NOT_ATTACHED/);
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  assert.match(review, /Your review is posted, but the photos didn't upload/);
});

test("recommend is unanswered by default and derived from the rating when skipped", async () => {
  const { createInitialReviewDraft, resolveWouldRecommend } =
    await import("../../../features/review/reviewDraft");
  assert.equal(createInitialReviewDraft().recommend, null);
  assert.equal(resolveWouldRecommend(null, 5), true);
  assert.equal(resolveWouldRecommend(null, 2), false);
  assert.equal(resolveWouldRecommend(false, 5), false);
  assert.equal(resolveWouldRecommend(true, 1), true);
  const publishing = read("src/features/post/publishing.ts");
  assert.match(publishing, /wouldRecommend: resolveWouldRecommend\(undefined, state\.rating\)/);
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  assert.match(review, /variant=\{draft\.recommend === true \? "primary" : "secondary"\}/);
  assert.doesNotMatch(review, /label="Skip"/);
});

test("review editor: dish first, helper text, modal picker, route wins over a stale draft", () => {
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const order = [
    "{/* 1. Dish */}",
    "{/* 2. Rating */}",
    "{/* 3. Review text */}",
    "{/* 4. Photos */}",
  ];
  const positions = order.map((marker) => review.indexOf(marker));
  assert.ok(positions.every((position, index) => position > (positions[index - 1] ?? -1)));
  assert.match(review, /"Add a star rating to publish\."/);
  assert.match(review, /\{draft\.text\.length\}\/\{REVIEW_TEXT_MAX_LENGTH\}/);
  assert.match(review, /<Modal\s+visible=\{isSearching\}/);
  assert.match(review, /onRequestClose=/);
  assert.doesNotMatch(review, /StyleSheet\.absoluteFill/);
  assert.match(review, /No dishes or stalls match/);
  // The saved draft loads asynchronously: the route effect waits for it.
  assert.match(review, /const draftHydrated = useReviewDraftHydrated\(\)/);
  assert.match(review, /if \(!draftHydrated\) return;/);
  assert.match(review, /"Unfinished review"/);
  assert.match(review, /\{ text: "Start new", onPress: startFromRoute \}/);
  // A draft with content but no dish still counts; a manual dish switch asks first.
  assert.match(review, /if \(!reviewDraftHasContent\(draft\)\) \{\s*startFromRoute\(\);/);
  assert.match(review, /"Change dish\?"/);
  // Photo filters were preview-only (the original file uploads), so they are removed.
  assert.doesNotMatch(review, /filterId|onSetFilter|filter_id|reviewFiltersEnabled/);
});

test("success modal shows points only when gamification is on", () => {
  const modal = read("src/app/screens/review/ReviewSuccessModal.tsx");
  assert.match(modal, /FEATURE_FLAGS\.gamificationEnabled && payload\?\.pointsEarned/);
});

test("media picker and star rating are usable with a screen reader", () => {
  const picker = read("src/components/review/MediaPicker.tsx");
  assert.match(picker, /accessibilityLabel=\{`Remove photo \$\{index \+ 1\}`\}/);
  assert.doesNotMatch(picker, /MediaEditor|onSetFilter|filterId|Filter applied/);
  assert.match(picker, /\{photos\.length\}\/\{maxPhotos\} photos/);
  assert.match(picker, /width: 44,\s*height: 44/);
  assert.doesNotMatch(picker, /Automatically open editor/);
  const stars = read("src/components/review/StarRating.tsx");
  assert.match(stars, /onAccessibilityAction=/);
  assert.match(stars, /min: 0, max, now: value/);
  assert.match(stars, /`Rating, \$\{value > 0/);
  // Grid tiles say whose review it is, of what, where and when.
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  assert.match(
    feed,
    /accessibilityLabel=\{`\$\{item\.review\.authorName\}'s review of \$\{item\.dishName\} at \$\{item\.venueName\}/,
  );
});

test("review feed signs photo urls in one batch", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /\.createSignedUrls\(uniquePaths, 60 \* 60\)/);
  assert.doesNotMatch(
    service,
    /await createSignedStorageUrl\(client, bucket, path\)\) \?\? legacyUrl/,
  );
});

test("post composer never attaches a venue-only post to the stall's first dish", () => {
  const composer = read("src/app/screens/post/PostComposerScreen.tsx");
  assert.doesNotMatch(composer, /listDishesByVenue\(selectedVenueId\)\[0\]/);
  assert.match(composer, /onPress=\{\(\) => setSelectedDishId\(null\)\}/);
});

test("stall detail's menu photo button uploads through supply.submitMenuPhoto", () => {
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");
  assert.match(stall, /"Add a menu photo"/);
  assert.match(stall, /getHungryService\(\)\.supply\.submitMenuPhoto\(\{\s*venueId: venue\.id/);
  assert.match(stall, /"Thanks, we'll add the menu soon\."/);
  assert.match(stall, /const canSubmitMenuPhoto = isAuthenticated && Platform\.OS !== "web"/);
  // No longer a detour into a review editor with no dishes.
  assert.doesNotMatch(stall, /label="Add a menu photo"[\s\S]{0,200}ReviewMain/);
});

test("prototype-only review features stay out of production", () => {
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(review, /const reviewMusicEnabled = false/);
  assert.match(review, /const reviewVideoEnabled = false/);
  assert.match(review, /\{reviewMusicEnabled \? \(/);
  assert.match(review, /const hasVideo = reviewVideoEnabled && Boolean\(draft\.videoUri\)/);
  assert.doesNotMatch(review, /\(draft\.videoUri \? 20 : 0\)/);
  // The local-only reply prototype was deleted outright (detail-L21).
  assert.doesNotMatch(stallDetail, /reviewRepliesEnabled|activeReplyReviewId|submitReviewReply/);
});

test("review tab loads one paginated page with refresh, error and empty states", () => {
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");

  assert.match(feed, /reviews\.listRecentReviewsPage\(\{\s*limit: REVIEW_FEED_PAGE_SIZE/);
  assert.doesNotMatch(feed, /getReviewsForDish/);
  assert.match(feed, /<RefreshControl/);
  assert.match(feed, /title="Couldn't load reviews"[\s\S]*ctaLabel="Try again"/);
  // Writing a review starts from the centre tab button, not the feed.
  assert.match(feed, /title="No photo reviews yet"/);
});

test("review medium/low fixes: sign-out clears the draft, feed pages by (created_at, id)", () => {
  const session = read("src/store/useSessionStore.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const feed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const review = read("src/app/screens/review/ReviewScreen.tsx");
  const migration = read("supabase/migrations/20261020030000_review_feed_index_and_integrity.sql");

  assert.match(
    session.slice(session.indexOf("function clearAccountScopedStores")),
    /useReviewDraftStore\.getState\(\)\.resetDraft\(\)/,
  );
  assert.match(
    service,
    /created_at\.eq\."\$\{options\.before\}",id\.lt\."\$\{options\.beforeId\}"/,
  );
  // The next page starts at the last raw row of the last page, so a dropped review is no end.
  assert.match(feed, /feedCursorRef\.current = page\.nextCursor/);
  assert.match(feed, /beforeId: cursor\?\.beforeId/);
  // Refetch on focus so a just-posted review shows without pull-to-refresh.
  assert.match(feed, /useFocusEffect\(/);
  assert.doesNotMatch(feed, /setTimeout\(\(\) => setIsInitialLoading\(false\), 0\)/);
  // The editor leaves its one-screen stack instead of popToTop.
  assert.doesNotMatch(review, /navigation\.popToTop\(\)/);
  assert.doesNotMatch(review, /getParent\(\)\?\.getParent\(\)/);
  assert.match(migration, /on public\.reviews \(created_at desc, id desc\)/);
  assert.match(migration, /security definer\s+set search_path = ''/);
});
