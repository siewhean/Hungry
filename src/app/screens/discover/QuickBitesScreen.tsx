import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  useWindowDimensions,
  Animated,
  type ViewToken,
} from "react-native";
import { Utensils } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppSymbol,
  AppText,
  Button,
  FilterChipRail,
  Screen,
  Skeleton,
  UnderlineTabs,
} from "@/components/ui";
import {
  formatPhotoGridDistance,
  PHOTO_GRID_CARD_RATIO,
  PhotoGridCard,
} from "@/components/discover/PhotoGridCard";
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
import { groupBitesByStall, type QuickBiteStallItem } from "@/features/discover/stallGroups";
import {
  DISCOVER_CUISINE_FILTERS,
  getDiscoverBiteCollection,
  getDiscoverBiteDistance,
  getDiscoverBites,
  getDiscoverFeedBites,
  type DiscoverCollection,
  type DiscoverDishLookup,
  type VenueHoursLookup,
} from "@/features/discover/bites";

/**
 * Live bites already carry the feed's name, price, rating, photo and distance, so the rails
 * look nothing up: the synchronous repository would download whole tables to answer.
 */
const LIVE_FEED_DISH_LOOKUP: DiscoverDishLookup = { getDishById: () => undefined };

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type QuickBitesRoute = RouteProp<RootStackParamList, "QuickBites">;
type QuickBiteGridItem = Bite & { distance?: number };
type QuickBiteMode = "dishes" | "stalls";
const MODE_TABS: { value: QuickBiteMode; label: string; accessibilityLabel: string }[] = [
  { value: "dishes", label: "Dishes", accessibilityLabel: "Show dishes" },
  { value: "stalls", label: "Stalls", accessibilityLabel: "Show stalls" },
];

function QuickBiteStallCard({
  item,
  itemWidth,
  onOpen,
}: {
  item: QuickBiteStallItem;
  itemWidth: number;
  onOpen: (item: QuickBiteStallItem) => void;
}) {
  return (
    <PhotoGridCard
      accessibilityLabel={`Open ${item.venueName}`}
      chipLabel={item.buildingName}
      chipSymbol="nearYou"
      distanceLabel={formatPhotoGridDistance(item.distance)}
      onPress={() => onOpen(item)}
      title={item.venueName}
      width={itemWidth}
    >
      <QuickBiteImagePlaceholder height={itemWidth * PHOTO_GRID_CARD_RATIO} />
      {item.photoUrl.trim() ? (
        <CyclingGridImage
          images={[item.photoUrl]}
          cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
          isAutoCycleActive={false}
          startDelayMs={0}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </PhotoGridCard>
  );
}

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
      <AppSymbol name="fork.knife" fallback={Utensils} size={28} color={palette.orange} />
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
  // The tile always opens its own dish; only that dish's own photos cycle.
  const imageUrls = useMemo(() => getQuickBiteImageUrls(item), [item]);
  const rating =
    item.cravingCount > 0 && item.rating > 0
      ? `${item.rating.toFixed(1)} (${item.cravingCount})`
      : undefined;

  return (
    <PhotoGridCard
      accessibilityLabel={`Open ${item.dishName} at ${item.venueName}`}
      // The stall, not a person: these are the stall's dishes, not a user's post.
      chipLabel={item.venueName}
      distanceLabel={formatPhotoGridDistance(item.distance)}
      onPress={() => onOpen(item)}
      onPressIn={() => onPrefetch(item)}
      ratingLabel={rating}
      title={item.dishName}
      width={itemWidth}
    >
      <QuickBiteImagePlaceholder height={itemWidth * PHOTO_GRID_CARD_RATIO} />
      <CyclingGridImage
        images={imageUrls}
        cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
        isAutoCycleActive={isAutoCycleActive}
        startDelayMs={(index % 4) * 350}
        style={StyleSheet.absoluteFill}
      />
    </PhotoGridCard>
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

  const [selectedCuisine, setSelectedCuisine] = useState("All");
  const cuisineFilterOptions = useMemo(
    () => DISCOVER_CUISINE_FILTERS.map((cuisine) => ({ id: cuisine, label: cuisine })),
    [],
  );
  const isSupabaseDataSource = getServiceProvider().mode === "supabase";
  // Mock and Excel builds fill in from the local data; live builds never read it (HOME-X7).
  const fallbackBites = useMemo(
    () => (isSupabaseDataSource ? [] : getDiscoverBites()),
    [isSupabaseDataSource],
  );
  const dishLookup = isSupabaseDataSource ? LIVE_FEED_DISH_LOOKUP : undefined;
  // Live data starts empty behind a skeleton; the local cache is never shown as the answer.
  const [bites, setBites] = useState<Bite[]>(isSupabaseDataSource ? [] : fallbackBites);
  const [isLoading, setIsLoading] = useState(isSupabaseDataSource);
  const [venueHours, setVenueHours] = useState<VenueHoursLookup>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [fullyVisibleBiteIds, setFullyVisibleBiteIds] = useState<Set<string>>(() => new Set());
  // Raw text stays local so spaces survive typing; it is sanitised only on submit.
  const [searchText, setSearchText] = useState("");
  const [mode, setMode] = useState<QuickBiteMode>("dishes");
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const submitSearch = useCallback(() => {
    const query = sanitizeSearchQuery(searchText);
    navigation.navigate("SearchResults", { browseMode: mode, initialQuery: query || undefined });
    if (query) {
      scheduleIdleWork(
        () => {
          rememberSearch(query);
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    }
  }, [mode, navigation, rememberSearch, searchText]);

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
    return getDiscoverBiteCollection(collection, bites, dishLookup, venueHours);
  }, [bites, collection, dishLookup, venueHours]);

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
        return { ...bite, distance: getDiscoverBiteDistance(bite, dishLookup) };
      });
  }, [collectionBites, dishLookup, selectedCuisine]);

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
      navigation.navigate("DishDetail", { dishId: activeItem.dishId, source: "quick_bites" }),
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

  const stallRows = useMemo(() => groupBitesByStall(filteredBites), [filteredBites]);
  const openStall = useCallback(
    (stall: QuickBiteStallItem) => navigation.navigate("StallDetail", { venueId: stall.venueId }),
    [navigation],
  );
  const renderGridItem = useCallback(
    (info: {
      item: QuickBiteGridItem | QuickBiteStallItem;
      index: number;
      extraData?: ReadonlySet<string>;
    }) =>
      mode === "dishes" ? (
        renderBiteItem({ ...info, item: info.item as QuickBiteGridItem })
      ) : (
        <QuickBiteStallCard
          item={info.item as QuickBiteStallItem}
          itemWidth={itemWidth}
          onOpen={openStall}
        />
      ),
    [itemWidth, mode, openStall, renderBiteItem],
  );
  const shownCount = mode === "dishes" ? filteredBites.length : stallRows.length;
  const [one, many] = mode === "dishes" ? ["dish", "dishes"] : ["stall", "stalls"];
  const summary = isLoading
    ? collectionCopy.title
    : `${collectionCopy.title} · ${shownCount} ${shownCount === 1 ? one : many}`;

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
            <AppSymbol name="back" size={24} weight="medium" color={palette.text} />
          </Pressable>
          <TextInput
            accessibilityLabel={`Search ${mode}`}
            autoCorrect={false}
            onChangeText={setSearchText}
            onSubmitEditing={submitSearch}
            placeholder={`Search all ${mode}`}
            placeholderTextColor={palette.textMuted}
            returnKeyType="search"
            style={[
              styles.searchInput,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
                color: palette.text,
              },
            ]}
            value={searchText}
          />
        </View>
        <UnderlineTabs
          accessibilityLabel="Collection results"
          fill
          tabs={MODE_TABS}
          value={mode}
          onChange={setMode}
        />

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

      <AppText
        tone="secondary"
        variant="bodySmall"
        style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}
      >
        {summary}
      </AppText>
      <View style={{ flex: 1, width: "100%" }}>
        <FlashList
          key={mode}
          data={
            (mode === "dishes" ? filteredBites : stallRows) as (
              | QuickBiteGridItem
              | QuickBiteStallItem
            )[]
          }
          renderItem={renderGridItem}
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
                <View style={styles.emptyStateIcon}>
                  <AppSymbol name="dish" size={40} color={palette.textMuted} />
                </View>
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
    alignItems: "center",
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  searchInput: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
