import { Alert } from "react-native";

import { getHungryService } from "@/lib/services/serviceProvider";
import { askChoice } from "@/store/useChoiceSheetStore";
import type { Review } from "@/types/domain";

/** Fields an author may change on their own review. */
export type OwnReviewPatch = Partial<Pick<Review, "rating" | "text" | "tags" | "wouldRecommend">>;

type ReviewEditMethods = {
  updateReview?: (reviewId: string, patch: OwnReviewPatch) => Promise<unknown>;
  deleteReview?: (reviewId: string) => Promise<unknown>;
};

/**
 * Review edit/delete lives in the reviews data layer (audit H33, group D):
 * `reviews.updateReview(reviewId, patch)` and `reviews.deleteReview(reviewId)`.
 * Until that lands the profile entry points stay hidden instead of failing.
 */
function getReviewEditMethods(): ReviewEditMethods {
  return getHungryService().reviews as ReviewEditMethods;
}

export function canEditOwnReviews(): boolean {
  const methods = getReviewEditMethods();
  return typeof methods.updateReview === "function" && typeof methods.deleteReview === "function";
}

export async function updateOwnReview(reviewId: string, patch: OwnReviewPatch): Promise<void> {
  const methods = getReviewEditMethods();
  if (!methods.updateReview) throw new Error("Editing reviews is not available yet.");
  await methods.updateReview(reviewId, patch);
}

export async function deleteOwnReview(reviewId: string): Promise<void> {
  const methods = getReviewEditMethods();
  if (!methods.deleteReview) throw new Error("Deleting reviews is not available yet.");
  await methods.deleteReview(reviewId);
}

/** "..." menu for the viewer's own post or review: an action sheet with Edit and Delete (confirmed). */
export function promptOwnContentActions(target: {
  label: "post" | "review";
  onEdit: () => void;
  onDelete: () => void;
}): void {
  const confirmDelete = () =>
    Alert.alert(
      `Delete this ${target.label}?`,
      target.label === "review"
        ? "It is removed from your profile and the dish page. This can't be undone."
        : "It is removed from your profile. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: target.onDelete },
      ],
    );

  // A choice of actions is an action sheet, not an alert (HIG, Action sheets); the delete
  // confirmation that follows stays an alert, since it guards an action that can't be undone.
  void askChoice({
    title: `Your ${target.label}`,
    options: [
      { id: "edit", label: `Edit ${target.label}` },
      { id: "delete", label: `Delete ${target.label}`, destructive: true },
    ],
  }).then((choice) => {
    if (choice === "edit") target.onEdit();
    else if (choice === "delete") confirmDelete();
  });
}
