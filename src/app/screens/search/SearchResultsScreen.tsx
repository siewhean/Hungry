import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Info,
  MapPin,
  MapPinOff,
  Share2,
  Star,
  X,
} from "lucide-react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  FilterChipRail,
  IconButton,
  Screen,
  Skeleton,
} from "@/components/ui";
import { appendUniqueById } from "@/lib/services/catalog/paging";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import {
  BROWSE_ALL_FILTER,
  BROWSE_FILTER_IDS,
  BROWSE_SORT_OPTIONS,
  SEARCH_SHARE_LINKS_LIVE,
  buildBrowseRequest,
  buildSearchShareUrl,
  cardAccessibilityLabel,
  cardSubtitle,
  describeMatchCount,
  describeResultsSummary,
  effectiveSortLabel,
  formatBrowseDistance,
  isTooShortQuery,
  mergeStallOutlets,
  normalizeQuery,
  parseFilterIds,
  ratingPillText,
  toggleFilterId,
  type BrowseFilterId,
  type BrowseItem,
  type BrowseMode,
  type BrowseSortId,
  type StallRow,
} from "@/features/search/browseGrid";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import {
  CATALOG_OFFLINE_RELEASE_ID,
  CATALOG_QUERY_MAX_CHARS,
  CATALOG_QUERY_MIN_CHARS,
  CATALOG_SUGGEST_MIN_CHARS,
  type CatalogPlace,
  type CatalogRawDishCard,
  type CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { CatalogAccessError, CatalogReleaseExpiredError } from "@/lib/services/catalog";
import {
  recordCatalogDiagnostic,
  summarizeCatalogRequest,
} from "@/lib/services/catalog/diagnostics";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
type SearchResultsRoute = RouteProp<RootStackParamList, "SearchResults">;
type SearchSource = NonNullable<NonNullable<RootStackParamList["SearchResults"]>["source"]>;
/** A typed query counts as a search once its results have been on screen this long. */
const SEARCH_SETTLE_MS = 1_500;

function newSearchId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const RAW_BROWSE_FILTER_OPTIONS = [BROWSE_ALL_FILTER, ...BROWSE_FILTER_IDS].map((filter) => ({
  id: filter,
  label: filter,
}));
/** "Search all Singapore" when the 3 km browse radius is empty: wide enough to cover the island. */
const WIDE_RADIUS_METERS = 30_000;

/** Religious dietary choices are reported as "dietary", not by name (privacy, like onboarding). */
function analyticsFilterName(filter: string) {
  return filter === "Halal" ? "dietary" : filter;
}

/** ~100 m buckets, so a GPS refresh that barely moves does not reset the list. */
function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function BrowseGridLoadingState({ itemWidth, mode }: { itemWidth: number; mode: BrowseMode }) {
  const { palette, spacing } = useHungryTheme();
  const loadingLabel = mode === "dishes" ? "Finding dishes" : "Finding stalls";

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

const RawCatalogCard = memo(function RawCatalogCard({
  index,
  item,
  itemWidth,
  mode,
  onOpen,
}: {
  index: number;
  item: BrowseItem;
  itemWidth: number;
  mode: BrowseMode;
  onOpen: (item: BrowseItem, index: number) => void;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isDish = mode === "dishes";
  const dish = isDish ? (item as CatalogRawDishCard) : undefined;
  const stall = isDish ? undefined : (item as StallRow);
  const imageUrl =
    item.imageUrl ?? ("representativeDish" in item ? item.representativeDish?.imageUrl : undefined);
  const title = item.name;
  const stallName = dish ? dish.venueName || title : title;
  const stallRating = ratingPillText(stall?.qualityRating, stall?.qualityReviewCount);
  // On a stall card the rating is its top dish's, which the pill says so it is not read as the
  // stall's own rating (SEARCH-V5).
  const rating = dish
    ? ratingPillText(dish.rating, dish.reviewCount)
    : stallRating
      ? `Top dish ${stallRating}`
      : undefined;
  const outlets = stall?.extraOutlets ?? 0;
  const isVerified = item.verificationStatus === "approved";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cardAccessibilityLabel(mode, item)}
      accessibilityHint={isDish ? "Opens the dish" : "Opens the stall"}
      onPress={() => onOpen(item, index)}
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
              decorative
            />
          ) : (
            // Most catalog rows have no cleared photo; show the stall's initials, not a grey caption.
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <StallLogoMark name={stallName} size={Math.round(itemWidth * 0.3)} />
            </View>
          )}
          {/* One badge only: approved rows are "Verified"; every other row carries no pill. */}
          {isVerified ? (
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
              <AppText variant="micro" style={{ color: palette.textSecondary }}>
                Verified
              </AppText>
            </View>
          ) : null}
          {outlets > 0 ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                position: "absolute",
                right: spacing[2],
                top: spacing[2],
              }}
            >
              <AppText variant="micro" style={{ color: palette.textSecondary }}>
                {`+${outlets} ${outlets === 1 ? "outlet" : "outlets"}`}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ gap: spacing[1], padding: spacing[2] }}>
          <AppText numberOfLines={2} variant="bodyBold">
            {title}
          </AppText>
          <AppText numberOfLines={2} tone="secondary" variant="micro">
            {cardSubtitle(mode, item)}
          </AppText>
          {rating ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
              <Star color={palette.starFill} fill={palette.starFill} size={12} />
              <AppText tone="secondary" variant="micro">
                {rating}
              </AppText>
            </View>
          ) : stall && stall.menuCount > 0 ? (
            <AppText tone="secondary" variant="micro">
              {`${stall.menuCount} ${stall.menuCount === 1 ? "dish" : "dishes"}`}
            </AppText>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <AppText tone="muted" variant="micro">
              {item.distanceMeters !== undefined
                ? formatBrowseDistance(item.distanceMeters)
                : "Singapore"}
            </AppText>
            {dish?.price !== undefined ? (
              <AppText style={{ color: palette.text }} variant="price">
                S${dish.price.toFixed(2)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const MODE_LABELS = { dishes: "Dishes", stalls: "Stalls" } as const;

type BrowsePlace = { id: string; name: string };

function RawCatalogBrowseGrid({
  allowModeSwitch = false,
  initialFilter,
  initialPlace,
  initialSearchQuery = "",
  initialSource,
  mode: initialMode,
}: {
  allowModeSwitch?: boolean;
  initialFilter?: string;
  initialPlace?: BrowsePlace;
  initialSearchQuery?: string;
  initialSource?: SearchSource;
  mode: BrowseMode;
}) {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const [mode, setMode] = useState(initialMode);
  const [searchText, setSearchText] = useState(initialSearchQuery);
  // A picked mall, hawker centre or food court: only its stalls and dishes are listed.
  const [place, setPlace] = useState<BrowsePlace | undefined>(initialPlace);
  const initialPlaceId = initialPlace?.id;
  const initialPlaceName = initialPlace?.name;
  const [placeMatches, setPlaceMatches] = useState<{ query: string; items: CatalogPlace[] }>({
    query: "",
    items: [],
  });
  const [filters, setFilters] = useState<readonly BrowseFilterId[]>(() =>
    parseFilterIds(initialFilter),
  );
  const [sort, setSort] = useState<BrowseSortId>("relevance");
  // "Search all Singapore" applies only to the query, filters and place it was tapped for.
  const [widenedScope, setWidenedScope] = useState<string | null>(null);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [matchCount, setMatchCount] = useState<number | undefined>();
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A failed next page waits for a tap on Retry instead of re-firing on every scroll.
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  // The text of a submitted search (Enter, a suggestion, a link); only these are logged as zero results.
  const [committedQuery, setCommittedQuery] = useState(() => normalizeQuery(initialSearchQuery));
  // The request whose first page is on screen, so "no results" is never shown for a stale one.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // The page on screen came from the bundled offline copy, not the live catalog.
  const [isOfflineCopy, setIsOfflineCopy] = useState(false);
  const [didYouMean, setDidYouMean] = useState<{ query: string; label: string } | null>(null);
  const requestVersion = useRef(0);
  const rawSearchInputRef = useRef<TextInput | null>(null);
  const releaseIdRef = useRef<string | undefined>(undefined);
  const listRef = useRef<FlashListRef<BrowseItem>>(null);
  const sortSheetRef = useRef<BottomSheetModal>(null);
  const lastRecordedQueryRef = useRef("");
  const loggedZeroKeyRef = useRef("");
  // One id per counted search, carried on its result-opened and zero-results events.
  const searchIdRef = useRef<string | undefined>(undefined);
  const service = getCatalogRawService();
  const itemWidth = width / 2;

  const query = useMemo(() => normalizeQuery(searchText), [searchText]);
  const tooShort = isTooShortQuery(query);
  const widenScope = JSON.stringify([mode, query, filters, place?.id]);
  const widenRadius = widenedScope === widenScope;

  // A link or a new navigation with other params replaces what the grid shows.
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  useEffect(() => {
    setSearchText(initialSearchQuery);
  }, [initialSearchQuery]);
  useEffect(() => {
    setPlace(initialPlaceId ? { id: initialPlaceId, name: initialPlaceName ?? "" } : undefined);
  }, [initialPlaceId, initialPlaceName]);
  useEffect(() => {
    setFilters(parseFilterIds(initialFilter));
  }, [initialFilter]);

  // A picked area wins over GPS; without either the default point is used and disclosed below.
  const { coordinate: effectiveCoordinate, isApproximate: isUsingDefaultLocation } =
    getEffectiveLocation({ permission, currentLocation, manualCoordinate });
  const latitude = roundCoordinate(effectiveCoordinate.latitude);
  const longitude = roundCoordinate(effectiveCoordinate.longitude);
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  const requestKey = useMemo(
    () => JSON.stringify([mode, query, filters, sort, latitude, longitude, widenRadius, place?.id]),
    [filters, latitude, longitude, mode, place?.id, query, sort, widenRadius],
  );

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (!isAuthenticated) return;
      const startedAt = Date.now();
      const version = requestVersion.current;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      setLoadMoreFailed(false);
      try {
        const request = buildBrowseRequest({
          query,
          filters,
          sort,
          coordinate,
          cursor,
          releaseId: releaseIdRef.current,
          buildingId: place?.id,
        });
        if (widenRadius && !query && !place) request.radiusMeters = WIDE_RADIUS_METERS;
        const page =
          mode === "dishes" ? await service.listDishes(request) : await service.listVenues(request);
        if (requestVersion.current !== version) return;
        // Defensive dedupe: FlashList keys must stay unique even if a source
        // repeats a row across pages.
        setItems((current) => (append ? appendUniqueById(current, page.items) : page.items));
        setNextCursor(page.nextCursor);
        releaseIdRef.current = page.releaseId || undefined;
        setIsOfflineCopy(page.releaseId === CATALOG_OFFLINE_RELEASE_ID);
        recordCatalogDiagnostic({
          operation:
            mode === "dishes"
              ? query.trim()
                ? "search-dishes"
                : "browse-dishes"
              : query.trim()
                ? "search-stalls"
                : "browse-stalls",
          durationMs: Date.now() - startedAt,
          releaseId: page.releaseId,
          request: summarizeCatalogRequest(request),
          resultCount: page.items.length,
          succeeded: true,
        });
        if (append) {
          trackAnalyticsEvent("search_load_more", { mode, count: page.items.length });
        } else {
          const count = page.matchCount ?? page.items.length;
          setMatchCount(count);
          setLoadedKey(requestKey);
          // New results start at the top, not wherever the old list was scrolled to.
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
          // Screen readers hear the result count when a new set lands.
          AccessibilityInfo.announceForAccessibility(describeMatchCount(count, mode));
        }
      } catch (loadError) {
        if (
          requestVersion.current === version &&
          append &&
          loadError instanceof CatalogReleaseExpiredError
        ) {
          // The pinned release expired mid-scroll: start again on the active release.
          releaseIdRef.current = undefined;
          setIsLoadingMore(false);
          void loadPageRef.current?.();
          return;
        }
        if (requestVersion.current === version) {
          reportError(loadError, { surface: "catalog_browse", mode });
          if (append) {
            setLoadMoreFailed(true);
          } else {
            setError(
              loadError instanceof Error ? loadError.message : "Could not load the catalog.",
            );
            setItems([]);
          }
          const request = buildBrowseRequest({
            query,
            filters,
            sort,
            coordinate,
            cursor,
            releaseId: releaseIdRef.current,
            buildingId: place?.id,
          });
          recordCatalogDiagnostic({
            operation:
              mode === "dishes"
                ? query.trim()
                  ? "search-dishes"
                  : "browse-dishes"
                : query.trim()
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
    [
      coordinate,
      filters,
      isAuthenticated,
      mode,
      place,
      query,
      requestKey,
      service,
      sort,
      widenRadius,
    ],
  );

  const loadPageRef = useRef<typeof loadPage | undefined>(undefined);
  loadPageRef.current = loadPage;

  // A search is committed by Enter, a suggestion or a link, not by typing pauses: one search
  // event, one taste signal and one recent-search entry each, the same for guests and members.
  const recordCommittedQuery = useCallback(
    (
      text: string,
      options: {
        recordTaste: boolean;
        remember: boolean;
        source: SearchSource | "results" | "results_typed";
      },
    ) => {
      const committed = normalizeQuery(text);
      const key = committed.toLowerCase();
      if (key.length < CATALOG_QUERY_MIN_CHARS) return;
      setCommittedQuery(committed);
      if (lastRecordedQueryRef.current === key) return;
      lastRecordedQueryRef.current = key;
      searchIdRef.current = newSearchId();
      trackAnalyticsEvent("search_query", {
        mode,
        filter: filters.map(analyticsFilterName).join(",") || BROWSE_ALL_FILTER,
        query_length: committed.length,
        search_id: searchIdRef.current,
        source: options.source,
      });
      if (options.remember) rememberSearch(committed);
      if (options.recordTaste) {
        recordTasteInteraction({
          type: "search_query",
          surface: "search",
          query: key,
          chipId: filters.length ? filters.join(",") : undefined,
        });
      }
    },
    [filters, mode, recordTasteInteraction, rememberSearch],
  );

  // A query that arrives with the screen (Search home, a link, a Discover chip) is a submitted one.
  // Discover chips already logged their taste signal and are not saved as recent searches.
  const initialQueryRecordedRef = useRef(false);
  useEffect(() => {
    if (initialQueryRecordedRef.current) return;
    initialQueryRecordedRef.current = true;
    const fromDiscoverChip = initialSource === "discover_chip";
    recordCommittedQuery(initialSearchQuery, {
      recordTaste: isAuthenticated && !fromDiscoverChip,
      remember: !fromDiscoverChip,
      source: initialSource ?? "search_typed",
    });
  }, [initialSearchQuery, initialSource, isAuthenticated, recordCommittedQuery]);

  useEffect(() => {
    requestVersion.current += 1;
    releaseIdRef.current = undefined;
    // One typed character matches most of the catalog and is not sent; the hint says why.
    if (tooShort) {
      // Old results must not stay on screen (and tappable) under a query they do not answer.
      setIsLoading(false);
      setItems([]);
      setMatchCount(undefined);
      setNextCursor(undefined);
      return;
    }
    const timer = setTimeout(
      () => {
        void loadPage();
      },
      query ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [loadPage, query, tooShort]);

  // Typing a mall or hawker centre name offers the place itself, so its stalls can be listed
  // without the fuzzy name matches from other buildings.
  useEffect(() => {
    if (place || tooShort || query.length < CATALOG_SUGGEST_MIN_CHARS) return;
    let active = true;
    const timer = setTimeout(() => {
      service
        .listPlaces({ query, coordinate, limit: 3 })
        .then((matches) => {
          if (active) setPlaceMatches({ query, items: matches });
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [coordinate, place, query, service, tooShort]);
  const offeredPlaces =
    !place && placeMatches.query === query && query.length >= CATALOG_SUGGEST_MIN_CHARS
      ? placeMatches.items
      : [];

  const selectPlace = useCallback(
    (next: BrowsePlace) => {
      trackAnalyticsEvent("search_place_selected", { mode });
      setItems([]);
      setSearchText("");
      setPlace(next);
    },
    [mode],
  );
  const clearPlace = useCallback(() => {
    setItems([]);
    setPlace(undefined);
  }, []);

  // Zero results are logged only for a submitted query, once, with the (capped) text so
  // "what did people fail to find" can be answered. Partial typing is never logged.
  const hasNoResults = loadedKey === requestKey && !isLoading && !error && items.length === 0;

  // Results load while the user types, so a typed query that stays on screen is a search too,
  // not only one submitted with Enter. Not saved as a recent and not a taste signal.
  const resultsSettled = loadedKey === requestKey && !isLoading && !error;
  useEffect(() => {
    if (!resultsSettled || query.length < CATALOG_QUERY_MIN_CHARS) return;
    const timer = setTimeout(
      () =>
        recordCommittedQuery(query, {
          recordTaste: false,
          remember: false,
          source: "results_typed",
        }),
      SEARCH_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, recordCommittedQuery, resultsSettled]);
  useEffect(() => {
    if (!hasNoResults || !committedQuery) return;
    if (committedQuery.toLowerCase() !== query.toLowerCase()) return;
    if (loggedZeroKeyRef.current === requestKey) return;
    loggedZeroKeyRef.current = requestKey;
    trackAnalyticsEvent("search_zero_results", {
      mode,
      filter: filters.map(analyticsFilterName).join(",") || BROWSE_ALL_FILTER,
      // The text itself only when the user allows search history (Settings).
      ...(allowSearchHistory ? { query: committedQuery.slice(0, CATALOG_QUERY_MAX_CHARS) } : {}),
      query_length: committedQuery.length,
      search_id: searchIdRef.current,
    });
  }, [allowSearchHistory, committedQuery, filters, hasNoResults, mode, query, requestKey]);

  // "Did you mean": the closest food type for a typed query with no results. With filters on,
  // the filters are the likelier cause, so "Clear filters" is offered instead.
  useEffect(() => {
    if (!hasNoResults || filters.length > 0 || query.length < CATALOG_QUERY_MIN_CHARS) return;
    let active = true;
    service
      .suggest(query)
      .then((suggestions) => {
        const match = suggestions.find(
          (suggestion) =>
            suggestion.kind === "food_type" &&
            suggestion.label.toLowerCase() !== query.toLowerCase(),
        );
        if (active && match) setDidYouMean({ query, label: match.label });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [filters.length, hasNoResults, query, service]);

  const handleSelectFilter = useCallback(
    (filter: string) => {
      const next = toggleFilterId(filters, filter);
      setFilters(next);
      trackAnalyticsEvent("search_filter_changed", {
        mode,
        filter: analyticsFilterName(filter),
        selected: filter !== BROWSE_ALL_FILTER && next.some((id) => id === filter),
      });
    },
    [filters, mode],
  );

  const handleSelectSort = useCallback(
    (next: BrowseSortId) => {
      setSort(next);
      sortSheetRef.current?.dismiss();
      trackAnalyticsEvent("search_sort_changed", { mode, sort: next });
    },
    [mode],
  );

  const handleBack = useCallback(() => {
    // Cold starts and links have nothing to go back to.
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Discover" });
  }, [navigation]);

  const handleShare = useCallback(() => {
    const url = buildSearchShareUrl({ query, filters, mode, place, sort });
    trackAnalyticsEvent("search_shared", { mode, filter_count: filters.length });
    // iOS sends both message and url, so the link goes only in `url` there.
    const content =
      Platform.OS === "ios"
        ? { message: "Search Hungry", url }
        : { message: `Search Hungry: ${url}` };
    void Share.share(content).catch(() => undefined);
  }, [filters, mode, place, query, sort]);

  // Cards get one stable press handler; the live query and release are read when a card is tapped.
  const queryRef = useRef(query);
  const modeRef = useRef(mode);
  useEffect(() => {
    queryRef.current = query;
    modeRef.current = mode;
  }, [mode, query]);
  const handleOpen = useCallback(
    (item: BrowseItem, index: number) => {
      const openedMode = modeRef.current;
      const releaseId = releaseIdRef.current;
      // Live catalog dish ids are dish ids: open the dish page, which shows this catalog record
      // if it can't load the dish. The offline copy and stalls keep the catalog page.
      if (openedMode === "dishes" && !releaseId?.startsWith("excel-fallback")) {
        navigation.navigate("DishDetail", {
          dishId: item.id,
          source: "search",
          catalogFallback: { releaseId },
        });
      } else {
        navigation.navigate("CatalogRawDetail", {
          kind: openedMode === "dishes" ? "dish" : "venue",
          id: item.id,
          releaseId,
        });
      }
      trackAnalyticsEvent("search_result_opened", {
        mode: openedMode,
        position: index,
        query_length: queryRef.current.length,
        search_id: searchIdRef.current,
      });
      if (openedMode === "dishes") {
        recordTasteInteraction({
          type: "dish_result_click",
          surface: "search",
          dishId: item.id,
          query: queryRef.current || undefined,
          buttonId: "search_result",
        });
      }
    },
    [navigation, recordTasteInteraction],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: BrowseItem; index: number }) => (
      <RawCatalogCard
        index={index}
        item={item}
        itemWidth={itemWidth}
        mode={mode}
        onOpen={handleOpen}
      />
    ),
    [handleOpen, itemWidth, mode],
  );

  // Chain outlets and duplicate records of one stall show as a single card.
  const rows = useMemo<BrowseItem[]>(
    () => (mode === "stalls" ? mergeStallOutlets(items as CatalogRawVenueCard[]) : items),
    [items, mode],
  );
  const isRefreshing = isLoading && items.length > 0;
  const summary =
    matchCount !== undefined && !error && loadedKey === requestKey
      ? describeResultsSummary({
          count: matchCount,
          mode,
          hasQuery: Boolean(query),
          placeName: place?.name,
          widened: widenRadius,
        })
      : undefined;
  const sortLabel = effectiveSortLabel(sort, Boolean(query), Boolean(place));
  const suggestedQuery =
    didYouMean && didYouMean.query === query && filters.length === 0 ? didYouMean.label : undefined;
  // A place lists its whole building with no radius, so there is nothing to widen.
  const radiusInPlay = !query && !widenRadius && !place;

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{ gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <IconButton
              variant="ghost"
              accessibilityLabel="Go back"
              onPress={handleBack}
              icon={<ArrowLeft color={palette.text} size={22} />}
            />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <TextInput
                ref={rawSearchInputRef}
                accessibilityLabel={`Search ${mode}`}
                autoCorrect={false}
                maxLength={CATALOG_QUERY_MAX_CHARS}
                onChangeText={setSearchText}
                onSubmitEditing={() =>
                  recordCommittedQuery(searchText, {
                    recordTaste: true,
                    remember: true,
                    source: "results",
                  })
                }
                placeholder={
                  place
                    ? `Search ${mode} at ${place.name}`
                    : mode === "dishes"
                      ? "Search all dishes"
                      : "Search all stalls"
                }
                placeholderTextColor={palette.textMuted}
                returnKeyType="search"
                testID="browse-results-search-input"
                style={[
                  browseStyles.textInput,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: 18,
                    borderWidth: 1,
                    color: palette.text,
                    // minHeight, not height: the text must be able to grow with the system font size.
                    minHeight: 48,
                    paddingLeft: spacing[3],
                    paddingRight: searchText ? 48 : spacing[3],
                    paddingVertical: spacing[2],
                  },
                ]}
                value={searchText}
              />
              {searchText ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  onPress={() => {
                    setSearchText("");
                    rawSearchInputRef.current?.focus();
                  }}
                  style={browseStyles.clearButton}
                >
                  <X color={palette.textMuted} size={18} />
                </Pressable>
              ) : null}
            </View>
            {SEARCH_SHARE_LINKS_LIVE ? (
              <IconButton
                variant="ghost"
                accessibilityLabel="Share this search"
                onPress={handleShare}
                icon={<Share2 color={palette.text} size={20} />}
              />
            ) : null}
          </View>
          {tooShort ? (
            <AppText tone="secondary" variant="micro">
              {`Type at least ${CATALOG_QUERY_MIN_CHARS} letters to search.`}
            </AppText>
          ) : null}
          {place ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Showing only ${place.name}. Tap to show everywhere`}
              onPress={clearPlace}
              style={{
                alignItems: "center",
                alignSelf: "flex-start",
                backgroundColor: palette.surface,
                borderColor: palette.orange,
                borderRadius: 18,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[2],
                minHeight: 36,
                paddingHorizontal: spacing[3],
              }}
            >
              <MapPin color={palette.orange} size={16} />
              <AppText numberOfLines={1} variant="bodySmall" style={{ flexShrink: 1 }}>
                {place.name}
              </AppText>
              <X color={palette.textMuted} size={16} />
            </Pressable>
          ) : null}
          {offeredPlaces.length > 0 ? (
            <View accessibilityLabel="Places" style={{ gap: spacing[1] }}>
              <AppText tone="secondary" variant="micro">
                Malls, hawker centres and food courts
              </AppText>
              {offeredPlaces.map((offered) => (
                <Pressable
                  key={offered.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Show stalls at ${offered.name}`}
                  onPress={() => selectPlace({ id: offered.id, name: offered.name })}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: spacing[2],
                    minHeight: 44,
                  }}
                >
                  <MapPin color={palette.orange} size={18} />
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={1} variant="bodyBold">
                      {offered.name}
                    </AppText>
                    <AppText tone="secondary" variant="micro">
                      {`${offered.venueCount} stalls`}
                      {offered.distanceMeters !== undefined
                        ? ` · ${formatBrowseDistance(offered.distanceMeters)}`
                        : ""}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
          {allowModeSwitch ? (
            <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: spacing[2] }}>
              {(["dishes", "stalls"] as const).map((option) => (
                <Chip
                  key={option}
                  accessibilityRole="tab"
                  label={MODE_LABELS[option]}
                  accessibilityLabel={`Show ${MODE_LABELS[option].toLowerCase()}`}
                  selected={mode === option}
                  onPress={() => {
                    if (option === mode) return;
                    setItems([]);
                    setMatchCount(undefined);
                    setMode(option);
                    trackAnalyticsEvent("search_mode_changed", { mode: option });
                  }}
                />
              ))}
            </View>
          ) : null}
          <FilterChipRail
            options={RAW_BROWSE_FILTER_OPTIONS}
            selectedIds={filters.length ? filters : [BROWSE_ALL_FILTER]}
            onSelect={handleSelectFilter}
          />
          {filters.includes("Halal") ? (
            <View
              accessibilityRole="text"
              style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}
            >
              <Info color={palette.textMuted} size={16} />
              <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
                Halal tags come from stalls and public listings, and are not all MUIS-certified.
                Check the stall&apos;s certificate if it matters to you.
              </AppText>
            </View>
          ) : null}
          {isOfflineCopy ? (
            <View
              accessibilityRole="text"
              testID="search-offline-copy"
              style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}
            >
              <Info color={palette.textMuted} size={16} />
              <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
                {"You're seeing a saved copy of the catalog. It may be out of date."}
              </AppText>
            </View>
          ) : null}
          {isUsingDefaultLocation ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Location is off, so distances are from central Singapore. Choose your area"
              onPress={() =>
                navigation.navigate("OnboardingStack", { screen: "ManualLocationPicker" })
              }
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 }}
            >
              <MapPinOff color={palette.textMuted} size={16} />
              <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
                Location is off, so distances are from central Singapore.{" "}
                <AppText variant="micro" style={{ color: palette.orange }}>
                  Choose your area
                </AppText>
              </AppText>
            </Pressable>
          ) : null}
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing[2],
              justifyContent: "space-between",
            }}
          >
            <AppText
              accessibilityRole="text"
              tone="secondary"
              variant="bodySmall"
              style={{ flex: 1 }}
            >
              {summary ?? " "}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sort by, ${sortLabel}`}
              onPress={() => sortSheetRef.current?.present()}
              style={{ alignItems: "center", flexDirection: "row", gap: spacing[1], minHeight: 44 }}
            >
              <AppText variant="bodySmall">{sortLabel}</AppText>
              <ChevronDown color={palette.textMuted} size={16} />
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, opacity: isRefreshing ? 0.45 : 1 }}>
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            numColumns={2}
            onEndReached={() => {
              if (nextCursor && !isLoadingMore && !isLoading && !loadMoreFailed) {
                void loadPage(nextCursor, true);
              }
            }}
            onEndReachedThreshold={0.6}
            renderItem={renderItem}
            ListEmptyComponent={
              !isAuthenticated ? (
                // A signed-out grid (after a session expiry and a back swipe) loads nothing.
                <EmptyState
                  title="Sign in to search"
                  body="Sign in again to search dishes and stalls."
                  ctaLabel="Sign in"
                  onPress={() => navigation.navigate("AuthStack", { screen: "Login" })}
                />
              ) : isLoading ? (
                <BrowseGridLoadingState itemWidth={itemWidth} mode={mode} />
              ) : error ? (
                <EmptyState
                  title="Catalog unavailable"
                  body="We couldn't load the catalog. Check your connection and try again."
                  errorMessage={error}
                  ctaLabel="Retry"
                  onPress={() => void loadPage()}
                />
              ) : (
                <View style={{ gap: spacing[2] }}>
                  <EmptyState
                    title="No matches found"
                    body={
                      filters.length
                        ? "Try removing a filter or searching for something else."
                        : "Try another search."
                    }
                  />
                  <View style={{ alignItems: "center", gap: spacing[2] }}>
                    {suggestedQuery ? (
                      <Button
                        label={`Did you mean "${suggestedQuery}"?`}
                        onPress={() => {
                          setSearchText(suggestedQuery);
                          recordCommittedQuery(suggestedQuery, {
                            recordTaste: true,
                            remember: true,
                            source: "results",
                          });
                        }}
                      />
                    ) : null}
                    {filters.length ? (
                      <Button
                        label="Clear filters"
                        variant="secondary"
                        onPress={() => setFilters([])}
                      />
                    ) : null}
                    {radiusInPlay ? (
                      <Button
                        label="Search all Singapore"
                        variant="secondary"
                        onPress={() => setWidenedScope(widenScope)}
                      />
                    ) : null}
                  </View>
                </View>
              )
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={{ paddingVertical: spacing[4] }}>
                  <ActivityIndicator color={palette.orange} />
                </View>
              ) : loadMoreFailed && nextCursor ? (
                <View
                  style={{ alignItems: "center", gap: spacing[2], paddingVertical: spacing[4] }}
                >
                  <AppText tone="secondary">{"Couldn't load more."}</AppText>
                  <Button
                    label="Retry"
                    variant="secondary"
                    onPress={() => void loadPage(nextCursor, true)}
                  />
                </View>
              ) : null
            }
          />
          {isRefreshing ? (
            <View
              accessibilityLabel="Updating results"
              accessibilityRole="progressbar"
              pointerEvents="none"
              style={browseStyles.refreshIndicator}
            >
              <ActivityIndicator color={palette.orange} />
            </View>
          ) : null}
        </View>
      </View>
      <BottomSheet ref={sortSheetRef} accessibilityLabel="Sort by" snapPoints={["40%"]}>
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h2">Sort by</AppText>
          {BROWSE_SORT_OPTIONS.map((option) => {
            const selected = option.id === sort;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => handleSelectSort(option.id)}
                style={{
                  alignItems: "center",
                  borderBottomColor: palette.border,
                  borderBottomWidth: 1,
                  flexDirection: "row",
                  gap: spacing[3],
                  minHeight: 54,
                  paddingVertical: spacing[3],
                }}
              >
                <AppText variant="bodyBold" style={{ flex: 1 }}>
                  {option.label}
                </AppText>
                {selected ? <Check size={18} color={palette.orange} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const browseStyles = StyleSheet.create({
  clearButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    top: 2,
    width: 44,
  },
  refreshIndicator: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 16,
  },
  textInput: {
    fontSize: 16,
    textAlignVertical: "center",
  },
});

export function BrowseDishesScreen() {
  return <RawCatalogBrowseGrid mode="dishes" />;
}

export function BrowseStallsScreen() {
  return <RawCatalogBrowseGrid mode="stalls" />;
}

export function SearchResultsScreen() {
  const route = useRoute<SearchResultsRoute>();

  // Everything comes from route params, so a search never inherits an older persisted query.
  return (
    <RawCatalogBrowseGrid
      allowModeSwitch
      mode={route.params?.browseMode ?? "dishes"}
      initialFilter={route.params?.initialFilter ?? route.params?.foodTypeTag}
      initialPlace={
        route.params?.placeId
          ? { id: route.params.placeId, name: route.params.placeName ?? "this place" }
          : undefined
      }
      initialSearchQuery={route.params?.initialQuery ?? ""}
      initialSource={route.params?.source}
    />
  );
}
