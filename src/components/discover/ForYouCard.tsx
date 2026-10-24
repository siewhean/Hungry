import { Pressable, View } from "react-native";
import { Bookmark, Star, Store } from "lucide-react-native";

import { AccessibleImage, AppText } from "@/components/ui";
import type { ForYouPick } from "@/features/discover/mallMode";
import { useHungryTheme } from "@/theme";

interface ForYouCardProps {
  pick: ForYouPick;
  onPress: () => void;
  onPressIn?: () => void;
}

const REVIEW_SNIPPET_LENGTH = 110;

/**
 * A recommendation laid out like a review card: photo, name and price, stall, why it suits
 * this diner, and what another diner said.
 */
export function ForYouCard({ pick, onPress, onPressIn }: ForYouCardProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const { dish } = pick;
  const review = dish.reviews.find((item) => item.text.trim().length > 0);
  const snippet = review
    ? review.text.trim().length > REVIEW_SNIPPET_LENGTH
      ? `${review.text.trim().slice(0, REVIEW_SNIPPET_LENGTH).trimEnd()}…`
      : review.text.trim()
    : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dish.name} at ${dish.venueName}${
        pick.matchPercent !== undefined ? `, ${pick.matchPercent} percent match` : ""
      }`}
      onPress={onPress}
      onPressIn={onPressIn}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        overflow: "hidden",
      }}
      testID="for-you-card"
    >
      {dish.imageUrl ? (
        <View style={{ height: 190 }}>
          <AccessibleImage
            source={{ uri: dish.imageUrl }}
            decorative
            contentFit="cover"
            style={{ height: "100%", width: "100%" }}
          />
          {pick.matchPercent !== undefined ? (
            <View
              style={{
                backgroundColor: palette.orange,
                borderRadius: radii.pill,
                left: spacing[3],
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
                position: "absolute",
                top: spacing[3],
              }}
            >
              <AppText variant="bodySmallBold" style={{ color: palette.textOnOrange }}>
                {pick.matchPercent}% match
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ gap: spacing[2], padding: spacing[4] }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}>
          <AppText variant="h2" numberOfLines={2} style={{ flex: 1 }}>
            {dish.name}
          </AppText>
          {dish.price > 0 ? (
            <AppText variant="h2" style={{ color: palette.text }}>
              S${dish.price.toFixed(2)}
            </AppText>
          ) : null}
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
          <Store size={15} color={palette.textSecondary} />
          <AppText variant="bodySmall" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {dish.venueName}
            {dish.unitNumber ? ` · ${dish.unitNumber}` : ""}
          </AppText>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
          {dish.reviewCount > 0 ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
              <Star size={15} color={palette.starStroke} fill={palette.starFill} />
              <AppText variant="bodySmallBold">{dish.rating.toFixed(1)}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                ({dish.reviewCount})
              </AppText>
            </View>
          ) : null}
          {dish.savedCount ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
              <Bookmark size={14} color={palette.textSecondary} />
              <AppText variant="bodySmall" tone="secondary">
                {dish.savedCount} saved
              </AppText>
            </View>
          ) : null}
        </View>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: palette.orangeLight,
            borderRadius: radii.pill,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
          }}
        >
          <AppText variant="micro" style={{ color: palette.orangeDark }}>
            {pick.reason}
          </AppText>
        </View>
        {snippet ? (
          <View
            style={{
              backgroundColor: palette.surfaceRaised,
              borderRadius: componentRadii.card,
              gap: spacing[1],
              padding: spacing[3],
            }}
          >
            <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>
              {`“${snippet}”`}
            </AppText>
            {review ? (
              <AppText variant="micro" tone="muted">
                {review.authorName}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
