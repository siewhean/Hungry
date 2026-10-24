import { Pressable, View } from "react-native";
import { ChevronRight, Star } from "lucide-react-native";

import { AccessibleImage, AppText } from "@/components/ui";
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

function distanceLabel(meters: number | undefined): string | undefined {
  if (meters === undefined || !Number.isFinite(meters) || meters <= 0) return undefined;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Trending dishes as rich rows: photo, name, stall and unit, rating, price and distance. */
export function TrendingList({ title, bites, onOpen, onPrefetch, onSeeAll }: TrendingListProps) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  if (!bites.length) return null;
  return (
    <View style={{ gap: spacing[3] }} testID="trending-list">
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="h2">{title}</AppText>
        {onSeeAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See all: ${title}`}
            hitSlop={8}
            onPress={onSeeAll}
          >
            <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
              SEE ALL
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {bites.slice(0, MAX_ROWS).map((bite) => {
        const distance = distanceLabel(bite.distanceMeters);
        return (
          <Pressable
            key={bite.id}
            accessibilityRole="button"
            accessibilityLabel={`${bite.dishName} at ${bite.venueName}`}
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
            <View
              style={{
                backgroundColor: palette.bgSoft,
                borderRadius: componentRadii.card,
                height: 72,
                overflow: "hidden",
                width: 72,
              }}
            >
              {bite.photoUrl ? (
                <AccessibleImage
                  source={{ uri: bite.photoUrl }}
                  decorative
                  contentFit="cover"
                  style={{ height: "100%", width: "100%" }}
                />
              ) : null}
            </View>
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
                  <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
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
