import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight, Star } from "lucide-react-native";

import { AccessibleImage, AppText } from "@/components/ui";
import { stallBuildingLabel } from "@/features/detail/stallLocation";
import {
  STALL_SHOWCASE_CARD_LIMIT,
  type DiscoverStallShowcaseCard,
} from "@/features/discover/stallShowcase";
import { getStallRowOpenLabel } from "@/features/discover/homeStalls";
import { useHungryTheme } from "@/theme";

export function VerticalStallShowcaseSection({
  cards,
  areaPhrase,
  pageHeight,
  cardWidth,
  onOpenCard,
  onPrefetchCard,
}: {
  cards: DiscoverStallShowcaseCard[];
  areaPhrase: string;
  pageHeight: number;
  cardWidth: number;
  onOpenCard: (card: DiscoverStallShowcaseCard) => void;
  onPrefetchCard: (card: DiscoverStallShowcaseCard) => void;
}) {
  const { componentRadii, palette, radii, spacing, shadows, typography } = useHungryTheme();
  const visibleCards = useMemo(() => cards.slice(0, STALL_SHOWCASE_CARD_LIMIT), [cards]);
  const columnGap = spacing[2];
  const rowGap = spacing[1.5];
  const columnCardWidth = (cardWidth - columnGap) / 2;
  const headingReserveHeight = typography.h2.lineHeight + spacing[3];
  const showcaseViewportHeight = Math.max(0, pageHeight - headingReserveHeight);
  const availableRowHeight = (showcaseViewportHeight - rowGap * 2) / 3;
  const maxTallCardHeight = columnCardWidth * 1.1;
  const tallCardHeight = Math.max(0, Math.floor(Math.min(availableRowHeight, maxTallCardHeight)));
  const compactCardDetailsHeight = typography.bodySmall.lineHeight * 2 + spacing[0.5] + spacing[1];
  const cardImageHeight = Math.max(0, Math.floor(tallCardHeight - compactCardDetailsHeight));
  const showcaseRows = useMemo(() => {
    const rows: DiscoverStallShowcaseCard[][] = [];
    for (let index = 0; index < visibleCards.length; index += 2) {
      rows.push(visibleCards.slice(index, index + 2));
    }
    return rows;
  }, [visibleCards]);

  // A plain two-column grid inside the page scroll: no nested scroller or scroll locking.
  return (
    <View style={{ gap: spacing[2] }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <AppText variant="h2" numberOfLines={1} style={{ color: palette.text, flex: 1 }}>
          More {areaPhrase}
        </AppText>
        <AppText
          variant="micro"
          style={{ color: palette.textSecondary, fontWeight: "800", marginLeft: spacing[2] }}
        >
          {visibleCards.length} {visibleCards.length === 1 ? "stall" : "stalls"}
        </AppText>
      </View>
      <View style={{ gap: rowGap, width: cardWidth }}>
        {showcaseRows.map((rowCards, rowIndex) => (
          <View
            key={`stall-showcase-row-${rowIndex}`}
            style={{
              flexDirection: "row",
              gap: columnGap,
              minHeight: tallCardHeight,
              width: cardWidth,
            }}
          >
            {rowCards.map((card) => {
              const openLabel = getStallRowOpenLabel(card.venue);
              return (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${card.venue.name} details`}
                  onPressIn={() => onPrefetchCard(card)}
                  onPress={() => onOpenCard(card)}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      minHeight: tallCardHeight,
                      overflow: "hidden",
                      width: columnCardWidth,
                    },
                  ]}
                >
                  <View
                    style={{
                      backgroundColor: palette.surfaceRaised,
                      height: cardImageHeight,
                      overflow: "hidden",
                      width: "100%",
                    }}
                  >
                    <AccessibleImage
                      source={card.imageSource}
                      style={{ height: "100%", width: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      decorative
                    />
                    {openLabel ? (
                      <View
                        style={{
                          backgroundColor: palette.imageLabelSurface,
                          borderColor: palette.imageLabelBorder,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          left: spacing[2],
                          paddingHorizontal: spacing[1.5],
                          paddingVertical: spacing[0.5],
                          position: "absolute",
                          top: spacing[2],
                        }}
                      >
                        <AppText
                          variant="micro"
                          style={{ color: palette.textOnDark, fontWeight: "900" }}
                        >
                          {openLabel.startsWith("Open") ? "Open" : "Closed"}
                        </AppText>
                      </View>
                    ) : null}
                    {card.heroDish.reviewCount > 0 ? (
                      <View
                        style={{
                          alignItems: "center",
                          backgroundColor: palette.imageLabelSurface,
                          borderColor: palette.imageLabelBorder,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          bottom: spacing[2],
                          flexDirection: "row",
                          gap: spacing[0.5],
                          paddingHorizontal: spacing[1.5],
                          paddingVertical: spacing[0.5],
                          position: "absolute",
                          right: spacing[2],
                        }}
                      >
                        <Star color={palette.starStroke} size={11} fill={palette.starFill} />
                        <AppText
                          variant="micro"
                          style={{ color: palette.textOnDark, fontWeight: "900" }}
                        >
                          {card.heroDish.rating.toFixed(1)}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      gap: spacing[0.5],
                      justifyContent: "center",
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[0.5],
                    }}
                  >
                    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
                      <View
                        style={{
                          alignItems: "center",
                          flex: 1,
                          flexDirection: "row",
                          gap: spacing[1],
                        }}
                      >
                        <AppText
                          variant="bodySmall"
                          numberOfLines={1}
                          style={{ color: palette.text, flex: 1, fontWeight: "900" }}
                        >
                          {card.venue.name}
                        </AppText>
                        <AppText
                          variant="micro"
                          numberOfLines={1}
                          style={{ color: palette.textSecondary, flexShrink: 1, maxWidth: "55%" }}
                        >
                          {[stallBuildingLabel(card.venue), card.venue.unitNumber]
                            .filter(Boolean)
                            .join(" · ")}
                        </AppText>
                      </View>
                      <ChevronRight color={palette.textMuted} size={16} />
                    </View>
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <AppText
                        variant="bodySmall"
                        numberOfLines={1}
                        style={{ color: palette.text, flex: 1, fontWeight: "800" }}
                      >
                        {card.heroDish.name}
                      </AppText>
                      {card.heroDish.price > 0 ? (
                        <AppText
                          variant="price"
                          style={{
                            color: palette.text,
                            fontSize: typography.bodySmallBold.fontSize,
                            fontWeight: "800",
                            lineHeight: typography.bodySmallBold.lineHeight,
                            marginLeft: spacing[1],
                          }}
                        >
                          S${card.heroDish.price.toFixed(2)}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
