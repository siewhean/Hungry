import { View } from "react-native";

import { AppText, Skeleton, SkeletonText } from "@/components/ui";
import { useDiscoverCardChrome } from "@/components/discover/home/homeCardChrome";
import {
  FOOD_STYLE_ITEM_WIDTH,
  STALL_ROW_CHEVRON_SIZE,
  STALL_ROW_THUMBNAIL_SIZE,
  getFoodStyleButtonMetrics,
} from "@/components/discover/home/homeLayout";
import {
  useStallShowcaseCardFrame,
  useStallShowcaseMetrics,
} from "@/components/discover/home/VerticalStallShowcaseSection";
import { useHungryTheme } from "@/theme";

// Every skeleton below is built from the same sizes, frames and text line heights as the card it
// stands in for (homeLayout, homeCardChrome, the showcase metrics, AppText's line heights), so the
// page keeps its shape when the real content arrives.

/** The popular-food buttons: a round bowl with a two-line label under it. */
export function PopularFoodStyleSkeleton() {
  const theme = useHungryTheme();
  const { palette, radii, shadows, spacing } = theme;
  const { bowlSize, buttonHeight, labelGap, labelLineHeight } = getFoodStyleButtonMetrics(theme);

  return (
    <>
      {[0, 1, 2, 3].map((slot) => (
        <View
          key={`popular-food-loading-${slot}`}
          style={{ alignItems: "center", height: buttonHeight, width: FOOD_STYLE_ITEM_WIDTH }}
        >
          {/* The bowl keeps its ring and shadow; the picture fills it, as the real one does. */}
          <View
            style={[
              shadows.card,
              {
                backgroundColor: palette.surfaceRaised,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                height: bowlSize,
                overflow: "hidden",
                width: bowlSize,
              },
            ]}
          >
            <Skeleton width="100%" height="100%" borderRadius={radii.pill} />
          </View>
          {/* The label reserves two lines of text, whatever the name needs. */}
          <View
            style={{ alignItems: "center", marginTop: labelGap, minHeight: labelLineHeight * 2 }}
          >
            {[70, 54].map((lineWidth) => (
              <View key={lineWidth} style={{ height: labelLineHeight, justifyContent: "center" }}>
                <Skeleton width={lineWidth} height={spacing[3]} borderRadius={radii.sm} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

/** A rail of dish cards: photo, dish name, stall, then price and rating. */
export function DiscoverFoodRailLoadingSkeleton({
  cardWidth,
  imageHeight,
  withReason = false,
}: {
  cardWidth: number;
  imageHeight: number;
  /** The palate rail adds a "why this suits you" line under the stall name. */
  withReason?: boolean;
}) {
  const chrome = useDiscoverCardChrome();

  return (
    <>
      {[0, 1, 2].map((slot) => (
        <View key={`discover-food-rail-loading-${slot}`} style={chrome.biteCardShell(cardWidth)}>
          <Skeleton width="100%" height={imageHeight} borderRadius={0} />
          <View style={chrome.biteCardBody}>
            <SkeletonText variant="bodySmallBold" width="82%" />
            <SkeletonText variant="micro" width="58%" />
            {withReason ? <SkeletonText variant="micro" width="70%" /> : null}
            <View style={chrome.biteCardPriceRow}>
              <SkeletonText variant="bodySmallBold" width={54} />
              <SkeletonText variant="micro" width={44} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

/**
 * The "Stalls near you" rows: round logo, stall name, hours, building and menu line, chevron. Most
 * stalls have no dishes yet, so the rows are drawn with the full four lines.
 */
export function DiscoverStallListLoadingSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  const { radii } = useHungryTheme();
  const chrome = useDiscoverCardChrome();

  return (
    <>
      {Array.from({ length: rowCount }, (_, slot) => (
        <View key={`discover-stall-list-loading-${slot}`} style={chrome.stallRowShell}>
          <Skeleton
            width={STALL_ROW_THUMBNAIL_SIZE}
            height={STALL_ROW_THUMBNAIL_SIZE}
            borderRadius={radii.pill}
          />
          <View style={chrome.stallRowText}>
            <SkeletonText variant="bodySmall" width="72%" />
            <SkeletonText variant="micro" width="48%" />
            <SkeletonText variant="micro" width="60%" />
            <SkeletonText variant="micro" width="38%" />
          </View>
          <Skeleton
            width={STALL_ROW_CHEVRON_SIZE}
            height={STALL_ROW_CHEVRON_SIZE}
            borderRadius={radii.sm}
          />
        </View>
      ))}
    </>
  );
}

/** "More near you": the two-column stall grid, one page of rows (three), under its real title. */
export function VerticalStallShowcaseLoadingSkeleton({
  areaPhrase,
  cardWidth,
  pageHeight,
}: {
  areaPhrase: string;
  cardWidth: number;
  pageHeight: number;
}) {
  const { palette, spacing } = useHungryTheme();
  const { cardImageHeight, columnCardWidth, columnGap, rowGap, tallCardHeight } =
    useStallShowcaseMetrics({ cardWidth, pageHeight });
  const cardFrame = useStallShowcaseCardFrame(columnCardWidth, tallCardHeight);

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="h2" numberOfLines={1} style={{ color: palette.text, flex: 1 }}>
          More {areaPhrase}
        </AppText>
        <SkeletonText variant="micro" width={48} style={{ marginLeft: spacing[2] }} />
      </View>
      <View style={{ gap: rowGap, width: cardWidth }}>
        {[0, 1, 2].map((row) => (
          <View
            key={`stall-showcase-loading-row-${row}`}
            style={{
              flexDirection: "row",
              gap: columnGap,
              minHeight: tallCardHeight,
              width: cardWidth,
            }}
          >
            {[0, 1].map((column) => (
              <View key={`stall-showcase-loading-${row}-${column}`} style={cardFrame}>
                <Skeleton width="100%" height={cardImageHeight} borderRadius={0} />
                <View
                  style={{
                    flex: 1,
                    gap: spacing[0.5],
                    justifyContent: "center",
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[0.5],
                  }}
                >
                  <SkeletonText variant="bodySmallBold" width="85%" />
                  <SkeletonText variant="micro" width="60%" />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
