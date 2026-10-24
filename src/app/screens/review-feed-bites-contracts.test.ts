import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Review feed cards do not render bottom bites sections", () => {
  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewShareSheet = read("src/app/screens/review/ReviewShareSheet.tsx");
  const commentsSheet = read("src/components/social/ReviewCommentsSheet.tsx");

  assert.doesNotMatch(reviewFeed, /ReviewBitesStrip/);
  assert.doesNotMatch(reviewFeed, /BiteCommentsSheet/);
  assert.doesNotMatch(reviewFeed, /getHomeBitesFeed\(\)/);
  assert.doesNotMatch(reviewFeed, /useDelayedLoadingSkeleton\(isBitesLoading\)/);
  assert.doesNotMatch(reviewFeed, /bitesByDishId/);
  assert.doesNotMatch(reviewFeed, /activeCommentBite/);
  // Round 6: the Reviews tab is a photo grid. Tiles carry no like, save, share or comment actions.
  assert.match(reviewFeed, /const GRID_COLUMNS = 3;/);
  assert.match(reviewFeed, /numColumns=\{GRID_COLUMNS\}/);
  assert.match(reviewFeed, /reviewsWithPhotos\(/);
  assert.doesNotMatch(reviewFeed, /ReviewCommentsSheet|commentsEnabled|openCommentsSheet/);
  assert.doesNotMatch(reviewFeed, /linkedPost/);
  assert.doesNotMatch(reviewFeed, /toggleLike|likeCount/);
  assert.doesNotMatch(reviewFeed, /seededComments=\{/);
  // Control tiles are photo and date (sh, 9ae387b): relative within a week, then a date. The dish
  // name shows only in the review_tile_labels_v1 "labels" arm.
  assert.match(reviewFeed, /const dateLabel = formatReviewDate\(item\.review\.createdAt\);/);
  assert.match(
    reviewFeed,
    /\{showLabels \? \([\s\S]*\{item\.dishName\}[\s\S]*\) : \([\s\S]*\{dateLabel\}/,
  );
  assert.match(reviewFeed, /sameYear \? \{\} : \{ year: "numeric" \}/);

  assert.match(commentsSheet, /<BottomSheetModal/);
  assert.match(commentsSheet, /if \(!FEATURE_FLAGS\.commentsEnabled\) \{\s*return null;\s*\}/);
  assert.match(commentsSheet, /<BottomSheetFooter/);
  assert.match(commentsSheet, /commentsByPostId\[activeReview\.id\] \?\? \[\]/);
  assert.match(commentsSheet, /addComment\(activeReview\.id, newComment\)/);
  assert.match(commentsSheet, /addReply\(activeReview\.id, newReply\)/);
  assert.match(commentsSheet, /visibleRepliesByCommentId\[comment\.id\] \?\? \[\]/);
  assert.match(
    commentsSheet,
    /placeholder=\{activeReplyCommentId \? "Write a reply\.\.\." : "Add a comment\.\.\."\}/,
  );

  assert.match(reviewShareSheet, /if \(!FEATURE_FLAGS\.directMessagesEnabled\)/);
  assert.match(reviewShareSheet, /recipients=\{directMessagesEnabled \? shareRecipients : \[\]\}/);
  assert.match(reviewShareSheet, /toChatShareRecipient/);
  assert.doesNotMatch(reviewShareSheet, /ACTIVITY_MESSAGES/);
  assert.match(reviewShareSheet, /selectedChatIds/);
  assert.match(reviewShareSheet, /sharePostToChat\(chatId,/);
  assert.match(
    reviewShareSheet,
    /Clipboard\.setStringAsync\(withShareSource\(activeReview\.link, "copy_link"\)\)/,
  );
  assert.match(reviewShareSheet, /Share\.share\(/);
  // iOS gets the link once, as `url`; Android has no url, so it rides in the message.
  assert.match(
    reviewShareSheet,
    /Platform\.OS === "ios"\s*\? \{ message: activeReview\.message, url: link \}/,
  );
  assert.match(reviewShareSheet, /recipientAccessibilityLabelPrefix="Select"/);
  assert.match(reviewShareSheet, /FloatingShareSendButton/);
  assert.match(reviewShareSheet, /selectedCount=\{selectedChatIds\.length\}/);
  assert.match(reviewShareSheet, /accessibilityLabel=\{`Send shared \$\{kindNoun\}`\}/);
  assert.doesNotMatch(reviewShareSheet, /showSendAction/);

  // The unused Bite* cards and the bites strip were deleted (they were never mounted).
  assert.equal(existsSync(path.join(root, "src/components/social/BitesCarousel.tsx")), false);
  assert.equal(existsSync(path.join(root, "src/components/social/BiteCommentsSheet.tsx")), false);
});
