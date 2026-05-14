import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Review feed cards do not render bottom bites sections", () => {
  const reviewFeed = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const reviewFeedV2 = read("src/app/screens/review/ReviewFeedScreenV2.tsx");
  const reviewShareSheet = read("src/app/screens/review/ReviewShareSheet.tsx");
  const commentsSheet = read("src/components/social/ReviewCommentsSheet.tsx");

  for (const source of [reviewFeed, reviewFeedV2]) {
    assert.doesNotMatch(source, /ReviewBitesStrip/);
    assert.doesNotMatch(source, /BiteCommentsSheet/);
    assert.doesNotMatch(source, /getHomeBitesFeed\(\)/);
    assert.doesNotMatch(source, /useDelayedLoadingSkeleton\(isBitesLoading\)/);
    assert.doesNotMatch(source, /bitesByDishId/);
    assert.doesNotMatch(source, /activeCommentBite/);
    assert.match(source, /useSocialStore/);
    assert.match(source, /initializeInteractions\(/);
    assert.match(source, /toggleLike/);
    assert.match(source, /toggleSave/);
    assert.match(source, /incrementShare/);
    assert.match(source, /ReviewCommentsSheet/);
    assert.match(source, /ReviewShareSheet/);
    assert.match(source, /commentsSheetRef\.current\?\.present\(\)/);
    assert.match(source, /shareSheetRef\.current\?\.present\(\)/);
    assert.match(
      source,
      /const reviewDate = new Date\(item\.review\.createdAt\)\.toLocaleDateString/,
    );
    assert.match(
      source,
      /<AppText variant="micro" tone="muted" numberOfLines=\{1\}>\s*\{item\.venueName\}\s*<\/AppText>/,
    );
    assert.match(source, /\{reviewDate\}[\s\S]*<Send/);
    assert.match(source, /accessibilityLabel="Share review"/);
    assert.match(
      source,
      /accessibilityLabel=\{interaction\.saved \? "Unsave review" : "Save review"\}/,
    );
    assert.match(source, /accessibilityLabel="Open review comments"/);
    assert.match(
      source,
      /accessibilityLabel=\{interaction\.liked \? "Unlike review" : "Like review"\}/,
    );
    assert.match(source, /interaction\.commentCount > 0/);
    assert.match(source, /interaction\.likeCount > 0/);
    assert.match(source, /interaction\.shareCount > 0/);
    assert.match(source, /<Send[\s\S]*<Bookmark[\s\S]*<CommentIcon[\s\S]*<Heart/);
    assert.match(source, /justifyContent: "space-between"[\s\S]*justifyContent: "flex-end"/);
  }

  assert.match(commentsSheet, /<BottomSheetModal/);
  assert.match(commentsSheet, /<BottomSheetFooter/);
  assert.match(commentsSheet, /commentsByPostId\[activeReview\.id\] \?\? \[\]/);
  assert.match(commentsSheet, /addComment\(activeReview\.id, newComment\)/);
  assert.match(commentsSheet, /addReply\(activeReview\.id, newReply\)/);
  assert.match(commentsSheet, /repliesByCommentId\[comment\.id\] \?\? \[\]/);
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
  assert.match(reviewShareSheet, /Clipboard\.setString\(activeReview\.link\)/);
  assert.match(reviewShareSheet, /Share\.share\(\{/);
  assert.match(reviewShareSheet, /recipientAccessibilityLabelPrefix="Select"/);
  assert.match(reviewShareSheet, /FloatingShareSendButton/);
  assert.match(reviewShareSheet, /selectedCount=\{selectedChatIds\.length\}/);
  assert.match(reviewShareSheet, /accessibilityLabel="Send shared review"/);
  assert.doesNotMatch(reviewShareSheet, /showSendAction/);
});
