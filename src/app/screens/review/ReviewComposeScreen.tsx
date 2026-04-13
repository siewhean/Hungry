import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { View } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { PhotoPicker } from "@/components/review";
import { AppText, Button, Card, InlineBanner, Input } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ReviewScreenShell } from "./ReviewScreenShell";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewCompose">;

export function ReviewComposeScreen({ navigation }: Props) {
  const { spacing } = useHungryTheme();
  const rootNavigation = navigation.getParent()?.getParent();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const draft = useReviewDraftStore((state) => state.draft);
  const failedPhotoUris = useReviewDraftStore((state) => state.failedPhotoUris);
  const addPhoto = useReviewDraftStore((state) => state.addPhoto);
  const removePhoto = useReviewDraftStore((state) => state.removePhoto);
  const markPhotoFailed = useReviewDraftStore((state) => state.markPhotoFailed);
  const clearFailedPhoto = useReviewDraftStore((state) => state.clearFailedPhoto);
  const setText = useReviewDraftStore((state) => state.setText);
  const isSubmitting = useReviewDraftStore((state) => state.isSubmitting);
  const setSubmitting = useReviewDraftStore((state) => state.setSubmitting);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const addReview = useProfileStore((state) => state.addReview);
  const addReviewedDish = useProfileStore((state) => state.addReviewedDish);
  const recordReviewEntry = useProfileStore((state) => state.recordReviewEntry);
  const showToast = useUIStore((state) => state.showToast);
  const showReviewSuccess = useUIStore((state) => state.showReviewSuccess);
  const selectedDishId = useReviewDraftStore((state) => state.draft.selectedDishId);
  const dish = useMemo(() => mockRepository.getDishById(selectedDishId ?? ""), [selectedDishId]);

  if (!dish) {
    return (
      <ReviewScreenShell
        title="Choose a dish first"
        subtitle="Reviews should stay attached to the exact dish you ate."
        step={4}
        total={4}
      >
        <Card>
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Dish selection is missing</AppText>
            <AppText tone="secondary">
              Go back to quick review and pick the exact dish before writing your final notes.
            </AppText>
          </View>
        </Card>
        <Button label="Back to quick review" onPress={() => navigation.popToTop()} />
      </ReviewScreenShell>
    );
  }

  const handleSubmit = () => {
    if (!isAuthenticated) {
      setReturnRoute({
        name: "ReviewStack",
        params: { screen: "ReviewCompose" },
      });
      rootNavigation?.navigate("AuthStack", { screen: "Login" });
      return;
    }

    const successPayload = {
      dishName: dish.name,
      venueName: mockRepository.getVenueById(dish.venueId)?.name ?? "",
      pointsEarned: 15 + draft.selectedTags.length * 4 + (draft.text.trim().length ? 10 : 0) + draft.photos.length * 5,
      xpEarned: 15 + draft.selectedTags.length * 4 + (draft.text.trim().length ? 10 : 0) + draft.photos.length * 5,
      tagCount: draft.selectedTags.length,
      rating: draft.rating,
    };

    setSubmitting(true);
    setTimeout(() => {
      addReviewedDish(dish.id);
      addReview(dish);
      recordReviewEntry(dish.id, {
        rating: draft.rating,
        text: draft.text,
        tags: draft.selectedTags,
      });
      trackAnalyticsEvent("review_submitted", {
        dish_id: dish.id,
        venue_id: dish.venueId,
        rating: draft.rating,
        has_text: Boolean(draft.text.trim()),
        has_photos: draft.photos.length > 0,
        tag_count: draft.selectedTags.length,
      });
      setSubmitting(false);
      showToast({ message: "Review posted! Your feedback helps other foodies find the best dishes in Singapore.", tone: "success" });
      showReviewSuccess(successPayload);
      resetDraft();
      navigation.popToTop();
    }, 700);
  };

  return (
    <ReviewScreenShell
      title="Final notes"
      subtitle="Add a short comment or keep it lightweight with just the tags."
      step={4}
      total={4}
    >
      <Card>
        <View style={{ gap: spacing[3] }}>
          <AppText variant="h3">{dish.name}</AppText>
          <AppText tone="secondary">The draft stays intact while you move between steps.</AppText>
          <Input
            label="Review text"
            value={draft.text}
            onChangeText={(text) => setText(text.slice(0, 200))}
            placeholder="What stood out?"
            multiline
            numberOfLines={5}
            maxLength={200}
          />
          <AppText variant="micro" tone="muted">
            {draft.text.length}/200 characters
          </AppText>
          <PhotoPicker
            photos={draft.photos}
            onAddPhoto={addPhoto}
            onRemovePhoto={removePhoto}
            onPhotoError={markPhotoFailed}
          />
          {draft.photos.length ? <AppText tone="muted">Photos attached: {draft.photos.length}</AppText> : null}
          {failedPhotoUris.length ? (
            <InlineBanner tone="warning" message="One or more photos failed. Remove them or retry later." />
          ) : null}
          <View style={{ gap: spacing[2] }}>
            {failedPhotoUris.map((uri) => (
              <Button key={uri} label={`Retry ${uri}`} variant="ghost" onPress={() => clearFailedPhoto(uri)} />
            ))}
          </View>
        </View>
      </Card>
      <Button label="Submit review" loading={isSubmitting} onPress={handleSubmit} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
    </ReviewScreenShell>
  );
}
