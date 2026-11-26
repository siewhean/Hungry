import { useLayoutEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { ChevronRight, Utensils } from "lucide-react-native";

import { PagedRailScrollView } from "@/components/discover/home/PagedRailScrollView";
import { HOME_PRICE_STYLE } from "@/components/discover/home/homeLayout";
import { AccessibleImage, AppSymbol, AppText, PressableScale } from "@/components/ui";
import { buildBiteLabel, formatBiteDistance } from "@/features/discover/biteLabel";
import { useCatalogHomeCardVisibility } from "@/features/discover/catalogHomeVisibility";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

interface TrendingListProps {
  title: string;
  bites: Bite[];
  onOpen: (bite: Bite) => void;
  onPrefetch?: (bite: Bite) => void;
  onSeeAll?: () => void;
  /** Cards shown before scrolling; the rest of `bites` appear as the row is scrolled. */
  initialCount?: number;
}

const MAX_ROWS = 8;
/** Each dish is a card in a row that scrolls sideways; the next one peeks in. */
const CARD_WIDTH = 300;

/** The row photo; a missing or broken photo shows the same dish icon as the card rails. */
function TrendingThumb({
  photoUrl,
  dishName,
  measureCatalogPaint,
}: {
  photoUrl?: string;
  dishName: string;
  measureCatalogPaint: boolean;
}) {
  const { componentRadii, palette } = useHungryTheme();
  const [failedUrl, setFailedUrl] = useState<string>();
  const showPhoto = Boolean(photoUrl) && photoUrl !== failedUrl;
  const paint = useCatalogHomeCardVisibility(measureCatalogPaint);
  const onImageSourceChange = paint?.onImageSourceChange;
  useLayoutEffect(() => {
    onImageSourceChange?.(showPhoto ? photoUrl : undefined);
  }, [onImageSourceChange, photoUrl, showPhoto]);
  return (
    <View
      ref={paint?.ref}
      collapsable={!paint}
      onLayout={paint?.onLayout}
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
          key={photoUrl}
          source={{ uri: photoUrl }}
          decorative
          contentFit="cover"
          onDisplay={paint && photoUrl ? () => paint.onImageDisplay(photoUrl) : undefined}
          onError={() => setFailedUrl(photoUrl)}
          style={{ height: "100%", width: "100%" }}
        />
      ) : (
        <View accessibilityRole="image" accessibilityLabel={`${dishName} photo unavailable`}>
          <AppSymbol name="fork.knife" fallback={Utensils} size={24} color={palette.textMuted} />
        </View>
      )}
    </View>
  );
}

/** Trending dishes as rich cards in a sideways row: photo, name, stall and unit, rating, price and distance. */
export function TrendingList({
  title,
  bites,
  onOpen,
  onPrefetch,
  onSeeAll,
  initialCount,
}: TrendingListProps) {
  const { componentRadii, palette, semanticSpacing, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  if (!bites.length) return null;
  return (
    <View style={{ gap: spacing[3] }} testID="trending-list">
      {onSeeAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all: ${title}`}
          hitSlop={8}
          onPress={onSeeAll}
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[2],
            justifyContent: "space-between",
            minHeight: 44,
          }}
        >
          <AppText variant="h2" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          <AppSymbol
            name="chevron.right"
            fallback={ChevronRight}
            size={20}
            color={palette.textMuted}
          />
        </Pressable>
      ) : (
        <AppText variant="h2">{title}</AppText>
      )}
      <PagedRailScrollView
        items={bites}
        initialCount={initialCount ?? MAX_ROWS}
        resetKey={title}
        style={{ marginLeft: -semanticSpacing.screenEdge, width: screenWidth }}
        contentContainerStyle={{ gap: spacing[3], paddingHorizontal: semanticSpacing.screenEdge }}
        renderItem={(bite, index) => {
          const distance = formatBiteDistance(bite.distanceMeters);
          return (
            <PressableScale
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
                width: CARD_WIDTH,
              }}
            >
              <TrendingThumb
                photoUrl={bite.photoUrl}
                dishName={bite.dishName}
                measureCatalogPaint={index < 3 && bite.price > 0}
              />
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
                      <AppSymbol name="rating" size={12} color={palette.starFill} />
                      <AppText variant="micro">{bite.rating.toFixed(1)}</AppText>
                    </View>
                  ) : null}
                  {distance ? (
                    <AppText variant="micro" tone="muted">
                      {distance}
                    </AppText>
                  ) : null}
                  {bite.price > 0 ? (
                    <AppText
                      variant="bodySmallBold"
                      style={{ color: palette.text, ...HOME_PRICE_STYLE }}
                    >
                      S${bite.price.toFixed(2)}
                    </AppText>
                  ) : null}
                </View>
              </View>
              <AppSymbol
                name="chevron.right"
                fallback={ChevronRight}
                size={20}
                color={palette.textMuted}
              />
            </PressableScale>
          );
        }}
      />
    </View>
  );
}
