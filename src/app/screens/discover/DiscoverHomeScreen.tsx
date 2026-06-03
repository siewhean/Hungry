import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronRight,
  Compass,
  MapPinned,
  Search,
  SearchX,
  Shuffle,
  Star,
  Flame,
  Dices,
  Utensils,
  Zap,
} from "lucide-react-native";
import { useNavigation, useRoute, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  EmptyState,
  FilterChipRail,
  IconButton,
  Screen,
  Skeleton,
} from "@/components/ui";
import { getDiscoverBiteCollections, getDiscoverBites } from "@/features/discover/bites";
import {
  prefetchDishDetail,
  prefetchBrowseResults,
  prefetchImages,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getNearestBuildings, getNearestSingaporeArea } from "@/lib/geo/singaporeBuildings";
import { toRecommendationGeoCell } from "@/lib/geo/recommendationGeoCell";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { Bite, DataRepository } from "@/lib/services/types";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useMovingSearchPlaceholder } from "@/features/search/useMovingSearchPlaceholder";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, DishDetail, SearchCategory, VenueSummary } from "@/types/domain";
import { isVenueOpenFromHours } from "@/utils/stallStatus";

type DiscoverChipId = "dietary" | "spicy" | "halal" | "late" | "cheap";

const INTENT_CHIPS: readonly {
  id: Exclude<DiscoverChipId, "dietary">;
  label: string;
  category: SearchCategory;
}[] = [
  { id: "spicy", label: "Spicy", category: "local favourites" },
  { id: "halal", label: "Halal", category: "rice" },
  { id: "late", label: "Late night", category: "late night" },
  { id: "cheap", label: "Value", category: "noodles" },
] as const;

const DISCOVER_DIETARY_FALLBACKS: readonly DietaryFlag[] = ["halal", "vegetarian", "pork_free"];

const STALLS_CARD_GRAPHIC = require("../../../assets/discover/stalls-restaurants-card-wide.png");
const DISHES_CARD_GRAPHIC = require("../../../assets/discover/dishes-card-wide.png");
const POPULAR_LAKSA_GRAPHIC = require("../../../assets/discover/popular-laksa-topdown.png");
const POPULAR_CHICKEN_RICE_GRAPHIC = require("../../../assets/discover/popular-chicken-rice-topdown.png");
const POPULAR_CHAR_KWAY_TEOW_GRAPHIC = require("../../../assets/discover/popular-char-kway-teow-topdown.png");
const POPULAR_BAK_CHOR_MEE_GRAPHIC = require("../../../assets/discover/popular-bak-chor-mee-topdown.png");

type PopularFoodStyle = {
  id: string;
  label: string;
  query: string;
  dishId?: string;
  imageSource?: number;
  fallbackImageUrl?: string;
  trending?: boolean;
};

type PopularFoodStyleItemData = PopularFoodStyle & {
  dish: DishDetail | undefined;
  imageSource: string | number;
  imageUrl: string | undefined;
};

type DiscoverStallShowcaseCard = {
  id: string;
  venue: VenueSummary;
  heroDish: DishDetail;
  imageSource: string | number;
  products: DishDetail[];
};

const STALL_SHOWCASE_CARD_LIMIT = 30;
const STALL_SHOWCASE_IMAGE_REPEAT_BUFFER = 2;
const DISCOVER_AREA_RADIUS_METERS = 3000;
const STALL_SHOWCASE_FALLBACK_IMAGES = [
  POPULAR_LAKSA_GRAPHIC,
  POPULAR_CHICKEN_RICE_GRAPHIC,
  POPULAR_CHAR_KWAY_TEOW_GRAPHIC,
  POPULAR_BAK_CHOR_MEE_GRAPHIC,
] as const;

function buildStallShowcaseCardsFromVenues(
  venues: VenueSummary[],
  repository: DataRepository,
): DiscoverStallShowcaseCard[] {
  const uniqueVenues = Array.from(new Map(venues.map((venue) => [venue.id, venue])).values());

  return uniqueVenues.flatMap((venue) => {
    const venueDishes = repository.listDishesByVenue(venue.id);
    const topDish = repository.getDishById(venue.topDishId);
    const heroCandidates = [
      ...(topDish ? [topDish] : []),
      ...venueDishes.filter((dish) => dish.id !== topDish?.id),
    ];

    return heroCandidates.map((heroDish, heroIndex) => {
      const products = [heroDish, ...venueDishes.filter((dish) => dish.id !== heroDish.id)].slice(
        0,
        4,
      );

      return {
        id: `${venue.id}-${heroDish.id}-${heroIndex}`,
        venue,
        heroDish,
        imageSource:
          heroDish.imageUrl ||
          STALL_SHOWCASE_FALLBACK_IMAGES[heroIndex % STALL_SHOWCASE_FALLBACK_IMAGES.length],
        products,
      };
    });
  });
}

function extendStallShowcaseCards(
  cards: DiscoverStallShowcaseCard[],
  limit = STALL_SHOWCASE_CARD_LIMIT,
) {
  if (!cards.length) {
    return [];
  }

  if (cards.length >= limit) {
    return cards.slice(0, limit);
  }

  return Array.from({ length: limit }, (_, index) => cards[index % cards.length]);
}

function getStallShowcaseImageSources(card: DiscoverStallShowcaseCard) {
  const sources = [
    card.imageSource,
    ...card.products
      .map((product) => product.imageUrl)
      .filter((imageUrl): imageUrl is string => Boolean(imageUrl)),
  ];
  const uniqueSources = new Map<string, string | number>();

  sources.forEach((source) => {
    uniqueSources.set(String(source), source);
  });

  return Array.from(uniqueSources.values());
}

function buildLoopingStallShowcaseImageSources(
  card: DiscoverStallShowcaseCard,
  minimumFrameCount: number,
) {
  const sources = getStallShowcaseImageSources(card);

  return Array.from(
    { length: Math.max(minimumFrameCount, sources.length) },
    (_, index) => sources[index % sources.length],
  );
}

const POPULAR_FOOD_STYLES: readonly PopularFoodStyle[] = [
  {
    id: "laksa",
    label: "Laksa",
    query: "Laksa",
    dishId: "dish-laksa",
    imageSource: POPULAR_LAKSA_GRAPHIC,
    trending: true,
  },
  {
    id: "chicken-rice",
    label: "Chicken Rice",
    query: "Chicken Rice",
    dishId: "dish-chicken-rice",
    imageSource: POPULAR_CHICKEN_RICE_GRAPHIC,
  },
  {
    id: "char-kway-teow",
    label: "Char Kway Teow",
    query: "Char Kway Teow",
    imageSource: POPULAR_CHAR_KWAY_TEOW_GRAPHIC,
    trending: true,
  },
  {
    id: "bak-chor-mee",
    label: "Bak Chor Mee",
    query: "Bak Chor Mee",
    imageSource: POPULAR_BAK_CHOR_MEE_GRAPHIC,
  },
] as const;
const SEARCH_PLACEHOLDER_DEFAULT = "Dishes, stalls, or hawker centres…";
const DISCOVER_SEARCH_PLACEHOLDER_PHRASES = [
  SEARCH_PLACEHOLDER_DEFAULT,
  "Try laksa nearby",
  "Search for mee pok",
  "What's near you?",
] as const;

function DiscoverSearchPlaceholder() {
  const { palette, typography } = useHungryTheme();
  const movingSearchPlaceholder = useMovingSearchPlaceholder({
    phrases: DISCOVER_SEARCH_PLACEHOLDER_PHRASES,
    tickMs: 55,
    revealStepMs: 55,
    deleteStepMs: 55,
    pauseMs: 950,
    totalCycleMs: 6200,
  });

  return (
    <TextInput
      editable={false}
      value=""
      placeholder={movingSearchPlaceholder}
      placeholderTextColor={palette.textSecondary}
      pointerEvents="none"
      style={{
        color: palette.text,
        flex: 1,
        height: 48,
        padding: 0,
        paddingTop: 0,
        paddingBottom: 0,
        includeFontPadding: false,
        ...typography.body,
        textAlignVertical: "center",
      }}
    />
  );
}

const POPULAR_FOOD_FILTER_SKELETON_MIN_MS = 1200;
type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Discover">,
  NativeStackNavigationProp<RootStackParamList>
>;

function DiscoverSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  return (
    <View style={{ gap: spacing[6], padding: spacing[4] }}>
      <Skeleton width="40%" height={24} />
      <Skeleton width="100%" height={56} borderRadius={radii.lg} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width={140} height={120} borderRadius={radii.lg} />
        <Skeleton width={140} height={120} borderRadius={radii.lg} />
      </View>
      <View style={{ gap: spacing[4] }}>
        <Skeleton width="60%" height={28} />
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <Skeleton width={200} height={280} borderRadius={radii.xl} />
          <Skeleton width={200} height={280} borderRadius={radii.xl} />
        </View>
      </View>
    </View>
  );
}

function FoodStyleButton({
  imageSource,
  label,
  trending,
  onPressIn,
  onPress,
}: {
  imageSource: string | number;
  label: string;
  trending?: boolean;
  onPressIn?: () => void;
  onPress: () => void;
}) {
  const { palette, radii, spacing, shadows, typography } = useHungryTheme();
  const bowlSize = 72;
  const labelGap = spacing[1.5];
  const labelLineHeight = typography.bodySmallBold.fontSize + spacing[1];
  const buttonHeight = bowlSize + labelGap + labelLineHeight * 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search for ${label}`}
      onPressIn={onPressIn}
      onPress={onPress}
      style={{ alignItems: "center", height: buttonHeight, width: 88 }}
    >
      <View
        style={[
          shadows.card,
          {
            width: bowlSize,
            height: bowlSize,
            borderRadius: radii.pill,
            borderWidth: trending ? 3 : 1,
            borderColor: trending ? palette.orange : palette.border,
            backgroundColor: palette.surfaceRaised,
            overflow: "hidden",
          },
        ]}
      >
        <AccessibleImage
          source={typeof imageSource === "string" ? { uri: imageSource } : imageSource}
          style={{ width: "100%", height: "100%", borderRadius: radii.pill }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          decorative
        />
      </View>
      <AppText
        variant="bodySmallBold"
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.84}
        style={{
          color: palette.text,
          lineHeight: labelLineHeight,
          marginTop: labelGap,
          minHeight: labelLineHeight * 2,
          textAlign: "center",
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const MemoFoodStyleButton = memo(FoodStyleButton);

const PopularFoodStyleItem = memo(function PopularFoodStyleItem({
  item,
  onPress,
  onPrefetch,
}: {
  item: PopularFoodStyleItemData;
  onPress: (item: PopularFoodStyleItemData) => void;
  onPrefetch: (item: PopularFoodStyleItemData) => void;
}) {
  const handlePressIn = useCallback(() => {
    onPrefetch(item);
  }, [item, onPrefetch]);
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <MemoFoodStyleButton
      imageSource={item.imageSource}
      label={item.label}
      trending={item.trending}
      onPressIn={handlePressIn}
      onPress={handlePress}
    />
  );
});

function PopularFoodStyleSkeleton() {
  const { palette, radii, spacing, shadows, typography } = useHungryTheme();
  const bowlSize = 72;
  const labelGap = spacing[1.5];
  const labelLineHeight = typography.bodySmallBold.fontSize + spacing[1];
  const buttonHeight = bowlSize + labelGap + labelLineHeight * 2;

  return (
    <>
      {[0, 1, 2, 3].map((slot) => (
        <View
          key={`popular-food-loading-${slot}`}
          style={{ alignItems: "center", height: buttonHeight, width: 88 }}
        >
          <View
            style={[
              shadows.card,
              {
                alignItems: "center",
                backgroundColor: palette.surfaceRaised,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                height: bowlSize,
                justifyContent: "center",
                width: bowlSize,
              },
            ]}
          >
            <Skeleton width={bowlSize - 10} height={bowlSize - 10} borderRadius={radii.pill} />
          </View>
          <View
            style={{
              gap: spacing[1],
              marginTop: labelGap,
              minHeight: labelLineHeight * 2,
            }}
          >
            <Skeleton width={70} height={14} borderRadius={radii.sm} />
            <Skeleton width={54} height={14} borderRadius={radii.sm} />
          </View>
        </View>
      ))}
    </>
  );
}

function DiscoverFoodRailLoadingSkeleton({
  cardWidth,
  imageHeight,
}: {
  cardWidth: number;
  imageHeight: number;
}) {
  const { colorScheme, componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const isDark = colorScheme === "dark";

  return (
    <>
      {[0, 1, 2].map((slot) => (
        <View
          key={`discover-food-rail-loading-${slot}`}
          style={[
            shadows.card,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: isDark ? 0 : 1,
              overflow: "hidden",
              width: cardWidth,
            },
          ]}
        >
          <Skeleton width="100%" height={imageHeight} borderRadius={0} />
          <View style={{ gap: spacing[1.5], padding: spacing[3] }}>
            <Skeleton width="82%" height={16} borderRadius={radii.sm} />
            <Skeleton width="58%" height={12} borderRadius={radii.sm} />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: spacing[1],
              }}
            >
              <Skeleton width={54} height={16} borderRadius={radii.sm} />
              <Skeleton width={44} height={14} borderRadius={radii.sm} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

function DiscoverStallListLoadingSkeleton({ rowCount = 3 }: { rowCount?: number }) {
  const { colorScheme, componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const isDark = colorScheme === "dark";

  return (
    <>
      {Array.from({ length: rowCount }, (_, slot) => (
        <View
          key={`discover-stall-list-loading-${slot}`}
          style={[
            shadows.card,
            {
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: componentRadii.card,
              borderWidth: isDark ? 0 : 1,
              flexDirection: "row",
              gap: spacing[3],
              padding: spacing[3],
            },
          ]}
        >
          <Skeleton width={56} height={56} borderRadius={radii.pill} />
          <View style={{ flex: 1, gap: spacing[1.5] }}>
            <Skeleton width="72%" height={16} borderRadius={radii.sm} />
            <Skeleton width="48%" height={12} borderRadius={radii.sm} />
          </View>
          <Skeleton width={20} height={20} borderRadius={radii.pill} />
        </View>
      ))}
    </>
  );
}

function FilteredResultsEmptyState({
  preserveHeight,
  minHeight,
}: {
  preserveHeight?: boolean;
  minHeight?: number;
}) {
  const { palette } = useHungryTheme();
  return (
    <View
      style={
        preserveHeight && minHeight
          ? {
              alignItems: "center",
              minHeight,
              height: minHeight,
              justifyContent: "center",
              paddingTop: 0,
              paddingBottom: 0,
              overflow: "hidden",
            }
          : undefined
      }
    >
      <EmptyState
        title="No matching results"
        body="Try again later."
        icon={<SearchX color={palette.textSecondary} size={28} />}
      />
    </View>
  );
}

function NoFoodSectionEmptyState({
  title,
  preserveHeight,
  minHeight,
}: {
  title: string;
  preserveHeight?: boolean;
  minHeight?: number;
}) {
  const { palette } = useHungryTheme();
  return (
    <View
      style={
        preserveHeight && minHeight
          ? {
              alignItems: "center",
              minHeight,
              height: minHeight,
              justifyContent: "center",
              paddingTop: 0,
              paddingBottom: 0,
              overflow: "hidden",
            }
          : undefined
      }
    >
      <EmptyState
        title={title}
        body="Try again later."
        icon={<SearchX color={palette.textSecondary} size={28} />}
      />
    </View>
  );
}

function VerticalStallShowcaseSection({
  cards,
  locationLabel,
  pageHeight,
  cardWidth,
  scrollY,
  onOpenCard,
  onPrefetchCard,
  onGestureStart,
  onGestureEnd,
  onTopBoundaryPull,
  onRequestSectionFocus,
  onSectionLayout,
}: {
  cards: DiscoverStallShowcaseCard[];
  locationLabel: string;
  pageHeight: number;
  cardWidth: number;
  scrollY: Animated.Value;
  onOpenCard: (card: DiscoverStallShowcaseCard) => void;
  onPrefetchCard: (card: DiscoverStallShowcaseCard) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onTopBoundaryPull: (deltaY: number) => void;
  onRequestSectionFocus: () => void;
  onSectionLayout: (event: LayoutChangeEvent) => void;
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
  const rowSnapInterval = tallCardHeight + rowGap;
  const showcaseRows = useMemo(() => {
    const rows: DiscoverStallShowcaseCard[][] = [];
    for (let index = 0; index < visibleCards.length; index += 2) {
      rows.push(visibleCards.slice(index, index + 2));
    }
    return rows;
  }, [visibleCards]);
  const cardImageHeight = Math.max(0, Math.floor(tallCardHeight - compactCardDetailsHeight));
  const contentTravel = columnCardWidth;
  const showcaseKey = useMemo(
    () => visibleCards.map((card, index) => `${card.id}-${index}`).join("|"),
    [visibleCards],
  );
  const showcaseScrollOffsetRef = useRef(0);
  const isParentScrollLockedRef = useRef(false);
  const lastTouchYRef = useRef<number | null>(null);
  const updateParentScrollLock = useCallback(
    (isLocked: boolean) => {
      if (isParentScrollLockedRef.current === isLocked) {
        return;
      }

      isParentScrollLockedRef.current = isLocked;
      if (isLocked) {
        onGestureStart();
        return;
      }

      onGestureEnd();
    },
    [onGestureEnd, onGestureStart],
  );
  const handleShowcaseGestureStart = useCallback(() => {
    onRequestSectionFocus();
    updateParentScrollLock(true);
  }, [onRequestSectionFocus, updateParentScrollLock]);
  const handleShowcaseGestureEnd = useCallback(() => {
    lastTouchYRef.current = null;
    updateParentScrollLock(false);
  }, [updateParentScrollLock]);
  const handleShowcaseTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      lastTouchYRef.current = event.nativeEvent.pageY;
      handleShowcaseGestureStart();
    },
    [handleShowcaseGestureStart],
  );
  const handleShowcaseTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const nextTouchY = event.nativeEvent.pageY;
      const lastTouchY = lastTouchYRef.current ?? nextTouchY;
      const deltaY = nextTouchY - lastTouchY;
      lastTouchYRef.current = nextTouchY;

      if (showcaseScrollOffsetRef.current <= 1 && deltaY > 0) {
        updateParentScrollLock(false);
        onTopBoundaryPull(deltaY);
      }
    },
    [onTopBoundaryPull, updateParentScrollLock],
  );
  const handleShowcaseScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const nextOffsetY = event.nativeEvent.contentOffset.y;
      showcaseScrollOffsetRef.current = nextOffsetY;
      updateParentScrollLock(nextOffsetY > 1);
    },
    [updateParentScrollLock],
  );

  useEffect(() => {
    showcaseScrollOffsetRef.current = 0;
    updateParentScrollLock(false);
    scrollY.setValue(0);
  }, [scrollY, showcaseKey, updateParentScrollLock]);

  return (
    <View onLayout={onSectionLayout} style={{ gap: spacing[2], height: pageHeight }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <AppText variant="h2" numberOfLines={1} style={{ color: palette.text, flex: 1 }}>
          More from {locationLabel}
        </AppText>
        <AppText
          variant="micro"
          style={{ color: palette.textSecondary, fontWeight: "800", marginLeft: spacing[2] }}
        >
          {visibleCards.length} {visibleCards.length === 1 ? "card" : "cards"}
        </AppText>
      </View>
      <Animated.ScrollView
        key={showcaseKey}
        directionalLockEnabled
        nestedScrollEnabled
        snapToInterval={rowSnapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: rowGap }}
        style={{ height: showcaseViewportHeight, width: cardWidth }}
        onTouchStart={handleShowcaseTouchStart}
        onTouchMove={handleShowcaseTouchMove}
        onTouchEnd={handleShowcaseGestureEnd}
        onTouchCancel={handleShowcaseGestureEnd}
        onScrollBeginDrag={handleShowcaseGestureStart}
        onScrollEndDrag={handleShowcaseGestureEnd}
        onMomentumScrollEnd={handleShowcaseGestureEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          listener: handleShowcaseScroll,
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {showcaseRows.map((rowCards, rowIndex) => {
          const inputRange = [
            (rowIndex - 3) * rowSnapInterval,
            (rowIndex - 2) * rowSnapInterval,
            rowIndex * rowSnapInterval,
            (rowIndex + 1) * rowSnapInterval,
          ];

          return (
            <View
              key={`stall-showcase-row-${rowIndex}`}
              style={{
                flexDirection: "row",
                gap: columnGap,
                height: tallCardHeight,
                width: cardWidth,
              }}
            >
              {rowCards.map((card, columnIndex) => {
                const imageInputStart = Math.max(0, (rowIndex - 3) * rowSnapInterval);
                const imageInputEnd = Math.max(rowSnapInterval, (rowIndex + 1) * rowSnapInterval);
                const imageScrollStepCount = Math.max(
                  1,
                  Math.round((imageInputEnd - imageInputStart) / rowSnapInterval),
                );
                const imageTravel = columnCardWidth * imageScrollStepCount;
                const imageFrameCount = imageScrollStepCount + STALL_SHOWCASE_IMAGE_REPEAT_BUFFER;
                const imageRailSources = buildLoopingStallShowcaseImageSources(
                  card,
                  imageFrameCount,
                );
                const direction = columnIndex === 0 ? -1 : 1;
                const imageTranslateX = scrollY.interpolate({
                  inputRange: [imageInputStart, imageInputEnd],
                  outputRange: columnIndex === 0 ? [0, -imageTravel] : [-imageTravel, 0],
                  extrapolate: "clamp",
                });
                const translateX = scrollY.interpolate({
                  inputRange,
                  outputRange: [-contentTravel * direction, 0, 0, contentTravel * direction],
                  extrapolate: "clamp",
                });
                const opacity = scrollY.interpolate({
                  inputRange,
                  outputRange: [0.42, 1, 1, 0.42],
                  extrapolate: "clamp",
                });

                return (
                  <Pressable
                    key={`${card.id}-${rowIndex}-${columnIndex}`}
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
                        height: tallCardHeight,
                        overflow: "hidden",
                        width: columnCardWidth,
                      },
                    ]}
                  >
                    <Animated.View
                      style={{
                        height: "100%",
                        opacity,
                        transform: [{ translateX }],
                        width: "100%",
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: palette.surfaceRaised,
                          height: cardImageHeight,
                          overflow: "hidden",
                          width: "100%",
                        }}
                      >
                        <Animated.View
                          style={{
                            flexDirection: "row",
                            height: "100%",
                            transform: [{ translateX: imageTranslateX }],
                            width: columnCardWidth * imageRailSources.length,
                          }}
                        >
                          {imageRailSources.map((imageSource, imageIndex) => (
                            <AccessibleImage
                              key={`${card.id}-image-${imageIndex}`}
                              source={
                                typeof imageSource === "string" ? { uri: imageSource } : imageSource
                              }
                              style={{ height: "100%", width: columnCardWidth }}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={120}
                              decorative
                            />
                          ))}
                        </Animated.View>
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
                            {isVenueOpenFromHours(card.venue.operatingHours, card.venue.isOpen)
                              ? "OPEN"
                              : "CLOSED"}
                          </AppText>
                        </View>
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
                          <Star color={palette.amber} size={11} fill={palette.amber} />
                          <AppText
                            variant="micro"
                            style={{ color: palette.textOnDark, fontWeight: "900" }}
                          >
                            {card.heroDish.rating.toFixed(1)}
                          </AppText>
                        </View>
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
                        <View
                          style={{
                            alignItems: "center",
                            flexDirection: "row",
                            gap: spacing[1],
                          }}
                        >
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
                              style={{ color: palette.textSecondary, flexShrink: 0 }}
                            >
                              {card.venue.unitNumber}
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
                          <AppText
                            variant="price"
                            style={{
                              color: palette.orange,
                              fontSize: typography.bodySmallBold.fontSize,
                              fontWeight: "800",
                              lineHeight: typography.bodySmallBold.lineHeight,
                              marginLeft: spacing[1],
                            }}
                          >
                            S${card.heroDish.price.toFixed(2)}
                          </AppText>
                        </View>
                      </View>
                    </Animated.View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

function HalalLogoIcon({ color }: { color: string }) {
  return (
    <AppText
      variant="micro"
      style={{
        color,
        fontWeight: "800",
        includeFontPadding: false,
      }}
    >
      حلال
    </AppText>
  );
}

export function DiscoverHomeScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute();
  const isTabSwipeLockedRef = useRef(false);
  const popularFoodFilterSkeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repository = getDataRepository();
  const isSupabaseDataSource = getServiceProvider().mode === "supabase";
  const [supabaseDiscoverAreaCount, setSupabaseDiscoverAreaCount] = useState<number | null>(null);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const {
    componentSizes,
    componentRadii,
    palette,
    radii,
    spacing,
    semanticSpacing,
    shadows,
    motion,
    colorScheme,
    typography,
  } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [discoverViewportHeight, setDiscoverViewportHeight] = useState(0);
  const discoverSectionGap = spacing[4];
  const discoverContentGap = spacing[2];
  const decisionCardGap = discoverContentGap;
  const decisionCardInnerGap = spacing[2];
  const discoverRailCardWidth = screenWidth * 0.55;
  const discoverRailImageHeight = 130;
  const decisionCardWidth = (screenWidth - semanticSpacing.screenEdge * 2 - decisionCardGap) / 2;
  const decisionCardPadding = spacing[2];
  const decisionCardIconSize = 36;
  const decisionCardIconGraphicSize = 19;
  const decisionCardLabelFontSize = Math.max(15, typography.bodySmallBold.fontSize + 1);
  const decisionCardLabelLineHeight = decisionCardLabelFontSize + spacing[1];
  const decisionCardLabelMaxWidth = Math.max(
    76,
    decisionCardWidth - decisionCardPadding * 2 - decisionCardIconSize - decisionCardInnerGap,
  );
  const popularFoodLabelLineHeight = typography.bodySmallBold.fontSize + spacing[1];
  const popularFoodButtonHeight = 72 + spacing[1.5] + popularFoodLabelLineHeight * 2;
  const discoverRailReservedHeight =
    discoverRailImageHeight +
    spacing[6] +
    typography.bodyBold.lineHeight +
    typography.micro.lineHeight +
    typography.price.lineHeight;
  const bottomTabVisibleHeight = componentSizes.bottomTabBar + Math.max(insets.bottom, spacing[2]);
  const fallbackDiscoverViewportHeight = Math.max(0, screenHeight - insets.top);
  const effectiveDiscoverViewportHeight = discoverViewportHeight || fallbackDiscoverViewportHeight;
  const stallShowcasePageHeight =
    Math.max(0, effectiveDiscoverViewportHeight - bottomTabVisibleHeight) ||
    effectiveDiscoverViewportHeight ||
    fallbackDiscoverViewportHeight;
  const stallShowcaseCardWidth = screenWidth - semanticSpacing.screenEdge * 2;
  const edgeToEdgeHorizontalScrollStyle = {
    width: screenWidth,
  };
  const setTabSwipeLocked = useCallback(
    (isLocked: boolean) => {
      if (isTabSwipeLockedRef.current === isLocked) {
        return;
      }

      isTabSwipeLockedRef.current = isLocked;
      navigation.setOptions({ swipeEnabled: !isLocked });
    },
    [navigation],
  );
  const clearPopularFoodFilterSkeletonTimer = useCallback(() => {
    if (!popularFoodFilterSkeletonTimerRef.current) {
      return;
    }

    clearTimeout(popularFoodFilterSkeletonTimerRef.current);
    popularFoodFilterSkeletonTimerRef.current = null;
  }, []);
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore((state) => state.account !== null);
  const isUserMode = !isDeveloperMode && !isMerchantMode;

  useEffect(() => {
    if (locationPermission !== "granted" && !manualLocation) {
      void grantLocation();
    }
  }, [locationPermission, manualLocation, grantLocation]);

  useEffect(
    () => () => {
      clearPopularFoodFilterSkeletonTimer();
      if (isTabSwipeLockedRef.current) {
        navigation.setOptions({ swipeEnabled: true });
      }
    },
    [clearPopularFoodFilterSkeletonTimer, navigation],
  );

  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const refreshPopularNearby = useDiscoveryStore((state) => state.refreshPopularNearby);
  const cacheRecommendationSlate = useDiscoveryStore((state) => state.cacheRecommendationSlate);
  const getCachedRecommendationSlate = useDiscoveryStore(
    (state) => state.getCachedRecommendationSlate,
  );
  const pruneExpiredRecommendations = useDiscoveryStore(
    (state) => state.pruneExpiredRecommendations,
  );

  useEffect(() => {
    void refreshPopularNearby();
  }, [refreshPopularNearby]);
  const updateSearchQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2, 240),
    [screenWidth, spacing],
  );
  const searchIconSize = 52;
  const openSearchHome = useCallback(() => {
    navigation.navigate("SearchHome");
  }, [navigation]);

  const [activeDiscoverChipIds, setActiveDiscoverChipIds] = useState<DiscoverChipId[]>([]);
  const [isPopularFoodFilterSkeletonPending, setIsPopularFoodFilterSkeletonPending] =
    useState(false);
  const deferredDiscoverChipIds = useDeferredValue(activeDiscoverChipIds);
  const deferredDiscoverChipSet = useMemo(
    () => new Set<DiscoverChipId>(deferredDiscoverChipIds),
    [deferredDiscoverChipIds],
  );
  const activeDiscoverChipSignature = activeDiscoverChipIds.join("|");
  const deferredDiscoverChipSignature = deferredDiscoverChipIds.join("|");
  const isPopularFoodFilterPending =
    activeDiscoverChipSignature !== deferredDiscoverChipSignature ||
    isPopularFoodFilterSkeletonPending;
  const isDiscoverFiltering = deferredDiscoverChipIds.length > 0;
  const handleDiscoverViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight <= 0) {
      return;
    }

    setDiscoverViewportHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight,
    );
  }, []);

  const discoverLocationLatitude = manualCoordinate?.latitude ?? currentLocation.latitude;
  const discoverLocationLongitude = manualCoordinate?.longitude ?? currentLocation.longitude;
  const areaBuildings = useMemo(
    () => getNearestBuildings(discoverLocationLatitude, discoverLocationLongitude, 3, 14),
    [discoverLocationLatitude, discoverLocationLongitude],
  );
  const discoverLocationLabel =
    manualLocation ?? getNearestSingaporeArea(discoverLocationLatitude, discoverLocationLongitude);

  useEffect(() => {
    if (!isSupabaseDataSource) {
      setSupabaseDiscoverAreaCount(null);
      return;
    }

    let isActive = true;
    setSupabaseDiscoverAreaCount(null);
    void getHungryService()
      .discovery.countVenuesInArea(
        discoverLocationLatitude,
        discoverLocationLongitude,
        DISCOVER_AREA_RADIUS_METERS,
      )
      .then((venueCount) => {
        if (!isActive) return;
        setSupabaseDiscoverAreaCount(typeof venueCount === "number" ? venueCount : null);
      })
      .catch(() => {
        if (isActive) {
          setSupabaseDiscoverAreaCount(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [discoverLocationLatitude, discoverLocationLongitude, isSupabaseDataSource]);

  const themeTints = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      bg: palette.bg,
      text: palette.text,
      cardBg: palette.surface,
      secondaryText: palette.textSecondary,
      isDark,
    };
  }, [palette, colorScheme]);

  const sortedChips = useMemo(() => {
    const baseChips = [
      { id: "dietary" as const, label: "Dietary Needs", category: "dietary" },
      ...INTENT_CHIPS,
    ];
    const hour = new Date().getHours();
    const prioritizeLateNight = hour >= 22 || hour < 4;
    if (prioritizeLateNight) {
      return baseChips.sort((a, b) => (a.id === "late" ? -1 : b.id === "late" ? 1 : 0));
    }
    return baseChips;
  }, []);

  // ─── Idle Pulse Animation (Psychological Nudge) ───────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  const startPulse = useCallback(() => {
    setIsPulsing(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: motion.idlePulse,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: motion.idlePulse,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim, motion.idlePulse]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isPulsing) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      setIsPulsing(false);
    }
    idleTimerRef.current = setTimeout(() => {
      startPulse();
    }, 7000); // 7 seconds of inactivity
  }, [isPulsing, pulseAnim, startPulse]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);
  const discoverScrollRef = useRef<ScrollView | null>(null);
  const discoverScrollOffsetYRef = useRef(0);
  const discoverScrollDirectionRef = useRef<"up" | "down" | null>(null);
  const stallShowcaseTopYRef = useRef(0);
  const stallShowcaseScrollY = useRef(new Animated.Value(0)).current;
  const [isStallShowcaseGestureActive, setIsStallShowcaseGestureActive] = useState(false);
  const handleDiscoverScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffsetY = event.nativeEvent.contentOffset.y;
      const previousOffsetY = discoverScrollOffsetYRef.current;
      if (nextOffsetY > previousOffsetY + 1) {
        discoverScrollDirectionRef.current = "down";
      } else if (nextOffsetY < previousOffsetY - 1) {
        discoverScrollDirectionRef.current = "up";
      }

      discoverScrollOffsetYRef.current = nextOffsetY;
      resetIdleTimer();
    },
    [resetIdleTimer],
  );
  const handleStallShowcaseLayout = useCallback((event: LayoutChangeEvent) => {
    stallShowcaseTopYRef.current = event.nativeEvent.layout.y;
  }, []);
  const focusStallShowcaseSection = useCallback((animated = false) => {
    const sectionTopY = stallShowcaseTopYRef.current;
    if (sectionTopY <= 0) {
      return;
    }

    if (Math.abs(discoverScrollOffsetYRef.current - sectionTopY) <= 1) {
      return;
    }

    discoverScrollOffsetYRef.current = sectionTopY;
    discoverScrollRef.current?.scrollTo({ x: 0, y: sectionTopY, animated });
  }, []);
  const handleDiscoverScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffsetY = event.nativeEvent.contentOffset.y;
      const sectionTopY = stallShowcaseTopYRef.current;
      discoverScrollOffsetYRef.current = nextOffsetY;
      resetIdleTimer();

      if (
        discoverScrollDirectionRef.current !== "down" ||
        sectionTopY <= 0 ||
        nextOffsetY < sectionTopY - stallShowcasePageHeight / 2 ||
        nextOffsetY >= sectionTopY - 1
      ) {
        return;
      }

      focusStallShowcaseSection(true);
    },
    [focusStallShowcaseSection, resetIdleTimer, stallShowcasePageHeight],
  );
  const handleStallShowcaseGestureStart = useCallback(() => {
    resetIdleTimer();
    focusStallShowcaseSection();
    setIsStallShowcaseGestureActive(true);
  }, [focusStallShowcaseSection, resetIdleTimer]);
  const handleStallShowcaseGestureEnd = useCallback(() => {
    resetIdleTimer();
    setIsStallShowcaseGestureActive(false);
  }, [resetIdleTimer]);
  const handleStallShowcaseTopBoundaryPull = useCallback(
    (deltaY: number) => {
      resetIdleTimer();
      setIsStallShowcaseGestureActive(false);
      const nextParentOffsetY = Math.max(0, discoverScrollOffsetYRef.current - deltaY);
      discoverScrollDirectionRef.current = "up";
      discoverScrollOffsetYRef.current = nextParentOffsetY;
      discoverScrollRef.current?.scrollTo({ x: 0, y: nextParentOffsetY, animated: false });
    },
    [resetIdleTimer],
  );

  // Tab press-to-top behavior intentionally disabled for bottom navigation.

  const areaVenues = useMemo(() => {
    const scopedVenues = areaBuildings.flatMap((building) =>
      repository.listVenuesByBuilding(building.id),
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return Array.from(uniqueVenues.values());
  }, [areaBuildings, repository]);
  const areaDishes = useMemo(
    () => areaVenues.flatMap((venue) => repository.listDishesByVenue(venue.id)),
    [areaVenues, repository],
  );
  const allDiscoverVenues = useMemo(() => {
    const discoveredVenues = repository
      .listBuildings()
      .flatMap((building) => repository.listVenuesByBuilding(building.id));
    const uniqueVenues = new Map(discoveredVenues.map((venue) => [venue.id, venue]));
    return Array.from(uniqueVenues.values());
  }, [repository]);
  const allDiscoverDishes = useMemo(
    () => allDiscoverVenues.flatMap((venue) => repository.listDishesByVenue(venue.id)),
    [allDiscoverVenues, repository],
  );
  const areaDishPool = areaDishes.length ? areaDishes : allDiscoverDishes;
  const currentHour = new Date().getHours();
  const isLateNightMakanVisible = currentHour >= 21 || currentHour < 4;
  const discoverDietaryFlags = useMemo(
    () =>
      profile.dietaryPreferences.length ? profile.dietaryPreferences : DISCOVER_DIETARY_FALLBACKS,
    [profile.dietaryPreferences],
  );
  const toggleDiscoverChip = useCallback(
    (chipId: DiscoverChipId) => {
      const wasActive = activeDiscoverChipIds.includes(chipId);
      const nextChipIds = wasActive
        ? activeDiscoverChipIds.filter((value) => value !== chipId)
        : [...activeDiscoverChipIds, chipId];

      clearPopularFoodFilterSkeletonTimer();
      if (nextChipIds.length > 0) {
        setIsPopularFoodFilterSkeletonPending(true);
        popularFoodFilterSkeletonTimerRef.current = setTimeout(() => {
          popularFoodFilterSkeletonTimerRef.current = null;
          setIsPopularFoodFilterSkeletonPending(false);
        }, POPULAR_FOOD_FILTER_SKELETON_MIN_MS);
      } else {
        setIsPopularFoodFilterSkeletonPending(false);
      }

      if (!wasActive && chipId !== "dietary") {
        scheduleIdleWork(
          () => {
            recordTasteInteraction({
              type: "search_query",
              surface: "discover",
              query: chipId,
              chipId,
            });
          },
          { timeout: 500, fallbackDelayMs: 80 },
        );
      }

      setActiveDiscoverChipIds(nextChipIds);
    },
    [activeDiscoverChipIds, clearPopularFoodFilterSkeletonTimer, recordTasteInteraction],
  );
  const matchesDiscoverChipSelection = useCallback(
    (dish?: DishDetail, textParts: string[] = []) => {
      if (!deferredDiscoverChipSet.size) {
        return true;
      }
      let cachedHaystack: string | null = null;
      const getLateNightHaystack = () => {
        if (cachedHaystack !== null) {
          return cachedHaystack;
        }

        cachedHaystack = [
          dish?.name,
          dish?.venueName,
          dish?.tasteTags.join(" "),
          dish?.priceRange,
          ...textParts,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return cachedHaystack;
      };

      return Array.from(deferredDiscoverChipSet).every((chipId) => {
        if (chipId === "dietary") {
          return dish
            ? discoverDietaryFlags.some((flag) => dish.dietaryFlags.includes(flag))
            : false;
        }
        if (chipId === "halal") {
          if (dish?.dietaryFlags.includes("halal")) {
            return true;
          }
          return getLateNightHaystack().includes("halal");
        }
        if (chipId === "spicy") {
          return (
            Boolean(dish && dish.tasteVector.spicy >= 6) || getLateNightHaystack().includes("spicy")
          );
        }
        if (chipId === "late") {
          const haystack = getLateNightHaystack();
          return (
            haystack.includes("late") || haystack.includes("satay") || haystack.includes("mala")
          );
        }
        if (chipId === "cheap") {
          return Boolean(dish && dish.price < 8);
        }
        return true;
      });
    },
    [deferredDiscoverChipSet, discoverDietaryFlags],
  );
  const areaVenueIds = useMemo(() => new Set(areaVenues.map((venue) => venue.id)), [areaVenues]);
  const discoverBaseBites = useMemo(
    () =>
      getDiscoverBites(repository).filter(
        (bite) => !areaVenueIds.size || areaVenueIds.has(bite.venueId),
      ),
    [areaVenueIds, repository],
  );
  const discoverBiteCollections = useMemo(
    () => getDiscoverBiteCollections(discoverBaseBites, repository),
    [discoverBaseBites, repository],
  );
  const discoverDishById = useMemo(() => {
    const dishById = new Map<string, DishDetail>();
    discoverBaseBites.forEach((bite) => {
      const dish = repository.getDishById(bite.dishId);
      if (dish) {
        dishById.set(bite.dishId, dish);
      }
    });
    return dishById;
  }, [discoverBaseBites, repository]);
  const getBiteDish = useCallback(
    (bite: Bite) => discoverDishById.get(bite.dishId),
    [discoverDishById],
  );
  const unfilteredQuickBiteCards = useMemo(
    () => discoverBiteCollections.quickBites.slice(0, 6),
    [discoverBiteCollections.quickBites],
  );
  const unfilteredTrendingCards = useMemo(
    () => discoverBiteCollections.trending.slice(0, 6),
    [discoverBiteCollections.trending],
  );
  const unfilteredEditorChoiceCards = useMemo(
    () => discoverBiteCollections.editorChoice.slice(0, 6),
    [discoverBiteCollections.editorChoice],
  );
  const unfilteredBudgetCards = useMemo(
    () => discoverBiteCollections.budget.slice(0, 6),
    [discoverBiteCollections.budget],
  );
  const unfilteredLateNightCards = useMemo(
    () => discoverBiteCollections.lateNight.slice(0, 5),
    [discoverBiteCollections.lateNight],
  );
  const filterDiscoverBites = useCallback(
    (bites: Bite[]) =>
      bites.filter((bite) =>
        matchesDiscoverChipSelection(getBiteDish(bite), [
          bite.dishName,
          bite.venueName,
          bite.caption,
        ]),
      ),
    [getBiteDish, matchesDiscoverChipSelection],
  );
  const quickBiteCards = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(unfilteredQuickBiteCards)
        : unfilteredQuickBiteCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredQuickBiteCards],
  );
  const trendingCards = useMemo(
    () =>
      isDiscoverFiltering ? filterDiscoverBites(unfilteredTrendingCards) : unfilteredTrendingCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredTrendingCards],
  );
  const editorChoiceCards = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(unfilteredEditorChoiceCards)
        : unfilteredEditorChoiceCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredEditorChoiceCards],
  );
  const budgetCards = useMemo(
    () =>
      isDiscoverFiltering ? filterDiscoverBites(unfilteredBudgetCards) : unfilteredBudgetCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredBudgetCards],
  );
  const lateNightCards = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(unfilteredLateNightCards)
        : unfilteredLateNightCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredLateNightCards],
  );
  const unfilteredPopularFoodStyleItems = useMemo(
    () =>
      POPULAR_FOOD_STYLES.map((style) => {
        const dish = style.dishId ? repository.getDishById(style.dishId) : undefined;
        return {
          ...style,
          imageSource: style.imageSource ?? dish?.imageUrl ?? style.fallbackImageUrl,
          imageUrl: dish?.imageUrl ?? style.fallbackImageUrl,
          dish,
        };
      }).filter((style): style is PopularFoodStyleItemData => Boolean(style.imageSource)),
    [repository],
  );
  const popularFoodStyleItems = useMemo(
    () =>
      isDiscoverFiltering
        ? unfilteredPopularFoodStyleItems.filter((style) =>
            matchesDiscoverChipSelection(style.dish, [style.label, style.query]),
          )
        : unfilteredPopularFoodStyleItems,
    [isDiscoverFiltering, matchesDiscoverChipSelection, unfilteredPopularFoodStyleItems],
  );
  const isWaitingForPopularFoodStyles = !isDiscoverFiltering && popularFoodStyleItems.length === 0;
  const showPopularFoodSkeleton = useDelayedLoadingSkeleton(isWaitingForPopularFoodStyles);
  const showPopularFoodFilterSkeleton = isPopularFoodFilterPending;
  const shouldShowPopularFoodSkeleton = showPopularFoodSkeleton || showPopularFoodFilterSkeleton;
  const showDiscoverFilterRailSkeleton = showPopularFoodFilterSkeleton;
  const unfilteredAreaStallCards = useMemo(
    () =>
      areaBuildings
        .map((building) => {
          const venues = repository.listVenuesByBuilding(building.id);
          const venue = venues[0];
          const topDish = venue ? repository.getDishById(venue.topDishId) : undefined;
          return venue ? { building, venue, topDish } : null;
        })
        .filter(Boolean) as {
        building: any;
        venue: VenueSummary;
        topDish: DishDetail | undefined;
      }[],
    [areaBuildings, repository],
  );
  const areaStallCards = useMemo(
    () =>
      isDiscoverFiltering
        ? unfilteredAreaStallCards.filter(({ venue, topDish }) =>
            matchesDiscoverChipSelection(topDish, [venue.name]),
          )
        : unfilteredAreaStallCards,
    [isDiscoverFiltering, matchesDiscoverChipSelection, unfilteredAreaStallCards],
  );
  const unfilteredStallShowcaseCards = useMemo(() => {
    const showcaseVenuePool = [...areaVenues, ...allDiscoverVenues];
    return buildStallShowcaseCardsFromVenues(showcaseVenuePool, repository);
  }, [allDiscoverVenues, areaVenues, repository]);
  const stallShowcaseCards = useMemo(() => {
    const filteredCards = isDiscoverFiltering
      ? unfilteredStallShowcaseCards.filter(({ venue, heroDish, products }) =>
          products.some((product) =>
            matchesDiscoverChipSelection(product, [
              venue.name,
              heroDish.name,
              ...product.tasteTags,
            ]),
          ),
        )
      : unfilteredStallShowcaseCards;

    return extendStallShowcaseCards(filteredCards);
  }, [isDiscoverFiltering, matchesDiscoverChipSelection, unfilteredStallShowcaseCards]);
  const discoverAreaCount = supabaseDiscoverAreaCount ?? areaVenues.length;
  const handleDecideForMe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const radiusMeters = 500;
    trackAnalyticsEvent("decide_for_me_triggered", {
      location_granted: locationPermission === "granted",
      radius_m: radiusMeters,
    });

    const geoCell = toRecommendationGeoCell(currentLocation.latitude, currentLocation.longitude);
    pruneExpiredRecommendations();

    const cachedDishIds = getCachedRecommendationSlate(geoCell);
    const cachedDishes = (cachedDishIds ?? [])
      .map((dishId) => repository.getDishById(dishId))
      .filter((dish): dish is DishDetail => Boolean(dish));

    let picked = repository.getDecideForMe(profile.tasteVector, {
      dietaryFlags: profile.dietaryPreferences,
      neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
      radiusMeters,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      excludeDishIds: [],
    });

    if (!picked && cachedDishes.length) {
      picked = cachedDishes[0];
    }

    if (!cachedDishes.length) {
      const liveSlate = repository
        .searchDishes(
          {
            query: "",
            categories: [],
            dietaryFlags: profile.dietaryPreferences,
            tasteValues: profile.tasteVector,
            radius: radiusMeters,
          },
          profile.tasteVector,
        )
        .slice(0, 20);

      if (liveSlate.length) {
        cacheRecommendationSlate(
          geoCell,
          liveSlate.map((dish) => dish.id),
        );
        if (!picked) {
          picked = liveSlate[0];
        }
      }
    }

    if (picked) {
      recordTasteInteraction({
        type: "food_button_click",
        surface: "decide",
        dish: picked,
        buttonId: "decide_for_me",
      });
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  };

  const handleFoodStylePress = useCallback(
    (item: PopularFoodStyleItemData) => {
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        initialQuery: item.query,
      });

      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "search_query",
            surface: "discover",
            dish: item.dish,
            dishId: item.dishId,
            query: item.query,
            chipId: item.id,
            buttonId: "popular_right_now",
          });
          updateSearchQuery(item.query);
          rememberSearch(item.query);
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    },
    [navigation, recordTasteInteraction, rememberSearch, updateSearchQuery],
  );

  const prefetchFoodStyle = useCallback(
    (item: PopularFoodStyleItemData) => {
      prefetchImages([item.imageUrl], 1);
      prefetchBrowseResults(item.query, navigation, { browseMode: "stalls" });
      if (item.dish?.id) {
        prefetchDishDetail(item.dish.id, repository);
        prefetchStallDetail(item.dish.venueId, repository);
      }
    },
    [navigation, repository],
  );

  useEffect(() => {
    const cancelPrefetch = scheduleIdleWork(
      () => {
        unfilteredPopularFoodStyleItems.slice(0, 4).forEach(prefetchFoodStyle);
      },
      { timeout: 700, fallbackDelayMs: 160 },
    );

    return () => {
      cancelPrefetch();
    };
  }, [prefetchFoodStyle, unfilteredPopularFoodStyleItems]);

  const prefetchBiteCard = useCallback(
    (bite: Bite) => {
      prefetchDishDetail(bite.dishId, repository);
      prefetchStallDetail(bite.venueId, repository);
      preloadRoute(navigation, "DishDetail", { dishId: bite.dishId });
    },
    [navigation, repository],
  );

  const openBiteDish = useCallback(
    (bite: Bite, buttonId: string) => {
      navigation.navigate("DishDetail", { dishId: bite.dishId });
      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "dish_result_click",
            surface: "discover",
            dish: getBiteDish(bite),
            dishId: bite.dishId,
            buttonId,
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    },
    [getBiteDish, navigation, recordTasteInteraction],
  );

  const prefetchBiteCollectionRoute = useCallback(
    (collection: keyof typeof discoverBiteCollections) => {
      prefetchImages(
        discoverBiteCollections[collection].map((bite) => bite.photoUrl),
        5,
      );
      preloadRoute(navigation, "QuickBites", { collection });
    },
    [discoverBiteCollections, navigation],
  );

  useEffect(() => {
    const leadingBites = [
      ...unfilteredQuickBiteCards.slice(0, 3),
      ...unfilteredTrendingCards.slice(0, 3),
      ...unfilteredEditorChoiceCards.slice(0, 2),
    ];
    prefetchImages(
      leadingBites.map((bite) => bite.photoUrl),
      8,
    );
  }, [unfilteredEditorChoiceCards, unfilteredQuickBiteCards, unfilteredTrendingCards]);

  const prefetchStallShowcaseCard = useCallback(
    (card: DiscoverStallShowcaseCard) => {
      prefetchStallDetail(card.venue.id, repository);
      prefetchDishDetail(card.heroDish.id, repository);
      prefetchImages(
        card.products.map((product) => product.imageUrl),
        4,
      );
      if (isUserMode) {
        preloadRoute(navigation, "StallDetail", { venueId: card.venue.id });
        return;
      }

      preloadRoute(navigation, "MapZoomedIn", { buildingId: card.venue.buildingId });
    },
    [isUserMode, navigation, repository],
  );

  const openStallShowcaseCard = useCallback(
    (card: DiscoverStallShowcaseCard) => {
      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "dish_result_click",
            surface: "discover",
            dish: card.heroDish,
            dishId: card.heroDish.id,
            buttonId: "vertical_stall_showcase_card",
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );

      if (isUserMode) {
        navigation.navigate("StallDetail", { venueId: card.venue.id });
        return;
      }

      navigation.navigate("MapZoomedIn", { buildingId: card.venue.buildingId });
    },
    [isUserMode, navigation, recordTasteInteraction],
  );

  useEffect(() => {
    const cancelPrefetch = scheduleIdleWork(
      () => {
        stallShowcaseCards.slice(0, 2).forEach(prefetchStallShowcaseCard);
      },
      { timeout: 700, fallbackDelayMs: 160 },
    );

    return () => {
      cancelPrefetch();
    };
  }, [prefetchStallShowcaseCard, stallShowcaseCards]);

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: themeTints.bg }}>
      <ScrollView
        ref={discoverScrollRef}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isStallShowcaseGestureActive}
        onLayout={handleDiscoverViewportLayout}
        contentContainerStyle={{
          gap: discoverSectionGap,
          paddingHorizontal: semanticSpacing.screenEdge,
        }}
        onScroll={handleDiscoverScroll}
        onScrollEndDrag={handleDiscoverScrollEnd}
        onMomentumScrollEnd={handleDiscoverScrollEnd}
        scrollEventThrottle={16}
      >
        {/* Dynamic Location Header */}
        <View style={{ paddingTop: spacing[1] }}>
          <AppText
            variant="micro"
            style={{
              color: themeTints.isDark ? palette.white : palette.orange,
              letterSpacing: 1,
              marginBottom: 0,
              opacity: 0.8,
            }}
          >
            YOU ARE AT
          </AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="h1" style={{ color: themeTints.text }} numberOfLines={1}>
                {discoverLocationLabel}
              </AppText>
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                {`${discoverAreaCount} places in this area`}
              </AppText>
            </View>
            {isUserMode ? null : (
              <View style={{ marginTop: -spacing[0.5] }}>
                <IconButton
                  variant="ghost"
                  accessibilityLabel="Open map view"
                  size={spacing[8] + spacing[2.5]}
                  onPressIn={() => preloadRoute(navigation, "DiscoverMap")}
                  onPress={() => navigation.navigate("DiscoverMap")}
                  icon={
                    <MapPinned
                      color={themeTints.isDark ? palette.white : palette.orange}
                      size={20}
                    />
                  }
                />
              </View>
            )}
          </View>
        </View>

        {/* Search Bar Entry */}
        <View style={{ alignItems: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search dishes, stalls, or hawker centres"
            onPressIn={() => preloadRoute(navigation, "SearchHome")}
            onPress={openSearchHome}
            style={{
              width: searchBarWidth,
              borderRadius: componentRadii.search,
              backgroundColor: themeTints.cardBg,
              borderWidth: themeTints.isDark ? 0 : 1,
              borderColor: palette.border,
              height: 48,
              paddingHorizontal: spacing[3],
              flexDirection: "row",
              alignItems: "center",
              ...shadows.card,
            }}
          >
            <View style={{ flex: 1 }}>
              <DiscoverSearchPlaceholder />
            </View>
            <View
              style={{
                width: searchIconSize,
                alignItems: "center",
                justifyContent: "center",
                height: 48,
              }}
            >
              <Search color={themeTints.isDark ? palette.white : palette.textMuted} size={19} />
            </View>
          </Pressable>
        </View>

        {/* Intent Chips with Icons */}
        <FilterChipRail
          options={sortedChips}
          selectedIds={activeDiscoverChipIds}
          onSelect={toggleDiscoverChip}
          onSwipeLockChange={setTabSwipeLocked}
          renderLeftIcon={(chip, isActive) =>
            chip.id === "dietary" ? (
              <Utensils size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : chip.id === "spicy" ? (
              <Flame size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : chip.id === "halal" ? (
              <HalalLogoIcon color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : chip.id === "late" ? (
              <Compass size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : (
              <Utensils size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            )
          }
        />

        {/* Popular food style buttons */}
        <View style={{ gap: discoverContentGap }}>
          <AppText variant="h2" style={{ color: themeTints.text }}>
            Popular right now
          </AppText>
          {shouldShowPopularFoodSkeleton ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[2] }}
            >
              <PopularFoodStyleSkeleton />
            </ScrollView>
          ) : popularFoodStyleItems.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[2] }}
            >
              {popularFoodStyleItems.map((item) => (
                <PopularFoodStyleItem
                  key={item.id}
                  item={item}
                  onPrefetch={prefetchFoodStyle}
                  onPress={handleFoodStylePress}
                />
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState preserveHeight minHeight={popularFoodButtonHeight} />
          ) : null}
        </View>

        {/* Decision action chips */}
        <View style={{ flexDirection: "row", gap: decisionCardGap }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decide for me"
            onPressIn={() => preloadRoute(navigation, "DecideForMeResult")}
            onPress={handleDecideForMe}
            style={({ pressed }) => [
              shadows.card,
              {
                borderRadius: componentRadii.button,
                height: 72,
                opacity: pressed ? 0.92 : 1,
                overflow: "hidden",
                width: decisionCardWidth,
              },
            ]}
          >
            <LinearGradient
              colors={[palette.orange, palette.amber]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                alignItems: "center",
                borderRadius: componentRadii.button,
                flexDirection: "row",
                gap: decisionCardInnerGap,
                height: "100%",
                justifyContent: "center",
                padding: decisionCardPadding,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.inverseSurfaceSubtle,
                  borderRadius: radii.pill,
                  height: decisionCardIconSize,
                  justifyContent: "center",
                  width: decisionCardIconSize,
                }}
              >
                <Dices color={palette.white} size={decisionCardIconGraphicSize} />
              </View>
              <AppText
                adjustsFontSizeToFit
                minimumFontScale={0.88}
                variant="bodyBold"
                tone="inverse"
                numberOfLines={1}
                style={{
                  includeFontPadding: false,
                  flexShrink: 1,
                  fontSize: decisionCardLabelFontSize,
                  lineHeight: decisionCardLabelLineHeight,
                  maxWidth: decisionCardLabelMaxWidth,
                  minWidth: 0,
                  textAlign: "center",
                  textAlignVertical: "center",
                }}
              >
                Decide for Me
              </AppText>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open hungry wheel"
            onPressIn={() => preloadRoute(navigation, "WheelStack", { screen: "WheelHome" })}
            onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
            style={({ pressed }) => [
              shadows.card,
              {
                alignItems: "center",
                backgroundColor: themeTints.isDark ? palette.inverseSurfaceFaint : palette.navy,
                borderRadius: componentRadii.button,
                flexDirection: "row",
                gap: decisionCardInnerGap,
                height: 72,
                justifyContent: "center",
                opacity: pressed ? 0.92 : 1,
                padding: decisionCardPadding,
                width: decisionCardWidth,
              },
            ]}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.inverseSurfaceSoft,
                borderRadius: radii.pill,
                height: decisionCardIconSize,
                justifyContent: "center",
                width: decisionCardIconSize,
              }}
            >
              <Compass color={palette.white} size={decisionCardIconGraphicSize} />
            </View>
            <AppText
              adjustsFontSizeToFit
              minimumFontScale={0.88}
              variant="bodyBold"
              tone="inverse"
              numberOfLines={1}
              style={{
                includeFontPadding: false,
                flexShrink: 1,
                fontSize: decisionCardLabelFontSize,
                lineHeight: decisionCardLabelLineHeight,
                maxWidth: decisionCardLabelMaxWidth,
                minWidth: 0,
                textAlign: "center",
                textAlignVertical: "center",
              }}
            >
              Hungry Wheel
            </AppText>
          </Pressable>
        </View>

        {/* Discovery Targets — two large tap targets */}
        <View style={{ gap: discoverContentGap }}>
          <View style={{ flexDirection: "row", gap: discoverContentGap }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse stalls and restaurants"
              onPressIn={() => {
                areaVenues
                  .slice(0, 5)
                  .forEach((venue) => prefetchStallDetail(venue.id, repository));
                preloadRoute(navigation, "BrowseStalls");
              }}
              onPress={() => navigation.navigate("BrowseStalls")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? palette.inverseSurfaceFaint : palette.bgSoft,
                  borderRadius: componentRadii.card,
                  flex: 1,
                  overflow: "hidden",
                  borderWidth: themeTints.isDark ? 0 : 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <View>
                <AccessibleImage
                  source={STALLS_CARD_GRAPHIC}
                  style={{ aspectRatio: 1.55, width: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  decorative
                />
                <LinearGradient
                  colors={[palette.imageOverlayGradientStart, palette.imageOverlayGradientEnd]}
                  style={{
                    bottom: 0,
                    left: 0,
                    padding: spacing[3],
                    position: "absolute",
                    right: 0,
                  }}
                >
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: palette.imageLabelSurface,
                      borderColor: palette.imageLabelBorder,
                      borderRadius: radii.sm,
                      borderWidth: 1,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="bodyBold" tone="inverse" numberOfLines={2}>
                      Stalls & Restaurants
                    </AppText>
                  </View>
                </LinearGradient>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse dishes"
              onPressIn={() => {
                areaDishPool.slice(0, 6).forEach((dish) => prefetchDishDetail(dish.id, repository));
                preloadRoute(navigation, "BrowseDishes");
              }}
              onPress={() => navigation.navigate("BrowseDishes")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? palette.inverseSurfaceFaint : palette.bgSoft,
                  borderRadius: componentRadii.card,
                  flex: 1,
                  overflow: "hidden",
                  borderWidth: themeTints.isDark ? 0 : 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <View>
                <AccessibleImage
                  source={DISHES_CARD_GRAPHIC}
                  style={{ aspectRatio: 1.55, width: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  decorative
                />
                <LinearGradient
                  colors={[palette.imageOverlayGradientStart, palette.imageOverlayGradientEnd]}
                  style={{
                    bottom: 0,
                    left: 0,
                    padding: spacing[3],
                    position: "absolute",
                    right: 0,
                  }}
                >
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: palette.imageLabelSurface,
                      borderColor: palette.imageLabelBorder,
                      borderRadius: radii.sm,
                      borderWidth: 1,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="bodyBold" tone="inverse" numberOfLines={1}>
                      Dishes
                    </AppText>
                  </View>
                </LinearGradient>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Proactive Selection */}
        <View style={{ gap: discoverContentGap }}>
          {/* Daily Crave */}
          {!isUserMode && FEATURE_FLAGS.craveEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open daily crave"
              onPressIn={() => preloadRoute(navigation, "Crave")}
              onPress={() => navigation.navigate("Crave")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark
                    ? palette.inverseSurfaceBarely
                    : palette.bgSoft,
                  borderRadius: componentRadii.button,
                  padding: spacing[4],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[4],
                  borderWidth: 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.pill,
                  backgroundColor: palette.orange,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Flame color={palette.white} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                  Daily Crave
                </AppText>
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  Swipe to build your taste profile
                </AppText>
              </View>
              <ChevronRight
                color={themeTints.isDark ? palette.white : palette.textMuted}
                size={20}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Quick Bites */}
        <View style={{ gap: discoverContentGap }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Quick Bites
              </AppText>
              <View
                style={{
                  backgroundColor: palette.statusFast,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  borderRadius: radii.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[1],
                }}
              >
                <Zap color={palette.white} fill={palette.white} size={10} />
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                  &lt; 15 MIN
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all quick bites under 15 minutes"
              onPressIn={() => prefetchBiteCollectionRoute("quickBites")}
              onPress={() => navigation.navigate("QuickBites", { collection: "quickBites" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {showDiscoverFilterRailSkeleton ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              <DiscoverFoodRailLoadingSkeleton
                cardWidth={discoverRailCardWidth}
                imageHeight={discoverRailImageHeight}
              />
            </ScrollView>
          ) : quickBiteCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {quickBiteCards.map((bite) => (
                <Pressable
                  key={`quick-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick bite: ${bite.dishName}`}
                  onPressIn={() => prefetchBiteCard(bite)}
                  onPress={() => openBiteDish(bite, "quick_bite_card")}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <AccessibleImage
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                    decorative
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText
                      variant="bodyBold"
                      numberOfLines={1}
                      style={{ color: themeTints.text }}
                    >
                      {bite.dishName}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {bite.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {bite.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState preserveHeight minHeight={discoverRailReservedHeight} />
          ) : (
            <NoFoodSectionEmptyState
              title="No quick bites found"
              preserveHeight
              minHeight={discoverRailReservedHeight}
            />
          )}
        </View>

        {/* Recommended Dishes (Carousel) */}
        <View style={{ gap: discoverContentGap }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2">Trending in {discoverLocationLabel}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all trending dishes in ${discoverLocationLabel}`}
              onPressIn={() => prefetchBiteCollectionRoute("trending")}
              onPress={() => navigation.navigate("QuickBites", { collection: "trending" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {showDiscoverFilterRailSkeleton ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              <DiscoverFoodRailLoadingSkeleton
                cardWidth={discoverRailCardWidth}
                imageHeight={discoverRailImageHeight}
              />
            </ScrollView>
          ) : trendingCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {trendingCards.map((bite) => (
                <Pressable
                  key={`trending-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${bite.dishName} at ${bite.venueName}`}
                  onPressIn={() => prefetchBiteCard(bite)}
                  onPress={() => openBiteDish(bite, "trending_bite_card")}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <AccessibleImage
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                    decorative
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                      {bite.dishName}
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      {bite.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[1],
                        }}
                      >
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {bite.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState preserveHeight minHeight={discoverRailReservedHeight} />
          ) : (
            <NoFoodSectionEmptyState
              title="No trending food found"
              preserveHeight
              minHeight={discoverRailReservedHeight}
            />
          )}
        </View>

        {/* Editor's Choice Carousel */}
        <View style={{ gap: discoverContentGap }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Editor&apos;s Choice
              </AppText>
              <View
                style={{
                  backgroundColor: palette.orange,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  borderRadius: radii.sm,
                }}
              >
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                  ★ CURATED
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all editor's choice dishes"
              onPressIn={() => prefetchBiteCollectionRoute("editorChoice")}
              onPress={() => navigation.navigate("QuickBites", { collection: "editorChoice" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {showDiscoverFilterRailSkeleton ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              <DiscoverFoodRailLoadingSkeleton
                cardWidth={discoverRailCardWidth}
                imageHeight={discoverRailImageHeight}
              />
            </ScrollView>
          ) : editorChoiceCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {editorChoiceCards.map((bite) => (
                <Pressable
                  key={`ec-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Editor's choice: ${bite.dishName}`}
                  onPressIn={() => prefetchBiteCard(bite)}
                  onPress={() => openBiteDish(bite, "editor_choice_bite_card")}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <AccessibleImage
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                    decorative
                  />
                  {/* Editor badge overlay */}
                  <View
                    style={{
                      position: "absolute",
                      top: spacing[2],
                      left: spacing[2],
                      backgroundColor: palette.orange,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[0.5],
                      borderRadius: radii.sm,
                    }}
                  >
                    <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                      MUST ORDER
                    </AppText>
                  </View>
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                      {bite.dishName}
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      {bite.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {bite.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState preserveHeight minHeight={discoverRailReservedHeight} />
          ) : (
            <NoFoodSectionEmptyState
              title="No editor's choice food found"
              preserveHeight
              minHeight={discoverRailReservedHeight}
            />
          )}
        </View>

        {/* Budget < S$8 Dish Carousel */}
        <View style={{ gap: discoverContentGap }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Budget &lt; S$8
              </AppText>
              <View
                style={{
                  backgroundColor: palette.success,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  borderRadius: radii.sm,
                }}
              >
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                  VALUE
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all budget dishes under $8"
              onPressIn={() => prefetchBiteCollectionRoute("budget")}
              onPress={() => navigation.navigate("QuickBites", { collection: "budget" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {showDiscoverFilterRailSkeleton ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              <DiscoverFoodRailLoadingSkeleton
                cardWidth={discoverRailCardWidth}
                imageHeight={discoverRailImageHeight}
              />
            </ScrollView>
          ) : budgetCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {budgetCards.map((bite) => (
                <Pressable
                  key={`budget-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Budget meal: ${bite.dishName} at S$${bite.price.toFixed(2)}`}
                  onPressIn={() => prefetchBiteCard(bite)}
                  onPress={() => openBiteDish(bite, "budget_bite_card")}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <AccessibleImage
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={120}
                    decorative
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText
                      variant="bodyBold"
                      numberOfLines={1}
                      style={{ color: themeTints.text }}
                    >
                      {bite.dishName}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {bite.venueName}
                    </AppText>
                    <AppText
                      variant="price"
                      style={{ color: palette.orange, fontWeight: "700", marginTop: spacing[0.5] }}
                    >
                      S${bite.price.toFixed(2)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState preserveHeight minHeight={discoverRailReservedHeight} />
          ) : (
            <NoFoodSectionEmptyState
              title="No budget-friendly food found"
              preserveHeight
              minHeight={discoverRailReservedHeight}
            />
          )}
        </View>

        {/* Late Night Makan */}
        {isLateNightMakanVisible ? (
          <View style={{ gap: discoverContentGap }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <AppText variant="h2" style={{ color: themeTints.text }}>
                  Late Night Makan
                </AppText>
                <View
                  style={{
                    backgroundColor: palette.navy,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[0.5],
                    borderRadius: radii.sm,
                  }}
                >
                  <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                    LATE NIGHT
                  </AppText>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all late night stalls"
                onPressIn={() => prefetchBiteCollectionRoute("lateNight")}
                onPress={() => navigation.navigate("QuickBites", { collection: "lateNight" })}
              >
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  SEE ALL
                </AppText>
              </Pressable>
            </View>
            {showDiscoverFilterRailSkeleton ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={edgeToEdgeHorizontalScrollStyle}
                contentContainerStyle={{ gap: spacing[4] }}
              >
                <DiscoverFoodRailLoadingSkeleton
                  cardWidth={discoverRailCardWidth}
                  imageHeight={discoverRailImageHeight}
                />
              </ScrollView>
            ) : lateNightCards.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={edgeToEdgeHorizontalScrollStyle}
                contentContainerStyle={{ gap: spacing[4] }}
              >
                {lateNightCards.map((bite) => (
                  <Pressable
                    key={`night-${bite.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Late night option: ${bite.dishName}`}
                    onPressIn={() => prefetchBiteCard(bite)}
                    onPress={() => openBiteDish(bite, "late_night_bite_card")}
                    style={[
                      shadows.card,
                      {
                        backgroundColor: themeTints.cardBg,
                        borderRadius: componentRadii.card,
                        borderWidth: themeTints.isDark ? 0 : 1,
                        borderColor: palette.border,
                        overflow: "hidden",
                        width: discoverRailCardWidth,
                      },
                    ]}
                  >
                    <AccessibleImage
                      source={{ uri: bite.photoUrl }}
                      style={{ height: discoverRailImageHeight, width: "100%" }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      decorative
                    />
                    <View style={{ padding: spacing[3], gap: spacing[1] }}>
                      <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                        {bite.dishName}
                      </AppText>
                      <AppText
                        variant="micro"
                        style={{ color: themeTints.secondaryText }}
                        numberOfLines={1}
                      >
                        {bite.venueName}
                      </AppText>
                      <AppText variant="price" style={{ color: palette.orange, fontWeight: "700" }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : isDiscoverFiltering ? (
              <FilteredResultsEmptyState preserveHeight minHeight={discoverRailReservedHeight} />
            ) : (
              <NoFoodSectionEmptyState
                title="No late-night food found"
                preserveHeight
                minHeight={discoverRailReservedHeight}
              />
            )}
          </View>
        ) : null}

        {/* Hawker Centres Near You (Horizontal Selection) */}
        <View style={{ gap: discoverContentGap }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2" style={{ color: themeTints.text }}>
              Stalls in {discoverLocationLabel}
            </AppText>
            {isUserMode ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View hawker centres on map"
                onPressIn={() => preloadRoute(navigation, "DiscoverMap")}
                onPress={() => navigation.navigate("DiscoverMap")}
              >
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  VIEW MAP
                </AppText>
              </Pressable>
            )}
          </View>
          <View style={{ gap: discoverContentGap }}>
            {showDiscoverFilterRailSkeleton ? (
              <DiscoverStallListLoadingSkeleton />
            ) : areaStallCards.length ? (
              areaStallCards.map(({ venue, topDish }) => (
                <Pressable
                  key={venue.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${venue.name} ${
                    isUserMode ? "details" : "in map zoomed view"
                  }`}
                  onPressIn={() => {
                    prefetchStallDetail(venue.id, repository);
                    if (topDish?.id) {
                      prefetchDishDetail(topDish.id, repository);
                    }
                    if (!isUserMode) {
                      preloadRoute(navigation, "MapZoomedIn", {
                        buildingId: venue.buildingId,
                      });
                    }
                  }}
                  onPress={() => {
                    if (isUserMode) {
                      navigation.navigate("StallDetail", { venueId: venue.id });
                      return;
                    }

                    navigation.navigate("MapZoomedIn", {
                      buildingId: venue.buildingId,
                    });
                  }}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: componentRadii.card,
                      padding: spacing[3],
                      flexDirection: "row",
                      gap: spacing[3],
                      alignItems: "center",
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      padding: 2,
                      borderRadius: radii.pill,
                      borderWidth: 2,
                      borderColor: palette.orange,
                    }}
                  >
                    <AccessibleImage
                      source={{ uri: topDish?.imageUrl }}
                      style={{ borderRadius: radii.pill, height: 48, width: 48 }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={120}
                      decorative
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText
                      variant="bodySmall"
                      style={{ fontWeight: "800", color: themeTints.text }}
                      numberOfLines={1}
                    >
                      {venue.name}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {venue.unitNumber} · {venue.operatingHours.split(" – ")[0]}
                    </AppText>
                  </View>
                  <ChevronRight color={palette.textMuted} size={20} />
                </Pressable>
              ))
            ) : isDiscoverFiltering ? (
              <FilteredResultsEmptyState preserveHeight minHeight={discoverRailReservedHeight} />
            ) : (
              <NoFoodSectionEmptyState
                title="No stalls in your area currently"
                preserveHeight
                minHeight={discoverRailReservedHeight}
              />
            )}
          </View>
        </View>

        {stallShowcaseCards.length ? (
          <VerticalStallShowcaseSection
            cards={stallShowcaseCards}
            locationLabel={discoverLocationLabel}
            pageHeight={stallShowcasePageHeight}
            cardWidth={stallShowcaseCardWidth}
            scrollY={stallShowcaseScrollY}
            onOpenCard={openStallShowcaseCard}
            onPrefetchCard={prefetchStallShowcaseCard}
            onGestureStart={handleStallShowcaseGestureStart}
            onGestureEnd={handleStallShowcaseGestureEnd}
            onTopBoundaryPull={handleStallShowcaseTopBoundaryPull}
            onRequestSectionFocus={focusStallShowcaseSection}
            onSectionLayout={handleStallShowcaseLayout}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
