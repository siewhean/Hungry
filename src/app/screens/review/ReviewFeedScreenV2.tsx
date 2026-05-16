/**
 * ReviewFeedScreenV2 — Enhanced Tab 3
 * Pure user-review feed with optimized filtering and search.
 * Filter by Dish, Location, Rating, and Recent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  type TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bookmark,
  Filter,
  Heart,
  MessageCircle,
  MessageCircleMore,
  Send,
  Star,
} from "lucide-react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewCommentsSheet, type ActiveReviewCommentTarget } from "@/components/social";
import {
  AppHeader,
  AppText,
  Chip,
  EmptyState,
  ExpandableSearchLauncher,
  Skeleton,
} from "@/components/ui";
import { promptBlockReviewAuthor, promptReportReview } from "@/lib/security/communitySafety";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { useSocialStore, type InteractionState, type SocialComment } from "@/store/useSocialStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "./ReviewShareSheet";
import { listReviewFeedItems, type ReviewFeedItem } from "@/features/review/reviewFeed";

// ─── Types ──────────────────────────────────────────────────────────────────

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

type FilterMode = "Recent" | "Rating" | "Dish" | "Location" | "Vegetarian";

const FILTER_CHIPS: FilterMode[] = ["Recent", "Rating", "Dish", "Location", "Vegetarian"];

// ─── ReviewCardV2 ─────────────────────────────────────────────────────────────

function ReviewFeedSkeleton() {
  const { componentRadii, radii, spacing } = useHungryTheme();

  return (
    <View style={{ gap: spacing[4], paddingHorizontal: spacing[4], paddingTop: spacing[4] }}>
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

function ReviewCardV2({
  item,
  interaction,
  onCommentPress,
  onPressDish,
  onSavePress,
  onSharePress,
  onLikePress,
}: {
  item: ReviewFeedItem;
  interaction: InteractionState;
  onCommentPress: (item: ReviewFeedItem) => void;
  onPressDish: (dishId: string) => void;
  onSavePress: (item: ReviewFeedItem) => void;
  onSharePress: (item: ReviewFeedItem) => void;
  onLikePress: (reviewId: string) => void;
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
      {/* Photo with Overlay Info */}
      {hasPhoto && (
        <Pressable onPress={() => onPressDish(item.dishId)} style={{ position: "relative" }}>
          <Image
            source={{ uri: item.review.photos[0] }}
            style={{ width: "100%", height: width * 0.6 }}
            contentFit="cover"
          />
          {item.dish.dietaryFlags.includes("vegetarian") && (
            <View
              style={{
                position: "absolute",
                top: spacing[3],
                right: spacing[3],
                backgroundColor: "rgba(34, 197, 94, 0.9)",
                paddingHorizontal: spacing[2],
                paddingVertical: 4,
                borderRadius: radii.sm,
              }}
            >
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "700" }}>
                VEGETARIAN
              </AppText>
            </View>
          )}
        </Pressable>
      )}

      {/* Content */}
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        {/* User Info & Rating */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: componentRadii.iconButton,
                backgroundColor: palette.orangeLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText style={{ color: palette.orange, fontWeight: "800" }}>
                {item.review.authorName.charAt(0)}
              </AppText>
            </View>
            <View>
              <AppText variant="bodyBold">{item.review.authorName}</AppText>
              <AppText variant="micro" tone="muted" numberOfLines={1}>
                {item.venueName}
              </AppText>
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: palette.amberLight,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: componentRadii.card,
            }}
          >
            <Star size={12} color={palette.amber} fill={palette.amber} />
            <AppText variant="bodySmallBold" style={{ color: palette.amber }}>
              {item.review.rating.toFixed(1)}
            </AppText>
          </View>
        </View>

        {/* Dish Details */}
        <Pressable
          onPress={() => onPressDish(item.dishId)}
          style={{
            backgroundColor: palette.bgSoft,
            padding: spacing[3],
            borderRadius: componentRadii.card,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="bodySmallBold" numberOfLines={1}>
              {item.dishName}
            </AppText>
            <AppText variant="micro" tone="muted" numberOfLines={1}>
              {item.venueName}
            </AppText>
          </View>
          <Heart size={16} color={palette.textMuted} />
        </Pressable>

        {/* Review Body */}
        <AppText
          variant="body"
          style={{ color: palette.text, lineHeight: typography.body.lineHeight }}
        >
          {item.review.text}
        </AppText>

        {/* Tags */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1, minWidth: 0 }}>
            {item.review.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: palette.border,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <AppText variant="micro" style={{ color: palette.textSecondary }}>
                  #{tag}
                </AppText>
              </View>
            ))}
          </View>
          <AppText variant="micro" tone="muted" style={{ textAlign: "right" }}>
            {reviewDate}
          </AppText>
        </View>

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
                accessibilityLabel={interaction.saved ? "Unsave review" : "Save review"}
                onPress={() => onSavePress(item)}
                style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
              >
                <Bookmark
                  color={interaction.saved ? palette.orange : palette.text}
                  fill={interaction.saved ? palette.orange : "transparent"}
                  size={22}
                />
              </Pressable>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={interaction.liked ? "Unlike review" : "Like review"}
                onPress={() => onLikePress(item.review.id)}
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
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── ReviewFeedScreenV2 ───────────────────────────────────────────────────────

export function ReviewFeedScreenV2() {
  const navigation = useNavigation<RootNavigation>();
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const repository = getDataRepository();
  const interactions = useSocialStore((state) => state.interactions);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const toggleLike = useSocialStore((state) => state.toggleLike);
  const toggleSave = useSocialStore((state) => state.toggleSave);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);

  const [activeFilter, setActiveFilter] = useState<FilterMode>("Recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeCommentReview, setActiveCommentReview] = useState<ActiveReviewCommentTarget | null>(
    null,
  );
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<TextInput>(null);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const stallPosts = useMemo(() => repository.listStallPosts(), [repository]);
  const searchBarWidth = screenWidth - spacing[8];
  const headerActionSize = spacing[8] + spacing[2.5];
  const showInitialSkeleton = useDelayedLoadingSkeleton(isInitialLoading, 0);
  const reviewHeaderTitle = "Reviews";

  useEffect(() => {
    const timeout = setTimeout(() => setIsInitialLoading(false), 0);
    return () => clearTimeout(timeout);
  }, []);

  // Get review feed data from the active repository.
  const allReviews = useMemo<ReviewFeedItem[]>(() => {
    const reviews = listReviewFeedItems(repository);

    // Apply sorting
    if (activeFilter === "Rating") {
      return [...reviews].sort((a, b) => b.review.rating - a.review.rating);
    }
    if (activeFilter === "Dish") {
      return [...reviews].sort((a, b) => a.dishName.localeCompare(b.dishName));
    }
    if (activeFilter === "Location") {
      return [...reviews].sort((a, b) => a.venueName.localeCompare(b.venueName));
    }
    if (activeFilter === "Vegetarian") {
      return reviews.filter(
        (item) =>
          item.dish.dietaryFlags.includes("vegetarian") ||
          item.review.tags.some((t) => t.toLowerCase() === "vegetarian"),
      );
    }

    return [...reviews].sort(
      (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
    );
  }, [repository, activeFilter]);

  useEffect(() => {
    initializeInteractions(
      allReviews.map((item) => ({
        id: item.review.id,
        commentCount: 1,
        likeCount: item.review.rating,
        savedCount: 0,
      })),
    );
  }, [allReviews, initializeInteractions]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return allReviews;
    const q = searchQuery.toLowerCase();
    return allReviews.filter(
      (item) =>
        item.dishName.toLowerCase().includes(q) ||
        item.venueName.toLowerCase().includes(q) ||
        item.review.text.toLowerCase().includes(q),
    );
  }, [allReviews, searchQuery]);

  const openReviewComments = useCallback((item: ReviewFeedItem) => {
    setActiveCommentReview({
      id: item.review.id,
      authorName: item.review.authorName,
      dishName: item.dishName,
      caption: item.review.text,
    });
    requestAnimationFrame(() => {
      commentsSheetRef.current?.present();
      commentsSheetRef.current?.snapToIndex(0);
    });
  }, []);

  const seededCommentsForActiveReview = useMemo<SocialComment[]>(() => {
    if (!activeCommentReview) {
      return [];
    }

    const matchingItem = filteredData.find((item) => item.review.id === activeCommentReview.id);
    if (!matchingItem) {
      return [];
    }

    return [
      {
        id: matchingItem.review.id,
        authorName: matchingItem.review.authorName,
        authorAvatarUrl: undefined,
        text: matchingItem.review.text,
        createdAt: matchingItem.review.createdAt,
      },
    ];
  }, [activeCommentReview, filteredData]);

  const openShareReview = useCallback(
    (item: ReviewFeedItem) => {
      const linkedPost =
        stallPosts.find((post) => post.dishIds.includes(item.dishId)) ??
        stallPosts.find((post) => post.venueId === item.venueId) ??
        stallPosts[0];
      const linkedDish = item.dish.imageUrl ? item.dish : repository.getDishById(item.dishId);
      setActiveShareReview({
        reviewId: item.review.id,
        postId: linkedPost?.id ?? item.review.id,
        title: item.dishName,
        subtitle: `${item.venueName} · ${item.review.authorName}`,
        imageUrl: item.review.photos[0] ?? linkedDish?.imageUrl ?? linkedPost?.mediaUrl ?? "",
        authorName: item.review.authorName,
        message: `${item.review.authorName} reviewed ${item.dishName} at ${item.venueName} on Hungry: ${item.review.text}`,
        link: `https://hungry.sg/reviews/${item.review.id}`,
      });
      requestAnimationFrame(() => {
        shareSheetRef.current?.present();
      });
    },
    [repository, stallPosts],
  );

  const handleSavePress = useCallback(
    (item: ReviewFeedItem) => {
      void toggleSave(item.review.id);

      const dish = repository.getDishById(item.dishId) ?? item.dish;
      if (dish?.id) {
        toggleFavourite(dish);
      }
    },
    [repository, toggleFavourite, toggleSave],
  );

  const renderItem = useCallback(
    ({ item }: { item: ReviewFeedItem }) => {
      const baseInteraction = interactions[item.review.id] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 1,
      };
      const postComments = commentsByPostId[item.review.id] ?? [];
      const commentIds = new Set<string>([
        item.review.id,
        ...postComments.map((comment) => comment.id),
      ]);
      const replyCount = Object.values(repliesByCommentId).reduce((acc, replies) => {
        const repliesForPost = replies.filter((reply) => commentIds.has(reply.parentCommentId));
        return acc + repliesForPost.length;
      }, 0);
      const computedCommentCount = Math.max(
        baseInteraction.commentCount,
        commentIds.size + replyCount,
      );

      return (
        <ReviewCardV2
          item={item}
          interaction={{ ...baseInteraction, commentCount: computedCommentCount }}
          onCommentPress={openReviewComments}
          onLikePress={(reviewId) => void toggleLike(reviewId)}
          onPressDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
          onSavePress={handleSavePress}
          onSharePress={openShareReview}
        />
      );
    },
    [
      interactions,
      navigation,
      openReviewComments,
      openShareReview,
      handleSavePress,
      toggleLike,
      commentsByPostId,
      repliesByCommentId,
    ],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Header Section */}
      <View
        style={{ paddingHorizontal: semanticSpacing.screenEdge, paddingTop: 0, gap: spacing[4] }}
      >
        <AppHeader
          title={reviewHeaderTitle}
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
        <AppText variant="bodySmall" tone="secondary">
          What&apos;s the community eating?
        </AppText>

        {/* Filters */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Filter size={18} color={palette.orange} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            {FILTER_CHIPS.map((chip) => (
              <Chip
                key={chip}
                label={chip}
                selected={activeFilter === chip}
                onPress={() => setActiveFilter(chip)}
              />
            ))}
          </ScrollView>
        </View>

        <ReviewSearchQuerySummary query={searchQuery} />
      </View>

      {/* Feed List */}
      {showInitialSkeleton ? (
        <ReviewFeedSkeleton />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.review.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: spacing[4], paddingBottom: spacing[24] }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No reviews found"
              body="Try adjusting your filters or search query."
            />
          }
        />
      )}
      <ReviewCommentsSheet
        activeReview={activeCommentReview}
        inputRef={commentInputRef}
        innerRef={commentsSheetRef}
        seededComments={seededCommentsForActiveReview}
        onDismiss={() => setActiveCommentReview(null)}
      />
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
