import { useSyncExternalStore } from "react";
import { communitySafetyState } from "./communitySafetyState";
import { Alert } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ContentReportTargetType } from "@/lib/services/types";

type ContentSafetyTarget = {
  targetType: ContentReportTargetType;
  targetId: string;
  authorName: string;
  authorId?: string;
  postId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorKey: string) => void;
};

type ReviewSafetyTarget = {
  reviewId: string;
  authorName: string;
  authorId?: string;
};

const hiddenPostIds = communitySafetyState.hiddenIds;
const blockedAuthorKeys = communitySafetyState.blockedIds;

export function useCommunitySafetyRevision(): number {
  return useSyncExternalStore(
    communitySafetyState.subscribe,
    communitySafetyState.getRevision,
    communitySafetyState.getRevision,
  );
}
export function clearCommunitySafetyState(): void {
  communitySafetyState.reset();
}
export async function hydrateCommunitySafetyState(): Promise<void> {
  const generation = communitySafetyState.getGeneration();
  const users = await getHungryService().communitySafety.getBlockedUsers();
  communitySafetyState.hydrate(
    users.map((user) => user.blockedUserKey),
    generation,
  );
}

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
  authorId?: string | null;
}): boolean {
  if (hiddenPostIds.has(target.id)) {
    return true;
  }

  if (!target.authorId) {
    return false;
  }

  return blockedAuthorKeys.has(target.authorId);
}

function reportContent(target: ContentSafetyTarget): void {
  void getHungryService()
    .communitySafety.reportContent({
      targetType: target.targetType,
      targetId: target.targetId,
      targetAuthorKey: target.authorId,
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
  target: Pick<
    ContentSafetyTarget,
    "authorName" | "authorId" | "targetType" | "targetId" | "onBlocked"
  >,
): void {
  const blockedAuthorKey = target.authorId;
  if (!blockedAuthorKey) {
    Alert.alert("Cannot identify this author", "You can still report this content for review.");
    return;
  }
  const generation = communitySafetyState.getGeneration();
  void getHungryService()
    .communitySafety.blockUser({
      blockedUserKey: blockedAuthorKey,
      reason: `user_blocked_${target.targetType}_author`,
    })
    .then(() => {
      if (generation !== communitySafetyState.getGeneration()) return;
      communitySafetyState.block(blockedAuthorKey);
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

  const generation = communitySafetyState.getGeneration();
  void getHungryService()
    .communitySafety.hidePost(postId, "hidden_from_content_safety_menu")
    .then(() => {
      if (generation !== communitySafetyState.getGeneration()) return;
      communitySafetyState.hide(postId);
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

  if (!target.authorId) actions.splice(1, 1);

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
  authorId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorKey: string) => void;
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
  authorId?: string;
  postId?: string;
  label?: string;
  onHidden?: (postId: string) => void;
  onBlocked?: (blockedAuthorKey: string) => void;
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
  promptContentSafetyActions({
    targetType: "review",
    targetId: target.reviewId,
    authorName: target.authorName,
    authorId: target.authorId,
    label: "review",
  });
}

export function promptBlockReviewAuthor(target: ReviewSafetyTarget): void {
  if (!target.authorId) {
    Alert.alert("Cannot identify this author", "Report the review instead.");
    return;
  }
  Alert.alert("Block author", `Block ${target.authorName}?`, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Block",
      style: "destructive",
      onPress: () =>
        blockAuthor({
          targetType: "review",
          targetId: target.reviewId,
          authorName: target.authorName,
          authorId: target.authorId,
        }),
    },
  ]);
}
