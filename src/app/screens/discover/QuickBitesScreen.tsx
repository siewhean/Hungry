import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Animated,
  type ViewToken,
} from "react-native";
import { ArrowLeft, MapPinned, Star, Utensils } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppText,
  Button,
  ExpandableSearchLauncher,
  FilterChipRail,
  Screen,
  Skeleton,
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
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { getHomeBitesFeed } from "@/features/home/bites";
import type { Bite } from "@/lib/services/types";
import { getServiceProvider } from "@/lib/services/serviceProvider";
import { useSearchStore } from "@/store/useSearchStore";
import { useProfileStore } from "@/store/useProfileStore";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";
import { reportError } from "@/lib/monitoring/reportError";
import {
  DISCOVER_CUISINE_FILTERS,
  getDiscoverBiteCollection,
  getDiscoverBiteDistance,
  getDiscoverBites,
  getDiscoverFeedBites,
  type DiscoverCollection,
  type VenueHoursLookup,
} from "@/features/discover/bites";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type QuickBitesRoute = RouteProp<RootStackParamList, "QuickBites">;
type QuickBiteGridItem = Bite & { distance?: number };

function QuickBiteImagePlaceholder({ height }: { height: number }) {
  const { palette } = useHungryTheme();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Food photo unavailable"
      style={{
        alignItems: "center",
        backgroundColor: palette.surfaceRaised,
        height,
        justifyContent: "center",
        width: "100%",
      }}
    >
      <Utensils color={palette.orange} size={28} />
    </View>
  );
}

function getQuickBiteImageUrls(item: Bite) {
  return [item.photoUrl, ...(item.mediaUrls ?? [])].filter(
    (imageUrl, index, imageUrls) =>
      imageUrl.trim().length > 0 && imageUrls.indexOf(imageUrl) === index,
  );
}

function QuickBiteGridCard({
  index,
  item,
  itemWidth,
  isAutoCycleActive,
  onOpen,
  onPrefetch,
}: {
  index: number;
  item: QuickBiteGridItem;
  itemWidth: number;
  isAutoCycleActive: boolean;
  onOpen: (item: QuickBiteGridItem) => void;
  onPrefetch: (item: QuickBiteGridItem) => void;
}) {
  const { palette } = useHungryTheme();
  // The tile always opens its own dish; only that dish's own photos cycle.
  const imageUrls = useMemo(() => getQuickBiteImageUrls(item), [item]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.dishName} at ${item.venueName}`}
      onPressIn={() => onPrefetch(item)}
      onPress={() => onOpen(item)}
      style={{
        width: itemWidth,
        height: itemWidth * 1.35,
        backgroundColor: palette.surface,
        borderRightWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: palette.border,
      }}
    >
      <QuickBiteImagePlaceholder height={itemWidth * 1.35} />
      <CyclingGridImage
        images={imageUrls}
        cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
        isAutoCycleActive={isAutoCycleActive}
        startDelayMs={(index % 4) * 350}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", palette.mediaGradientMid, palette.detailImageOverlay]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.cardContent}>
        {/* The stall, not a person: these are the stall's dishes, not a user's post. */}
        <View style={[styles.authorBadge, { backgroundColor: palette.mediaScrimStrong }]}>
          <Utensils size={12} color={palette.white} />
          <AppText
            variant="micro"
            numberOfLines={1}
            style={{ color: palette.white, flexShrink: 1, fontWeight: "700" }}
          >
            {item.venueName}
          </AppText>
        </View>
        <View style={{ flex: 1 }} />
        <AppText
          variant="bodySmallBold"
          style={{ color: palette.white, marginBottom: 2 }}
          numberOfLines={1}
        >
          {item.dishName}
        </AppText>
        <View style={styles.metaRow}>
          {item.distance !== undefined ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <MapPinned size={10} color={palette.white} />
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "600" }}>
                {item.distance >= 1000
                  ? `${(item.distance / 1000).toFixed(1)}km`
                  : `${Math.round(item.distance)}m`}
              </AppText>
            </View>
          ) : (
            <View />
          )}
          {/* The count is reviews, so it is shown as the rating with its review count. */}
          {item.cravingCount > 0 && item.rating > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Star size={10} color={palette.white} fill={palette.white} />
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "700" }}>
                {`${item.rating.toFixed(1)} (${item.cravingCount})`}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Same radius the Discover rails read. */
const DISCOVER_AREA_RADIUS_METERS = 3000;

function QuickBitesLoadingGrid({ itemWidth }: { itemWidth: number }) {
  return (
    <View accessibilityLabel="Loading dishes" accessibilityLiveRegion="polite">
      {[0, 1, 2].map((row) => (
        <View key={`quick-bites-loading-${row}`} style={{ flexDirection: "row" }}>
          {[0, 1].map((column) => (
            <Skeleton
              key={`quick-bites-loading-${row}-${column}`}
              width={itemWidth}
              height={itemWidth * 1.35}
              borderRadius={0}
            />
          ))}
        </View>
      ))}
    </View>
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
    title: "Dishes near you",
    placeholder: "Find dishes near you...",
    emptyTitle: "No dishes found nearby",
    emptyBody: "Try changing your filters or search query.",
  },
  trending: {
    title: "Most reviewed",
    placeholder: "Find most reviewed dishes...",
    emptyTitle: "No reviewed dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  editorChoice: {
    title: "Top rated",
    placeholder: "Find top rated dishes...",
    emptyTitle: "No top rated dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  budget: {
    title: "Budget Under S$8",
    placeholder: "Find budget dishes...",
    emptyTitle: "No budget dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
  lateNight: {
    title: "Late night eats",
    placeholder: "Find late night dishes...",
    emptyTitle: "No late night dishes found nearby",
    emptyBody: "Try another filter or search for a dish.",
  },
};

export function QuickBitesScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<QuickBitesRoute>();
  const { palette, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const gpsLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const locationPermission = useLocationStore((state) => state.permission);
  // "See all" from Discover passes its area, so the list matches the rail.
  const areaLatitude = route.params?.latitude;
  const areaLongitude = route.params?.longitude;
  const { coordinate: effectiveCoordinate } = getEffectiveLocation({
    permission: locationPermission,
    currentLocation: gpsLocation,
    manualCoordinate,
  });
  const effectiveLatitude = effectiveCoordinate.latitude;
  const effectiveLongitude = effectiveCoordinate.longitude;
  const currentLocation = useMemo(
    () =>
      typeof areaLatitude === "number" && typeof areaLongitude === "number"
        ? { latitude: areaLatitude, longitude: areaLongitude }
        : { latitude: effectiveLatitude, longitude: effectiveLongitude },
    [areaLatitude, areaLongitude, effectiveLatitude, effectiveLongitude],
  );
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
  const isSupabaseDataSource = getServiceProvider().mode === "supabase";
  // Live data starts empty behind a skeleton; the local cache is never shown as the answer.
  const [bites, setBites] = useState<Bite[]>(isSupabaseDataSource ? [] : fallbackBites);
  const [isLoading, setIsLoading] = useState(isSupabaseDataSource);
  const [venueHours, setVenueHours] = useState<VenueHoursLookup>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [fullyVisibleBiteIds, setFullyVisibleBiteIds] = useState<Set<string>>(() => new Set());
  // Raw text stays local so spaces survive typing; it is sanitised only on submit.
  const [searchText, setSearchText] = useState("");
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2 - 32 - 12, 240),
    [screenWidth, spacing],
  );

  const submitSearch = useCallback(() => {
    const query = sanitizeSearchQuery(searchText);
    navigation.navigate("SearchResults", { initialQuery: query || undefined });
    if (query) {
      scheduleIdleWork(
        () => {
          rememberSearch(query);
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    }
  }, [navigation, rememberSearch, searchText]);

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
    let isActive = true;
    // The same feed read the Discover rails use, so "See all" holds the same stalls.
    const loadBites = async () => {
      setLoadFailed(false);
      try {
        if (isSupabaseDataSource) {
          setIsLoading(true);
          const feed = await getDiscoverFeedBites({
            areaName: manualLocation,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            radiusMeters: DISCOVER_AREA_RADIUS_METERS,
          });
          if (!isActive) return;
          setBites(feed.bites);
          setVenueHours(() => feed.venueHours);
          // An empty answer from the offline cache is a failed read, not "nothing nearby".
          setLoadFailed(feed.isFallback && feed.bites.length === 0);
          setIsLoading(false);
          return;
        }

        const feed = await getHomeBitesFeed(currentLocation.latitude, currentLocation.longitude);
        if (!isActive) return;
        if (feed && feed.length > 0) {
          const feedIds = new Set(feed.map((bite) => bite.id));
          setBites([...feed, ...fallbackBites.filter((bite) => !feedIds.has(bite.id))]);
        } else {
          setBites(fallbackBites);
        }
      } catch (error) {
        if (!isActive) return;
        reportError(error, { surface: "quick_bites" });
        setBites(isSupabaseDataSource ? [] : fallbackBites);
        setLoadFailed(isSupabaseDataSource);
        setIsLoading(false);
      }
    };
    void loadBites();
    return () => {
      isActive = false;
    };
  }, [currentLocation, fallbackBites, isSupabaseDataSource, manualLocation, reloadKey]);

  const collectionBites = useMemo(() => {
    return getDiscoverBiteCollection(collection, bites, undefined, venueHours);
  }, [bites, collection, venueHours]);

  const filteredBites = useMemo(() => {
    // The rail's own order (reviews, rating, photos) is kept: no re-sort by distance.
    return collectionBites
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

  const openBite = useCallback(
    (activeItem: QuickBiteGridItem) =>
      navigation.navigate("DishDetail", { dishId: activeItem.dishId }),
    [navigation],
  );
  // Visibility comes in through extraData, so a viewability change does not rebuild
  // renderItem (and with it every cell).
  const renderBiteItem = useCallback(
    ({
      item,
      index,
      extraData,
    }: {
      item: QuickBiteGridItem;
      index: number;
      extraData?: ReadonlySet<string>;
    }) => (
      <QuickBiteGridCard
        index={index}
        isAutoCycleActive={Boolean(extraData?.has(item.id))}
        item={item}
        itemWidth={itemWidth}
        onOpen={openBite}
        onPrefetch={prefetchBiteRoute}
      />
    ),
    [itemWidth, openBite, prefetchBiteRoute],
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous screen"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <ArrowLeft color={palette.text} size={24} />
          </Pressable>
          <AppText variant="h2" style={{ flex: 1 }}>
            {collectionCopy.title}
          </AppText>
          <ExpandableSearchLauncher
            query={searchText}
            onQueryChange={setSearchText}
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
            onClear={() => setSearchText("")}
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
          extraData={fullyVisibleBiteIds}
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
            isLoading ? (
              <QuickBitesLoadingGrid itemWidth={itemWidth} />
            ) : (
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
                    {loadFailed ? "Couldn't load dishes" : collectionCopy.emptyTitle}
                  </AppText>
                  <AppText tone="muted" style={{ textAlign: "center" }}>
                    {loadFailed ? "Check your connection and try again." : collectionCopy.emptyBody}
                  </AppText>
                </View>
                {loadFailed ? (
                  <Button label="Try again" onPress={() => setReloadKey((key) => key + 1)} />
                ) : null}
              </View>
            )
          }
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
  cardContent: { ...StyleSheet.absoluteFill, padding: 10, justifyContent: "flex-end" },
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
});
