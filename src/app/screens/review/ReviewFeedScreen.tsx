/**
 * ReviewFeedScreen — Tab 3
 * Pure user-review feed.
 * Sort by recency, rating, or A–Z by dish or stall.
 * No discovery or editorial content here.
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, Heart, MoreHorizontal, Pencil, Send, Star } from "lucide-react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { CaptionPreview, ReviewModerationNotice, ReviewPhotoViewer } from "@/components/review";
import {
  AccessibleImage,
  AppHeader,
  AppText,
  Avatar,
  EmptyState,
  ExpandableSearchLauncher,
  FilterChipRail,
  Skeleton,
} from "@/components/ui";
import {
  isContentHiddenForSession,
  loadBlockedAuthorsForSession,
  promptBlockReviewAuthor,
  promptReportReview,
} from "@/lib/security/communitySafety";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore, type InteractionState } from "@/store/useSocialStore";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { likePostAfterSignIn, saveDishAfterSignIn } from "@/features/auth/finishGuestAction";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "./ReviewShareSheet";
import {
  listReviewFeedItems,
  makeReviewInteractionId,
  type ReviewFeedItem,
} from "@/features/review/reviewFeed";
import { openTrustedExternalUrl } from "@/lib/security/safeLinking";
import { SUPPORT_EMAIL, webShareUrl } from "@/constants/links";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";

// ─── Types ──────────────────────────────────────────────────────────────────

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Review">,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterMode = "recent" | "top_rated" | "dish" | "location";

const REVIEW_FEED_PAGE_SIZE = 50;
/** A focus refetch runs when the loaded page is older than this (e.g. after posting a review). */
const REVIEW_FEED_STALE_MS = 15_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

const FILTER_OPTIONS: { id: FilterMode; label: string }[] = [
  { id: "recent", label: "Most Recent" },
  { id: "top_rated", label: "Top Rated" },
  { id: "dish", label: "A–Z dish" },
  { id: "location", label: "A–Z stall" },
];

// ─── StarRow ─────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 12 }: { rating: number; size?: number }) {
  const { palette } = useHungryTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Rated ${rating} out of 5 stars`}
      style={{ flexDirection: "row", gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={palette.starStroke}
          fill={i <= rating ? palette.starFill : "transparent"}
        />
      ))}
    </View>
  );
}

function ReviewFeedSkeleton() {
  const { componentRadii, radii, spacing } = useHungryTheme();

  return (
    <View style={{ gap: spacing[4], paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={{ gap: spacing[3] }}>
          <Skeleton width="100%" height={180} borderRadius={componentRadii.card} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Skeleton width={36} height={36} borderRadius={radii.pill} />
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Skeleton width="42%" height={16} borderRadius={radii.sm} />
              <Skeleton width="32%" height={12} borderRadius={radii.sm} />
            </View>
          </View>
          <Skeleton width="90%" height={16} borderRadius={radii.sm} />
          <Skeleton width="62%" height={16} borderRadius={radii.sm} />
        </View>
      ))}
    </View>
  );
}

function ReviewSearchQuerySummary({ query }: { query: string }) {
  const trimmedQuery = query.trim();
  const { spacing } = useHungryTheme();

  if (!trimmedQuery) {
    return null;
  }

  return (
    <View style={{ gap: spacing[0.5], paddingHorizontal: spacing[1] }}>
      <AppText variant="micro" tone="secondary">
        Showing results for
      </AppText>
      <AppText variant="bodySmallBold" style={{ flexShrink: 1 }}>
        {trimmedQuery}
      </AppText>
    </View>
  );
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

// The card takes primitives (not the interaction map) so that one like
// tap or save re-renders that card only, and `memo` keeps every other card as it is.
const ReviewCard = memo(function ReviewCard({
  item,
  liked,
  likeCount,
  saved,
  shareCount,
  isOwnReview,
  onPressDish,
  onSavePress,
  onSharePress,
  onLikePress,
  onSafetyPress,
  onPhotoPress,
  onAuthorPress,
  reviewReactionsEnabled,
}: {
  item: ReviewFeedItem;
  liked: boolean;
  likeCount: number;
  saved: boolean;
  shareCount: number;
  /** The viewer wrote this review: no Report/Block on it. */
  isOwnReview: boolean;
  onPressDish: (dishId: string) => void;
  onSavePress: (item: ReviewFeedItem) => void;
  onSharePress: (item: ReviewFeedItem) => void;
  onLikePress: (item: ReviewFeedItem) => void;
  onSafetyPress: (item: ReviewFeedItem) => void;
  onPhotoPress: (item: ReviewFeedItem, index: number) => void;
  onAuthorPress: (item: ReviewFeedItem) => void;
  reviewReactionsEnabled: boolean;
}) {
  const { componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const { width } = useWindowDimensions();
  const hasPhoto = item.review.photos.length > 0;
  const reviewDate = `${formatReviewDate(item.review.createdAt)}${item.review.editedAt ? " · edited" : ""}`;
  const photoCount = item.review.photos.length;
  const canOpenAuthor = Boolean(item.review.authorId) && !isOwnReview;
  // 44pt minimum on every action so each is an easy target.
  const actionStyle = {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  } as const;

  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: componentRadii.card,
          marginHorizontal: spacing[4],
          marginBottom: spacing[4],
          overflow: "hidden",
          borderWidth: 1,
          borderColor: palette.border,
        },
        shadows.card,
      ]}
    >
      {/* Photo */}
      {hasPhoto && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            photoCount > 1
              ? `View ${photoCount} photos from this review of ${item.dishName}`
              : `View photo from this review of ${item.dishName}`
          }
          onPress={() => onPhotoPress(item, 0)}
        >
          <AccessibleImage
            source={{ uri: item.review.photos[0] }}
            style={{ width: "100%", height: width * 0.55 }}
            contentFit="cover"
            decorative
          />
          {photoCount > 1 ? (
            <View
              style={{
                backgroundColor: palette.overlay,
                borderRadius: radii.pill,
                bottom: spacing[2],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                position: "absolute",
                right: spacing[2],
              }}
            >
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "700" }}>
                {`1/${photoCount}`}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      )}

      {/* Body */}
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        {item.review.moderationState ? (
          <ReviewModerationNotice
            state={item.review.moderationState}
            reviewId={item.review.id}
            dishName={item.dishName}
          />
        ) : null}

        {/* Author + rating row */}
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Pressable
            accessibilityRole={canOpenAuthor ? "button" : undefined}
            accessibilityLabel={
              canOpenAuthor
                ? `Open ${item.review.authorName}'s profile`
                : `${item.review.authorName}, ${item.venueName}`
            }
            disabled={!canOpenAuthor}
            onPress={() => onAuthorPress(item)}
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexShrink: 1,
              gap: spacing[2],
              minHeight: 44,
            }}
          >
            <Avatar uri={item.review.authorAvatarUrl} name={item.review.authorName} size={36} />
            <View style={{ flexShrink: 1 }}>
              <AppText variant="bodySmallBold" style={{ color: palette.text }}>
                {item.review.authorName}
              </AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {item.venueName}
              </AppText>
            </View>
          </Pressable>
          <StarRow rating={item.review.rating} size={14} />
        </View>

        {/* Dish link */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open ${item.dishName} at ${item.venueName}`}
          hitSlop={8}
          onPress={() => onPressDish(item.dishId)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
            backgroundColor: palette.orangeLight,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: radii.md,
            alignSelf: "flex-start",
          }}
        >
          <AppText variant="micro" style={{ color: palette.orangeText, fontWeight: "700" }}>
            {item.dishName}
          </AppText>
          <AppText variant="micro" style={{ color: palette.textMuted }}>
            ·
          </AppText>
          <AppText variant="micro" style={{ color: palette.textMuted }} numberOfLines={1}>
            {item.venueName}
          </AppText>
        </Pressable>

        {/* Caption: a two-line preview that opens on tap */}
        <CaptionPreview text={item.review.text} />

        {item.review.merchantReply?.text ? (
          <View
            accessible
            accessibilityLabel={`Reply from the stall: ${item.review.merchantReply.text}`}
            style={{
              backgroundColor: palette.bgSoft,
              borderRadius: radii.md,
              gap: spacing[1],
              padding: spacing[3],
            }}
          >
            <AppText variant="micro" tone="secondary" style={{ fontWeight: "700" }}>
              Reply from {item.venueName}
            </AppText>
            <AppText variant="bodySmall">{item.review.merchantReply.text}</AppText>
          </View>
        ) : null}

        {/* Tags (or date when no recommend) */}
        {item.review.tags.length > 0 || !item.review.wouldRecommend ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing[2],
                flex: 1,
                minWidth: 0,
              }}
            >
              {item.review.tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    backgroundColor: palette.bgSoft,
                    paddingHorizontal: spacing[2],
                    paddingVertical: 4,
                    borderRadius: radii.sm,
                  }}
                >
                  <AppText
                    variant="micro"
                    style={{ color: palette.textSecondary, fontWeight: "600" }}
                  >
                    {tag}
                  </AppText>
                </View>
              ))}
            </View>
            {!item.review.wouldRecommend && (
              <AppText
                variant="micro"
                tone="muted"
                style={{ marginLeft: spacing[3], textAlign: "right" }}
              >
                {reviewDate}
              </AppText>
            )}
          </View>
        ) : null}

        {/* Recommend row */}
        {item.review.wouldRecommend && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: spacing[2],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                flex: 1,
                minWidth: 0,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: palette.success,
                }}
              />
              <AppText variant="micro" style={{ color: palette.success, fontWeight: "600" }}>
                Would recommend
              </AppText>
            </View>
            <AppText
              variant="micro"
              tone="muted"
              numberOfLines={1}
              style={{ marginLeft: spacing[3], textAlign: "right" }}
            >
              {reviewDate}
            </AppText>
          </View>
        )}

        {/* Actions: right-aligned, all inside the card */}
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[1],
            justifyContent: "flex-end",
          }}
        >
          {reviewReactionsEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? "Unlike review" : "Like review"}
              onPress={() => onLikePress(item)}
              style={({ pressed }) => [actionStyle, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
            >
              <Heart
                color={liked ? palette.error : palette.text}
                fill={liked ? palette.error : "transparent"}
                size={22}
              />
              {likeCount > 0 ? (
                <AppText variant="micro" style={{ color: palette.text, fontWeight: "600" }}>
                  {likeCount}
                </AppText>
              ) : null}
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share review"
            onPress={() => onSharePress(item)}
            style={({ pressed }) => [actionStyle, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
          >
            <Send color={palette.text} size={22} />
            {shareCount > 0 ? (
              <AppText variant="micro" style={{ color: palette.text, fontWeight: "600" }}>
                {shareCount}
              </AppText>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? "Remove saved dish" : "Save dish"}
            onPress={() => onSavePress(item)}
            style={({ pressed }) => [actionStyle, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
          >
            <Bookmark
              color={saved ? palette.orange : palette.text}
              fill={saved ? palette.orange : "transparent"}
              size={22}
            />
          </Pressable>
          {isOwnReview ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More options for ${item.review.authorName}'s review`}
              accessibilityHint="Report this review or block its author"
              onPress={() => onSafetyPress(item)}
              style={actionStyle}
            >
              <MoreHorizontal color={palette.textMuted} size={20} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
});

// ─── ReviewFeedScreen ─────────────────────────────────────────────────────────

export function ReviewFeedScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute();
  const reviewFeedScrollRef = useRef<FlatList<ReviewFeedItem> | null>(null);
  const isTabSwipeLockedRef = useRef(false);
  const { palette, radii, shadows, spacing, semanticSpacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const interactions = useSocialStore((state) => state.interactions);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const toggleLike = useSocialStore((state) => state.toggleLike);
  const toggleSave = useSocialStore((state) => state.toggleSave);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const viewerId = useProfileStore((state) => state.profile.id);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);

  const [filterMode, setFilterMode] = useState<FilterMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [serviceReviewItems, setServiceReviewItems] = useState<ReviewFeedItem[] | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{
    photos: string[];
    label: string;
    index: number;
  } | null>(null);
  const [serviceLoadFailed, setServiceLoadFailed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreServiceReviews, setHasMoreServiceReviews] = useState(false);
  // Bumped when saved blocks load or a report/block succeeds, so the feed re-filters.
  const [safetyFilterVersion, setSafetyFilterVersion] = useState(0);
  const bumpSafetyFilter = useCallback(() => setSafetyFilterVersion((current) => current + 1), []);
  const serviceLoadIdRef = useRef(0);
  const lastServiceLoadAtRef = useRef(0);
  /** Where the next older page starts: the last raw row of the last page, not the last shown. */
  const feedCursorRef = useRef<{ before: string; beforeId: string } | undefined>(undefined);
  /** Newest created_at loaded, so a refocus asks only for newer reviews. */
  const newestCreatedAtRef = useRef<string | undefined>(undefined);
  const reviewReactionsEnabled = serviceProviderMode === "mock";
  const searchBarWidth = screenWidth - spacing[8];
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

  const trackedFilterModeRef = useRef<FilterMode>(filterMode);
  useEffect(() => {
    if (trackedFilterModeRef.current === filterMode) return;
    trackedFilterModeRef.current = filterMode;
    trackAnalyticsEvent("review_feed_filter_changed", { filter: filterMode });
  }, [filterMode]);

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
      } catch {
        if (loadId !== serviceLoadIdRef.current) return;
        if (mode === "append") {
          showToast({ message: "Could not load more reviews.", tone: "warning" });
          return;
        }
        // A failed top-up keeps what is on screen.
        if (mode === "replace") setServiceLoadFailed(true);
      }
    },
    [showToast, toServiceFeedItem],
  );

  // Loads on first focus. Coming back with a stale page adds only the newer reviews on top,
  // so a review the user just posted shows without losing the pages already scrolled.
  useFocusEffect(
    useCallback(() => {
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
    }, [loadServiceReviews, serviceProviderMode]),
  );

  useEffect(
    () => () => {
      serviceLoadIdRef.current += 1;
    },
    [],
  );

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
    if (serviceProviderMode === "mock" || !hasMoreServiceReviews || isLoadingMore) return;
    const cursor = feedCursorRef.current;
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      await loadServiceReviews("append", cursor);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreServiceReviews, isLoadingMore, loadServiceReviews, serviceProviderMode]);

  const requireAccount = useRequireAccount();
  const requireAccountForReviewAction = useCallback(
    (message: string, onSignedIn?: () => void) =>
      requireAccount(message, { name: "MainTabs", params: { screen: "Review" } }, onSignedIn),
    [requireAccount],
  );
  const openWriteReview = useCallback(() => {
    const open = () => navigation.navigate("ReviewStack", { screen: "ReviewMain" });
    if (!requireAccountForReviewAction("Sign in to write a review.", open)) return;
    open();
  }, [navigation, requireAccountForReviewAction]);

  // Gather reviews from all dishes
  const allReviews = useMemo<ReviewFeedItem[]>(() => {
    const reviews = (
      serviceProviderMode === "mock" ? listReviewFeedItems(repository) : (serviceReviewItems ?? [])
    ).filter(
      (item) => !isContentHiddenForSession({ id: item.review.id, authorId: item.review.authorId }),
    );

    // Sort
    if (filterMode === "top_rated") {
      return [...reviews].sort((a, b) => b.review.rating - a.review.rating);
    }
    if (filterMode === "dish") {
      return [...reviews].sort((a, b) => a.dishName.localeCompare(b.dishName));
    }
    if (filterMode === "location") {
      return [...reviews].sort((a, b) => a.venueName.localeCompare(b.venueName));
    }
    // Default: most recent
    return [...reviews].sort(
      (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
    );
  }, [repository, filterMode, safetyFilterVersion, serviceProviderMode, serviceReviewItems]);

  useEffect(() => {
    // Likes are mock-only; live reviews keep no per-card interaction state in the store.
    if (serviceProviderMode !== "mock") return;
    initializeInteractions(
      allReviews.map((item) => ({
        id: item.interactionId,
        commentCount: 0,
        likeCount: 0,
        savedCount: 0,
      })),
    );
  }, [allReviews, initializeInteractions, serviceProviderMode]);

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return allReviews;
    const q = searchQuery.toLowerCase();
    return allReviews.filter(
      (item) =>
        item.dishName.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.review.text.toLowerCase().includes(q) ||
        item.review.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allReviews, searchQuery]);

  // Tab press-to-top behavior intentionally disabled for bottom navigation.

  const openShareReview = useCallback(
    (item: ReviewFeedItem) => {
      const linkedDish = item.dish?.imageUrl ? item.dish : repository.getDishById(item.dishId);
      // A review is not a post: never borrow another post's id, or its share
      // count goes up when this review is shared.
      setActiveShareReview({
        reviewId: item.review.id,
        postId: "",
        title: item.dishName,
        subtitle: `${item.venueName} · ${item.review.authorName}`,
        imageUrl: item.review.photos[0] ?? linkedDish?.imageUrl ?? "",
        authorName: item.review.authorName,
        message: `${item.review.authorName} reviewed ${item.dishName} at ${item.venueName} on Hungry: ${item.review.text}`,
        link: webShareUrl("review", item.review.id),
      });
      requestAnimationFrame(() => {
        shareSheetRef.current?.present();
      });
    },
    [repository],
  );

  const handleSavePress = useCallback(
    (item: ReviewFeedItem) => {
      if (
        !requireAccountForReviewAction(`Sign in to save ${item.dishName}`, () => {
          const dish = item.dish ?? repository.getDishById(item.dishId);
          if (dish) saveDishAfterSignIn(dish);
        })
      ) {
        return;
      }

      if (serviceProviderMode === "mock") {
        void toggleSave(item.interactionId);
        return;
      }

      const localDish = item.dish ?? repository.getDishById(item.dishId);
      if (localDish) {
        toggleFavourite(localDish);
        return;
      }
      void getHungryService()
        .discovery.getDish(item.dishId)
        .then((dish) => {
          if (dish) {
            toggleFavourite(dish);
          } else {
            showToast({ message: "Could not save this dish right now.", tone: "warning" });
          }
        })
        .catch(() =>
          showToast({ message: "Could not save this dish right now.", tone: "warning" }),
        );
    },
    [
      repository,
      requireAccountForReviewAction,
      serviceProviderMode,
      showToast,
      toggleFavourite,
      toggleSave,
    ],
  );

  const handleLikePress = useCallback(
    (targetItem: ReviewFeedItem) => {
      if (
        reviewReactionsEnabled &&
        requireAccountForReviewAction("Sign in to like reviews.", () =>
          likePostAfterSignIn(targetItem.interactionId),
        )
      ) {
        void toggleLike(targetItem.interactionId);
      }
    },
    [requireAccountForReviewAction, reviewReactionsEnabled, toggleLike],
  );
  const handleSafetyPress = useCallback(
    (targetItem: ReviewFeedItem) => {
      const { review } = targetItem;
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
      Alert.alert(`Review by ${review.authorName}`, undefined, [
        {
          text: "Report review",
          onPress: () =>
            promptReportReview({
              reviewId: review.id,
              authorName: review.authorName,
              authorId: review.authorId,
              onHidden: bumpSafetyFilter,
            }),
        },
        {
          text: `Block ${review.authorName}`,
          style: "destructive",
          onPress: () =>
            promptBlockReviewAuthor({
              reviewId: review.id,
              authorName: review.authorName,
              authorId: review.authorId,
              onBlocked: bumpSafetyFilter,
            }),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [bumpSafetyFilter, isAuthenticated, requireAccountForReviewAction],
  );
  const handlePhotoPress = useCallback((targetItem: ReviewFeedItem, index: number) => {
    setPhotoViewer({
      photos: targetItem.review.photos,
      label: `${targetItem.dishName} review`,
      index,
    });
  }, []);
  const handleAuthorPress = useCallback(
    (targetItem: ReviewFeedItem) => {
      const { authorId, authorName, authorAvatarUrl } = targetItem.review;
      if (!authorId) return;
      navigation.navigate("UserProfile", { authorId, authorName, authorAvatarUrl });
    },
    [navigation],
  );
  const handlePressDish = useCallback(
    (dishId: string) => navigation.navigate("DishDetail", { dishId }),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ReviewFeedItem }) => {
      const baseInteraction = interactions[item.interactionId];
      return (
        <ReviewCard
          item={item}
          liked={reviewReactionsEnabled ? (baseInteraction?.liked ?? false) : false}
          likeCount={reviewReactionsEnabled ? (baseInteraction?.likeCount ?? 0) : 0}
          saved={
            reviewReactionsEnabled
              ? (baseInteraction?.saved ?? false)
              : favouriteDishIds.includes(item.dishId)
          }
          shareCount={reviewReactionsEnabled ? (baseInteraction?.shareCount ?? 0) : 0}
          isOwnReview={Boolean(item.review.authorId && item.review.authorId === viewerId)}
          onLikePress={handleLikePress}
          onPressDish={handlePressDish}
          onSavePress={handleSavePress}
          onSharePress={openShareReview}
          onSafetyPress={handleSafetyPress}
          onPhotoPress={handlePhotoPress}
          onAuthorPress={handleAuthorPress}
          reviewReactionsEnabled={reviewReactionsEnabled}
        />
      );
    },
    [
      interactions,
      favouriteDishIds,
      handleAuthorPress,
      handleLikePress,
      handlePhotoPress,
      handlePressDish,
      handleSafetyPress,
      openShareReview,
      handleSavePress,
      reviewReactionsEnabled,
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
              placeholder="Search Reviews"
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

        {/* Filter chips */}
        <FilterChipRail
          options={FILTER_OPTIONS}
          selectedId={filterMode}
          onSelect={setFilterMode}
          onSwipeLockChange={setTabSwipeLocked}
          gap={spacing[2]}
        />

        <ReviewSearchQuerySummary query={searchQuery} />
      </View>

      {/* Review feed */}
      {showInitialSkeleton ? (
        <ReviewFeedSkeleton />
      ) : (
        <FlatList
          ref={reviewFeedScrollRef}
          data={filteredReviews}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: spacing[3],
            paddingBottom: spacing[20],
          }}
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
                  hasMoreServiceReviews
                    ? "No match in the latest reviews. Try a dish or stall name."
                    : "Try a different search term."
                }
              />
            ) : (
              <EmptyState
                title="No reviews yet"
                body="Be the first to review a dish!"
                ctaLabel="Write a review"
                onPress={openWriteReview}
              />
            )
          }
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Write a review"
        onPress={openWriteReview}
        style={{
          alignItems: "center",
          backgroundColor: palette.orange,
          borderRadius: radii.pill,
          bottom: spacing[4],
          flexDirection: "row",
          gap: spacing[2],
          minHeight: 48,
          paddingHorizontal: spacing[4],
          position: "absolute",
          right: spacing[4],
          ...shadows.card,
        }}
      >
        <Pencil color={palette.white} size={18} />
        <AppText variant="bodySmallBold" style={{ color: palette.white }}>
          Write a review
        </AppText>
      </Pressable>
      {photoViewer ? (
        <ReviewPhotoViewer
          photos={photoViewer.photos}
          initialIndex={photoViewer.index}
          label={photoViewer.label}
          onClose={() => setPhotoViewer(null)}
        />
      ) : null}
      <ReviewShareSheet
        activeReview={activeShareReview}
        bottomInset={insets.bottom}
        innerRef={shareSheetRef}
        onDismiss={() => setActiveShareReview(null)}
        onShared={incrementShare}
      />
    </SafeAreaView>
  );
}
