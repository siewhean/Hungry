import { useCallback, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Star, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { useHungryTheme } from "@/theme";
import { AppText, Button, Chip } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";

interface QuickReviewSheetProps {
  venueName: string;
  dishName?: string;
  onSuccess: (data: { rating: number; tagCount: number }) => void;
}

export const QuickReviewSheet = ({ venueName, dishName, onSuccess }: QuickReviewSheetProps) => {
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const [rating, setRating] = useState(0);
  const [comment, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const tags = ["Spicy", "Savoury", "Sweet", "Sour", "Worth it", "Quick", "Chewy", "Fresh"];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSuccess({ rating, tagCount: selectedTags.length });
  };

  return (
    <View style={{ gap: spacing[4], paddingBottom: spacing[6] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <AppText variant="h2">Quick Review</AppText>
          <AppText variant="bodySmall" tone="secondary">{dishName ? `${dishName} at ${venueName}` : venueName}</AppText>
        </View>
      </View>

      {/* Star Rating */}
      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => { setRating(star); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
              <Star 
                size={32} 
                color={star <= rating ? palette.amber : palette.border} 
                fill={star <= rating ? palette.amber : "transparent"} 
              />
            </Pressable>
          ))}
        </View>
        <AppText variant="micro" tone="secondary">Tap to rate</AppText>
      </View>

      {/* Taste Tags */}
      <View style={{ gap: spacing[2] }}>
        <AppText variant="h3">How was it?</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {tags.map(tag => (
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
              backgroundColor: palette.bgSoft, 
              borderColor: palette.border, 
              borderRadius: radii.md,
              color: palette.text,
              padding: spacing[3],
            }
          ]}
          placeholder="What makes this worth the queue?"
          placeholderTextColor={palette.textMuted}
          multiline
          value={comment}
          onChangeText={setCaption}
        />
      </View>

      <Button label="Post Review" onPress={handleSubmit} disabled={rating === 0} />
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
