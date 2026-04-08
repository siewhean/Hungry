/**
 * BiteCard — dish-attached micro-review card
 *
 * Displayed in the Bites carousel on the Home Feed.
 * Compact format: 160×220 portrait card.
 */

import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Heart, MessageCircle } from "lucide-react-native";

import { AppText } from "@/components/ui";
import { useHungryTheme } from "@/theme";

export interface Bite {
  id: string;
  dishId: string;
  dishName: string;
  dishImageUrl: string;
  venueName: string;
  authorName: string;
  authorAvatarUrl: string;
  caption: string; // max 80 chars
  heartCount: number;
  commentCount: number;
  tasteTag: string; // e.g. "🌶️ Spicy kick"
  createdAt: string;
}

interface BiteCardProps {
  bite: Bite;
  onPress: () => void;
  onDishPress?: () => void;
}

export function BiteCard({ bite, onPress, onDishPress }: BiteCardProps) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Bite by ${bite.authorName}: ${bite.dishName}`}
      style={{
        width: 160,
        borderRadius: radii.lg,
        overflow: "hidden",
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      {/* Dish image */}
      <View style={{ height: 120, position: "relative" }}>
        <Image
          source={{ uri: bite.dishImageUrl }}
          style={{ width: "100%", height: 120 }}
          contentFit="cover"
          transition={200}
        />
        {/* Gradient overlay at bottom */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 56,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        />
        {/* Taste tag chip */}
        <View
          style={{
            position: "absolute",
            top: spacing[2],
            left: spacing[2],
            backgroundColor: `${palette.orange}EE`,
            borderRadius: radii.pill,
            paddingHorizontal: spacing[2],
            paddingVertical: 2,
          }}
        >
          <AppText variant="micro" style={{ color: "#FFFFFF", fontFamily: "Nunito_700Bold" }}>
            {bite.tasteTag}
          </AppText>
        </View>
        {/* Author avatar */}
        <View
          style={{
            position: "absolute",
            bottom: -14,
            right: spacing[2],
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: palette.orange,
            overflow: "hidden",
            backgroundColor: palette.surface,
          }}
        >
          <Image
            source={{ uri: bite.authorAvatarUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: spacing[3], paddingTop: spacing[4], gap: spacing[2] }}>
        <Pressable onPress={onDishPress ?? onPress}>
          <AppText
            variant="h3"
            numberOfLines={1}
            style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }}
          >
            {bite.dishName}
          </AppText>
        </Pressable>
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          {bite.venueName}
        </AppText>
        <AppText
          variant="bodySmall"
          tone="secondary"
          numberOfLines={2}
          style={{ lineHeight: 17 }}
        >
          {bite.caption}
        </AppText>

        {/* Social row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[3],
            marginTop: spacing[1],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Heart size={12} color={palette.error} />
            <AppText variant="micro" tone="muted">
              {bite.heartCount}
            </AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MessageCircle size={12} color={palette.textMuted} />
            <AppText variant="micro" tone="muted">
              {bite.commentCount}
            </AppText>
          </View>
          <AppText variant="micro" tone="muted" style={{ marginLeft: "auto" }}>
            {bite.createdAt}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}
