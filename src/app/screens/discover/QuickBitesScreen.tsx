import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Animated,
  type ViewToken,
} from "react-native";
import { ArrowLeft, MapPinned, Heart } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  ExpandableSearchLauncher,
  FilterChipRail,
  Screen,
  Avatar,
} from "@/components/ui";
import {
  CyclingGridImage,
  CYCLING_GRID_IMAGE_INTERVAL_MS,
} from "@/components/discover/CyclingGridImage";
import {
  prefetchDishDetail,
  prefetchImages,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { useHungryTheme } from "@/theme";
import { useLocationStore } from "@/store/useLocationStore";
import { getHomeBitesFeed } from "@/features/home/bites";
import type { Bite } from "@/lib/services/types";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { useSearchStore } from "@/store/useSearchStore";
import { useProfileStore } from "@/store/useProfileStore";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import {
  DISCOVER_CUISINE_FILTERS,
  getDiscoverBiteCollection,
  getDiscoverBitesFromSearch,
  getDiscoverBiteDistance,
  getDiscoverBites,
  type DiscoverCollection,
} from "@/features/discover/bites";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type QuickBitesRoute = RouteProp<RootStackParamList, "QuickBites">;
type QuickBiteGridItem = Bite & { distance: number };

function getQuickBiteCycleSlides(item: QuickBiteGridItem, items: QuickBiteGridItem[]) {
  const crossStallSlides = items.filter(
    (candidate) => candidate.id !== item.id && candidate.venueId !== item.venueId,
  );
  const fallbackSlides = items.filter((candidate) => candidate.id !== item.id);

  return [item, ...crossStallSlides, ...fallbackSlides].slice(0, 4);
}

function QuickBiteGridCard({
  allItems,
  index,
  item,
  itemWidth,
  isAutoCycleActive,
  onOpen,
  onPrefetch,
}: {
  allItems: QuickBiteGridItem[];
  index: number;
  item: QuickBiteGridItem;
  itemWidth: number;
  isAutoCycleActive: boolean;
  onOpen: (item: QuickBiteGridItem) => void;
  onPrefetch: (item: QuickBiteGridItem) => void;
}) {
  const { palette } = useHungryTheme();
  const slides = useMemo(() => getQuickBiteCycleSlides(item, allItems), [allItems, item]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? item;
  const handleActiveIndexChange = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  return (
    <Pressable
      onPressIn={() => onPrefetch(activeSlide)}
      onPress={() => onOpen(activeSlide)}
      style={{
        width: itemWidth,
        height: itemWidth * 1.35,
        backgroundColor: palette.surface,
        borderRightWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: palette.border,
      }}
    >
      <CyclingGridImage
        images={slides.map((slide) => slide.photoUrl)}
        cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
        isAutoCycleActive={isAutoCycleActive}
        startDelayMs={(index % 4) * 350}
        onActiveIndexChange={handleActiveIndexChange}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", palette.mediaGradientMid, palette.detailImageOverlay]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.cardContent}>
        <View style={[styles.authorBadge, { backgroundColor: palette.mediaScrimSoft }]}>
          <Avatar uri={activeSlide.authorAvatar} name={activeSlide.authorName} size={18} />
          <AppText
            variant="micro"
            style={{ color: palette.white, fontWeight: "700", fontSize: 10 }}
          >
            {activeSlide.authorName}
          </AppText>
        </View>
        <View style={{ flex: 1 }} />
        <AppText
          variant="bodySmallBold"
          style={{ color: palette.white, marginBottom: 2 }}
          numberOfLines={1}
        >
          {activeSlide.dishName}
        </AppText>
        <View style={styles.metaRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <MapPinned size={10} color={palette.white} />
            <AppText
              variant="micro"
              style={{ color: palette.white, fontWeight: "600", fontSize: 10 }}
            >
              {activeSlide.distance}m
            </AppText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Heart size={10} color={palette.white} fill={palette.white} style={{ opacity: 0.8 }} />
            <AppText
              variant="micro"
              style={{ color: palette.white, fontWeight: "700", fontSize: 10 }}
            >
              {activeSlide.cravingCount}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const COLLECTION_COPY: Record<
  NonNullable<DiscoverCollection>,
  {
    title: string;
    placeholder: string;
    emptyTitle: string;
    emptyBody: string;
  }
> = {
  quickBites: {
    title: "Quick Bites",
    placeholder: "Find quick bites...",
    emptyTitle: "No quick bites found nearby",
    emptyBody: "Try changing your filters or search query.",
  },
  trending: {
    title: "Trending",
    placeholder: "Find trending dishes...",
    emptyTitle: "No trending dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  editorChoice: {
    title: "Editor's Choice",
    placeholder: "Find curated dishes...",
    emptyTitle: "No editor's picks found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  budget: {
    title: "Budget Under S$8",
    placeholder: "Find budget dishes...",
    emptyTitle: "No budget dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  lateNight: {
    title: "Late Night Makan",
    placeholder: "Find late night food...",
    emptyTitle: "No late night dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
};

export function QuickBitesScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<QuickBitesRoute>();
  const { componentRadii, palette, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const tasteVector = useProfileStore((state) => state.profile.tasteVector);
  const dietaryPreferences = useProfileStore((state) => state.profile.dietaryPreferences);
  const collection: DiscoverCollection = route.params?.collection ?? "quickBites";
  const collectionCopy = COLLECTION_COPY[collection];
  const fallbackBites = useMemo(() => getDiscoverBites(), []);

  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const cuisineFilterOptions = useMemo(
    () => DISCOVER_CUISINE_FILTERS.map((cuisine) => ({ id: cuisine, label: cuisine })),
    [],
  );
  const [bites, setBites] = useState<Bite[]>(fallbackBites);
  const [fullyVisibleBiteIds, setFullyVisibleBiteIds] = useState<Set<string>>(() => new Set());
  const searchQuery = useSearchStore((state) => state.filters.query);
  const updateSearchQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2 - 32 - 12, 240),
    [screenWidth, spacing],
  );

  const submitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    navigation.navigate("SearchHome");
    if (trimmed) {
      scheduleIdleWork(
        () => {
          rememberSearch(trimmed);
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    }
  }, [navigation, rememberSearch, searchQuery]);

  const prefetchBiteRoute = useCallback(
    (bite: Bite) => {
      prefetchDishDetail(bite.dishId);
      prefetchStallDetail(bite.venueId);
      preloadRoute(navigation, "DishDetail", { dishId: bite.dishId });
    },
    [navigation],
  );

  // ── Animation Logic ────────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;
  const CHIPS_HEIGHT = 64;

  const chipsOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const chipsHeightAnim = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [CHIPS_HEIGHT, 0],
    extrapolate: "clamp",
  });

  const chipsTranslateY = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, -20],
    extrapolate: "clamp",
  });

  useEffect(() => {
    // Sync with location and real feed if available
    const loadBites = async () => {
      const isSupabaseDataSource = getServiceProvider().mode === "supabase";
      try {
        if (isSupabaseDataSource) {
          const liveBites = await getDiscoverBitesFromSearch(collection, {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: 3000,
            tasteVector,
            dietaryFlags: dietaryPreferences,
          });
          setBites(liveBites);
          return;
        }

        const feed = await getHomeBitesFeed(currentLocation.latitude, currentLocation.longitude);
        if (feed && feed.length > 0) {
          const feedIds = new Set(feed.map((bite) => bite.id));
          setBites([...feed, ...fallbackBites.filter((bite) => !feedIds.has(bite.id))]);
        } else {
          setBites(fallbackBites);
        }
      } catch {
        setBites(isSupabaseDataSource ? [] : fallbackBites);
      }
    };
    void loadBites();
  }, [collection, currentLocation, dietaryPreferences, fallbackBites, tasteVector]);

  const collectionBites = useMemo(() => {
    return getDiscoverBiteCollection(collection, bites);
  }, [bites, collection]);

  const filteredBites = useMemo(() => {
    const list = collectionBites
      .filter((bite) => {
        const cuisine = selectedCuisine.toLowerCase();
        const matchesCuisine =
          cuisine === "all" ||
          bite.caption.toLowerCase().includes(cuisine) ||
          bite.dishName.toLowerCase().includes(cuisine);

        return matchesCuisine;
      })
      .map((bite) => {
        return { ...bite, distance: getDiscoverBiteDistance(bite) };
      });

    return list.sort((a, b) => a.distance - b.distance);
  }, [collectionBites, selectedCuisine]);

  useEffect(() => {
    prefetchImages(
      filteredBites.map((bite) => bite.photoUrl),
      8,
    );
  }, [filteredBites]);

  const numColumns = 2;
  const itemWidth = screenWidth / numColumns;
  const fullTileViewabilityConfig = useRef({ itemVisiblePercentThreshold: 100 }).current;
  const handleFullyVisibleBitesChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setFullyVisibleBiteIds(
        new Set(
          viewableItems
            .filter((token) => token.isViewable && token.item)
            .map((token) => (token.item as QuickBiteGridItem).id),
        ),
      );
    },
  ).current;

  const renderBiteItem = useCallback(
    ({ item, index }: { item: QuickBiteGridItem; index: number }) => (
      <QuickBiteGridCard
        allItems={filteredBites}
        index={index}
        isAutoCycleActive={fullyVisibleBiteIds.has(item.id)}
        item={item}
        itemWidth={itemWidth}
        onOpen={(activeItem) => navigation.navigate("DishDetail", { dishId: activeItem.dishId })}
        onPrefetch={prefetchBiteRoute}
      />
    ),
    [filteredBites, fullyVisibleBiteIds, itemWidth, navigation, prefetchBiteRoute],
  );

  const renderFoodCarousel = useCallback(
    () =>
      filteredBites.length ? (
        <View style={{ paddingVertical: spacing[5], gap: spacing[3] }}>
          <View style={{ paddingHorizontal: spacing[4] }}>
            <AppText variant="h3">{collectionCopy.title}</AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
          >
            {filteredBites.map((bite) => (
              <Pressable
                key={`carousel-${bite.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Open ${bite.dishName} at ${bite.venueName}`}
                onPressIn={() => prefetchBiteRoute(bite)}
                onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                style={[
                  styles.carouselCard,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                  },
                ]}
              >
                <AccessibleImage
                  source={{ uri: bite.photoUrl }}
                  style={{ height: 104, width: "100%" }}
                  contentFit="cover"
                  decorative
                />
                <View style={{ padding: spacing[2], gap: 2 }}>
                  <AppText variant="bodySmallBold" numberOfLines={1}>
                    {bite.dishName}
                  </AppText>
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {bite.venueName}
                  </AppText>
                  <AppText variant="price" style={{ color: palette.orange }}>
                    S${bite.price.toFixed(2)}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null,
    [
      collectionCopy.title,
      filteredBites,
      navigation,
      palette.border,
      palette.orange,
      palette.surface,
      prefetchBiteRoute,
      componentRadii.card,
      spacing,
    ],
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing[4],
            paddingTop: spacing[2],
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            backgroundColor: palette.bg,
            zIndex: 10,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
          <AppText variant="h2" style={{ flex: 1 }}>
            {collectionCopy.title}
          </AppText>
          <ExpandableSearchLauncher
            query={searchQuery}
            onQueryChange={updateSearchQuery}
            onSubmit={submitSearch}
            accessibilityLabel="Search dishes"
            iconAlignment="right"
            iconSize={40}
            barHeight={40}
            placeholder="Search dishes..."
            expandedWidth={searchBarWidth}
            borderColor={palette.border}
            backgroundColor={palette.bgSoft}
            textColor={palette.text}
            onClear={() => updateSearchQuery("")}
          />
        </View>

        <Animated.View
          style={{
            height: chipsHeightAnim,
            opacity: chipsOpacity,
            transform: [{ translateY: chipsTranslateY }],
            overflow: "hidden",
          }}
        >
          <FilterChipRail
            options={cuisineFilterOptions}
            selectedId={selectedCuisine}
            onSelect={setSelectedCuisine}
            gap={spacing[2]}
            contentContainerStyle={{ paddingVertical: spacing[3] }}
          />
        </Animated.View>
      </View>

      <View style={{ flex: 1, width: "100%" }}>
        <FlashList
          data={filteredBites}
          renderItem={renderBiteItem}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={handleFullyVisibleBitesChanged}
          viewabilityConfig={fullTileViewabilityConfig}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: false,
          })}
          scrollEventThrottle={16}
          // @ts-ignore
          estimatedItemSize={220}
          numColumns={numColumns}
          contentContainerStyle={{ paddingBottom: spacing[12] }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View
              style={{
                marginTop: spacing[12],
                alignItems: "center",
                gap: spacing[4],
                width: "100%",
              }}
            >
              <AppText style={styles.emptyStateIcon}>🥣</AppText>
              <View
                style={{ alignItems: "center", gap: spacing[1], paddingHorizontal: spacing[8] }}
              >
                <AppText variant="h3" style={{ textAlign: "center" }}>
                  {collectionCopy.emptyTitle}
                </AppText>
                <AppText tone="muted" style={{ textAlign: "center" }}>
                  {collectionCopy.emptyBody}
                </AppText>
              </View>
            </View>
          }
          ListFooterComponent={renderFoodCarousel}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12 },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  backBtn: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  emptyStateIcon: {
    fontSize: 48,
    height: 72,
    lineHeight: 64,
    textAlign: "center",
    width: 72,
  },
  cardContent: { ...StyleSheet.absoluteFillObject, padding: 10, justifyContent: "flex-end" },
  authorBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 4,
    paddingRight: 8,
    borderRadius: 12,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  carouselCard: {
    borderWidth: 1,
    overflow: "hidden",
    width: 168,
  },
});
