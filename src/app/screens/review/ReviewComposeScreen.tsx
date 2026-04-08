import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { View } from "react-native";

import { AppText, Button, Card, InlineBanner, Input } from "@/components/ui";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { mockRepository } from "@/lib/services/mock/repositories";
import { ReviewScreenShell } from "./ReviewScreenShell";
import type { ReviewStackParamList } from "./ReviewStack";

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewCompose">;

export function ReviewComposeScreen({ navigation }: Props) {
  const draft = useReviewDraftStore((state) => state.draft);
  const failedPhotoUris = useReviewDraftStore((state) => state.failedPhotoUris);
  const addPhoto = useReviewDraftStore((state) => state.addPhoto);
  const markPhotoFailed = useReviewDraftStore((state) => state.markPhotoFailed);
  const clearFailedPhoto = useReviewDraftStore((state) => state.clearFailedPhoto);
  const setText = useReviewDraftStore((state) => state.setText);
  const isSubmitting = useReviewDraftStore((state) => state.isSubmitting);
  const setSubmitting = useReviewDraftStore((state) => state.setSubmitting);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const showToast = useUIStore((state) => state.showToast);
  const addReviewedDish = useProfileStore((state) => state.addReviewedDish);
  const selectedDishId = useReviewDraftStore((state) => state.draft.selectedDishId);
  const dish = useMemo(
    () => mockRepository.getDishById(selectedDishId ?? "") ?? mockRepository.listPopularNearby()[0],
    [selectedDishId],
  );

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      // Persist to profile review history
      addReviewedDish(dish.id);
      setSubmitting(false);
      showToast({ message: "Review submitted. It appears in your profile history.", tone: "success" });
      resetDraft();
      navigation.navigate("ReviewHub");
    }, 700);
  };

  return (
    <ReviewScreenShell
      title="Write your review"
      subtitle="Keep the text short or rely on tags."
      stepLabel="SCR-072"
    >
      <Card>
        <View style={{ gap: 12 }}>
          <AppText variant="h3">{dish.name}</AppText>
          <AppText tone="secondary">The draft stays intact while you move between steps.</AppText>
          <Input
            label="Review text"
            value={draft.text}
            onChangeText={setText}
            placeholder="What stood out?"
            multiline
            numberOfLines={5}
          />
          <Button label="Add demo photo" variant="secondary" onPress={() => addPhoto(`mock-photo-${Date.now()}`)} />
          <Button label="Simulate photo failure" variant="ghost" onPress={() => markPhotoFailed(`failed-${Date.now()}`)} />
          {draft.photos.length ? <AppText tone="muted">Photos attached: {draft.photos.length}</AppText> : null}
          {failedPhotoUris.length ? (
            <InlineBanner tone="warning" message="One or more photos failed. Remove them or retry later." />
          ) : null}
          <View style={{ gap: 8 }}>
            {failedPhotoUris.map((uri) => (
              <Button key={uri} label={`Retry ${uri}`} variant="ghost" onPress={() => clearFailedPhoto(uri)} />
            ))}
          </View>
        </View>
      </Card>
      <Button label="Submit review" loading={isSubmitting} onPress={handleSubmit} />
      <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} />
      <AppText variant="bodySmall" tone="muted">
        This mock flow preserves state across all three screens.
      </AppText>
    </ReviewScreenShell>
  );
}
