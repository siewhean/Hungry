import { Alert } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ContentReportTargetType } from "@/lib/services/types";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore, type SafetyReportReason } from "@/store/useUIStore";

type ContentSafetyTarget = {
  targetType: ContentReportTargetType;
  targetId: string;
  authorName: string;
  /** Auth user id of the author. Blocking is keyed by this id, never by display name. */
  authorId?: string | null;
  postId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorId: string) => void;
};

type ReviewSafetyTarget = {
  reviewId: string;
  authorName: string;
  /** Auth user id of the review author. Without it the author cannot be blocked. */
  authorId?: string | null;
  onHidden?: (reviewId: string) => void;
  onBlocked?: (blockedAuthorId: string) => void;
};

/** Posts the viewer hid and reviews the viewer reported this session. */
const hiddenPostIds = new Set<string>();
/** Auth user ids the viewer has blocked (hydrated from the server, plus new blocks). */
const blockedAuthorIds = new Set<string>();

export function targetAuthorKey(authorName: string): string {
  return authorName.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export function getHiddenPostIdsForSession(): ReadonlySet<string> {
  return hiddenPostIds;
}

/** A post the viewer deleted: every surface that honours session hides drops it at once. */
export function markPostRemovedForSession(postId: string): void {
  hiddenPostIds.add(postId);
}

export function getBlockedAuthorIdsForSession(): ReadonlySet<string> {
  return blockedAuthorIds;
}

/** Forgets this account's local hide/block filters, e.g. on sign-out or account switch. */
export function clearCommunitySafetySessionState(): void {
  hiddenPostIds.clear();
  blockedAuthorIds.clear();
}

function normalizeAuthorId(authorId?: string | null): string | undefined {
  const trimmed = authorId?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Loads the viewer's saved blocks so they survive app restarts. Failures keep the
 * current session set; the server still filters blocked authors from feed reads.
 */
export async function loadBlockedAuthorsForSession(): Promise<ReadonlySet<string>> {
  try {
    const blockedUsers = await getHungryService().communitySafety.getBlockedUsers();
    blockedUsers.forEach((entry) => {
      const blockedUserId = normalizeAuthorId(entry.blockedUserId);
      if (blockedUserId) blockedAuthorIds.add(blockedUserId);
    });
  } catch {
    // Keep whatever this session already knows.
  }
  return blockedAuthorIds;
}

/** Ends a block and lets that person's posts and comments show again this session. */
export async function unblockUserForSession(blockedUserId: string): Promise<void> {
  await getHungryService().communitySafety.unblockUser(blockedUserId);
  blockedAuthorIds.delete(blockedUserId);
  trackAnalyticsEvent("user_unblocked", { targetId: blockedUserId });
}

/** Shows a hidden post again, here and in the feed's next load. */
export async function unhidePostForSession(postId: string): Promise<void> {
  await getHungryService().communitySafety.unhidePost(postId);
  hiddenPostIds.delete(postId);
  trackAnalyticsEvent("post_unhidden", { targetId: postId });
}

export function isContentHiddenForSession(target: {
  id: string;
  authorId?: string | null;
}): boolean {
  if (hiddenPostIds.has(target.id)) {
    return true;
  }

  const authorId = normalizeAuthorId(target.authorId);
  return authorId ? blockedAuthorIds.has(authorId) : false;
}

function notify(message: string, tone: "success" | "error" = "success"): void {
  useUIStore.getState().showToast({ message, tone });
}

function reportContent(target: ContentSafetyTarget, reason: SafetyReportReason): void {
  void getHungryService()
    .communitySafety.reportContent({
      targetType: target.targetType,
      targetId: target.targetId,
      targetAuthorKey: normalizeAuthorId(target.authorId) ?? targetAuthorKey(target.authorName),
      reason: `user_reported_${target.targetType}_${reason}`,
    })
    .then(() => {
      // A reported review disappears for the reporter right away; the server hides it on reload.
      if (target.targetType === "review") {
        hiddenPostIds.add(target.targetId);
        target.onHidden?.(target.targetId);
      }
      trackAnalyticsEvent("content_report_submitted", {
        targetType: target.targetType,
        targetId: target.targetId,
        reason,
      });
      notify("Report sent. Hungry will review it.");
    })
    .catch(() => {
      notify("Could not send the report. Please try again.", "error");
    });
}

function blockAuthor(
  target: Pick<ContentSafetyTarget, "targetType" | "targetId" | "onBlocked" | "authorName">,
  blockedAuthorId: string,
): void {
  void getHungryService()
    .communitySafety.blockUser({
      blockedUserId: blockedAuthorId,
      reason: `user_blocked_${target.targetType}_author`,
    })
    .then(() => {
      blockedAuthorIds.add(blockedAuthorId);
      target.onBlocked?.(blockedAuthorId);
      trackAnalyticsEvent("user_blocked", {
        targetType: `${target.targetType}_author`,
        targetId: target.targetId,
      });
      notify(`Blocked ${target.authorName}. You won't see their posts or comments.`);
    })
    .catch(() => {
      notify("Could not block this user. Please try again.", "error");
    });
}

function hidePost(target: ContentSafetyTarget): void {
  const postId = target.postId ?? (target.targetType === "post" ? target.targetId : undefined);
  if (!postId) return;

  void getHungryService()
    .communitySafety.hidePost(postId, "hidden_from_content_safety_menu")
    .then(() => {
      hiddenPostIds.add(postId);
      target.onHidden?.(postId);
      trackAnalyticsEvent("post_hidden", {
        targetType: target.targetType,
        targetId: postId,
      });
      notify("Post hidden. You can unhide it in Settings.");
    })
    .catch(() => {
      notify("Could not hide this post. Please try again.", "error");
    });
}

export function promptContentSafetyActions(target: ContentSafetyTarget): void {
  // Reports, hides and blocks all need an account; a visitor is told so, not dropped.
  if (!useSessionStore.getState().isAuthenticated) {
    Alert.alert("Sign in to report or block", "Create an account or sign in to use this.");
    return;
  }
  const label = target.label ?? "content";
  const canHidePost = target.targetType === "post" || Boolean(target.postId);
  // Seeded/demo content has no account behind it, so there is nobody to block.
  const blockedAuthorId = normalizeAuthorId(target.authorId);
  useUIStore.getState().openSafetyMenu({
    label,
    authorName: target.authorName,
    canHide: canHidePost,
    canBlock: Boolean(blockedAuthorId),
    onReport: (reason) => reportContent(target, reason),
    onHide: () => hidePost(target),
    onBlock: () => {
      if (blockedAuthorId) blockAuthor(target, blockedAuthorId);
    },
  });
}

export function promptPostSafetyActions(target: {
  postId: string;
  authorName: string;
  authorId?: string | null;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorId: string) => void;
}): void {
  promptContentSafetyActions({
    targetType: "post",
    targetId: target.postId,
    authorName: target.authorName,
    authorId: target.authorId,
    label: target.label ?? "post",
    onHidden: target.onHidden,
    onBlocked: target.onBlocked,
  });
}

export function promptCommentSafetyActions(target: {
  commentId: string;
  authorName: string;
  authorId?: string | null;
  postId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorId: string) => void;
}): void {
  promptContentSafetyActions({
    targetType: "reply",
    targetId: target.commentId,
    authorName: target.authorName,
    authorId: target.authorId,
    postId: target.postId,
    label: target.label ?? "comment",
    onHidden: target.onHidden,
    onBlocked: target.onBlocked,
  });
}

export function promptReportReview(target: ReviewSafetyTarget): void {
  Alert.alert(
    "Report review",
    `Report ${target.authorName}'s review for abusive, unsafe, or policy-violating content?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: () => {
          void getHungryService()
            .communitySafety.reportContent({
              targetType: "review",
              targetId: target.reviewId,
              targetAuthorKey:
                normalizeAuthorId(target.authorId) ?? targetAuthorKey(target.authorName),
              reason: "user_reported_objectionable_content",
            })
            .then(() => {
              // The reporter stops seeing the review right away; the server hides it on reload.
              hiddenPostIds.add(target.reviewId);
              target.onHidden?.(target.reviewId);
              trackAnalyticsEvent("content_report_submitted", {
                targetType: "review",
                targetId: target.reviewId,
              });
              notify("Report sent. Hungry will review it.");
            })
            .catch(() => {
              notify("Could not send the report. Please try again.", "error");
            });
        },
      },
    ],
  );
}

/** Report / Block sheet for a review, shared by the Reviews grid and the stall and dish pages. */
export function promptReviewSafetyActions(target: ReviewSafetyTarget): void {
  const blockedAuthorId = normalizeAuthorId(target.authorId);
  const safetyTarget: ContentSafetyTarget = {
    targetType: "review",
    targetId: target.reviewId,
    authorName: target.authorName,
    authorId: target.authorId,
    label: "review",
    onHidden: target.onHidden,
    onBlocked: target.onBlocked,
  };
  useUIStore.getState().openSafetyMenu({
    label: "review",
    authorName: target.authorName,
    canHide: false,
    // Seeded reviews have no account behind them, so there is nobody to block.
    canBlock: Boolean(blockedAuthorId),
    onReport: (reason) => reportContent(safetyTarget, reason),
    onHide: () => {},
    onBlock: () => {
      if (blockedAuthorId) blockAuthor(safetyTarget, blockedAuthorId);
    },
  });
}

export function promptBlockReviewAuthor(target: ReviewSafetyTarget): void {
  const blockedAuthorId = normalizeAuthorId(target.authorId);
  if (!blockedAuthorId) {
    Alert.alert(
      "Cannot block this author",
      "This review is not linked to a Hungry account. Report it instead and we will review it.",
    );
    return;
  }

  Alert.alert(
    "Block user",
    `Block ${target.authorName}? You won't see their posts, comments or reviews.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: () => {
          void getHungryService()
            .communitySafety.blockUser({
              blockedUserId: blockedAuthorId,
              reason: "user_blocked_from_review",
            })
            .then(() => {
              blockedAuthorIds.add(blockedAuthorId);
              target.onBlocked?.(blockedAuthorId);
              trackAnalyticsEvent("user_blocked", {
                targetType: "review_author",
                targetId: target.reviewId,
              });
              notify(`Blocked ${target.authorName}. You won't see their posts or comments.`);
            })
            .catch(() => {
              notify("Could not block this user. Please try again.", "error");
            });
        },
      },
    ],
  );
}
