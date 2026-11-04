import { useMemo } from "react";
import { View } from "react-native";

import { StallLogoMark } from "@/components/stall/StallLogoMark";
import { AccessibleImage, AppSymbol, AppText, PressableScale } from "@/components/ui";
import {
  STALL_SHOWCASE_CARD_LIMIT,
  type DiscoverStallShowcaseCard,
} from "@/features/discover/stallShowcase";
import { getStallRowOpenLabel } from "@/features/discover/homeStalls";
import { useHungryTheme } from "@/theme";

/**
 * The grid's measurements: two columns, three rows to a page. The cards and the loading skeleton
 * both take their sizes from here, so the placeholder fills the same rows the cards will.
 */
export function useStallShowcaseMetrics({
  cardWidth,
  pageHeight,
}: {
  cardWidth: number;
  pageHeight: number;
}) {
  const { spacing, typography } = useHungryTheme();
  const columnGap = spacing[2];
  const rowGap = spacing[1.5];
  const columnCardWidth = (cardWidth - columnGap) / 2;
  const headingReserveHeight = typography.h2.lineHeight + spacing[3];
  const showcaseViewportHeight = Math.max(0, pageHeight - headingReserveHeight);
  const availableRowHeight = (showcaseViewportHeight - rowGap * 2) / 3;
  const maxTallCardHeight = columnCardWidth * 1.1;
  const tallCardHeight = Math.max(0, Math.floor(Math.min(availableRowHeight, maxTallCardHeight)));
  // Dish name (up to two lines), then the stall and price on one line.
  const compactCardDetailsHeight =
    typography.bodySmallBold.lineHeight * 2 +
    typography.micro.lineHeight +
    spacing[0.5] +
    spacing[1];
  const cardImageHeight = Math.max(0, Math.floor(tallCardHeight - compactCardDetailsHeight));
  return { cardImageHeight, columnCardWidth, columnGap, rowGap, tallCardHeight };
}

/** The frame of one stall card in the grid (the photo and text go inside it). */
export function useStallShowcaseCardFrame(columnCardWidth: number, tallCardHeight: number) {
  const { componentRadii, palette, shadows } = useHungryTheme();
  return [
    shadows.card,
    {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderRadius: componentRadii.card,
      borderWidth: 1,
      minHeight: tallCardHeight,
      overflow: "hidden" as const,
      width: columnCardWidth,
    },
  ];
}

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
  const { palette, radii, spacing } = useHungryTheme();
  const visibleCards = useMemo(() => cards.slice(0, STALL_SHOWCASE_CARD_LIMIT), [cards]);
  const { cardImageHeight, columnCardWidth, columnGap, rowGap, tallCardHeight } =
    useStallShowcaseMetrics({ cardWidth, pageHeight });
  const cardFrame = useStallShowcaseCardFrame(columnCardWidth, tallCardHeight);
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
                <PressableScale
                  key={card.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${card.venue.name} details`}
                  onPressIn={() => onPrefetchCard(card)}
                  onPress={() => onOpenCard(card)}
                  style={cardFrame}
                >
                  <View
                    style={{
                      backgroundColor: palette.surfaceRaised,
                      height: cardImageHeight,
                      overflow: "hidden",
                      width: "100%",
                    }}
                  >
                    {card.imageSource ? (
                      <AccessibleImage
                        source={card.imageSource}
                        style={{ height: "100%", width: "100%" }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                        decorative
                      />
                    ) : (
                      // No photo of this stall's food yet: its logo, never a picture of another dish.
                      <View
                        style={{
                          alignItems: "center",
                          flex: 1,
                          justifyContent: "center",
                        }}
                      >
                        <StallLogoMark
                          borderWidth={2}
                          logoUrl={card.venue.logoUrl}
                          name={card.venue.name}
                          size={Math.min(64, Math.max(40, cardImageHeight - spacing[8]))}
                        />
                      </View>
                    )}
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
                        <AppSymbol name="rating" size={11} color={palette.starFill} />
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
                    <AppText
                      variant="bodySmallBold"
                      numberOfLines={2}
                      style={{ color: palette.text }}
                    >
                      {card.heroDish.name}
                    </AppText>
                    <View style={{ alignItems: "center", flexDirection: "row" }}>
                      <AppText
                        variant="micro"
                        numberOfLines={1}
                        style={{ color: palette.textSecondary, flexShrink: 1 }}
                      >
                        {card.venue.name}
                      </AppText>
                      {card.heroDish.price > 0 ? (
                        <AppText
                          variant="micro"
                          style={{
                            color: palette.textSecondary,
                            flexShrink: 0,
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {` · S$${card.heroDish.price.toFixed(2)}`}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
