import { useState } from "react";
import { View } from "react-native";

import {
  describeReviewEditError,
  isExpectedPublishError,
} from "@/features/review/publishErrorCopy";
import { markReviewDeletedForSession } from "@/features/review/reviewExplore";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { REVIEW_TEXT_MAX_LENGTH } from "@/lib/security/inputSanitization";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { Button, Dialog, Input } from "../ui";
import { StarRating } from "./StarRating";

interface OwnReviewActionsProps {
  review: { id: string; rating: number; text: string };
  /** Called after the server saved the edit, with the saved fields. */
  onUpdated: (patch: { rating: number; text: string }) => void;
  /** Called after the server deleted the review. */
  onDeleted: () => void;
}

/** Edit and Delete for the signed-in author's own review row (detail pages). */
export function OwnReviewActions({ review, onUpdated, onDeleted }: OwnReviewActionsProps) {
  const { spacing } = useHungryTheme();
  const showToast = useUIStore((state) => state.showToast);
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [text, setText] = useState(review.text);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setIsSaving(true);
    try {
      await getHungryService().reviews.updateReview(review.id, { rating, text });
      onUpdated({ rating, text: text.trim() });
      setIsEditing(false);
      showToast({ message: "Review updated.", tone: "success" });
    } catch (error) {
      if (!isExpectedPublishError(error)) {
        reportError(error, { action: "update_own_review", reviewId: review.id });
      }
      showToast({ message: describeReviewEditError(error, "save"), tone: "warning" });
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    setIsSaving(true);
    try {
      await getHungryService().reviews.deleteReview(review.id);
      markReviewDeletedForSession(review.id);
      onDeleted();
      showToast({ message: "Review deleted.", tone: "success" });
    } catch (error) {
      if (!isExpectedPublishError(error)) {
        reportError(error, { action: "delete_own_review", reviewId: review.id });
      }
      showToast({ message: describeReviewEditError(error, "delete"), tone: "warning" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={{ gap: spacing[2] }}>
      {isEditing ? (
        <>
          <StarRating value={rating} editable onChange={setRating} />
          <Input
            label="Your review"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={REVIEW_TEXT_MAX_LENGTH}
          />
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Button
              label="Save"
              size="sm"
              loading={isSaving}
              disabled={rating < 1}
              onPress={() => void save()}
            />
            <Button
              label="Cancel"
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onPress={() => {
                setRating(review.rating);
                setText(review.text);
                setIsEditing(false);
              }}
            />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <Button
            label="Edit"
            size="sm"
            variant="ghost"
            accessibilityLabel="Edit your review"
            disabled={isSaving}
            onPress={() => setIsEditing(true)}
          />
          <Button
            label="Delete"
            size="sm"
            variant="ghost"
            accessibilityLabel="Delete your review"
            loading={isSaving}
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      )}
      <Dialog
        visible={confirmDelete}
        title="Delete your review?"
        message="It will be removed for everyone and stop counting in the dish rating."
        buttons={[
          { text: "Cancel", style: "cancel", onPress: () => setConfirmDelete(false) },
          { text: "Delete", style: "destructive", onPress: () => void remove() },
        ]}
        onClose={() => setConfirmDelete(false)}
      />
    </View>
  );
}
