/**
 * ReviewFeedScreen — the Reviews tab.
 * A photo grid of diners' reviews, like Instagram's explore page: only reviews with a photo,
 * newest first, filtered by the diner's taste, a kind of food or an area.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Images, Star } from "lucide-react-native";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import {
  AccessibleImage,
  AppHeader,
  AppText,
  EmptyState,
  ExpandableSearchLauncher,
  FilterChipRail,
  Skeleton,
} from "@/components/ui";
import {
  isContentHiddenForSession,
  loadBlockedAuthorsForSession,
  promptReviewSafetyActions,
} from "@/lib/security/communitySafety";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { useProfileStore } from "@/store/useProfileStore";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import {
  listReviewFeedItems,
  makeReviewInteractionId,
  type ReviewFeedItem,
} from "@/features/review/reviewFeed";
import { REVIEW_SEARCH_MIN_LENGTH, reviewMatchesQuery } from "@/features/review/reviewSearch";
import {
  buildReviewExploreChips,
  filterReviewExplore,
  resolveActiveReviewChip,
  reviewTileHoldAction,
  reviewsWithPhotos,
  visibleGridReviews,
  withSelectedReviewChip,
} from "@/features/review/reviewExplore";
import { useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { SUPPORT_EMAIL } from "@/constants/links";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";

// ─── Types ──────────────────────────────────────────────────────────────────

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Review">,
  NativeStackNavigationProp<RootStackParamList>
>;

const REVIEW_FEED_PAGE_SIZE = 50;
/** A focus refetch runs when the loaded page is older than this (e.g. after posting a review). */
const REVIEW_FEED_STALE_MS = 15_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Wait for a pause in typing before asking the server to search every review. */
const REVIEW_SEARCH_DEBOUNCE_MS = 300;

/** One server search: the query it answers, its results so far and where the next page starts. */
interface ReviewSearchState {
  query: string;
  items: ReviewFeedItem[];
  hasMore: boolean;
  cursor?: { before: string; beforeId: string };
  status: "loading" | "ready" | "failed";
}

/** "3h ago" within a week; otherwise the date, with the year when it is not this year. */
function formatReviewDate(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const ageMs = Date.now() - timestamp;
  if (ageMs >= 0 && ageMs < WEEK_MS) return formatTimeAgo(createdAt);
  const sameYear = new Date(timestamp).getFullYear() === new Date().getFullYear();
  return new Date(timestamp).toLocaleDateString("en-SG", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

const GRID_COLUMNS = 3;
const GRID_GAP = 2;

function ReviewFeedSkeleton() {
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const tileSize = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, paddingTop: spacing[2] }}>
      {Array.from({ length: 9 }, (_, index) => (
        <Skeleton key={index} width={tileSize} height={tileSize} borderRadius={0} />
      ))}
    </View>
  );
}

/** One line under the chips while searching: how many reviews matched. */
function ReviewSearchQuerySummary({
  query,
  count,
  hasMore,
}: {
  query: string;
  count: number;
  hasMore: boolean;
}) {
  const { spacing } = useHungryTheme();

  if (!query.trim()) {
    return null;
  }

  return (
    <AppText
      variant="micro"
      tone="secondary"
      accessibilityLiveRegion="polite"
      style={{ paddingHorizontal: spacing[1] }}
    >
      {`${count}${hasMore ? "+" : ""} ${count === 1 && !hasMore ? "result" : "results"}`}
    </AppText>
  );
}

// ─── ReviewTile ──────────────────────────────────────────────────────────────

/**
 * One square photo in the grid, its date in the bottom-left corner. With `showLabels`
 * (the review_tile_labels_v1 "labels" arm) the dish name and stars sit over the photo too;
 * control stays photo and date only (sh, 9ae387b).
 */
const ReviewTile = memo(function ReviewTile({
  item,
  index,
  size,
  holdAction,
  showLabels,
  onPress,
  onLongPress,
}: {
  item: ReviewFeedItem;
  index: number;
  size: number;
  /** What holding the tile does: manage your own review, report someone else's, or nothing. */
  holdAction: "manage" | "report" | null;
  showLabels: boolean;
  onPress: (item: ReviewFeedItem, index: number) => void;
  onLongPress: (item: ReviewFeedItem) => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const photoCount = item.review.photos.length;
  const dateLabel = formatReviewDate(item.review.createdAt);
  const holdLabel = holdAction === "manage" ? "Edit or delete" : "Report or block";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.review.authorName}'s review of ${item.dishName} at ${item.venueName}, rated ${item.review.rating} of 5, ${dateLabel}`}
      accessibilityHint={
        holdAction === "manage"
          ? "Opens the review. Hold to edit or delete it"
          : holdAction === "report"
            ? "Opens the review. Hold to report it or block its author"
            : "Opens the review"
      }
      accessibilityActions={holdAction ? [{ name: "longpress", label: holdLabel }] : undefined}
      onAccessibilityAction={(event) => {
        if (holdAction && event.nativeEvent.actionName === "longpress") onLongPress(item);
      }}
      testID={`review-tile-${item.review.id}`}
      onPress={() => onPress(item, index)}
      onLongPress={holdAction ? () => onLongPress(item) : undefined}
      style={({ pressed }) => ({ height: size, opacity: pressed ? 0.85 : 1, width: size })}
    >
      <AccessibleImage
        // The small copy keeps a 3-column grid light; older reviews have only the full photo.
        source={{ uri: item.review.photoThumbnails?.[0] || item.review.photos[0] }}
        style={{ backgroundColor: palette.bgSoft, height: size, width: size }}
        contentFit="cover"
        decorative
      />
      {photoCount > 1 ? (
        <View style={{ position: "absolute", right: spacing[1.5], top: spacing[1.5] }}>
          <Images color={palette.white} size={16} />
        </View>
      ) : null}
      {showLabels ? (
        <View
          testID="review-tile-labels"
          style={{
            backgroundColor: palette.mediaScrimStrong,
            bottom: 0,
            gap: 2,
            left: 0,
            paddingHorizontal: spacing[1.5],
            paddingVertical: spacing[1],
            position: "absolute",
            right: 0,
          }}
        >
          <AppText
            variant="micro"
            numberOfLines={1}
            style={{ color: palette.white, fontWeight: "700" }}
          >
            {item.dishName}
          </AppText>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
            <Star size={10} color={palette.starStroke} fill={palette.starFill} />
            <AppText variant="micro" numberOfLines={1} style={{ color: palette.white }}>
              {`${item.review.rating}${dateLabel ? ` · ${dateLabel}` : ""}`}
            </AppText>
          </View>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: palette.mediaScrimStrong,
            borderRadius: radii.pill,
            bottom: spacing[1.5],
            left: spacing[1.5],
            paddingHorizontal: spacing[1.5],
            paddingVertical: 2,
            position: "absolute",
          }}
        >
          <AppText variant="micro" style={{ color: palette.white, fontWeight: "700" }}>
            {dateLabel}
          </AppText>
        </View>
      )}
    </Pressable>
  );
});

// ─── ReviewFeedScreen ─────────────────────────────────────────────────────────

export function ReviewFeedScreen() {
  const navigation = useNavigation<RootNavigation>();
  const isTabSwipeLockedRef = useRef(false);
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const tasteVector = useProfileStore((state) => state.profile.tasteVector);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const viewerId = useProfileStore((state) => state.profile.id);
  const isFocused = useIsFocused();
  const showToast = useUIStore((state) => state.showToast);

  const [chipId, setChipId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceReviewItems, setServiceReviewItems] = useState<ReviewFeedItem[] | null>(null);
  const [serviceLoadFailed, setServiceLoadFailed] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchState, setSearchState] = useState<ReviewSearchState | null>(null);
  const searchLoadIdRef = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreServiceReviews, setHasMoreServiceReviews] = useState(false);
  // Bumped when saved blocks load or a report/block succeeds, so the feed re-filters.
  const [safetyFilterVersion, setSafetyFilterVersion] = useState(0);
  const bumpSafetyFilter = useCallback(() => setSafetyFilterVersion((current) => current + 1), []);
  const serviceLoadIdRef = useRef(0);
  /** True while reviews from the service are on screen (a failed refresh keeps them). */
  const hasLoadedItemsRef = useRef(false);
  hasLoadedItemsRef.current = (serviceReviewItems?.length ?? 0) > 0;
  const lastServiceLoadAtRef = useRef(0);
  /** Where the next older page starts: the last raw row of the last page, not the last shown. */
  const feedCursorRef = useRef<{ before: string; beforeId: string } | undefined>(undefined);
  /** Newest created_at loaded, so a refocus asks only for newer reviews. */
  const newestCreatedAtRef = useRef<string | undefined>(undefined);
  const searchBarWidth = screenWidth - spacing[8];
  const tileSize = (screenWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
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
  const headerActionSize = spacing[8] + spacing[2.5];
  const isServiceFeedLoading =
    serviceProviderMode !== "mock" && serviceReviewItems === null && !serviceLoadFailed;
  const showInitialSkeleton = useDelayedLoadingSkeleton(isServiceFeedLoading, 0);
  const reviewHeaderTitle = "Reviews";

  const trackedChipRef = useRef(chipId);
  useEffect(() => {
    if (trackedChipRef.current === chipId) return;
    trackedChipRef.current = chipId;
    trackAnalyticsEvent("review_feed_filter_changed", { filter: chipId.split(":")[0] });
  }, [chipId]);

  useEffect(() => {
    let isMounted = true;
    void loadBlockedAuthorsForSession().then(() => {
      if (isMounted) bumpSafetyFilter();
    });
    return () => {
      isMounted = false;
    };
  }, [bumpSafetyFilter]);

  useEffect(
    () => () => {
      if (isTabSwipeLockedRef.current) {
        navigation.setOptions({ swipeEnabled: true });
      }
    },
    [navigation],
  );

  const toServiceFeedItem = useCallback(
    (entry: RecentReviewFeedEntry): ReviewFeedItem => ({
      review: entry.review,
      dish: repository.getDishById(entry.dishId),
      dishId: entry.dishId,
      dishName: entry.dishName,
      venueName: entry.venueName,
      venueId: entry.venueId,
      // Keyed by the review id only: never embed the review text in an id.
      interactionId: makeReviewInteractionId(entry.dishId, entry.review.id, 0),
    }),
    [repository],
  );

  // One paginated query for the newest reviews instead of one request per catalog dish.
  // "prepend" asks only for reviews newer than the newest loaded and puts them on top, so
  // coming back to the tab keeps the pages already scrolled.
  const loadServiceReviews = useCallback(
    async (
      mode: "replace" | "append" | "prepend",
      cursor?: { before: string; beforeId: string },
    ) => {
      const loadId = ++serviceLoadIdRef.current;
      try {
        const page = await getHungryService().reviews.listRecentReviewsPage({
          limit: REVIEW_FEED_PAGE_SIZE,
          // Only photo reviews belong on the grid: the server skips text-only ones.
          withPhotos: true,
          ...(mode === "append" ? { before: cursor?.before, beforeId: cursor?.beforeId } : {}),
          ...(mode === "prepend" && newestCreatedAtRef.current
            ? { after: newestCreatedAtRef.current }
            : {}),
        });
        if (loadId !== serviceLoadIdRef.current) return;
        lastServiceLoadAtRef.current = Date.now();
        const items = page.entries.map(toServiceFeedItem);
        // A full page of new rows may leave a gap before the loaded ones: start over from it.
        const startsOver = mode === "replace" || (mode === "prepend" && page.hasMore);
        if (startsOver) {
          feedCursorRef.current = page.nextCursor;
          newestCreatedAtRef.current = items[0]?.review.createdAt;
          setHasMoreServiceReviews(page.hasMore);
        } else if (mode === "append") {
          feedCursorRef.current = page.nextCursor ?? feedCursorRef.current;
          setHasMoreServiceReviews(page.hasMore);
        } else if (items[0]?.review.createdAt) {
          newestCreatedAtRef.current = items[0].review.createdAt;
        }
        setServiceReviewItems((current) => {
          if (startsOver || !current) return items;
          const known = new Set(current.map((item) => item.review.id));
          const fresh = items.filter((item) => !known.has(item.review.id));
          return mode === "append" ? [...current, ...fresh] : [...fresh, ...current];
        });
        setServiceLoadFailed(false);
      } catch (error) {
        if (loadId !== serviceLoadIdRef.current) return;
        reportError(error, { screen: "ReviewFeedScreen", action: `load_reviews_${mode}` });
        if (mode === "append") {
          showToast({ message: "Could not load more reviews.", tone: "warning" });
          return;
        }
        // A failed top-up keeps what is on screen.
        if (mode !== "replace") return;
        if (hasLoadedItemsRef.current) {
          // A failed pull-to-refresh keeps the grid and says so; the error state is only for
          // an empty grid.
          showToast({ message: "Couldn't refresh reviews. Pull to try again.", tone: "warning" });
          return;
        }
        setServiceLoadFailed(true);
      }
    },
    [showToast, toServiceFeedItem],
  );

  // Loads on first focus. Coming back with a stale page adds only the newer reviews on top,
  // so a review the user just posted shows without losing the pages already scrolled.
  useFocusEffect(
    useCallback(() => {
      // Re-filter on every focus: a review deleted on its own page leaves the loaded pages.
      bumpSafetyFilter();
      // Once per focus: the tab is preloaded, and a preloaded tab is not focused.
      trackAnalyticsEvent("review_feed_viewed", { source: "tab" });
      if (serviceProviderMode === "mock") {
        setServiceReviewItems(null);
        return undefined;
      }
      if (lastServiceLoadAtRef.current === 0) {
        void loadServiceReviews("replace");
      } else if (Date.now() - lastServiceLoadAtRef.current > REVIEW_FEED_STALE_MS) {
        void loadServiceReviews("prepend");
      }
      return undefined;
    }, [bumpSafetyFilter, loadServiceReviews, serviceProviderMode]),
  );

  useEffect(
    () => () => {
      serviceLoadIdRef.current += 1;
    },
    [],
  );

  // Search asks the server to look through every review, not only the pages already loaded. The
  // grid keeps filtering the loaded pages while the person types and while the answer is on its
  // way, so typing never feels slow.
  const trimmedQuery = searchQuery.trim();
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmedQuery), REVIEW_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);
  // Clearing the box shows the grid at once, without waiting out the debounce.
  const activeQuery = trimmedQuery ? debouncedQuery : "";
  const serverSearching =
    serviceProviderMode !== "mock" && activeQuery.length >= REVIEW_SEARCH_MIN_LENGTH;

  useEffect(() => {
    const loadId = ++searchLoadIdRef.current;
    if (!serverSearching) {
      setSearchState(null);
      return;
    }
    setSearchState((current) =>
      current?.query === activeQuery
        ? current
        : { query: activeQuery, items: [], hasMore: false, status: "loading" },
    );
    getHungryService()
      .reviews.searchReviewsPage({
        query: activeQuery,
        limit: REVIEW_FEED_PAGE_SIZE,
        withPhotos: true,
      })
      .then((page) => {
        if (loadId !== searchLoadIdRef.current) return;
        setSearchState({
          query: activeQuery,
          items: page.entries.map(toServiceFeedItem),
          hasMore: page.hasMore,
          cursor: page.nextCursor,
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        if (loadId !== searchLoadIdRef.current) return;
        reportError(error, { screen: "ReviewFeedScreen", action: "search_reviews" });
        setSearchState({ query: activeQuery, items: [], hasMore: false, status: "failed" });
      });
    return () => {
      searchLoadIdRef.current += 1;
    };
  }, [activeQuery, serverSearching, toServiceFeedItem]);

  const loadMoreSearchResults = useCallback(async () => {
    const current = searchState;
    if (!current || current.status !== "ready" || !current.hasMore || !current.cursor) return;
    const loadId = ++searchLoadIdRef.current;
    try {
      const page = await getHungryService().reviews.searchReviewsPage({
        query: current.query,
        limit: REVIEW_FEED_PAGE_SIZE,
        withPhotos: true,
        before: current.cursor.before,
        beforeId: current.cursor.beforeId,
      });
      if (loadId !== searchLoadIdRef.current) return;
      setSearchState((latest) => {
        if (!latest || latest.query !== current.query) return latest;
        const known = new Set(latest.items.map((item) => item.review.id));
        return {
          ...latest,
          items: [
            ...latest.items,
            ...page.entries.map(toServiceFeedItem).filter((item) => !known.has(item.review.id)),
          ],
          hasMore: page.hasMore,
          cursor: page.nextCursor ?? latest.cursor,
        };
      });
    } catch (error) {
      if (loadId !== searchLoadIdRef.current) return;
      reportError(error, { screen: "ReviewFeedScreen", action: "search_reviews_more" });
      showToast({ message: "Could not load more reviews.", tone: "warning" });
    }
  }, [searchState, showToast, toServiceFeedItem]);

  const handleRefresh = useCallback(async () => {
    if (serviceProviderMode === "mock") return;
    setIsRefreshing(true);
    try {
      await loadServiceReviews("replace");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadServiceReviews, serviceProviderMode]);

  const handleRetry = useCallback(() => {
    setServiceLoadFailed(false);
    setServiceReviewItems(null);
    void loadServiceReviews("replace");
  }, [loadServiceReviews]);

  const handleLoadMore = useCallback(async () => {
    // A load-more during a refresh would win the shared load id and throw the refresh away.
    if (serviceProviderMode === "mock" || isLoadingMore || isRefreshing) return;
    if (serverSearching) {
      setIsLoadingMore(true);
      try {
        await loadMoreSearchResults();
      } finally {
        setIsLoadingMore(false);
      }
      return;
    }
    if (!hasMoreServiceReviews) return;
    const cursor = feedCursorRef.current;
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      await loadServiceReviews("append", cursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMoreServiceReviews,
    isLoadingMore,
    isRefreshing,
    loadMoreSearchResults,
    loadServiceReviews,
    serverSearching,
    serviceProviderMode,
  ]);

  const requireAccount = useRequireAccount();
  const requireAccountForReviewAction = useCallback(
    (message: string, onSignedIn?: () => void) =>
      requireAccount(message, { name: "MainTabs", params: { screen: "Review" } }, onSignedIn),
    [requireAccount],
  );

  // Where a review's dish is: the name of its hawker centre, mall or building.
  const buildingNames = useMemo(
    () => new Map(repository.listBuildings().map((building) => [building.id, building.name])),
    [repository],
  );
  const areaOf = useCallback(
    (item: ReviewFeedItem) => (item.dish ? buildingNames.get(item.dish.buildingId) : undefined),
    [buildingNames],
  );

  // Every review with a photo, newest first.
  const gridReviews = useCallback(
    (source: readonly ReviewFeedItem[]): ReviewFeedItem[] => {
      const reviews = visibleGridReviews(reviewsWithPhotos(source), {
        viewerId,
        isHidden: (item) =>
          isContentHiddenForSession({ id: item.review.id, authorId: item.review.authorId }),
      });
      return [...reviews].sort(
        (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
      );
    },
    // safetyFilterVersion: a report, block or deletion changes what is hidden.

    [safetyFilterVersion, viewerId],
  );
  const allReviews = useMemo<ReviewFeedItem[]>(
    () =>
      gridReviews(
        serviceProviderMode === "mock"
          ? listReviewFeedItems(repository)
          : (serviceReviewItems ?? []),
      ),
    [gridReviews, repository, serviceProviderMode, serviceReviewItems],
  );
  // The server's answer for the query in force; null until it arrives (and for short queries).
  const serverSearchItems = useMemo(
    () =>
      serverSearching && searchState?.status === "ready" && searchState.query === activeQuery
        ? gridReviews(searchState.items)
        : null,
    [activeQuery, gridReviews, searchState, serverSearching],
  );

  // Chips follow the diner's palette, the foods and the areas on the page.
  // The picked food or area stays in the rail even when a reload drops it from the top values.
  const chips = useMemo(
    () =>
      withSelectedReviewChip(
        buildReviewExploreChips(allReviews, { userVector: tasteVector, areaOf }),
        chipId,
      ),
    [allReviews, areaOf, chipId, tasteVector],
  );
  const activeChip = resolveActiveReviewChip(chips, chipId);

  const filteredReviews = useMemo(() => {
    const byChip = filterReviewExplore(serverSearchItems ?? allReviews, activeChip, {
      userVector: tasteVector,
      areaOf,
    });
    // The server already matched its results; the loaded pages are matched here.
    if (serverSearchItems || !trimmedQuery) return byChip;
    return byChip.filter((item) => reviewMatchesQuery(item, trimmedQuery));
  }, [activeChip, allReviews, areaOf, serverSearchItems, tasteVector, trimmedQuery]);
  const searchHasMore = Boolean(serverSearchItems && searchState?.hasMore);

  // review_tile_labels_v1: exposure only once a focused, non-empty live grid is on screen (the
  // tab is preloaded, and mock tiles open the dish page). Latched, so a tab swipe never flips
  // tiles back to control mid-session.
  const [labelsEligible, setLabelsEligible] = useState(false);
  useEffect(() => {
    if (
      !labelsEligible &&
      isFocused &&
      serviceProviderMode !== "mock" &&
      !showInitialSkeleton &&
      filteredReviews.length > 0
    ) {
      setLabelsEligible(true);
    }
  }, [filteredReviews.length, isFocused, labelsEligible, serviceProviderMode, showInitialSkeleton]);
  const tileVariant = useExperimentVariant("review_tile_labels_v1", { enabled: labelsEligible });
  const showTileLabels = tileVariant === "labels";

  const ownReviewEditor = useOwnReviewEditor({
    onUpdated: (updated) =>
      setServiceReviewItems((current) =>
        current
          ? current.map((item) =>
              item.review.id === updated.id
                ? { ...item, review: { ...item.review, ...updated } }
                : item,
            )
          : current,
      ),
    onDeleted: (reviewId) =>
      setServiceReviewItems((current) =>
        current ? current.filter((item) => item.review.id !== reviewId) : current,
      ),
  });
  const { enabled: canEditOwnReviews, openActions: openOwnReviewActions } = ownReviewEditor;

  const handleSafetyPress = useCallback(
    (targetItem: ReviewFeedItem) => {
      const { review } = targetItem;
      // Your own review: edit or delete it. Reporting or blocking yourself would hide it from
      // you and fail on the server.
      if (isAuthenticated && review.authorId && review.authorId === viewerId) {
        if (canEditOwnReviews) openOwnReviewActions(review);
        return;
      }
      if (!isAuthenticated) {
        // Reporting needs an account, so say so instead of failing after the tap.
        Alert.alert("Report or block", "Sign in to report this review or block its author.", [
          {
            text: "Sign in",
            onPress: () => requireAccountForReviewAction("Sign in to report reviews."),
          },
          {
            text: "Email support",
            onPress: () =>
              void openTrustedExternalUrl(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Report a review")}&body=${encodeURIComponent(`Review reference: ${review.id}`)}`,
              ),
          },
          { text: "Cancel", style: "cancel" },
        ]);
        return;
      }
      promptReviewSafetyActions({
        reviewId: review.id,
        authorName: review.authorName,
        authorId: review.authorId,
        onHidden: bumpSafetyFilter,
        onBlocked: bumpSafetyFilter,
      });
    },
    [
      bumpSafetyFilter,
      canEditOwnReviews,
      isAuthenticated,
      openOwnReviewActions,
      requireAccountForReviewAction,
      viewerId,
    ],
  );
  const handleOpenReview = useCallback(
    (item: ReviewFeedItem, index: number) => {
      trackAnalyticsEvent("review_opened", {
        review_id: item.review.id,
        dish_id: item.dishId,
        source: "grid",
        position: index,
      });
      // Mock reviews live on their dish; live reviews open on their own page.
      if (serviceProviderMode === "mock") {
        navigation.navigate("DishDetail", { dishId: item.dishId, source: "review_feed" });
        return;
      }
      navigation.navigate("ReviewDetail", { reviewId: item.review.id });
    },
    [navigation, serviceProviderMode],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ReviewFeedItem; index: number }) => (
      <ReviewTile
        item={item}
        index={index}
        size={tileSize}
        holdAction={reviewTileHoldAction({
          isOwn: Boolean(
            isAuthenticated && item.review.authorId && item.review.authorId === viewerId,
          ),
          canEditOwnReviews,
        })}
        showLabels={showTileLabels}
        onPress={handleOpenReview}
        onLongPress={handleSafetyPress}
      />
    ),
    [
      canEditOwnReviews,
      handleOpenReview,
      handleSafetyPress,
      isAuthenticated,
      showTileLabels,
      tileSize,
      viewerId,
    ],
  );

  const keyExtractor = useCallback((item: ReviewFeedItem) => item.interactionId, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingTop: 0,
          paddingBottom: spacing[1],
          gap: spacing[2],
        }}
      >
        <AppHeader
          title={reviewHeaderTitle}
          showBack={false}
          right={
            <ExpandableSearchLauncher
              accessibilityLabel="Search reviews"
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSubmit={() => {
                Keyboard.dismiss();
                if (searchQuery.trim()) {
                  trackAnalyticsEvent("review_feed_searched", {
                    query_length: searchQuery.trim().length,
                    result_count: filteredReviews.length,
                  });
                }
              }}
              onClear={() => setSearchQuery("")}
              placeholder="Search reviews"
              expandedWidth={searchBarWidth}
              iconAlignment="right"
              iconSize={headerActionSize}
              barHeight={headerActionSize}
              borderColor={palette.border}
              backgroundColor={palette.bgSoft}
              textColor={palette.text}
              placeholderColor={palette.textSecondary}
              enableMovingPlaceholder={false}
              showExpandedBacking={false}
            />
          }
        />

        {/* Filter chips: your taste, foods and areas */}
        <FilterChipRail
          options={chips.map((chip) => ({ id: chip.id, label: chip.label }))}
          selectedId={activeChip?.id ?? "all"}
          onSelect={setChipId}
          onSwipeLockChange={setTabSwipeLocked}
          gap={spacing[2]}
        />

        <ReviewSearchQuerySummary
          query={searchQuery}
          count={filteredReviews.length}
          hasMore={searchHasMore}
        />
      </View>

      {/* Photo grid */}
      {showInitialSkeleton ? (
        <ReviewFeedSkeleton />
      ) : (
        <FlatList
          data={filteredReviews}
          key={`grid-${GRID_COLUMNS}`}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={{ gap: GRID_GAP }}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: GRID_GAP,
            paddingBottom: spacing[20],
            paddingTop: spacing[2],
          }}
          extraData={showTileLabels}
          refreshControl={
            serviceProviderMode === "mock" ? undefined : (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={palette.orange}
              />
            )
          }
          onEndReached={() => void handleLoadMore()}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            serviceLoadFailed ? (
              <EmptyState
                title="Couldn't load reviews"
                body="Check your connection and try again."
                ctaLabel="Try again"
                onPress={handleRetry}
              />
            ) : searchQuery ? (
              <EmptyState
                title="No reviews found"
                body={
                  serverSearchItems
                    ? "Try a different dish, stall or taste."
                    : searchState?.status === "failed"
                      ? "Couldn't search every review. Showing the latest ones only."
                      : serverSearching
                        ? "Searching every review…"
                        : "Try a different search term."
                }
              />
            ) : activeChip && activeChip.kind !== "all" && allReviews.length > 0 ? (
              <EmptyState
                title={
                  activeChip.kind === "taste"
                    ? "No reviews for your taste yet"
                    : `No ${activeChip.label} reviews here`
                }
                body={
                  activeChip.kind === "taste"
                    ? "None of the latest photo reviews match your palette. See them all instead."
                    : "Try another filter, or see every review."
                }
                ctaLabel="Show all reviews"
                onPress={() => setChipId("all")}
              />
            ) : (
              <EmptyState
                title="No photo reviews yet"
                body="Reviews with a photo show here. Tap the pen button below to write one."
              />
            )
          }
        />
      )}
      {ownReviewEditor.dialog}
    </SafeAreaView>
  );
}
