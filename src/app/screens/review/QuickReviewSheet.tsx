import { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Star } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { useHungryTheme } from "@/theme";
import { AccessibleImage, AppText, Button, StickyBottomBar } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ReviewTasteTag, DishSummary } from "@/types/domain";
import { TasteTagGrid } from "@/components/review/TasteTagGrid";
import { ReviewProgressBar } from "@/components/review/ReviewProgressBar";
import { ReviewSuccessCard } from "@/components/review/ReviewSuccessCard";
import { useGamificationStore, POINTS_PER_ACTION } from "@/store/useGamificationStore";

interface QuickReviewSheetProps {
  venueId: string;
  venueName: string;
  dishId?: string;
  dishName?: string;
  onSuccess: (data: { rating: number; tagCount: number }) => void;
}

export const QuickReviewSheet = ({
  venueId,
  venueName,
  dishId: initialDishId,
  dishName: initialDishName,
  onSuccess,
}: QuickReviewSheetProps) => {
  const { componentRadii, palette, spacing, radii } = useHungryTheme();

  // Gamification store — provides live points/tier for the success card
  const { totalPoints, lastEarnedPoints, awardPoints, tier, levelProgress } =
    useGamificationStore();
  const gamificationPoints = {
    total: totalPoints,
    lastEarned: lastEarnedPoints || POINTS_PER_ACTION.quickReview,
    tierName: tier().name,
    progress: levelProgress(),
  };

  const [step, setStep] = useState(initialDishId ? 2 : 1);
  const [dishes, setDishes] = useState<DishSummary[]>([]);

  const [selectedDishId, setSelectedDishId] = useState<string | undefined>(initialDishId);
  const [selectedDishName, setSelectedDishName] = useState<string | undefined>(initialDishName);
  const [rating, setRating] = useState(0);
  const [comment, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<ReviewTasteTag[]>([]);

  const [menuPhotoUri, setMenuPhotoUri] = useState<string | null>(null);
  const [menuPhotoMimeType, setMenuPhotoMimeType] = useState<string | undefined>(undefined);
  const [menuPhotoSizeBytes, setMenuPhotoSizeBytes] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!initialDishId) {
      getHungryService().discovery.listDishesByVenue(venueId).then(setDishes).catch(console.error);
    }
  }, [initialDishId, venueId]);

  const toggleTag = (tag: ReviewTasteTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleTakeMenuPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      useUIStore.getState().showToast({
        message: "Camera permission is required to snap a menu photo.",
        tone: "warning",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setMenuPhotoUri(asset.uri);
    setMenuPhotoMimeType(asset.mimeType ?? undefined);
    setMenuPhotoSizeBytes(asset.fileSize ?? undefined);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (__DEV__ && menuPhotoUri) {
        try {
          await getHungryService().supply.submitMenuPhoto({
            venueId,
            dishId: selectedDishId,
            photoUri: menuPhotoUri,
            photoMimeType: menuPhotoMimeType,
            photoFileSizeBytes: menuPhotoSizeBytes,
            reviewText: comment.trim() || undefined,
          });
        } catch {
          useUIStore.getState().showToast({
            message: "Menu photo OCR handoff failed. Review will still post.",
            tone: "warning",
          });
        }
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      awardPoints("quickReview");
      setStep(4); // Go to success step
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Dish Select
  if (step === 1) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingBottom: spacing[4] }}>
          <ReviewProgressBar currentStep={1} totalSteps={4} />
          <View style={{ marginTop: spacing[4], alignItems: "center" }}>
            <AppText variant="h2" style={{ fontWeight: "900", marginBottom: spacing[1] }}>
              Which dish?
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Select from {venueName}
            </AppText>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing[6] }}>
          <View style={{ gap: spacing[3] }}>
            {dishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => {
                  setSelectedDishId(dish.id);
                  setSelectedDishName(dish.name);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  padding: spacing[4],
                  backgroundColor: palette.bgSoft,
                  borderRadius: componentRadii.card,
                  borderWidth: 2,
                  borderColor: selectedDishId === dish.id ? palette.orange : "transparent",
                }}
              >
                <AppText variant="body" style={{ fontWeight: "700" }}>
                  {dish.name}
                </AppText>
                {dish.price ? (
                  <AppText variant="bodySmall" tone="secondary">
                    ${dish.price.toFixed(2)}
                  </AppText>
                ) : null}
              </Pressable>
            ))}
            {dishes.length === 0 && (
              <AppText tone="secondary" style={{ textAlign: "center", marginTop: spacing[4] }}>
                Loading menu...
              </AppText>
            )}
          </View>
        </ScrollView>

        <StickyBottomBar
          actions={[
            {
              label: "Next → Rate",
              onPress: () => setStep(2),
              disabled: !selectedDishId,
            },
          ]}
        />
      </View>
    );
  }

  // Step 2: Star Rating
  if (step === 2) {
    return (
      <View style={{ flex: 1, paddingBottom: spacing[6] }}>
        <ReviewProgressBar currentStep={2} totalSteps={4} />

        <View style={{ marginTop: spacing[4], alignItems: "center", marginBottom: spacing[6] }}>
          <AppText variant="h2" style={{ fontWeight: "900", marginBottom: spacing[1] }}>
            How was it overall?
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            Tap a star — you can change it
          </AppText>
        </View>

        <View style={{ alignItems: "center", gap: spacing[2], marginBottom: spacing[8] }}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => {
                  setRating(star);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                style={{ padding: spacing[1] }}
              >
                <Star
                  size={44}
                  color={star <= rating ? palette.amber : palette.border}
                  fill={star <= rating ? palette.amber : "transparent"}
                />
              </Pressable>
            ))}
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "80%",
              marginTop: spacing[2],
            }}
          >
            <AppText variant="micro" tone="secondary">
              Disappointing
            </AppText>
            <AppText variant="micro" tone="secondary">
              Will come back
            </AppText>
          </View>
        </View>

        <View style={{ marginTop: "auto", gap: spacing[3] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              label="‹ Back"
              variant="secondary"
              onPress={() => (initialDishId ? null : setStep(1))}
              disabled={!!initialDishId}
              style={{ flex: 0, paddingHorizontal: spacing[4] }}
            />
            <Button
              label="Next → Tags"
              onPress={() => setStep(3)}
              disabled={rating === 0}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    );
  }

  // Step 3: Taste Tags
  if (step === 3) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingBottom: spacing[4] }}>
          <ReviewProgressBar currentStep={3} totalSteps={4} />
          <View
            style={{
              marginTop: spacing[3],
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[2],
            }}
          >
            <View style={{ flexDirection: "row" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  color={palette.amber}
                  fill={i < rating ? palette.amber : "transparent"}
                />
              ))}
            </View>
            <AppText style={{ fontSize: 13, fontWeight: "700" }}>
              {rating} stars · {selectedDishName}
            </AppText>
          </View>
          <View style={{ marginTop: spacing[2] }}>
            <AppText variant="h2" style={{ fontWeight: "900", lineHeight: 28 }}>
              How did it taste?{" "}
              <AppText tone="secondary" style={{ fontSize: 14, fontWeight: "500" }}>
                (tap all that apply)
              </AppText>
            </AppText>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing[6] }}>
          <TasteTagGrid selectedTags={selectedTags} onToggle={toggleTag} />

          <View
            style={{
              marginVertical: spacing[4],
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[2],
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
            <AppText
              style={{ fontSize: 11, color: palette.textMuted, fontFamily: "DMMono_400Regular" }}
            >
              Optional: add a note
            </AppText>
            <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
          </View>

          <BottomSheetTextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.bgSoft,
                borderColor: palette.border,
                color: palette.text,
                padding: spacing[3],
              },
            ]}
            placeholder="Add anything else… (140 chars max)"
            placeholderTextColor={palette.textMuted}
            multiline
            maxLength={140}
            value={comment}
            onChangeText={setCaption}
          />
          <AppText
            style={{
              fontSize: 11,
              color: palette.textMuted,
              textAlign: "right",
              marginTop: spacing[1],
              fontFamily: "DMMono_400Regular",
            }}
          >
            {comment.length} / 140
          </AppText>

          {__DEV__ ? (
            <View style={{ marginTop: spacing[4], gap: spacing[2] }}>
              <AppText variant="h3">Menu Photo (Developer OCR)</AppText>
              <Button
                label={menuPhotoUri ? "Retake Menu Photo" : "Snap Menu Photo"}
                variant="secondary"
                onPress={() => {
                  void handleTakeMenuPhoto();
                }}
              />
              {menuPhotoUri ? (
                <View style={{ gap: spacing[2] }}>
                  <AccessibleImage
                    source={{ uri: menuPhotoUri }}
                    style={{ width: "100%", height: 140, borderRadius: radii.md }}
                    contentFit="cover"
                    accessibilityLabel="Selected menu photo preview"
                  />
                  <Button
                    label="Remove Photo"
                    variant="ghost"
                    onPress={() => {
                      setMenuPhotoUri(null);
                      setMenuPhotoMimeType(undefined);
                      setMenuPhotoSizeBytes(undefined);
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <StickyBottomBar
          actions={[
            {
              label: "‹ Back",
              variant: "secondary",
              onPress: () => setStep(2),
            },
            {
              label: isSubmitting ? "Submitting..." : "Submit review",
              onPress: handleSubmit,
              disabled: isSubmitting,
            },
          ]}
        />
      </View>
    );
  }

  // Step 4: Success
  return (
    <View style={{ flex: 1, paddingBottom: spacing[6] }}>
      <ReviewProgressBar currentStep={4} totalSteps={4} />

      <View style={{ marginTop: spacing[6] }}>
        <ReviewSuccessCard
          pointsEarned={gamificationPoints.lastEarned}
          totalPoints={gamificationPoints.total}
          levelName={gamificationPoints.tierName}
          levelProgress={gamificationPoints.progress}
          dishName={selectedDishName ?? "Dish"}
          stallName={venueName}
          rating={rating}
          selectedTags={selectedTags}
        />
      </View>

      <View style={{ marginTop: "auto", gap: spacing[3] }}>
        <Button
          label="Back to stall"
          onPress={() => onSuccess({ rating, tagCount: selectedTags.length })}
        />
        <Pressable
          onPress={() => onSuccess({ rating, tagCount: selectedTags.length })}
          style={{ padding: spacing[2], alignItems: "center" }}
        >
          <AppText style={{ fontSize: 13, fontWeight: "600", color: palette.orange }}>
            Share this review →
          </AppText>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
    borderWidth: 1.5,
    borderRadius: 12,
  },
});
