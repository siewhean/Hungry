import { Alert } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ContentReportTargetType } from "@/lib/services/types";

type ContentSafetyTarget = {
  targetType: ContentReportTargetType;
  targetId: string;
  authorName: string;
  postId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorKey: string) => void;
};

type ReviewSafetyTarget = {
  reviewId: string;
  authorName: string;
};

const hiddenPostIds = new Set<string>();
const blockedAuthorKeys = new Set<string>();

export function targetAuthorKey(authorName: string): string {
  return authorName.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export function getHiddenPostIdsForSession(): ReadonlySet<string> {
  return hiddenPostIds;
}

export function getBlockedAuthorKeysForSession(): ReadonlySet<string> {
  return blockedAuthorKeys;
}

export function isContentHiddenForSession(target: {
  id: string;
  authorName?: string | null;
}): boolean {
  if (hiddenPostIds.has(target.id)) {
    return true;
  }

  if (!target.authorName) {
    return false;
  }

  return blockedAuthorKeys.has(targetAuthorKey(target.authorName));
}

function reportContent(target: ContentSafetyTarget): void {
  void getHungryService()
    .communitySafety.reportContent({
      targetType: target.targetType,
      targetId: target.targetId,
      targetAuthorKey: targetAuthorKey(target.authorName),
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
  target: Pick<ContentSafetyTarget, "authorName" | "targetType" | "targetId" | "onBlocked">,
): void {
  const blockedAuthorKey = targetAuthorKey(target.authorName);
  void getHungryService()
    .communitySafety.blockUser({
      blockedUserKey: blockedAuthorKey,
      reason: `user_blocked_${target.targetType}_author`,
    })
    .then(() => {
      blockedAuthorKeys.add(blockedAuthorKey);
      target.onBlocked?.(blockedAuthorKey);
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
  const managementCopy = canHidePost
    ? `Report this ${label}, hide it, or block ${target.authorName}?`
    : `Report this ${label} or block ${target.authorName}?`;
  const actions = [
    {
      text: "Report",
      style: "destructive" as const,
      onPress: () => reportContent(target),
    },
    {
      text: "Block user",
      style: "destructive" as const,
      onPress: () => blockAuthor(target),
    },
  ];

  if (canHidePost) {
    actions.splice(1, 0, {
      text: "Hide post",
      style: "destructive" as const,
      onPress: () => hidePost(target),
    });
  }

  Alert.alert(`Manage ${label}`, managementCopy, [{ text: "Cancel", style: "cancel" }, ...actions]);
}

export function promptPostSafetyActions(target: {
  postId: string;
  authorName: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorKey: string) => void;
}): void {
  promptContentSafetyActions({
    targetType: "post",
    targetId: target.postId,
    authorName: target.authorName,
    label: target.label ?? "post",
    onHidden: target.onHidden,
    onBlocked: target.onBlocked,
  });
}

export function promptCommentSafetyActions(target: {
  commentId: string;
  authorName: string;
  postId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorKey: string) => void;
}): void {
  promptContentSafetyActions({
    targetType: "reply",
    targetId: target.commentId,
    authorName: target.authorName,
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
              targetAuthorKey: targetAuthorKey(target.authorName),
              reason: "user_reported_objectionable_content",
            })
            .then(() => {
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

export function promptBlockReviewAuthor(target: ReviewSafetyTarget): void {
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
              blockedUserKey: targetAuthorKey(target.authorName),
              reason: "user_blocked_from_review",
            })
            .then(() => {
              blockedAuthorKeys.add(targetAuthorKey(target.authorName));
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
