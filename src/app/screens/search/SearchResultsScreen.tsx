import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
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
import {
  AccessibleImage,
  AppText,
  Avatar,
  Button,
  EmptyState,
  FilterChipRail,
  Screen,
  Skeleton,
} from "@/components/ui";
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
import { appendUniqueById } from "@/lib/services/catalog/paging";
import {
  getCatalogRawService,
  getDataRepository,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type {
  CatalogPageRequest,
  CatalogRawDishCard,
  CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { CatalogAccessError } from "@/lib/services/catalog";
import {
  recordCatalogDiagnostic,
  summarizeCatalogRequest,
} from "@/lib/services/catalog/diagnostics";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
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
const RAW_BROWSE_FILTER_OPTIONS = BROWSE_FILTER_OPTIONS.filter((option) =>
  ["All", "Halal", "Japanese", "Western", "Noodles", "Rice"].includes(option.id),
);
const BROWSE_GRID_HYDRATION_TIMEOUT_MS = 350;
const BROWSE_GRID_HYDRATION_FALLBACK_DELAY_MS = 80;

function BrowseGridLoadingState({
  itemWidth,
  mode,
}: {
  itemWidth: number;
  mode: "dishes" | "stalls";
}) {
  const { palette, spacing } = useHungryTheme();
  const loadingLabel = mode === "dishes" ? "Preparing dishes" : "Preparing stalls";

  return (
    <View accessibilityLabel={loadingLabel} accessibilityRole="progressbar">
      <View style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[5] }}>
        <ActivityIndicator color={palette.orange} />
        <AppText tone="secondary">{loadingLabel}…</AppText>
      </View>
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
    </View>
  );
}

type RawCatalogItem = CatalogRawDishCard | CatalogRawVenueCard;

function rawCatalogRequest(
  mode: "dishes" | "stalls",
  query: string,
  selectedFilter: string,
  coordinate: { latitude: number; longitude: number },
  cursor?: string,
): CatalogPageRequest {
  const filter = selectedFilter.toLowerCase();
  return {
    query: query.trim() || undefined,
    coordinate,
    radiusMeters: query.trim() ? undefined : 3_000,
    cursor,
    limit: 24,
    sort: query.trim() ? "relevance" : "nearby",
    dietaryFlags: filter === "halal" ? ["halal"] : [],
    cuisineTags: ["japanese", "western", "noodles", "rice"].includes(filter) ? [filter] : [],
    openOnly: mode === "stalls" && filter === "local",
  };
}

function RawCatalogCard({
  item,
  itemWidth,
  mode,
  onPress,
}: {
  item: RawCatalogItem;
  itemWidth: number;
  mode: "dishes" | "stalls";
  onPress: () => void;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isDish = mode === "dishes";
  const imageUrl =
    item.imageUrl ?? ("representativeDish" in item ? item.representativeDish?.imageUrl : undefined);
  const title = isDish ? (item as CatalogRawDishCard).name : (item as CatalogRawVenueCard).name;
  const subtitle = isDish
    ? (item as CatalogRawDishCard).venueName
    : ((item as CatalogRawVenueCard).representativeDish?.name ?? "Menu details available");
  const price = isDish ? (item as CatalogRawDishCard).price : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      onPress={onPress}
      style={{ padding: spacing[1], width: itemWidth }}
    >
      <View
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          minHeight: itemWidth * 1.25,
          overflow: "hidden",
        }}
      >
        <View style={{ backgroundColor: palette.bgSoft, height: itemWidth * 0.7 }}>
          {imageUrl ? (
            <AccessibleImage
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`${title} image`}
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <AppText tone="muted" variant="micro">
                Image unavailable
              </AppText>
            </View>
          )}
          {item.verificationStatus !== "approved" ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.pill,
                left: spacing[2],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                position: "absolute",
                top: spacing[2],
              }}
            >
              <AppText variant="micro" style={{ color: palette.textMuted, fontSize: 10 }}>
                {item.verificationStatus === "verified" ? "Source verified" : "Unverified"}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ gap: spacing[1], padding: spacing[2] }}>
          <AppText numberOfLines={2} variant="bodyBold">
            {title}
          </AppText>
          <AppText numberOfLines={1} tone="secondary" variant="micro">
            {subtitle}
          </AppText>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText tone="muted" variant="micro">
              {item.distanceMeters !== undefined
                ? `${Math.round(item.distanceMeters)} m`
                : "Singapore"}
            </AppText>
            {price !== undefined ? (
              <AppText style={{ color: palette.orange }} variant="price">
                S${price.toFixed(2)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RawCatalogBrowseGrid({
  initialFoodTypeTag,
  initialSearchQuery = "",
  mode,
}: {
  initialFoodTypeTag?: string;
  initialSearchQuery?: string;
  mode: "dishes" | "stalls";
}) {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const initialRawFilter = RAW_BROWSE_FILTER_OPTIONS.find(
    (option) => option.id.toLowerCase() === initialFoodTypeTag?.toLowerCase(),
  )?.id;
  const [selectedFilter, setSelectedFilter] = useState(initialRawFilter ?? "All");
  const [items, setItems] = useState<RawCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [releaseId, setReleaseId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const rawSearchInputRef = useRef<TextInput | null>(null);
  const releaseIdRef = useRef<string | undefined>(undefined);
  const service = getCatalogRawService();
  const itemWidth = width / 2;

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (!service || !isAuthenticated) return;
      const startedAt = Date.now();
      const version = requestVersion.current;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      setLoadMoreError(null);
      try {
        const request = rawCatalogRequest(
          mode,
          searchQuery,
          selectedFilter,
          currentLocation,
          cursor,
        );
        request.releaseId = cursor ? releaseIdRef.current : undefined;
        const page =
          mode === "dishes" ? await service.listDishes(request) : await service.listVenues(request);
        if (requestVersion.current !== version) return;
        // Defensive dedupe: FlashList keys must stay unique even if a source
        // repeats a row across pages.
        setItems((current) => (append ? appendUniqueById(current, page.items) : page.items));
        setNextCursor(page.nextCursor);
        releaseIdRef.current = page.releaseId || undefined;
        setReleaseId(releaseIdRef.current);
        recordCatalogDiagnostic({
          operation:
            mode === "dishes"
              ? searchQuery.trim()
                ? "search-dishes"
                : "browse-dishes"
              : searchQuery.trim()
                ? "search-stalls"
                : "browse-stalls",
          durationMs: Date.now() - startedAt,
          releaseId: page.releaseId,
          request: summarizeCatalogRequest(request),
          resultCount: page.items.length,
          succeeded: true,
        });
      } catch (loadError) {
        if (requestVersion.current === version) {
          const message =
            loadError instanceof Error ? loadError.message : "Could not load the catalog.";
          // A failed continuation keeps the rows already shown (same source) and
          // offers a retry for the same cursor instead of switching source.
          if (append) setLoadMoreError(message);
          else {
            setError(message);
            setItems([]);
          }
          const request = rawCatalogRequest(
            mode,
            searchQuery,
            selectedFilter,
            currentLocation,
            cursor,
          );
          recordCatalogDiagnostic({
            operation:
              mode === "dishes"
                ? searchQuery.trim()
                  ? "search-dishes"
                  : "browse-dishes"
                : searchQuery.trim()
                  ? "search-stalls"
                  : "browse-stalls",
            durationMs: Date.now() - startedAt,
            errorKind:
              loadError instanceof CatalogAccessError
                ? loadError.kind
                : loadError instanceof Error
                  ? loadError.name
                  : "unknown",
            request: summarizeCatalogRequest(request),
            resultCount: 0,
            succeeded: false,
          });
        }
      } finally {
        if (requestVersion.current === version) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [currentLocation, isAuthenticated, mode, searchQuery, selectedFilter, service],
  );

  useEffect(() => {
    requestVersion.current += 1;
    releaseIdRef.current = undefined;
    setReleaseId(undefined);
    const timer = setTimeout(
      () => {
        void loadPage();
      },
      searchQuery.trim() ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [loadPage]);

  if (!isAuthenticated) {
    return (
      <Screen scroll={false}>
        <EmptyState
          title="Sign in to browse the full directory"
          body="The complete Hungry catalog is available after you sign in."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{ gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft color={palette.text} size={24} />
            </Pressable>
            <View style={{ flex: 1, height: 48, justifyContent: "center" }}>
              <TextInput
                ref={rawSearchInputRef}
                accessibilityLabel={`Search ${mode}`}
                autoCorrect={false}
                onChangeText={setSearchQuery}
                placeholder={mode === "dishes" ? "Search all dishes" : "Search all stalls"}
                placeholderTextColor={palette.textMuted}
                style={[
                  browseStyles.textInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: 18,
                    borderWidth: 1,
                    color: palette.text,
                    height: 48,
                    paddingLeft: spacing[3],
                    paddingRight: spacing[3] + 28,
                  },
                ]}
                value={searchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={12}
                  onPress={() => {
                    setSearchQuery("");
                    rawSearchInputRef.current?.focus();
                  }}
                  style={{ position: "absolute", right: spacing[3] }}
                >
                  <X color={palette.textMuted} size={20} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <FilterChipRail
            options={RAW_BROWSE_FILTER_OPTIONS}
            selectedId={selectedFilter}
            onSelect={setSelectedFilter}
          />
        </View>
        <FlashList
          data={items}
          keyboardShouldPersistTaps="handled"
          // @ts-ignore FlashList v2 supports this runtime prop but its bundled type omits it.
          estimatedItemSize={itemWidth * 1.25}
          keyExtractor={(item) => item.id}
          numColumns={2}
          onEndReached={() => {
            if (nextCursor && !isLoadingMore && !isLoading && !loadMoreError) {
              void loadPage(nextCursor, true);
            }
          }}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <RawCatalogCard
              item={item}
              itemWidth={itemWidth}
              mode={mode}
              onPress={() =>
                navigation.navigate("CatalogRawDetail", {
                  kind: mode === "dishes" ? "dish" : "venue",
                  id: item.id,
                  releaseId,
                })
              }
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <BrowseGridLoadingState itemWidth={itemWidth} mode={mode} />
            ) : error ? (
              <EmptyState
                title="Catalog unavailable"
                body={error}
                ctaLabel="Retry"
                onPress={() => void loadPage()}
              />
            ) : (
              <EmptyState title="No matches found" body="Try another search or filter." />
            )
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: spacing[4] }}>
                <ActivityIndicator color={palette.orange} />
              </View>
            ) : loadMoreError && nextCursor ? (
              <View
                accessibilityLiveRegion="polite"
                style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[4] }}
              >
                <AppText tone="secondary" variant="bodySmall">
                  {"Couldn't load more results."}
                </AppText>
                <Button
                  label="Retry"
                  variant="secondary"
                  onPress={() => void loadPage(nextCursor, true)}
                />
              </View>
            ) : null
          }
        />
      </View>
    </Screen>
  );
}

function BrowseGridScreen(props: {
  initialFoodTypeTag?: string;
  mode: "dishes" | "stalls";
  initialSearchQuery?: string;
}) {
  const shouldUseCatalogReadV2 =
    FEATURE_FLAGS.catalogReadV2 && getServiceProvider().mode === "supabase";
  return shouldUseCatalogReadV2 ? (
    <RawCatalogBrowseGrid {...props} />
  ) : (
    <LegacyBrowseGridScreen {...props} />
  );
}

function LegacyBrowseGridScreen({
  initialFoodTypeTag,
  mode,
  initialSearchQuery = "",
}: {
  initialFoodTypeTag?: string;
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
  const normalizedFoodTypeTag = initialFoodTypeTag?.trim().toLowerCase() ?? "";
  const shouldUseQueryScopedFeed = normalizedQuery.length > 0 || normalizedFoodTypeTag.length > 0;
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
      foodTypeTag: normalizedFoodTypeTag || undefined,
      query: normalizedFoodTypeTag ? undefined : searchQuery,
      radiusMeters: 100000,
    });
  }, [
    browseIndex,
    normalizedFoodTypeTag,
    profile.dietaryPreferences,
    searchQuery,
    shouldUseQueryScopedFeed,
  ]);
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
                      accessibilityLabel="Search browse results"
                      autoCorrect={false}
                      onBlur={hideSearch}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={recordBrowseSearchQuery}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={palette.textMuted}
                      returnKeyType="search"
                      testID="browse-results-search-input"
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
                        onPress={() => {
                          setSearchQuery("");
                          searchInputRef.current?.focus();
                        }}
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
              style={{ marginLeft: 0 }}
              gap={spacing[3]}
              edgePadding={spacing[4]}
              contentContainerStyle={{ paddingVertical: spacing[3] }}
            />
          </View>
        </View>

        <FlashList
          data={filteredFeedItems}
          keyboardShouldPersistTaps="handled"
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
              <BrowseGridLoadingState itemWidth={itemWidth} mode={mode} />
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
  const storedQuery = useSearchStore((state) => state.filters.query);
  const selectedCategories = useSearchStore((state) => state.filters.categories);
  const storedCatalogCategory = selectedCategories.find((category) =>
    ["noodles", "rice"].includes(category),
  );
  const shouldUseCatalogReadV2 =
    FEATURE_FLAGS.catalogReadV2 && getServiceProvider().mode === "supabase";

  if (shouldUseCatalogReadV2) {
    return (
      <RawCatalogBrowseGrid
        mode={route.params?.browseMode ?? "dishes"}
        initialFoodTypeTag={route.params?.foodTypeTag ?? storedCatalogCategory}
        initialSearchQuery={route.params?.initialQuery ?? storedQuery}
      />
    );
  }

  return <LegacySearchResultsScreen />;
}

function LegacySearchResultsScreen() {
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
  const foodTypeTag = route.params?.foodTypeTag;
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
    return (
      <BrowseGridScreen
        mode={browseMode}
        initialFoodTypeTag={foodTypeTag}
        initialSearchQuery={initialQuery}
      />
    );
  }

  return (
    <Screen scroll={false}>
      <SearchResultsView
        query={filters.query}
        onQueryChange={updateQuery}
        onClear={() => updateQuery("")}
        onBack={() =>
          navigation.canGoBack()
            ? navigation.goBack()
            : navigation.navigate("MainTabs", { screen: "Discover" })
        }
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
