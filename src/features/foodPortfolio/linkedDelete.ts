import { markReviewDeletedForSession } from "@/features/review/reviewExplore";
import { reportError } from "@/lib/monitoring/reportError";
import { markPostRemovedForSession } from "@/lib/security/communitySafety";
import { getHungryService } from "@/lib/services/serviceProvider";
import { askChoice } from "@/store/useChoiceSheetStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";

/** Which half of a review and its portfolio entry the person asked to delete. */
export type LinkedDeleteSide = "review" | "entry";

const QUESTIONS: Record<LinkedDeleteSide, { title: string; message: string; only: string }> = {
  review: {
    title: "Delete the portfolio entry too?",
    message: "This review is also a dish in your portfolio.",
    only: "Delete only the review",
  },
  entry: {
    title: "Delete the review too?",
    message: "This dish also has your review on the dish page.",
    only: "Delete only this post",
  },
};

/** The other half's id, or null. A failed lookup is reported and treated as no link. */
export async function findLinked(side: LinkedDeleteSide, id: string): Promise<string | null> {
  const portfolio = getHungryService().foodPortfolio;
  try {
    return side === "review"
      ? await portfolio.getEntryForReview(id)
      : await portfolio.getReviewForEntry(id);
  } catch (error) {
    reportError(error, { action: "find_linked_for_delete", side, id });
    return null;
  }
}

/**
 * Asks before deleting one half of a review and its portfolio entry. With a linked other half the
 * question is the confirmation ("Delete both" or "Delete only the review"), and `onConfirmed` gets
 * the other half's id when both should go. Without one, `confirmPlain` shows the usual confirm.
 * Dismissing the question deletes nothing.
 */
export async function askLinkedDelete(
  side: LinkedDeleteSide,
  id: string,
  confirmPlain: () => void,
  onConfirmed: (otherId: string | null) => void,
): Promise<void> {
  const otherId = await findLinked(side, id);
  if (!otherId) {
    confirmPlain();
    return;
  }
  const question = QUESTIONS[side];
  const choice = await askChoice({
    title: question.title,
    message: question.message,
    options: [
      { id: "both", label: "Delete both", destructive: true },
      { id: "one", label: question.only, destructive: true },
    ],
  });
  if (choice === "both") onConfirmed(otherId);
  else if (choice === "one") onConfirmed(null);
}

/**
 * Deletes the other half once the first is gone: the entry after a review (`side` "review"), or
 * the review after an entry. Returns false when it failed; the failure is reported.
 */
export async function deleteLinked(side: LinkedDeleteSide, otherId: string): Promise<boolean> {
  const service = getHungryService();
  try {
    if (side === "review") {
      await service.social.deletePost(otherId);
      markPostRemovedForSession(otherId);
      usePublishedPostStore.getState().removePost(otherId);
    } else {
      await service.reviews.deleteReview(otherId);
      markReviewDeletedForSession(otherId);
    }
    return true;
  } catch (error) {
    reportError(error, { action: "delete_linked", side, otherId });
    return false;
  }
}

/** The toast after a delete that may have taken the other half with it. */
export function linkedDeleteMessage(
  side: LinkedDeleteSide,
  other: "kept" | "deleted" | "failed",
): { message: string; tone: "success" | "warning" } {
  const first = side === "review" ? "Review" : "Post";
  if (other === "deleted")
    return { message: "Review and portfolio entry deleted.", tone: "success" };
  if (other === "failed") {
    return {
      message:
        side === "review"
          ? "Review deleted, but we couldn't delete the portfolio entry. Try again from your profile."
          : "Post deleted, but we couldn't delete the review. Try again from the dish page.",
      tone: "warning",
    };
  }
  return { message: `${first} deleted.`, tone: "success" };
}
