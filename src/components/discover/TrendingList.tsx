import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight, Star, Utensils } from "lucide-react-native";

import { AccessibleImage, AppText } from "@/components/ui";
import { buildBiteLabel, formatBiteDistance } from "@/features/discover/biteLabel";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

interface TrendingListProps {
  title: string;
  bites: Bite[];
  onOpen: (bite: Bite) => void;
  onPrefetch?: (bite: Bite) => void;
  onSeeAll?: () => void;
}

const MAX_ROWS = 5;

/** The row photo; a missing or broken photo shows the same dish icon as the card rails. */
function TrendingThumb({ photoUrl, dishName }: { photoUrl?: string; dishName: string }) {
  const { componentRadii, palette } = useHungryTheme();
  const [failedUrl, setFailedUrl] = useState<string>();
  const showPhoto = Boolean(photoUrl) && photoUrl !== failedUrl;
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bgSoft,
        borderRadius: componentRadii.card,
        height: 72,
        justifyContent: "center",
        overflow: "hidden",
        width: 72,
      }}
    >
      {showPhoto ? (
        <AccessibleImage
          source={{ uri: photoUrl }}
          decorative
          contentFit="cover"
          onError={() => setFailedUrl(photoUrl)}
          style={{ height: "100%", width: "100%" }}
        />
      ) : (
        <View accessibilityRole="image" accessibilityLabel={`${dishName} photo unavailable`}>
          <Utensils color={palette.textMuted} size={24} />
        </View>
      )}
    </View>
  );
}

/** Trending dishes as rich rows: photo, name, stall and unit, rating, price and distance. */
export function TrendingList({ title, bites, onOpen, onPrefetch, onSeeAll }: TrendingListProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  if (!bites.length) return null;
  return (
    <View style={{ gap: spacing[3] }} testID="trending-list">
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all: ${title}`}
          hitSlop={8}
          onPress={onSeeAll}
          style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 }}
        >
          <AppText variant="h2" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          <ChevronRight color={palette.textMuted} size={20} />
        </Pressable>
      ) : (
        <AppText variant="h2">{title}</AppText>
      )}
      {bites.slice(0, MAX_ROWS).map((bite) => {
        const distance = formatBiteDistance(bite.distanceMeters);
        return (
          <Pressable
            key={bite.id}
            accessibilityRole="button"
            accessibilityLabel={buildBiteLabel(bite)}
            onPress={() => onOpen(bite)}
            onPressIn={() => onPrefetch?.(bite)}
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: 1,
              flexDirection: "row",
              gap: spacing[3],
              padding: spacing[3],
            }}
          >
            <TrendingThumb photoUrl={bite.photoUrl} dishName={bite.dishName} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyBold" numberOfLines={1}>
                {bite.dishName}
              </AppText>
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {bite.venueName}
                {bite.unitNumber ? ` · ${bite.unitNumber}` : ""}
              </AppText>
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                {bite.rating > 0 ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
                    <Star size={12} color={palette.starStroke} fill={palette.starFill} />
                    <AppText variant="micro">{bite.rating.toFixed(1)}</AppText>
                  </View>
                ) : null}
                {distance ? (
                  <AppText variant="micro" tone="muted">
                    {distance}
                  </AppText>
                ) : null}
                {bite.price > 0 ? (
                  <AppText variant="price" style={{ color: palette.text }}>
                    S${bite.price.toFixed(2)}
                  </AppText>
                ) : null}
              </View>
            </View>
            <ChevronRight size={20} color={palette.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}
