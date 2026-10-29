import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomSheetScrollView, type BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Heart,
  Info,
  MapPin,
  MapPinOff,
  Share2,
  SlidersHorizontal,
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
  ChipGroup,
  EmptyState,
  IconButton,
  Screen,
  Skeleton,
} from "@/components/ui";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { appendUniqueById } from "@/lib/services/catalog/paging";
import { ParsedQueryChips } from "@/features/search/ParsedQueryChips";
import { ResultsNotes, type ResultsNote } from "@/features/search/ResultsNotes";
import { parseSearchQuery, type ParsedQueryPart } from "@/features/search/queryParser";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import {
  BROWSE_ALL_FILTER,
  BROWSE_FILTER_IDS,
  BROWSE_SORT_OPTIONS,
  CUISINE_FILTERS,
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
  roundCoordinate,
  stallCardDetail,
  stallCardImage,
  toggleFilterId,
  type BrowseFilterId,
  type BrowseItem,
  type BrowseMode,
  type BrowseSortId,
  type StallRow,
} from "@/features/search/browseGrid";
import { getCatalogRawService, getHungryService } from "@/lib/services/serviceProvider";
import {
  CATALOG_OFFLINE_RELEASE_ID,
  CATALOG_QUERY_MAX_CHARS,
  CATALOG_QUERY_MIN_CHARS,
  CATALOG_SUGGEST_MIN_CHARS,
  type CatalogPlace,
  type CatalogRawDishCard,
  type CatalogRawVenueCard,
} from "@/lib/services/catalog";
import {
  CatalogAccessError,
  CatalogRateLimitedError,
  CatalogReleaseExpiredError,
} from "@/lib/services/catalog";
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

// Japanese and Western stay valid in links but are not offered; the food types below the chips come
// from the release itself (SR4-24).
const RAW_BROWSE_FILTER_OPTIONS = [BROWSE_ALL_FILTER, ...BROWSE_FILTER_IDS]
  .filter((filter) => !CUISINE_FILTERS.has(filter))
  .map((filter) => ({
    id: filter,
    label: filter,
  }));
/** How many of the release's most common food types the Filters sheet offers. */
const FOOD_TYPE_CHIP_COUNT = 8;
/** A rate-limited search can be retried after this long (the limiter counts per minute). */
const RATE_LIMIT_RETRY_MS = 10_000;
/** "Search all Singapore" when the 3 km browse radius is empty: wide enough to cover the island. */
const WIDE_RADIUS_METERS = 30_000;

/** Religious dietary choices are reported as "dietary", not by name (privacy, like onboarding). */
function analyticsFilterName(filter: string) {
  return filter === "Halal" ? "dietary" : filter;
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
  onToggleSave,
  saved,
}: {
  index: number;
  item: BrowseItem;
  itemWidth: number;
  mode: BrowseMode;
  onOpen: (item: BrowseItem, index: number) => void;
  /** Dish cards only: saves the dish to Want to try. Absent when saving is switched off. */
  onToggleSave?: (dish: CatalogRawDishCard) => void;
  saved: boolean;
}) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const isDish = mode === "dishes";
  const dish = isDish ? (item as CatalogRawDishCard) : undefined;
  const stall = isDish ? undefined : (item as StallRow);
  const imageUrl = stall ? stallCardImage(stall) : item.imageUrl;
  const title = item.name;
  const stallName = dish ? dish.venueName : title;
  const stallRating = ratingPillText(stall?.qualityRating, stall?.qualityReviewCount);
  // On a stall card the rating is its top dish's, which the pill says so it is not read as the
  // stall's own rating (SEARCH-V5).
  const rating = dish
    ? ratingPillText(dish.rating, dish.reviewCount)
    : stallRating
      ? `Top dish ${stallRating}`
      : undefined;
  const outlets = stall?.extraOutlets ?? 0;
  const stallDetail = stall ? stallCardDetail(stall) : undefined;
  const isVerified = item.verificationStatus === "approved";
  // Most catalog rows have no cleared photo, and a photo can fail to load; either way show the
  // stall's initials, not a grey caption.
  const placeholder = (
    <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
      <StallLogoMark logoUrl={stall?.logoUrl} name={stallName} size={Math.round(itemWidth * 0.3)} />
    </View>
  );

  // The heart sits beside the card button, not inside it: a button inside a button is invalid HTML
  // on web and breaks hydration.
  return (
    <View style={{ padding: spacing[1], width: itemWidth }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cardAccessibilityLabel(mode, item)}
        accessibilityHint={isDish ? "Opens the dish" : "Opens the stall"}
        onPress={() => onOpen(item, index)}
        testID={`search-card-${mode}-${item.id}`}
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
                fallback={placeholder}
              />
            ) : (
              placeholder
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
            {stallDetail ? (
              <AppText numberOfLines={1} style={{ color: palette.text }} variant="micro">
                {stallDetail}
              </AppText>
            ) : null}
            {/* The line is reserved even with no rating or menu count, so cards in a row match (SR4-19). */}
            <View style={{ minHeight: RESERVED_LINE_HEIGHT }}>
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
            </View>
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
      {dish && onToggleSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${dish.name} from saved` : `Save ${dish.name}`}
          accessibilityState={{ selected: saved }}
          hitSlop={4}
          onPress={() => onToggleSave(dish)}
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderRadius: radii.pill,
            height: 44,
            justifyContent: "center",
            position: "absolute",
            right: spacing[1] + spacing[2],
            top: spacing[1] + 1 + itemWidth * 0.7 - 44 - spacing[2],
            width: 44,
          }}
        >
          <Heart
            color={saved ? palette.error : palette.textMuted}
            fill={saved ? palette.error : "transparent"}
            size={20}
          />
        </Pressable>
      ) : null}
    </View>
  );
});

/** One line of micro text; the rating line keeps this height when a card has nothing to show. */
const RESERVED_LINE_HEIGHT = 16;

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
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const allowSearchHistory = useUIStore((state) => state.allowSearchHistory);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const profileId = useProfileStore((state) => state.profile.id);
  const showToast = useUIStore((state) => state.showToast);
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
  // Food types picked from the release's most common ones, on top of the chips.
  const [foodTypes, setFoodTypes] = useState<readonly string[]>([]);
  const [foodTypeOptions, setFoodTypeOptions] = useState<readonly string[]>([]);
  const filterCount = filters.length + foodTypes.length;
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
  // Set when the limiter answered 429: Retry waits until then, because trying again fails again.
  const [retryAvailableAt, setRetryAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const requestVersion = useRef(0);
  const rawSearchInputRef = useRef<TextInput | null>(null);
  const releaseIdRef = useRef<string | undefined>(undefined);
  const listRef = useRef<FlashListRef<BrowseItem>>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const lastRecordedQueryRef = useRef("");
  const loggedZeroKeyRef = useRef("");
  // One id per counted search, carried on its result-opened and zero-results events.
  const searchIdRef = useRef<string | undefined>(undefined);
  const service = getCatalogRawService();
  // The list sits 12 in from each edge and each card has 4 of its own, so cards line up with the header's 16.
  const itemWidth = (width - spacing[3] * 2) / 2;

  const typedQuery = useMemo(() => normalizeQuery(searchText), [searchText]);
  // Filters read out of the typed text ("halal laksa under $5"). A chip the user removed puts its
  // words back into the search text; the removal lasts while those words are still typed.
  const [dismissedParts, setDismissedParts] = useState<readonly string[]>([]);
  const parsedFromText = useMemo(
    () => parseSearchQuery(typedQuery, new Set(dismissedParts)),
    [dismissedParts, typedQuery],
  );
  // Typing, clearing and picking a suggestion all go through here, so a removal is forgotten as
  // soon as the words it was for are gone from the text.
  const updateSearchText = useCallback((text: string) => {
    setSearchText(text);
    setDismissedParts((current) => {
      if (current.length === 0) return current;
      const present = new Set(parseSearchQuery(normalizeQuery(text)).parts.map((part) => part.key));
      const kept = current.filter((key) => present.has(key));
      return kept.length === current.length ? current : kept;
    });
  }, []);
  // Exposed only when the parser changes a query of 2+ words; the fallback is the parsed reading.
  const parseVariant = useExperimentVariant("search_query_parsing_v1", {
    enabled: parsedFromText.parts.length > 0 && typedQuery.includes(" "),
  });
  const parsed = useMemo(
    () =>
      parseVariant === "control"
        ? { text: typedQuery, dietary: [], maxPrice: undefined, parts: [] }
        : parsedFromText,
    [parseVariant, parsedFromText, typedQuery],
  );
  const parsedKey = parsed.parts.map((part) => part.key).join("|");
  // Tags are sparse, so "vegetarian bee hoon" can find nothing as a filtered search while the plain
  // text finds the dish. When the parsed reading has no results, the whole text is searched with no
  // parsed filters; the chips stay, and removing one starts over.
  const [relaxedScope, setRelaxedScope] = useState<string | undefined>();
  const relaxScope = JSON.stringify([mode, typedQuery, filters, foodTypes, place?.id, parsedKey]);
  const relaxed = relaxedScope === relaxScope;
  const query = relaxed ? typedQuery : parsed.text;
  const requestParsedKey = relaxed ? `${parsedKey}!` : parsedKey;
  const parsedFilters = useMemo(
    () =>
      relaxed
        ? { dietary: [], maxPrice: undefined }
        : { dietary: parsed.dietary, maxPrice: parsed.maxPrice },
    // The key stands for the parts: a new array with the same parts must not reload the grid.
    [requestParsedKey],
  );
  const tooShort = isTooShortQuery(query);
  const widenScope = JSON.stringify([mode, query, filters, foodTypes, place?.id, requestParsedKey]);
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
  const liveLatitude = roundCoordinate(effectiveCoordinate.latitude);
  const liveLongitude = roundCoordinate(effectiveCoordinate.longitude);
  // The point the list was searched from. A GPS refresh while the diner scrolls does not reload
  // the list; a new search does, and the first real fix replaces the built-in default point.
  // Otherwise the diner is offered "Update for new location" (SR4-26).
  const locationScope = JSON.stringify([
    mode,
    query,
    filters,
    foodTypes,
    place?.id,
    requestParsedKey,
    sort,
    widenRadius,
  ]);
  const [snapshot, setSnapshot] = useState({
    scope: locationScope,
    latitude: liveLatitude,
    longitude: liveLongitude,
    approximate: isUsingDefaultLocation,
  });
  if (snapshot.scope !== locationScope || (snapshot.approximate && !isUsingDefaultLocation)) {
    setSnapshot({
      scope: locationScope,
      latitude: liveLatitude,
      longitude: liveLongitude,
      approximate: isUsingDefaultLocation,
    });
  }
  const latitude = snapshot.latitude;
  const longitude = snapshot.longitude;
  const locationMoved =
    !snapshot.approximate &&
    (snapshot.latitude !== liveLatitude || snapshot.longitude !== liveLongitude);
  const coordinate = useMemo(() => ({ latitude, longitude }), [latitude, longitude]);

  const requestKey = useMemo(
    () =>
      JSON.stringify([
        mode,
        query,
        filters,
        foodTypes,
        sort,
        latitude,
        longitude,
        widenRadius,
        place?.id,
        requestParsedKey,
      ]),
    [
      filters,
      foodTypes,
      latitude,
      longitude,
      mode,
      requestParsedKey,
      place?.id,
      query,
      sort,
      widenRadius,
    ],
  );

  const loadPage = useCallback(
    async (cursor?: string, append = false) => {
      if (!isAuthenticated) return;
      const startedAt = Date.now();
      const version = requestVersion.current;
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
      setRetryAvailableAt(null);
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
          parsed: parsedFilters,
          foodTypes,
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
            if (loadError instanceof CatalogRateLimitedError) {
              const retryAt = Date.now() + RATE_LIMIT_RETRY_MS;
              setNow(Date.now());
              setRetryAvailableAt(retryAt);
            }
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
            parsed: parsedFilters,
            foodTypes,
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
      parsedFilters,
      foodTypes,
      place,
      query,
      requestKey,
      service,
      sort,
      widenRadius,
    ],
  );

  // Ticks once a second while Retry is waiting out the limiter.
  useEffect(() => {
    if (retryAvailableAt === null || Date.now() >= retryAvailableAt) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAvailableAt) clearInterval(timer);
    }, 1_000);
    return () => clearInterval(timer);
  }, [retryAvailableAt]);

  const loadPageRef = useRef<typeof loadPage | undefined>(undefined);
  loadPageRef.current = loadPage;
  // Read when a search is committed, so the parse of the text on screen is logged with it.
  const parsedPartsRef = useRef<readonly ParsedQueryPart[]>(parsed.parts);
  useEffect(() => {
    parsedPartsRef.current = parsed.parts;
  }, [parsed.parts]);

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
      const parts = parsedPartsRef.current;
      if (parts.length > 0) {
        trackAnalyticsEvent("search_parse_applied", {
          mode,
          part_count: parts.length,
          // Kinds only: a religious dietary choice is never reported by name.
          part_kinds: [...new Set(parts.map((part) => part.kind))].join(","),
          search_id: searchIdRef.current,
        });
      }
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
  // Kept per query text: a new search arriving on a screen that is already open (the Map bar, a
  // link) is recorded too, not only the first one of the mount (SR4-30).
  const initialQueryRecordedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (initialQueryRecordedRef.current === initialSearchQuery) return;
    initialQueryRecordedRef.current = initialSearchQuery;
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
      updateSearchText("");
      setPlace(next);
    },
    [mode, updateSearchText],
  );
  const clearPlace = useCallback(() => {
    setItems([]);
    setPlace(undefined);
  }, []);

  // Zero results are logged only for a submitted query, once, with the (capped) text so
  // "what did people fail to find" can be answered. Partial typing is never logged.
  const hasNoResults = loadedKey === requestKey && !isLoading && !error && items.length === 0;
  // The parsed filters found nothing: search the whole typed text instead (see `relaxed` above).
  const willRelax = hasNoResults && !relaxed && parsed.parts.length > 0;
  useEffect(() => {
    if (!willRelax) return;
    setRelaxedScope(relaxScope);
    trackAnalyticsEvent("search_parse_relaxed", {
      mode,
      part_count: parsed.parts.length,
      search_id: searchIdRef.current,
    });
  }, [mode, parsed.parts.length, relaxScope, willRelax]);

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
    if (!hasNoResults || willRelax || !committedQuery) return;
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
  }, [
    allowSearchHistory,
    committedQuery,
    filters,
    hasNoResults,
    mode,
    query,
    requestKey,
    willRelax,
  ]);

  // "Did you mean": the closest food type for a typed query with no results. With filters on,
  // the filters are the likelier cause, so "Clear filters" is offered instead.
  useEffect(() => {
    if (
      !hasNoResults ||
      filterCount > 0 ||
      parsed.parts.length > 0 ||
      query.length < CATALOG_QUERY_MIN_CHARS
    ) {
      return;
    }
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
  }, [filterCount, hasNoResults, parsed.parts.length, query, service]);

  // Android reads the hint's live region; iOS needs it announced.
  useEffect(() => {
    if (tooShort) {
      AccessibilityInfo.announceForAccessibility(
        `Type at least ${CATALOG_QUERY_MIN_CHARS} letters to search.`,
      );
    }
  }, [tooShort]);

  // The most common food types in the release become chips in the Filters sheet.
  useEffect(() => {
    let active = true;
    service
      .suggest("")
      .then((suggestions) => {
        if (!active) return;
        setFoodTypeOptions(
          suggestions
            .filter((suggestion) => suggestion.kind === "food_type")
            .slice(0, FOOD_TYPE_CHIP_COUNT)
            .map((suggestion) => suggestion.label),
        );
      })
      .catch((loadError) =>
        reportError(loadError, { surface: "catalog_browse", load: "food_types" }),
      );
    return () => {
      active = false;
    };
  }, [service]);

  const clearFilters = useCallback(() => {
    setFilters([]);
    setFoodTypes([]);
  }, []);

  const handleSelectFoodType = useCallback(
    (label: string) => {
      const selected = !foodTypes.includes(label);
      setFoodTypes((current) =>
        current.includes(label) ? current.filter((value) => value !== label) : [...current, label],
      );
      trackAnalyticsEvent("search_filter_changed", { mode, filter: label, selected });
    },
    [foodTypes, mode],
  );

  const handleSelectFilter = useCallback(
    (filter: string) => {
      if (filter === BROWSE_ALL_FILTER) setFoodTypes([]);
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
      filterSheetRef.current?.dismiss();
      trackAnalyticsEvent("search_sort_changed", { mode, sort: next });
    },
    [mode],
  );

  const handleRemoveParsedPart = useCallback(
    (part: ParsedQueryPart) => {
      setDismissedParts((current) =>
        current.includes(part.key) ? current : [...current, part.key],
      );
      trackAnalyticsEvent("search_parse_removed", {
        mode,
        part_kind: part.kind,
        search_id: searchIdRef.current,
      });
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
    const url = buildSearchShareUrl({ query: typedQuery, filters, mode, place, sort });
    trackAnalyticsEvent("search_shared", { mode, filter_count: filters.length });
    // iOS sends both message and url, so the link goes only in `url` there.
    const content =
      Platform.OS === "ios"
        ? { message: "Search Hungry", url }
        : { message: `Search Hungry: ${url}` };
    void Share.share(content).catch(() => undefined);
  }, [filters, mode, place, sort, typedQuery]);

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
      // Live catalog ids are dish and venue ids: open the dish or stall page. The stall page shows
      // the catalog record if it can't load the stall; the offline copy keeps the catalog page.
      if (openedMode === "dishes" && !releaseId?.startsWith("excel-fallback")) {
        navigation.navigate("DishDetail", {
          dishId: item.id,
          source: "search",
          catalogFallback: { releaseId },
        });
      } else if (openedMode === "stalls" && !releaseId?.startsWith("excel-fallback")) {
        navigation.navigate("StallDetail", { venueId: item.id });
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

  // The heart on a dish card: one optimistic toggle in the profile store (a single upsert on the
  // server, which ignores a second tap while the first is pending).
  const savedDishIds = useMemo(() => new Set(favouriteDishIds), [favouriteDishIds]);
  const handleToggleSave = useCallback(
    async (dish: CatalogRawDishCard) => {
      const result = await toggleFavourite(dish, { surface: "search" });
      if (result.status === "failed") {
        // A tap while a toggle is pending changes nothing: no toast for it.
        if (result.reason !== "pending") showToast({ message: result.message, tone: "error" });
        return;
      }
      if (result.status === "saved") {
        void getHungryService().discovery.recordMerchantActionEvent({
          eventType: "save",
          venueId: dish.venueId,
          dishId: dish.id,
          userId: profileId,
        });
      }
      showToast({
        message: result.status === "saved" ? "Saved to Want to try." : "Removed from Want to try.",
        tone: "success",
      });
    },
    [profileId, showToast, toggleFavourite],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: BrowseItem; index: number }) => (
      <RawCatalogCard
        index={index}
        item={item}
        itemWidth={itemWidth}
        mode={mode}
        onOpen={handleOpen}
        onToggleSave={FEATURE_FLAGS.favouritesEnabled ? handleToggleSave : undefined}
        saved={savedDishIds.has(item.id)}
      />
    ),
    [handleOpen, handleToggleSave, itemWidth, mode, savedDishIds],
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
          query,
          placeName: place?.name,
          widened: widenRadius,
        })
      : undefined;
  const sortLabel = effectiveSortLabel(sort, Boolean(query), Boolean(place));
  const suggestedQuery =
    didYouMean && didYouMean.query === query && filterCount === 0 && parsed.parts.length === 0
      ? didYouMean.label
      : undefined;
  // A place lists its whole building with no radius, so there is nothing to widen.
  const radiusInPlay = !query && !widenRadius && !place;

  const notes: ResultsNote[] = [];
  if (isOfflineCopy) {
    notes.push({
      id: "offline",
      testID: "search-offline-copy",
      text: "You're seeing a saved copy of the catalog. It may be out of date.",
    });
  }
  if (isUsingDefaultLocation) {
    notes.push({
      id: "location",
      text: "Location is off, so distances are from central Singapore.",
      action: {
        label: "Turn on location",
        accessibilityLabel:
          "Location is off, so distances are from central Singapore. Turn on location",
        onPress: () => {
          void grantLocation().then((granted) => {
            if (!granted) {
              showToast({
                message: "Location access is off. Turn it on in Settings to use your location.",
                tone: "info",
              });
            }
          });
        },
      },
    });
  }
  if (filters.includes("Halal") || parsed.dietary.includes("halal")) {
    notes.push({
      id: "halal",
      text: "Halal tags come from stalls and public listings, and are not all MUIS-certified. Check the stall's certificate if it matters to you.",
    });
  }

  // Everything above the first card scrolls away with the list; only the search row stays put.
  const listHeader = (
    <View style={{ gap: spacing[3], paddingHorizontal: spacing[1], paddingBottom: spacing[2] }}>
      <ParsedQueryChips parts={parsed.parts} onRemove={handleRemoveParsedPart} />
      {relaxed ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          testID="search-parsed-relaxed-note"
          style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}
        >
          <Info color={palette.textMuted} size={16} />
          <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
            {`Nothing matched with ${parsed.parts.map((part) => part.label).join(", ")}, so these results are for "${typedQuery}". Remove a chip to search without it.`}
          </AppText>
        </View>
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", gap: spacing[2] }}
        keyboardShouldPersistTaps="handled"
      >
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
        {filters.map((filter) => (
          <Chip
            key={filter}
            label={`${filter} ×`}
            accessibilityLabel={`Remove ${filter} filter`}
            selected
            onPress={() => handleSelectFilter(filter)}
          />
        ))}
        {foodTypes.map((label) => (
          <Chip
            key={`food:${label}`}
            label={`${label} ×`}
            accessibilityLabel={`Remove ${label} filter`}
            selected
            onPress={() => handleSelectFoodType(label)}
          />
        ))}
      </ScrollView>
      <ResultsNotes notes={notes} />
      {locationMoved ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Update for new location"
          onPress={() =>
            setSnapshot({
              scope: locationScope,
              latitude: liveLatitude,
              longitude: liveLongitude,
              approximate: false,
            })
          }
          style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 44 }}
        >
          <MapPin color={palette.orange} size={16} />
          <AppText tone="secondary" variant="micro" style={{ flex: 1 }}>
            {"You've moved, so distances may have changed. "}
            <AppText variant="micro" style={{ color: palette.orange }}>
              Update for new location
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
        <AppText accessibilityRole="text" tone="secondary" variant="bodySmall" style={{ flex: 1 }}>
          {summary ?? " "}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort by, ${sortLabel}`}
          onPress={() => filterSheetRef.current?.present()}
          style={{ alignItems: "center", flexDirection: "row", gap: spacing[1], minHeight: 44 }}
        >
          <AppText variant="bodySmall">{sortLabel}</AppText>
          <ChevronDown color={palette.textMuted} size={16} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: palette.bg }}>
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{
            gap: spacing[1],
            paddingBottom: spacing[2],
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
          }}
        >
          <View
            testID="search-sticky-row"
            style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
          >
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
                onChangeText={updateSearchText}
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
                    updateSearchText("");
                    rawSearchInputRef.current?.focus();
                  }}
                  style={browseStyles.clearButton}
                >
                  <X color={palette.textMuted} size={18} />
                </Pressable>
              ) : null}
            </View>
            <View>
              <IconButton
                variant="ghost"
                accessibilityLabel={
                  filterCount > 0 ? `Filters and sort, ${filterCount} on` : "Filters and sort"
                }
                onPress={() => filterSheetRef.current?.present()}
                icon={<SlidersHorizontal color={palette.text} size={20} />}
              />
              {filterCount > 0 ? (
                <View
                  pointerEvents="none"
                  testID="search-filters-badge"
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.orange,
                    borderRadius: 9,
                    height: 18,
                    justifyContent: "center",
                    minWidth: 18,
                    position: "absolute",
                    right: 2,
                    top: 2,
                  }}
                >
                  <AppText variant="micro" style={{ color: palette.surface }}>
                    {filterCount}
                  </AppText>
                </View>
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
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="text"
              tone="secondary"
              variant="micro"
            >
              {`Type at least ${CATALOG_QUERY_MIN_CHARS} letters to search.`}
            </AppText>
          ) : null}
        </View>
        <View style={{ flex: 1, opacity: isRefreshing ? 0.45 : 1 }}>
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: spacing[3] }}
            onEndReached={() => {
              if (nextCursor && !isLoadingMore && !isLoading && !loadMoreFailed) {
                void loadPage(nextCursor, true);
              }
            }}
            onEndReachedThreshold={0.6}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
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
              ) : error && retryAvailableAt !== null ? (
                // The limiter said slow down: a connection check would not help, and Retry waits.
                <View style={{ gap: spacing[2] }}>
                  <EmptyState
                    title="Too many searches"
                    body="You're searching faster than we can keep up. Wait a few seconds, then try again."
                  />
                  <View style={{ alignItems: "center" }}>
                    <Button
                      label={
                        now >= retryAvailableAt
                          ? "Try again"
                          : `Try again in ${Math.ceil((retryAvailableAt - now) / 1_000)}s`
                      }
                      disabled={now < retryAvailableAt}
                      onPress={() => void loadPage()}
                    />
                  </View>
                </View>
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
                      filterCount || parsed.parts.length
                        ? "Try removing a filter or searching for something else."
                        : "Try another search."
                    }
                  />
                  <View style={{ alignItems: "center", gap: spacing[2] }}>
                    {suggestedQuery ? (
                      <Button
                        label={`Did you mean "${suggestedQuery}"?`}
                        onPress={() => {
                          updateSearchText(suggestedQuery);
                          recordCommittedQuery(suggestedQuery, {
                            recordTaste: true,
                            remember: true,
                            source: "results",
                          });
                        }}
                      />
                    ) : null}
                    {filterCount ? (
                      <Button label="Clear filters" variant="secondary" onPress={clearFilters} />
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
      <BottomSheet ref={filterSheetRef} accessibilityLabel="Filters and sort" snapPoints={["85%"]}>
        <BottomSheetScrollView contentContainerStyle={{ gap: spacing[3] }}>
          <AppText variant="h2">Filters</AppText>
          <ChipGroup
            options={RAW_BROWSE_FILTER_OPTIONS}
            selectedIds={filters.length ? filters : foodTypes.length ? [] : [BROWSE_ALL_FILTER]}
            onSelect={handleSelectFilter}
          />
          {foodTypeOptions.length > 0 ? (
            <>
              <AppText variant="h2">Food type</AppText>
              <ChipGroup
                options={foodTypeOptions.map((label) => ({ id: label, label }))}
                selectedIds={foodTypes}
                onSelect={handleSelectFoodType}
              />
            </>
          ) : null}
          <AppText variant="h2">Sort by</AppText>
          <View>
            {BROWSE_SORT_OPTIONS.map((option) => {
              const selected = option.id === sort;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  onPress={() => handleSelectSort(option.id)}
                  style={{
                    alignItems: "center",
                    borderBottomColor: palette.border,
                    borderBottomWidth: 1,
                    flexDirection: "row",
                    gap: spacing[3],
                    minHeight: 48,
                    paddingVertical: spacing[2],
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
          <Button label="Done" onPress={() => filterSheetRef.current?.dismiss()} />
        </BottomSheetScrollView>
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
