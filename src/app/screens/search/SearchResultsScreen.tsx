import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ViewToken,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowLeft, MapPinned, MessageCircle, Search, X } from "lucide-react-native";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Avatar, EmptyState, FilterChipRail, Screen, Skeleton } from "@/components/ui";
import {
  CyclingGridImage,
  CYCLING_GRID_IMAGE_INTERVAL_MS,
} from "@/components/discover/CyclingGridImage";
import { SearchResultsView } from "@/components/discover/SearchResultsView";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import {
  getSearchResults,
  getSearchResultsAsync,
  sortSearchResults,
  type SearchSortMode,
  useSearchData,
} from "@/features/search/search";
import {
  prefetchDishDetail,
  prefetchImages,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import {
  getBrowseIndex,
  getCachedBrowseIndex,
  searchBrowseDishes,
  type BrowseIndex,
} from "@/features/search/browseIndex";
import { dedupeNearestVenueCandidates } from "@/features/search/venueDedupe";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, VenueSummary } from "@/types/domain";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type SearchResultsRoute = RouteProp<RootStackParamList, "SearchResults">;
type BrowseFeedItem = {
  id: string;
  title: string;
  venueName: string;
  imageUrl: string;
  authorName: string;
  authorAvatarUrl: string;
  distanceMeters: number;
  reviewCount: number;
  dish: DishDetail;
  venue?: VenueSummary;
};

function getCrossStallBrowseSlides(item: BrowseFeedItem, items: BrowseFeedItem[]) {
  const crossStallSlides = items.filter(
    (candidate) => candidate.id !== item.id && candidate.dish.venueId !== item.dish.venueId,
  );
  const fallbackSlides = items.filter((candidate) => candidate.id !== item.id);

  return [item, ...crossStallSlides, ...fallbackSlides].slice(0, 4);
}

function getStallBrowseSlides(item: BrowseFeedItem, venueDishes: DishDetail[]) {
  const dishes = [item.dish, ...venueDishes.filter((dish) => dish.id !== item.dish.id)];

  return dishes.slice(0, 4).map((dish) => ({
    ...item,
    id: `${item.id}-${dish.id}`,
    title: dish.name,
    imageUrl: dish.imageUrl,
    distanceMeters: dish.distanceMeters,
    reviewCount: dish.reviewCount,
    dish,
  }));
}

function BrowseGridCard({
  index,
  isAutoCycleActive,
  item,
  itemWidth,
  onOpen,
  onPrefetch,
  slides,
}: {
  index: number;
  isAutoCycleActive: boolean;
  item: BrowseFeedItem;
  itemWidth: number;
  onOpen: (item: BrowseFeedItem) => void;
  onPrefetch: (item: BrowseFeedItem) => void;
  slides: BrowseFeedItem[];
}) {
  const { palette } = useHungryTheme();
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
      accessibilityRole="button"
      accessibilityLabel={`Open ${activeSlide.title}`}
      onPressIn={() => onPrefetch(activeSlide)}
      onPress={() => onOpen(activeSlide)}
      style={{
        backgroundColor: palette.surface,
        borderBottomColor: palette.border,
        borderBottomWidth: 0.5,
        borderRightColor: palette.border,
        borderRightWidth: 0.5,
        height: itemWidth * 1.35,
        width: itemWidth,
      }}
    >
      <CyclingGridImage
        images={slides.map((slide) => slide.imageUrl)}
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
      <View pointerEvents="none" style={browseStyles.cardContent}>
        <View style={[browseStyles.authorBadge, { backgroundColor: palette.mediaScrimSoft }]}>
          <Avatar uri={activeSlide.authorAvatarUrl} name={activeSlide.authorName} size={18} />
          <AppText
            variant="micro"
            style={{ color: palette.white, fontSize: 10, fontWeight: "700" }}
            numberOfLines={1}
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
          {activeSlide.title}
        </AppText>
        <View style={browseStyles.metaRow}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
            <MapPinned color={palette.white} size={10} />
            <AppText
              variant="micro"
              style={{ color: palette.white, fontSize: 10, fontWeight: "600" }}
            >
              {Math.round(activeSlide.distanceMeters)}m
            </AppText>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
            <MessageCircle color={palette.white} size={10} style={{ opacity: 0.82 }} />
            <AppText
              variant="micro"
              style={{ color: palette.white, fontSize: 10, fontWeight: "700" }}
            >
              {activeSlide.reviewCount}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const BROWSE_FILTERS = ["All", "Local", "Halal", "Japanese", "Western", "Noodles", "Rice", "Spicy"];
const BROWSE_FILTER_OPTIONS = BROWSE_FILTERS.map((filter) => ({ id: filter, label: filter }));
const BROWSE_GRID_HYDRATION_TIMEOUT_MS = 350;
const BROWSE_GRID_HYDRATION_FALLBACK_DELAY_MS = 80;

function BrowseGridLoadingState({ itemWidth }: { itemWidth: number }) {
  const { spacing } = useHungryTheme();

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {Array.from({ length: 8 }).map((_, index) => (
        <View
          key={`browse-grid-skeleton-${index}`}
          style={{
            height: itemWidth * 1.35,
            padding: spacing[1],
            width: itemWidth,
          }}
        >
          <Skeleton width="100%" height="100%" borderRadius={0} />
        </View>
      ))}
    </View>
  );
}

function BrowseGridScreen({
  mode,
  initialSearchQuery = "",
}: {
  mode: "dishes" | "stalls";
  initialSearchQuery?: string;
}) {
  const navigation = useNavigation<RootNavigation>();
  const { componentRadii, palette, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchLauncherLeft, setSearchLauncherLeft] = useState(0);
  const [backControlLimit, setBackControlLimit] = useState(spacing[4] + 32);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [fullyVisibleFeedItemIds, setFullyVisibleFeedItemIds] = useState<Set<string>>(
    () => new Set(),
  );
  const searchInputRef = useRef<TextInput | null>(null);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const shouldUseQueryScopedFeed = normalizedQuery.length > 0;
  const lastRecordedBrowseQueryRef = useRef("");
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const repository = getDataRepository();
  const [browseIndex, setBrowseIndex] = useState<BrowseIndex | null>(() =>
    getCachedBrowseIndex(repository),
  );
  const isBrowseDataReady = Boolean(browseIndex);

  useEffect(() => {
    const cachedIndex = getCachedBrowseIndex(repository);
    if (cachedIndex) {
      setBrowseIndex(cachedIndex);
      return undefined;
    }

    setBrowseIndex(null);
    const cancelHydration = scheduleIdleWork(
      () => {
        setBrowseIndex(getBrowseIndex(repository));
      },
      {
        timeout: BROWSE_GRID_HYDRATION_TIMEOUT_MS,
        fallbackDelayMs: BROWSE_GRID_HYDRATION_FALLBACK_DELAY_MS,
      },
    );

    return () => {
      cancelHydration();
    };
  }, [repository]);
  const areaBuildings = useMemo(
    () =>
      browseIndex && !shouldUseQueryScopedFeed
        ? getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14)
        : [],
    [browseIndex, currentLocation.latitude, currentLocation.longitude, shouldUseQueryScopedFeed],
  );
  const allVenues = useMemo(
    () => (browseIndex && !shouldUseQueryScopedFeed ? browseIndex.allVenues : []),
    [browseIndex, shouldUseQueryScopedFeed],
  );
  const areaVenues = useMemo(() => {
    if (!browseIndex || shouldUseQueryScopedFeed) {
      return [];
    }

    const scopedVenues = areaBuildings.flatMap(
      (building) => browseIndex.venuesByBuildingId.get(building.id) ?? [],
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return uniqueVenues.size ? Array.from(uniqueVenues.values()) : allVenues;
  }, [allVenues, areaBuildings, browseIndex, shouldUseQueryScopedFeed]);
  const queryMatchedDishes = useMemo(() => {
    if (!browseIndex || !shouldUseQueryScopedFeed) {
      return [];
    }

    return searchBrowseDishes(browseIndex, {
      dietaryFlags: profile.dietaryPreferences,
      query: searchQuery,
      radiusMeters: 100000,
    });
  }, [browseIndex, profile.dietaryPreferences, searchQuery, shouldUseQueryScopedFeed]);
  const allDishes = useMemo(
    () => (browseIndex && !shouldUseQueryScopedFeed ? browseIndex.allDishes : []),
    [browseIndex, shouldUseQueryScopedFeed],
  );
  const browseDishes = useMemo(() => {
    if (!browseIndex || shouldUseQueryScopedFeed) {
      return [];
    }

    const scopedDishes = areaVenues
      .flatMap((venue) => browseIndex.sortedDishesByVenueId.get(venue.id) ?? [])
      .sort((left, right) => right.rating - left.rating);
    return scopedDishes.length
      ? scopedDishes
      : [...allDishes].sort((left, right) => right.rating - left.rating);
  }, [allDishes, areaVenues, browseIndex, shouldUseQueryScopedFeed]);
  const browseVenues = useMemo(() => {
    if (!browseIndex || shouldUseQueryScopedFeed) {
      return [];
    }

    return (areaVenues.length ? areaVenues : allVenues).map((venue) => {
      const dishes = browseIndex.sortedDishesByVenueId.get(venue.id) ?? [];
      const topDish = dishes[0] ?? browseIndex.dishById.get(venue.topDishId);

      return {
        venue,
        dishes,
        topDish,
        minDistanceMeters: topDish?.distanceMeters ?? 0,
      };
    });
  }, [allVenues, areaVenues, browseIndex, shouldUseQueryScopedFeed]);

  const isDishGrid = mode === "dishes";
  const browsePostIndexes = useMemo(() => {
    const emptyPostByDishId = new Map<string, BrowseIndex["stallPosts"][number]>();
    const emptyPostByVenueId = new Map<string, BrowseIndex["stallPosts"][number]>();

    return {
      postByDishId: browseIndex?.postByDishId ?? emptyPostByDishId,
      postByVenueId: browseIndex?.postByVenueId ?? emptyPostByVenueId,
    };
  }, [browseIndex]);
  const feedItems = useMemo<BrowseFeedItem[]>(() => {
    if (!isBrowseDataReady) {
      return [];
    }

    const { postByDishId, postByVenueId } = browsePostIndexes;

    if (shouldUseQueryScopedFeed) {
      if (isDishGrid) {
        return queryMatchedDishes.map((dish) => {
          const post = postByDishId.get(dish.id) ?? postByVenueId.get(dish.venueId);

          return {
            id: `dish-${dish.id}`,
            title: dish.name,
            venueName: dish.venueName,
            imageUrl: dish.imageUrl,
            authorName: post?.authorName ?? dish.venueName,
            authorAvatarUrl: post?.authorAvatarUrl ?? dish.imageUrl,
            distanceMeters: dish.distanceMeters,
            reviewCount: dish.reviewCount,
            dish,
          };
        });
      }

      const topDishByVenue = new Map<string, DishDetail>();
      queryMatchedDishes.forEach((dish) => {
        const currentDish = topDishByVenue.get(dish.venueId);
        if (!currentDish || dish.rating > currentDish.rating) {
          topDishByVenue.set(dish.venueId, dish);
        }
      });

      const stallItems = Array.from(topDishByVenue.values()).map((topDish) => {
        const venue = browseIndex?.venueById.get(topDish.venueId);
        const post = postByVenueId.get(topDish.venueId) ?? postByDishId.get(topDish.id);

        return {
          id: `stall-${topDish.venueId}`,
          title: topDish.name,
          venueName: venue?.name ?? topDish.venueName,
          imageUrl: topDish.imageUrl,
          authorName: post?.authorName ?? venue?.name ?? topDish.venueName,
          authorAvatarUrl: post?.authorAvatarUrl ?? topDish.imageUrl,
          distanceMeters: topDish.distanceMeters,
          reviewCount: topDish.reviewCount,
          dish: topDish,
          venue,
        };
      });

      return dedupeNearestVenueCandidates(
        stallItems,
        (item) => item.venue,
        (item) => item.distanceMeters,
      );
    }

    if (isDishGrid) {
      return browseDishes.map((dish) => {
        const post = postByDishId.get(dish.id) ?? postByVenueId.get(dish.venueId);

        return {
          id: `dish-${dish.id}`,
          title: dish.name,
          venueName: dish.venueName,
          imageUrl: dish.imageUrl,
          authorName: post?.authorName ?? dish.venueName,
          authorAvatarUrl: post?.authorAvatarUrl ?? dish.imageUrl,
          distanceMeters: dish.distanceMeters,
          reviewCount: dish.reviewCount,
          dish,
        };
      });
    }

    const buildStallItems = (
      venues: {
        topDish?: DishDetail;
        venue: VenueSummary;
        dishes: DishDetail[];
      }[],
    ) =>
      venues.flatMap(({ venue, topDish: venueTopDish, dishes }) => {
        const topDish = normalizedQuery
          ? dishes.find((dish) => dish.name.toLowerCase().includes(normalizedQuery))
          : venueTopDish;

        if (!topDish) {
          return [];
        }

        const post = postByVenueId.get(venue.id) ?? postByDishId.get(topDish.id);

        return {
          id: `stall-${venue.id}`,
          title: topDish.name,
          venueName: venue.name,
          imageUrl: topDish.imageUrl,
          authorName: post?.authorName ?? venue.name,
          authorAvatarUrl: post?.authorAvatarUrl ?? topDish.imageUrl,
          distanceMeters: topDish.distanceMeters,
          reviewCount: topDish.reviewCount,
          dish: topDish,
          venue,
        };
      });

    return dedupeNearestVenueCandidates(
      buildStallItems(browseVenues),
      (item) => item.venue,
      (item) => item.distanceMeters,
    );
  }, [
    browseDishes,
    browsePostIndexes,
    browseVenues,
    browseIndex,
    isBrowseDataReady,
    isDishGrid,
    normalizedQuery,
    queryMatchedDishes,
    shouldUseQueryScopedFeed,
  ]);
  const filteredFeedItems = useMemo(() => {
    if (!isBrowseDataReady) {
      return [];
    }

    const query = searchQuery.trim().toLowerCase();
    const filter = selectedFilter.toLowerCase();
    const filtered = feedItems.filter((item) => {
      const searchText = [
        item.title,
        item.venueName,
        item.authorName,
        item.dish.name,
        item.dish.tasteTags.join(" "),
        item.dish.dietaryFlags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !query || searchText.includes(query);
      const matchesFilter =
        filter === "all" ||
        searchText.includes(filter) ||
        (filter === "local" && searchText.includes("singapore")) ||
        (filter === "spicy" && item.dish.tasteVector.spicy >= 6);

      return matchesSearch && matchesFilter;
    });

    return filtered.length || query ? filtered : feedItems;
  }, [feedItems, isBrowseDataReady, searchQuery, selectedFilter]);
  const fullTileViewabilityConfig = useRef({ itemVisiblePercentThreshold: 100 }).current;
  const handleFullyVisibleFeedItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setFullyVisibleFeedItemIds(
        new Set(
          viewableItems
            .filter((token) => token.isViewable && token.item)
            .map((token) => (token.item as BrowseFeedItem).id),
        ),
      );
    },
  ).current;
  useEffect(() => {
    if (!isBrowseDataReady) {
      return;
    }

    const leadingItems = filteredFeedItems.slice(0, 3);
    prefetchImages(
      leadingItems.map((item) => item.imageUrl),
      8,
    );
    leadingItems.forEach((item) => {
      prefetchDishDetail(item.dish.id, repository);
      if (item.venue?.id) {
        prefetchStallDetail(item.venue.id, repository);
      }
    });
    const firstItem = leadingItems[0];
    if (firstItem) {
      preloadRoute(navigation, "DishDetail", { dishId: firstItem.dish.id });
    }
  }, [filteredFeedItems, isBrowseDataReady, navigation, repository]);
  const numColumns = 2;
  const itemWidth = screenWidth / numColumns;
  const browseTitle = isDishGrid ? "Dishes" : "Stalls & Restaurants";
  const searchPlaceholder = isDishGrid ? "Find dishes..." : "Find stalls...";
  const searchBarWidth = Math.max(screenWidth - spacing[4] * 2, 240);
  const searchIconSize = 56;
  const fallbackLauncherLeft = screenWidth - spacing[4] - searchIconSize;
  const searchRevealProgress = useRef(new Animated.Value(0)).current;
  const searchPanelWidth = useMemo(() => {
    const effectiveLauncherLeft = searchLauncherLeft || fallbackLauncherLeft;
    const maximumFromLeadingEdge = effectiveLauncherLeft + searchIconSize - backControlLimit;
    return Math.max(180, Math.min(searchBarWidth, maximumFromLeadingEdge));
  }, [fallbackLauncherLeft, searchBarWidth, searchIconSize, searchLauncherLeft, backControlLimit]);
  const searchEntryAnimWidth = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, searchPanelWidth],
    extrapolate: "clamp",
  });
  const searchInputOpacity = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const searchInputScale = searchRevealProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
    extrapolate: "clamp",
  });
  const handleBackControlLayout = useCallback((nextLimit: number) => {
    setBackControlLimit((current) => (Math.abs(current - nextLimit) < 1 ? current : nextLimit));
  }, []);
  const handleSearchLauncherLayout = useCallback((nextLeft: number) => {
    setSearchLauncherLeft((current) => (Math.abs(current - nextLeft) < 1 ? current : nextLeft));
  }, []);
  const revealSearch = () => {
    if (isSearchExpanded) {
      return;
    }

    setIsSearchExpanded(true);
    searchRevealProgress.stopAnimation();
    searchRevealProgress.setValue(0);
    Animated.timing(searchRevealProgress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };
  const hideSearch = () => {
    if (!isSearchExpanded) {
      return;
    }

    searchRevealProgress.stopAnimation(() =>
      Animated.timing(searchRevealProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
      }),
    );
  };
  const recordBrowseSearchQuery = useCallback(() => {
    if (!normalizedQuery || lastRecordedBrowseQueryRef.current === normalizedQuery) {
      return;
    }
    lastRecordedBrowseQueryRef.current = normalizedQuery;
    recordTasteInteraction({
      type: "search_query",
      surface: "search",
      query: normalizedQuery,
      chipId: selectedFilter === "All" ? undefined : selectedFilter,
    });
  }, [normalizedQuery, recordTasteInteraction, selectedFilter]);

  useEffect(() => {
    return () => {
      searchRevealProgress.stopAnimation();
      searchRevealProgress.setValue(0);
    };
  }, [searchRevealProgress]);

  const renderBrowseItem = useCallback(
    ({ item, index }: { item: BrowseFeedItem; index: number }) => {
      const slides =
        mode === "stalls" && item.venue?.id
          ? getStallBrowseSlides(
              item,
              browseIndex?.sortedDishesByVenueId.get(item.venue.id) ?? [item.dish],
            )
          : getCrossStallBrowseSlides(item, filteredFeedItems);

      return (
        <BrowseGridCard
          index={index}
          isAutoCycleActive={fullyVisibleFeedItemIds.has(item.id)}
          item={item}
          itemWidth={itemWidth}
          slides={slides}
          onPrefetch={(activeItem) => {
            prefetchDishDetail(activeItem.dish.id, repository);
            if (activeItem.venue?.id) {
              prefetchStallDetail(activeItem.venue.id, repository);
            }
            preloadRoute(navigation, "DishDetail", { dishId: activeItem.dish.id });
          }}
          onOpen={(activeItem) => {
            navigation.navigate("DishDetail", { dishId: activeItem.dish.id });
            scheduleIdleWork(
              () => {
                recordTasteInteraction({
                  type: "dish_result_click",
                  surface: "search",
                  dish: activeItem.dish,
                  query: searchQuery,
                  buttonId: `${mode}_browse_card`,
                });
              },
              { timeout: 500, fallbackDelayMs: 80 },
            );
          }}
        />
      );
    },
    [
      browseIndex,
      filteredFeedItems,
      fullyVisibleFeedItemIds,
      itemWidth,
      mode,
      navigation,
      recordTasteInteraction,
      repository,
      searchQuery,
    ],
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg, position: "relative" }}>
        {isSearchExpanded ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss search"
            onPress={hideSearch}
            style={browseStyles.searchDismissOverlay}
          />
        ) : null}
        <View
          style={{
            backgroundColor: palette.bg,
            borderBottomColor: palette.border,
            borderBottomWidth: 1,
            paddingBottom: spacing[2],
            paddingTop: spacing[2],
            zIndex: 40,
          }}
        >
          <View style={[browseStyles.titleRow, { paddingHorizontal: spacing[4] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => navigation.goBack()}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                handleBackControlLayout(x + width);
              }}
              style={browseStyles.backButton}
            >
              <ArrowLeft color={palette.text} size={24} />
            </Pressable>
            <AppText
              variant="h1"
              numberOfLines={1}
              style={{ color: palette.text, flex: 1, fontSize: 24, lineHeight: 30 }}
            >
              {browseTitle}
            </AppText>
            <View
              style={[browseStyles.inlineSearchLauncher, { width: searchIconSize }]}
              onLayout={(event) => {
                handleSearchLauncherLayout(event.nativeEvent.layout.x);
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search"
                hitSlop={12}
                onPress={isSearchExpanded ? hideSearch : revealSearch}
                style={{
                  width: searchIconSize,
                  height: 56,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: componentRadii.iconButton,
                }}
              >
                <Search color={palette.textMuted} size={20} />
              </Pressable>

              {isSearchExpanded ? (
                <Animated.View
                  pointerEvents="auto"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    height: 56,
                    borderRadius: componentRadii.search,
                    overflow: "hidden",
                    width: searchEntryAnimWidth,
                    backgroundColor: palette.surface,
                    borderWidth: 1,
                    borderColor: palette.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[2],
                    paddingHorizontal: spacing[3],
                  }}
                >
                  <Animated.View
                    style={{
                      flex: 1,
                      opacity: searchInputOpacity,
                      transform: [{ scale: searchInputScale }],
                    }}
                  >
                    <TextInput
                      ref={searchInputRef}
                      autoCorrect={false}
                      onBlur={hideSearch}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={recordBrowseSearchQuery}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={palette.textMuted}
                      returnKeyType="search"
                      style={[
                        browseStyles.textInput,
                        { color: palette.text, textAlignVertical: "center" },
                      ]}
                      value={searchQuery}
                    />
                  </Animated.View>
                  <Animated.View style={{ opacity: searchInputOpacity }}>
                    {searchQuery.length > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Clear browse search"
                        hitSlop={8}
                        onPress={() => setSearchQuery("")}
                      >
                        <X color={palette.textMuted} size={18} />
                      </Pressable>
                    ) : null}
                  </Animated.View>
                </Animated.View>
              ) : null}
            </View>
          </View>

          <View style={{ marginTop: spacing[2], marginBottom: spacing[2] }}>
            <FilterChipRail
              options={BROWSE_FILTER_OPTIONS}
              selectedId={selectedFilter}
              onSelect={setSelectedFilter}
              gap={spacing[2]}
            />
          </View>
        </View>

        <FlashList
          data={filteredFeedItems}
          renderItem={renderBrowseItem}
          keyExtractor={(item) => item.id}
          onViewableItemsChanged={handleFullyVisibleFeedItemsChanged}
          viewabilityConfig={fullTileViewabilityConfig}
          // @ts-ignore FlashList v2 runtime supports this prop but its bundled RN type omits it.
          estimatedItemSize={220}
          numColumns={numColumns}
          contentContainerStyle={{ paddingBottom: spacing[12] }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isBrowseDataReady ? (
              <EmptyState title="No matches found" body="Try another search or filter." />
            ) : (
              <BrowseGridLoadingState itemWidth={itemWidth} />
            )
          }
        />
      </View>
    </Screen>
  );
}

const browseStyles = StyleSheet.create({
  authorBadge: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    left: 8,
    padding: 4,
    paddingRight: 8,
    position: "absolute",
    top: 8,
  },
  backButton: { alignItems: "center", height: 40, justifyContent: "center", width: 32 },
  cardContent: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 10 },
  metaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  searchRow: { alignItems: "center", flexDirection: "row", gap: 12, zIndex: 30 },
  titleRow: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 10 },
  inlineSearchLauncher: {
    alignItems: "center",
    position: "relative",
    height: 56,
    overflow: "visible",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
    padding: 0,
    textAlignVertical: "center",
  },
  searchDismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 20,
  },
});

export function BrowseDishesScreen() {
  return <BrowseGridScreen mode="dishes" />;
}

export function BrowseStallsScreen() {
  return <BrowseGridScreen mode="stalls" />;
}

export function SearchResultsScreen() {
  const route = useRoute<SearchResultsRoute>();
  const navigation = useNavigation<RootNavigation>();
  const { profile, filters } = useSearchData();
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const updateQuery = useSearchStore((state) => state.updateQuery);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const lastRecordedQueryRef = useRef("");
  const sortMode: SearchSortMode = "best_match";
  const browseMode = route.params?.browseMode;
  const initialQuery = route.params?.initialQuery ?? "";
  const [serviceResults, setServiceResults] = useState<DishDetail[] | null>(null);
  useEffect(() => {
    let active = true;
    setServiceResults(null);
    if (browseMode) {
      return () => {
        active = false;
      };
    }

    void getSearchResultsAsync(filters, profile.tasteVector)
      .then((results) => {
        if (active) setServiceResults(results);
      })
      .catch(() => {
        if (active) setServiceResults(null);
      });

    return () => {
      active = false;
    };
  }, [browseMode, filters, profile.tasteVector]);
  const rawResults = useMemo(
    () => serviceResults ?? getSearchResults(filters, profile.tasteVector),
    [filters, profile.tasteVector, serviceResults],
  );
  const results = useMemo(
    () => sortSearchResults(rawResults, sortMode, profile.tasteVector),
    [profile.tasteVector, rawResults, sortMode],
  );

  useEffect(() => {
    const leadingResults = results.slice(0, 6);
    prefetchImages(
      leadingResults.map((dish) => dish.imageUrl),
      8,
    );
    leadingResults.slice(0, 3).forEach((dish) => {
      prefetchDishDetail(dish.id);
      prefetchStallDetail(dish.venueId);
    });
  }, [results]);

  const recordCommittedSearchQuery = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery || lastRecordedQueryRef.current === normalizedQuery) {
        return;
      }
      lastRecordedQueryRef.current = normalizedQuery;
      recordTasteInteraction({
        type: "search_query",
        surface: "search",
        query: normalizedQuery,
      });
    },
    [recordTasteInteraction],
  );

  if (browseMode) {
    return <BrowseGridScreen mode={browseMode} initialSearchQuery={initialQuery} />;
  }

  return (
    <Screen scroll={false}>
      <SearchResultsView
        query={filters.query}
        onQueryChange={updateQuery}
        onClear={() => updateQuery("")}
        onSubmitQuery={recordCommittedSearchQuery}
        onTasteFilterPress={() => navigation.navigate("TasteFilter")}
        results={results}
        onResultPressIn={(dish) => {
          prefetchDishDetail(dish.id);
          preloadRoute(navigation, "DishDetail", { dishId: dish.id });
        }}
        onResultPress={(dish) => {
          navigation.navigate("DishDetail", { dishId: dish.id });
          scheduleIdleWork(
            () => {
              recordTasteInteraction({
                type: "dish_result_click",
                surface: "search",
                dish,
                query: filters.query,
                buttonId: "search_result",
              });
              rememberSearch(filters.query);
            },
            { timeout: 500, fallbackDelayMs: 80 },
          );
        }}
      />
    </Screen>
  );
}
