import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { AppSymbol, AppText, PressableScale } from "@/components/ui";
import { DiscoverFoodRailLoadingSkeleton } from "@/components/discover/home/DiscoverLoadingSkeletons";
import { DiscoverBiteImage } from "@/components/discover/home/DiscoverImages";
import { useDiscoverCardChrome } from "@/components/discover/home/homeCardChrome";
import {
  DISCOVER_TEXT_LINK_HIT_SLOP,
  HOME_PRICE_STYLE,
  type DiscoverBiteCardVariant,
  type DiscoverRailLayout,
} from "@/components/discover/home/homeLayout";
import type { DiscoverCollection } from "@/features/discover/bites";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

export function DiscoverRailBadge({
  label,
  showStar = false,
  tone,
}: {
  label: string;
  /** Draws a filled star before the label, in the label's colour. */
  showStar?: boolean;
  tone: "accent" | "success";
}) {
  const { colorScheme, palette, radii, spacing } = useHungryTheme();
  const isAccent = tone === "accent";
  const labelColor = isAccent
    ? palette.textOnOrange
    : colorScheme === "dark"
      ? palette.textOnOrange
      : palette.white;
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: isAccent ? palette.orange : palette.success,
        borderRadius: radii.sm,
        flexDirection: "row",
        gap: spacing[0.5],
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[0.5],
      }}
    >
      {showStar ? <AppSymbol name="rating" size={11} color={labelColor} /> : null}
      <AppText variant="micro" style={{ color: labelColor, fontWeight: "800" }}>
        {label}
      </AppText>
    </View>
  );
}

/** One dish card, shared by every rail. A rating shows only when reviews stand behind it. */
const DiscoverBiteCard = memo(function DiscoverBiteCard({
  bite,
  reason,
  buttonId,
  cardWidth,
  getCardLabel,
  imageHeight,
  onOpen,
  onPrefetch,
  variant,
}: {
  bite: Bite;
  buttonId: string;
  cardWidth: number;
  getCardLabel: (bite: Bite) => string;
  imageHeight: number;
  onOpen: (bite: Bite, buttonId: string) => void;
  onPrefetch: (bite: Bite) => void;
  /** Why this dish suits the diner ("Spicy, the way you like it"); only palate-ordered rails pass it. */
  reason?: string;
  variant: DiscoverBiteCardVariant;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const chrome = useDiscoverCardChrome();
  const hasRating = bite.cravingCount > 0 && bite.rating > 0;
  const handlePressIn = useCallback(() => onPrefetch(bite), [bite, onPrefetch]);
  const handlePress = useCallback(() => onOpen(bite, buttonId), [bite, buttonId, onOpen]);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={getCardLabel(bite)}
      onPressIn={handlePressIn}
      onPress={handlePress}
      style={chrome.biteCardShell(cardWidth)}
    >
      <DiscoverBiteImage bite={bite} height={imageHeight} />
      {/* Rating badge overlay: the rail is rating-based, not curated */}
      {variant === "topRated" && hasRating ? (
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orange,
            borderRadius: radii.sm,
            flexDirection: "row",
            gap: spacing[0.5],
            left: spacing[2],
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[0.5],
            position: "absolute",
            top: spacing[2],
          }}
        >
          <AppSymbol name="rating" size={11} color={palette.textOnOrange} />
          <AppText variant="micro" style={{ color: palette.textOnOrange, fontWeight: "800" }}>
            {bite.rating.toFixed(1)}
          </AppText>
        </View>
      ) : null}
      <View style={chrome.biteCardBody}>
        <AppText variant="bodySmallBold" numberOfLines={1} style={{ color: palette.text }}>
          {bite.dishName}
        </AppText>
        <AppText variant="micro" style={{ color: palette.textSecondary }} numberOfLines={1}>
          {bite.venueName}
        </AppText>
        {reason ? (
          <AppText variant="micro" tone="accent" numberOfLines={1}>
            {reason}
          </AppText>
        ) : null}
        <View style={chrome.biteCardPriceRow}>
          <AppText variant="bodySmallBold" style={{ color: palette.text, ...HOME_PRICE_STYLE }}>
            S${bite.price.toFixed(2)}
          </AppText>
          {variant !== "price" && hasRating ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
              <AppSymbol name="rating" size={12} color={palette.starFill} />
              <AppText variant="micro" style={{ color: palette.text, fontWeight: "700" }}>
                {bite.rating.toFixed(1)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});

/** A titled horizontal rail of dish cards whose title opens the full list, with a loading state and a filter-empty state. */
export const DiscoverBiteRail = memo(function DiscoverBiteRail({
  buttonId,
  canSeeAll,
  cards,
  getCardLabel,
  isLoading,
  isVisible,
  layout,
  onOpenBite,
  onPrefetchBite,
  onPrefetchCollection,
  onSeeAll,
  rail,
  reasons,
  seeAllLabel,
  title,
  titleBadge,
  variant,
}: {
  buttonId: string;
  /** False when the full-list screen is not registered in this build (release-01 core only). */
  canSeeAll: boolean;
  cards: Bite[];
  getCardLabel: (bite: Bite) => string;
  isLoading: boolean;
  /** Home is on screen (not a tab warm-up), so an impression is real. */
  isVisible: boolean;
  layout: DiscoverRailLayout;
  onOpenBite: (bite: Bite, buttonId: string) => void;
  onPrefetchBite: (bite: Bite) => void;
  onPrefetchCollection: (collection: DiscoverCollection) => void;
  onSeeAll: (collection: DiscoverCollection) => void;
  rail: DiscoverCollection;
  /** Reason line per dish id, for a palate-ordered rail. */
  reasons?: ReadonlyMap<string, string>;
  seeAllLabel: string;
  title: string;
  titleBadge?: ReactNode;
  variant: DiscoverBiteCardVariant;
}) {
  const { palette, spacing } = useHungryTheme();
  const impressionSentRef = useRef(false);
  const scrollStyle = useMemo(() => ({ width: layout.screenWidth }), [layout.screenWidth]);

  // Once per visit, when the rail first shows dishes on screen (not on every filter change).
  // Leaving Home ends the visit, so coming back counts again.
  useEffect(() => {
    if (!isVisible) {
      impressionSentRef.current = false;
      return;
    }
    if (isLoading || cards.length === 0 || impressionSentRef.current) return;
    impressionSentRef.current = true;
    trackAnalyticsEvent("discover_rail_impression", {
      surface: "home",
      rail,
      count: cards.length,
    });
  }, [cards.length, isLoading, isVisible, rail]);
  const handleOpenBite = useCallback(
    (bite: Bite, cardButtonId: string) => {
      trackAnalyticsEvent("discover_card_opened", {
        surface: "home",
        rail,
        kind: "dish",
        position: Math.max(
          0,
          cards.findIndex((card) => card.id === bite.id),
        ),
      });
      onOpenBite(bite, cardButtonId);
    },
    [cards, onOpenBite, rail],
  );
  const titleRow = (
    <>
      <AppText variant="h2" style={{ color: palette.text, flexShrink: 1 }}>
        {title}
      </AppText>
      {titleBadge}
    </>
  );

  return (
    <View style={{ gap: layout.contentGap }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        {canSeeAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={seeAllLabel}
            hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
            onPressIn={() => onPrefetchCollection(rail)}
            onPress={() => onSeeAll(rail)}
            style={{
              alignItems: "center",
              flex: 1,
              flexDirection: "row",
              gap: spacing[2],
              minHeight: 44,
            }}
          >
            {titleRow}
            <ChevronRight color={palette.textMuted} size={20} />
          </Pressable>
        ) : (
          <View
            style={{
              alignItems: "center",
              flex: 1,
              flexDirection: "row",
              gap: spacing[2],
              minHeight: 44,
            }}
          >
            {titleRow}
          </View>
        )}
      </View>
      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={scrollStyle}
          contentContainerStyle={{ gap: spacing[4] }}
        >
          <DiscoverFoodRailLoadingSkeleton
            cardWidth={layout.cardWidth}
            imageHeight={layout.imageHeight}
            withReason={reasons !== undefined}
          />
        </ScrollView>
      ) : cards.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={scrollStyle}
          contentContainerStyle={{ gap: spacing[4] }}
        >
          {cards.map((bite) => (
            <DiscoverBiteCard
              key={`${rail}-${bite.id}`}
              bite={bite}
              buttonId={buttonId}
              cardWidth={layout.cardWidth}
              getCardLabel={getCardLabel}
              imageHeight={layout.imageHeight}
              onOpen={handleOpenBite}
              onPrefetch={onPrefetchBite}
              reason={reasons?.get(bite.dishId)}
              variant={variant}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
});
