import { Alert } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";

type ReviewSafetyTarget = {
  reviewId: string;
  authorName: string;
};

function targetAuthorKey(authorName: string): string {
  return authorName.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
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
