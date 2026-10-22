import { SUPPORT_EMAIL } from "@/constants/links";
import type { Review } from "@/types/domain";

export type ReviewModerationState = NonNullable<Review["moderationState"]>;

/** What the author is told when their own review is hidden from everyone else. */
export function describeReviewModeration(state: ReviewModerationState): {
  title: string;
  body: string;
} {
  if (state === "removed") {
    return {
      title: "Removed by moderators",
      body: "Other people can't see this review. If you think this was a mistake, ask us to look again.",
    };
  }
  return {
    title: "Hidden after reports. Under review",
    body: "Other people can't see this review while we check it. If you think this was a mistake, ask us to look again.",
  };
}

/** A prepared email to support asking for a second look at one review. */
export function buildReviewAppealMailto(input: { reviewId: string; dishName?: string }): string {
  const subject = `Request review of my Hungry review${input.dishName ? ` of ${input.dishName}` : ""}`;
  const body = [
    "Hi Hungry team,",
    "",
    "Please take another look at my review. I don't think it breaks the community guidelines.",
    "",
    `Review reference: ${input.reviewId}`,
  ].join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
