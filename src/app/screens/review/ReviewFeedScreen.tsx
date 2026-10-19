/**
 * ReviewFeedScreen — Tab 3
 * Pure user-review feed.
 * Filter by dish, stall, rating, or recency.
 * No discovery or editorial content here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  type TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, Heart, MessageCircle, MessageCircleMore, Send, Star } from "lucide-react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation, useRoute, type CompositeNavigationProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { ReviewCommentsSheet, type ActiveReviewCommentTarget } from "@/components/social";
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
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "./ReviewShareSheet";
import {
  listReviewFeedItems,
  makeReviewInteractionId,
  type ReviewFeedItem,
} from "@/features/review/reviewFeed";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { webShareUrl } from "@/constants/links";

// ─── Types ──────────────────────────────────────────────────────────────────

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Review">,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterMode = "recent" | "top_rated" | "dish" | "location";

const REVIEW_FEED_PAGE_SIZE = 50;

const FILTER_OPTIONS: { id: FilterMode; label: string }[] = [
  { id: "recent", label: "Most Recent" },
  { id: "top_rated", label: "Top Rated" },
  { id: "dish", label: "By Dish" },
  { id: "location", label: "By Location" },
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
          color={palette.amber}
          fill={i <= rating ? palette.amber : "transparent"}
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

function ReviewCard({
  item,
  interaction,
  commentsEnabled,
  onCommentPress,
  onPressDish,
  onSavePress,
  onSharePress,
  onLikePress,
  onSafetyHidden,
  reviewReactionsEnabled,
}: {
  item: ReviewFeedItem;
  interaction: InteractionState;
  commentsEnabled: boolean;
  onCommentPress: (item: ReviewFeedItem) => void;
  onPressDish: (dishId: string) => void;
  onSavePress: (item: ReviewFeedItem) => void;
  onSharePress: (item: ReviewFeedItem) => void;
  onLikePress: (item: ReviewFeedItem) => void;
  /** Called after a report or block succeeds so the feed drops the hidden content. */
  onSafetyHidden: () => void;
  reviewReactionsEnabled: boolean;
}) {
  const { componentRadii, palette, radii, spacing, shadows, typography } = useHungryTheme();
  const CommentIcon = MessageCircle ?? MessageCircleMore;
  const { width } = useWindowDimensions();
  const hasPhoto = item.review.photos.length > 0;
  const reviewDate = new Date(item.review.createdAt).toLocaleDateString("en-SG", {
    month: "short",
    day: "numeric",
  });

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
          accessibilityLabel={`Open ${item.dishName} from review photo`}
          onPress={() => onPressDish(item.dishId)}
        >
          <AccessibleImage
            source={{ uri: item.review.photos[0] }}
            style={{ width: "100%", height: width * 0.55 }}
            contentFit="cover"
            decorative
          />
        </Pressable>
      )}

      {/* Body */}
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        {/* Author + rating row */}
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                backgroundColor: palette.orange,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText variant="bodySmallBold" style={{ color: palette.white }}>
                {item.review.authorName.charAt(0).toUpperCase()}
              </AppText>
            </View>
            <View>
              <AppText variant="bodySmallBold" style={{ color: palette.text }}>
                {item.review.authorName}
              </AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {item.venueName}
              </AppText>
            </View>
          </View>
          <StarRow rating={item.review.rating} size={14} />
        </View>

        {/* Dish link */}
        <Pressable
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
          <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
            {item.dishName}
          </AppText>
          <AppText variant="micro" style={{ color: palette.textMuted }}>
            ·
          </AppText>
          <AppText variant="micro" style={{ color: palette.textMuted }} numberOfLines={1}>
            {item.venueName}
          </AppText>
        </Pressable>

        {/* Review text */}
        <AppText
          variant="body"
          style={{ color: palette.text, lineHeight: typography.body.lineHeight }}
        >
          {item.review.text}
        </AppText>

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

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: spacing[1],
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing[4] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Report review by ${item.review.authorName}`}
              onPress={() =>
                promptReportReview({
                  reviewId: item.review.id,
                  authorName: item.review.authorName,
                  authorId: item.review.authorId,
                  onHidden: onSafetyHidden,
                })
              }
            >
              <AppText variant="micro" tone="muted">
                Report
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Block ${item.review.authorName}`}
              onPress={() =>
                promptBlockReviewAuthor({
                  reviewId: item.review.id,
                  authorName: item.review.authorName,
                  authorId: item.review.authorId,
                  onBlocked: onSafetyHidden,
                })
              }
            >
              <AppText variant="micro" tone="muted">
                Block user
              </AppText>
            </Pressable>
          </View>

          <View style={{ alignItems: "flex-end", gap: spacing[1.5] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing[4],
                justifyContent: "flex-end",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share review"
                onPress={() => onSharePress(item)}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
              >
                <Send color={palette.text} size={22} />
                {interaction.shareCount > 0 ? (
                  <AppText variant="micro" style={{ color: palette.text, fontWeight: "600" }}>
                    {interaction.shareCount}
                  </AppText>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={interaction.saved ? "Remove saved dish" : "Save dish"}
                onPress={() => onSavePress(item)}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
              >
                <Bookmark
                  color={interaction.saved ? palette.orange : palette.text}
                  fill={interaction.saved ? palette.orange : "transparent"}
                  size={22}
                />
              </Pressable>
              {commentsEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open review comments"
                  onPress={() => onCommentPress(item)}
                  style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                >
                  <CommentIcon color={palette.text} size={22} />
                  {interaction.commentCount > 0 ? (
                    <AppText variant="micro" style={{ color: palette.text, fontWeight: "600" }}>
                      {interaction.commentCount}
                    </AppText>
                  ) : null}
                </Pressable>
              ) : null}
              {reviewReactionsEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={interaction.liked ? "Unlike review" : "Like review"}
                  onPress={() => onLikePress(item)}
                  style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                >
                  <Heart
                    color={interaction.liked ? palette.error : palette.text}
                    fill={interaction.liked ? palette.error : "transparent"}
                    size={22}
                  />
                  {interaction.likeCount > 0 ? (
                    <AppText variant="micro" style={{ color: palette.text, fontWeight: "600" }}>
                      {interaction.likeCount}
                    </AppText>
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── ReviewFeedScreen ─────────────────────────────────────────────────────────

export function ReviewFeedScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute();
  const reviewFeedScrollRef = useRef<FlatList<ReviewFeedItem> | null>(null);
  const isTabSwipeLockedRef = useRef(false);
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const commentsEnabled = FEATURE_FLAGS.commentsEnabled;
  const interactions = useSocialStore((state) => state.interactions);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const toggleLike = useSocialStore((state) => state.toggleLike);
  const toggleSave = useSocialStore((state) => state.toggleSave);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);

  const [filterMode, setFilterMode] = useState<FilterMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeCommentReview, setActiveCommentReview] = useState<ActiveReviewCommentTarget | null>(
    null,
  );
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<TextInput>(null);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [serviceReviewItems, setServiceReviewItems] = useState<ReviewFeedItem[] | null>(null);
  const [serviceLoadFailed, setServiceLoadFailed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreServiceReviews, setHasMoreServiceReviews] = useState(false);
  // Bumped when saved blocks load or a report/block succeeds, so the feed re-filters.
  const [safetyFilterVersion, setSafetyFilterVersion] = useState(0);
  const bumpSafetyFilter = useCallback(() => setSafetyFilterVersion((current) => current + 1), []);
  const serviceLoadIdRef = useRef(0);
  const reviewReactionsEnabled = serviceProviderMode === "mock";
  const openCommentsSheet = useCallback(() => {
    const commentSheet = commentsSheetRef.current;
    if (!commentSheet) return;

    void commentSheet.present?.();
    requestAnimationFrame(() => {
      commentSheet.snapToIndex(0);
    });
  }, []);
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
  const showInitialSkeleton = useDelayedLoadingSkeleton(
    isInitialLoading || isServiceFeedLoading,
    0,
  );
  const reviewHeaderTitle = "Reviews";

  useEffect(() => {
    const timeout = setTimeout(() => setIsInitialLoading(false), 0);
    return () => clearTimeout(timeout);
  }, []);

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
      interactionId: makeReviewInteractionId(
        entry.dishId,
        entry.review.id,
        0,
        `${entry.dishId}::${entry.review.createdAt}::${entry.review.text}`,
      ),
    }),
    [repository],
  );

  // One paginated query for the newest reviews instead of one request per catalog dish.
  const loadServiceReviews = useCallback(
    async (mode: "replace" | "append", before?: string) => {
      const loadId = ++serviceLoadIdRef.current;
      try {
        const entries = await getHungryService().reviews.listRecentReviews({
          limit: REVIEW_FEED_PAGE_SIZE,
          before,
        });
        if (loadId !== serviceLoadIdRef.current) return;
        const items = entries.map(toServiceFeedItem);
        setServiceReviewItems((current) =>
          mode === "append" && current ? [...current, ...items] : items,
        );
        setHasMoreServiceReviews(entries.length >= REVIEW_FEED_PAGE_SIZE);
        setServiceLoadFailed(false);
      } catch {
        if (loadId !== serviceLoadIdRef.current) return;
        if (mode === "append") {
          showToast({ message: "Could not load more reviews.", tone: "warning" });
          return;
        }
        setServiceLoadFailed(true);
      }
    },
    [showToast, toServiceFeedItem],
  );

  useEffect(() => {
    if (serviceProviderMode === "mock") {
      setServiceReviewItems(null);
      return;
    }
    void loadServiceReviews("replace");
    return () => {
      serviceLoadIdRef.current += 1;
    };
  }, [loadServiceReviews, serviceProviderMode]);

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
    const oldest = serviceReviewItems?.[serviceReviewItems.length - 1]?.review.createdAt;
    if (!oldest) return;
    setIsLoadingMore(true);
    try {
      await loadServiceReviews("append", oldest);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMoreServiceReviews,
    isLoadingMore,
    loadServiceReviews,
    serviceProviderMode,
    serviceReviewItems,
  ]);

  const openWriteReview = useCallback(() => {
    navigation.navigate("ReviewStack", { screen: "ReviewMain" });
  }, [navigation]);

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
    initializeInteractions(
      allReviews.map((item) => ({
        id: item.interactionId,
        commentCount: 0,
        likeCount: 0,
        savedCount: 0,
      })),
    );
  }, [allReviews, initializeInteractions]);

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

  const openReviewComments = useCallback(
    (item: ReviewFeedItem) => {
      if (!commentsEnabled) return;

      setActiveCommentReview({
        id: item.review.id,
        authorName: item.review.authorName,
        dishName: item.dishName,
        caption: item.review.text,
      });
      openCommentsSheet();
    },
    [commentsEnabled, openCommentsSheet],
  );

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
        link: webShareUrl("dish", item.dishId),
      });
      requestAnimationFrame(() => {
        shareSheetRef.current?.present();
      });
    },
    [repository],
  );

  const requireAccount = useRequireAccount();
  const requireAccountForReviewAction = useCallback(
    (message: string) =>
      requireAccount(message, { name: "MainTabs", params: { screen: "Review" } }),
    [requireAccount],
  );
  const requireAccountForComment = useCallback(() => {
    if (isAuthenticated) return true;
    // Close the sheet first so it does not stay on top of the sign-in screen.
    commentsSheetRef.current?.dismiss();
    return requireAccountForReviewAction("Sign in to comment.");
  }, [isAuthenticated, requireAccountForReviewAction]);

  const handleSavePress = useCallback(
    (item: ReviewFeedItem) => {
      if (!isAuthenticated) {
        setReturnRoute({ name: "MainTabs", params: { screen: "Review" } });
        showToast({ message: "Sign in to save this dish.", tone: "warning" });
        navigation.navigate("AuthStack", { screen: "Login" });
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
      isAuthenticated,
      navigation,
      repository,
      serviceProviderMode,
      setReturnRoute,
      showToast,
      toggleFavourite,
      toggleSave,
    ],
  );

  const renderItem = useCallback(
    ({ item }: { item: ReviewFeedItem }) => {
      const baseInteraction = interactions[item.interactionId] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };
      const displayInteraction = reviewReactionsEnabled
        ? baseInteraction
        : {
            ...baseInteraction,
            liked: false,
            likeCount: 0,
            saved: favouriteDishIds.includes(item.dishId),
            saveCount: baseInteraction.saveCount,
            shareCount: 0,
          };
      const postComments = commentsByPostId[item.review.id] ?? [];
      const commentIds = new Set<string>(postComments.map((comment) => comment.id));
      const replyCount = Object.values(repliesByCommentId).reduce((acc, replies) => {
        const repliesForPost = replies.filter((reply) => commentIds.has(reply.parentCommentId));
        return acc + repliesForPost.length;
      }, 0);
      const computedCommentCount = Math.max(
        baseInteraction.commentCount,
        commentIds.size + replyCount,
      );

      return (
        <ReviewCard
          item={item}
          interaction={{ ...displayInteraction, commentCount: computedCommentCount }}
          commentsEnabled={commentsEnabled}
          onCommentPress={openReviewComments}
          onLikePress={(targetItem) => {
            if (
              reviewReactionsEnabled &&
              requireAccountForReviewAction("Sign in to like reviews.")
            ) {
              void toggleLike(targetItem.interactionId);
            }
          }}
          onPressDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
          onSavePress={handleSavePress}
          onSharePress={openShareReview}
          onSafetyHidden={bumpSafetyFilter}
          reviewReactionsEnabled={reviewReactionsEnabled}
        />
      );
    },
    [
      interactions,
      favouriteDishIds,
      navigation,
      openReviewComments,
      openShareReview,
      bumpSafetyFilter,
      handleSavePress,
      requireAccountForReviewAction,
      toggleLike,
      commentsByPostId,
      commentsEnabled,
      repliesByCommentId,
      reviewReactionsEnabled,
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
              onSubmit={() => undefined}
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
              <EmptyState title="No reviews found" body="Try a different search term." />
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
      {commentsEnabled ? (
        <ReviewCommentsSheet
          activeReview={activeCommentReview}
          inputRef={commentInputRef}
          innerRef={commentsSheetRef}
          onDismiss={() => setActiveCommentReview(null)}
          onBeforeSend={requireAccountForComment}
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
