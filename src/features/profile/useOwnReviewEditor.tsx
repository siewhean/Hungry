import { useCallback, useState, type ReactElement } from "react";
import { MoreHorizontal } from "lucide-react-native";

import { OwnContentEditDialog } from "@/components/social/OwnContentEditDialog";
import { IconButton } from "@/components/ui";
import { describeReviewEditError } from "@/features/review/publishErrorCopy";
import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";
import {
  canEditOwnReviews,
  deleteOwnReview,
  promptOwnContentActions,
  updateOwnReview,
} from "./ownContentActions";

/** "..." button on the viewer's own review card. */
export function OwnReviewMenuButton({ onPress }: { onPress: () => void }) {
  const { palette } = useHungryTheme();
  return (
    <IconButton
      variant="ghost"
      accessibilityLabel="Manage your review"
      accessibilityHint="Edit or delete this review"
      onPress={onPress}
      icon={<MoreHorizontal color={palette.textSecondary} size={20} />}
    />
  );
}

/**
 * Edit and delete for the viewer's own reviews (profile Reviews tab, Review
 * history). `enabled` is false until the reviews service exposes
 * updateReview/deleteReview, so no dead menu is shown.
 */
export function useOwnReviewEditor(options: {
  onUpdated: (review: Review) => void;
  onDeleted: (reviewId: string) => void;
}): { enabled: boolean; openActions: (review: Review) => void; dialog: ReactElement } {
  const { onDeleted, onUpdated } = options;
  const showToast = useUIStore((state) => state.showToast);
  const [editing, setEditing] = useState<Review | null>(null);

  const removeReview = useCallback(
    async (review: Review) => {
      try {
        await deleteOwnReview(review.id);
        onDeleted(review.id);
        showToast({ message: "Review deleted.", tone: "success" });
      } catch (error) {
        showToast({ message: describeReviewEditError(error, "delete"), tone: "error" });
      }
    },
    [onDeleted, showToast],
  );

  const openActions = useCallback(
    (review: Review) =>
      promptOwnContentActions({
        label: "review",
        onEdit: () => setEditing(review),
        onDelete: () => void removeReview(review),
      }),
    [removeReview],
  );

  const saveReview = useCallback(
    async ({ text, rating }: { text: string; rating?: number }) => {
      if (!editing) return;
      const patch = {
        text: sanitizeFreeText(text, REVIEW_TEXT_MAX_LENGTH),
        rating: rating ?? editing.rating,
      };
      try {
        await updateOwnReview(editing.id, patch);
      } catch (error) {
        showToast({ message: describeReviewEditError(error, "save"), tone: "error" });
        throw error;
      }
      onUpdated({ ...editing, ...patch });
      setEditing(null);
      showToast({ message: "Review updated.", tone: "success" });
    },
    [editing, onUpdated, showToast],
  );

  const dialog = (
    <OwnContentEditDialog
      visible={Boolean(editing)}
      title="Edit review"
      textLabel="Your review"
      maxLength={REVIEW_TEXT_MAX_LENGTH}
      initialText={editing?.text ?? ""}
      initialRating={editing?.rating ?? 0}
      onCancel={() => setEditing(null)}
      onSave={saveReview}
    />
  );

  return { enabled: canEditOwnReviews(), openActions, dialog };
}
