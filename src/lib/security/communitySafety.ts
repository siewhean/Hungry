import { Alert } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ContentReportTargetType } from "@/lib/services/types";

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

/** Removes a block on the server, then drops it from this session's filters. */
export async function unblockAccount(blockedUserId: string): Promise<void> {
  await getHungryService().communitySafety.unblockUser(blockedUserId);
  const normalized = normalizeAuthorId(blockedUserId);
  if (normalized) blockedAuthorIds.delete(normalized);
  trackAnalyticsEvent("user_unblocked", {});
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

function reportContent(target: ContentSafetyTarget): void {
  void getHungryService()
    .communitySafety.reportContent({
      targetType: target.targetType,
      targetId: target.targetId,
      targetAuthorKey: normalizeAuthorId(target.authorId) ?? targetAuthorKey(target.authorName),
      reason: `user_reported_${target.targetType}`,
    })
    .then(() => {
      trackAnalyticsEvent("content_report_submitted", {
        targetType: target.targetType,
        targetId: target.targetId,
      });
      Alert.alert("Report sent", "Hungry will review this content.");
    })
    .catch(() => {
      Alert.alert("Could not send report", "Please try again later.");
    });
}

function blockAuthor(
  target: Pick<ContentSafetyTarget, "targetType" | "targetId" | "onBlocked">,
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
      Alert.alert("User blocked", "Thanks. We will reduce content from this user.");
    })
    .catch(() => {
      Alert.alert("Could not block user", "Please try again later.");
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
      Alert.alert("Post hidden", "We will show less content like this.");
    })
    .catch(() => {
      Alert.alert("Could not hide post", "Please try again later.");
    });
}

export function promptContentSafetyActions(target: ContentSafetyTarget): void {
  const label = target.label ?? "content";
  const canHidePost = target.targetType === "post" || Boolean(target.postId);
  // Seeded/demo content has no account behind it, so there is nobody to block.
  const blockedAuthorId = normalizeAuthorId(target.authorId);
  const managementCopy = !blockedAuthorId
    ? canHidePost
      ? `Report or hide this ${label}?`
      : `Report this ${label}?`
    : canHidePost
      ? `Report this ${label}, hide it, or block ${target.authorName}?`
      : `Report this ${label} or block ${target.authorName}?`;
  const actions = [
    {
      text: "Report",
      style: "destructive" as const,
      onPress: () => reportContent(target),
    },
  ];

  if (canHidePost) {
    actions.push({
      text: "Hide post",
      style: "destructive" as const,
      onPress: () => hidePost(target),
    });
  }

  if (blockedAuthorId) {
    actions.push({
      text: "Block user",
      style: "destructive" as const,
      onPress: () => blockAuthor(target, blockedAuthorId),
    });
  }

  Alert.alert(`Manage ${label}`, managementCopy, [{ text: "Cancel", style: "cancel" }, ...actions]);
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
              Alert.alert("Report sent", "Hungry will review this content.");
            })
            .catch(() => {
              Alert.alert("Could not send report", "Please try again later.");
            });
        },
      },
    ],
  );
}

/** Report / Block menu for a review, shared by the stall and dish pages (the Review feed has its own copy). */
export function promptReviewSafetyActions(target: ReviewSafetyTarget): void {
  Alert.alert(`Review by ${target.authorName}`, undefined, [
    { text: "Report review", onPress: () => promptReportReview(target) },
    {
      text: `Block ${target.authorName}`,
      style: "destructive",
      onPress: () => promptBlockReviewAuthor(target),
    },
    { text: "Cancel", style: "cancel" },
  ]);
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
    `Block ${target.authorName}? You will see less content from this user.`,
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
              Alert.alert("User blocked", "Thanks. We will reduce content from this user.");
            })
            .catch(() => {
              Alert.alert("Could not block user", "Please try again later.");
            });
        },
      },
    ],
  );
}
