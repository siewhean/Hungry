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
  assert.match(reviewFeed, /useSocialStore/);
  assert.match(reviewFeed, /initializeInteractions\(/);
  assert.match(reviewFeed, /const reviewReactionsEnabled = serviceProviderMode === "mock"/);
  assert.match(reviewFeed, /toggleLike/);
  assert.match(reviewFeed, /toggleSave\(item\.interactionId\)/);
  assert.match(
    reviewFeed,
    /const localDish = item\.dish \?\? repository\.getDishById\(item\.dishId\)/,
  );
  assert.match(reviewFeed, /toggleFavourite\(localDish\)/);
  assert.match(reviewFeed, /: favouriteDishIds\.includes\(item\.dishId\)/);
  assert.match(reviewFeed, /incrementShare/);
  assert.match(reviewFeed, /ReviewCommentsSheet/);
  assert.match(reviewFeed, /ReviewShareSheet/);
  assert.match(reviewFeed, /commentsEnabled=\{commentsEnabled\}/);
  assert.match(reviewFeed, /const openCommentsSheet = useCallback/);
  assert.match(reviewFeed, /const commentSheet = commentsSheetRef\.current/);
  assert.match(reviewFeed, /openCommentsSheet\(\)/);
  assert.match(reviewFeed, /shareSheetRef\.current\?\.present\(\)/);
  // Relative within a week, then a date that carries the year when it is not this year.
  assert.match(reviewFeed, /formatReviewDate\(item\.review\.createdAt\)/);
  assert.match(reviewFeed, /sameYear \? \{\} : \{ year: "numeric" \}/);
  assert.match(
    reviewFeed,
    /<AppText variant="micro" tone="muted" numberOfLines=\{1\}>\s*\{item\.venueName\}\s*<\/AppText>/,
  );
  assert.match(reviewFeed, /\{reviewDate\}[\s\S]*<Send/);
  assert.match(reviewFeed, /accessibilityLabel="Share review"/);
  assert.match(reviewFeed, /"Remove saved dish"/);
  assert.match(reviewFeed, /"Save dish"/);
  assert.doesNotMatch(reviewFeed, /"Unsave review"/);
  assert.doesNotMatch(reviewFeed, /"Save review"/);
  assert.match(reviewFeed, /accessibilityLabel="Open review comments"/);
  assert.match(reviewFeed, /accessibilityLabel=\{liked \? "Unlike review" : "Like review"\}/);
  assert.match(reviewFeed, /commentCount > 0/);
  assert.match(reviewFeed, /likeCount > 0/);
  assert.match(reviewFeed, /shareCount > 0/);
  assert.match(reviewFeed, /shareCount=\{reviewReactionsEnabled \?/);
  // Reviews never borrow a linked post id for share counting.
  assert.match(reviewFeed, /postId: "",/);
  assert.doesNotMatch(reviewFeed, /linkedPost/);
  assert.doesNotMatch(reviewFeed, /postId: linkedPost\?\.id \?\? item\.review\.id/);
  assert.match(reviewFeed, /commentCount: 0/);
  assert.match(reviewFeed, /likeCount: 0/);
  assert.doesNotMatch(reviewFeed, /commentCount: 1/);
  assert.doesNotMatch(reviewFeed, /likeCount: item\.review\.rating/);
  assert.doesNotMatch(reviewFeed, /seededCommentsForActiveReview/);
  assert.doesNotMatch(reviewFeed, /seededComments=\{/);
  assert.match(reviewFeed, /<Send[\s\S]*<Bookmark[\s\S]*<CommentIcon[\s\S]*<Heart/);
  assert.match(reviewFeed, /justifyContent: "space-between"[\s\S]*justifyContent: "flex-end"/);

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
