import { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Star } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { useHungryTheme } from "@/theme";
import { AppText, Button, Chip } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { getHungryService } from "@/lib/services/serviceProvider";

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
  dishId,
  dishName,
  onSuccess,
}: QuickReviewSheetProps) => {
  const { palette, spacing, radii } = useHungryTheme();
  const [rating, setRating] = useState(0);
  const [comment, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [menuPhotoUri, setMenuPhotoUri] = useState<string | null>(null);
  const [menuPhotoMimeType, setMenuPhotoMimeType] = useState<string | undefined>(undefined);
  const [menuPhotoSizeBytes, setMenuPhotoSizeBytes] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tags = ["Spicy", "Savoury", "Sweet", "Sour", "Worth it", "Quick", "Chewy", "Fresh"];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            dishId,
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess({ rating, tagCount: selectedTags.length });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={{ gap: spacing[4], paddingBottom: spacing[6] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <AppText variant="h2">Quick Review</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {dishName ? `${dishName} at ${venueName}` : venueName}
          </AppText>
        </View>
      </View>

      {/* Star Rating */}
      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => {
                setRating(star);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <Star
                size={32}
                color={star <= rating ? palette.amber : palette.border}
                fill={star <= rating ? palette.amber : "transparent"}
              />
            </Pressable>
          ))}
        </View>
        <AppText variant="micro" tone="secondary">
          Tap to rate
        </AppText>
      </View>

      {/* Taste Tags */}
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h3">How was it?</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              selected={selectedTags.includes(tag)}
              onPress={() => toggleTag(tag)}
            />
          ))}
        </View>
      </View>

      {/* Optional Comment */}
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h3">Any notes? (Optional)</AppText>
        <BottomSheetTextInput
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderWidth: 1,
              borderRadius: radii.md,
              color: palette.text,
              padding: spacing[3],
            },
          ]}
          placeholder="What makes this worth the queue?"
          placeholderTextColor={palette.textMuted}
          multiline
          value={comment}
          onChangeText={setCaption}
        />
      </View>

      {__DEV__ ? (
        <View style={{ gap: spacing[2] }}>
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
              <Image
                source={{ uri: menuPhotoUri }}
                style={{ width: "100%", height: 140, borderRadius: radii.md }}
                contentFit="cover"
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

      <Button label="Post Review" onPress={handleSubmit} disabled={rating === 0 || isSubmitting} />
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
  },
});
