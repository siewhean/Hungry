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
  ScrollView,
  type TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Bookmark, Heart, MessageCircle, Send, Star } from "lucide-react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewCommentsSheet, type ActiveReviewCommentTarget } from "@/components/social";
import { AppHeader, AppText, Chip, EmptyState, ExpandableSearchLauncher } from "@/components/ui";
import { promptBlockReviewAuthor, promptReportReview } from "@/lib/security/communitySafety";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSocialStore, type InteractionState, type SocialComment } from "@/store/useSocialStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail, Review } from "@/types/domain";
import { ReviewShareSheet, type ReviewShareTarget } from "./ReviewShareSheet";

// ─── Types ──────────────────────────────────────────────────────────────────

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

type ReviewFeedItem = {
  review: Review;
  dish: DishDetail;
  dishName: string;
  venueName: string;
  venueId: string;
  dishId: string;
};

type FilterMode = "recent" | "top_rated" | "dish" | "location";

// ─── Mock review feed data ────────────────────────────────────────────────────
// Aggregates reviews from all dishes to create a social-style feed.

const MOCK_EXTRA_REVIEWS: ReviewFeedItem[] = [
  {
    dishId: "dish-chicken-rice",
    dishName: "Chicken Rice",
    venueName: "Tian Tian Chicken Rice",
    venueId: "venue-tian-tian",
    review: {
      id: "feed-r-1",
      authorName: "Sarah L.",
      rating: 5,
      createdAt: "2026-04-21T09:30:00Z",
      text: "The best chicken rice in Singapore, no contest. The chilli is life-changing. Came at 11am and the queue was already 20 deep — worth every minute.",
      tags: ["Fragrant", "Juicy", "Must Try"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-laksa",
    dishName: "Laksa",
    venueName: "328 Katong Laksa",
    venueId: "venue-katong-laksa",
    review: {
      id: "feed-r-2",
      authorName: "Ahmad R.",
      rating: 5,
      createdAt: "2026-04-20T13:00:00Z",
      text: "Thick, creamy coconut gravy with perfectly cooked cockles. The cut noodles mean you can eat it with a spoon only — very authentic. Pro tip: go for the large.",
      tags: ["Creamy", "Spicy", "Rich"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-char-kway-teow",
    dishName: "Char Kway Teow",
    venueName: "Hill Street Char Kway Teow",
    venueId: "venue-hill-street-ckt",
    review: {
      id: "feed-r-3",
      authorName: "Wei Ming",
      rating: 4,
      createdAt: "2026-04-19T18:45:00Z",
      text: "Wok hei is real here. The cockles were fresh and the noodles had a nice char. Only gripe: no options for less oil. But if you're here for the full experience, this is it.",
      tags: ["Wok Hei", "Savoury", "Smoky"],
      wouldRecommend: true,
      photos: [],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-bak-chor-mee",
    dishName: "Bak Chor Mee",
    venueName: "Bedok 85 Fengshan Centre",
    venueId: "venue-bedok-85",
    review: {
      id: "feed-r-4",
      authorName: "Emma T.",
      rating: 5,
      createdAt: "2026-04-18T12:00:00Z",
      text: "Minced pork mee pok done right. The vinegar-chilli sauce is perfectly balanced. Pork liver is silky not grainy. Dry version with extra chilli 🔥",
      tags: ["Tangy", "Savoury", "Spicy"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-chicken-rice",
    dishName: "Chicken Rice",
    venueName: "Tian Tian Chicken Rice",
    venueId: "venue-tian-tian",
    review: {
      id: "feed-r-5",
      authorName: "Uncle Tan",
      rating: 4,
      createdAt: "2026-04-17T10:15:00Z",
      text: "Come early or you'll miss the roast chicken. The poached version is better than the roast IMO. Dark soy sauce on the side is a must.",
      tags: ["Comforting", "Juicy"],
      wouldRecommend: true,
      photos: [],
    },
    dish: {} as DishDetail,
  },
  {
    dishId: "dish-satay",
    dishName: "Satay",
    venueName: "Lau Pa Sat Satay Street",
    venueId: "venue-lau-pa-sat-satay",
    review: {
      id: "feed-r-6",
      authorName: "Priya S.",
      rating: 5,
      createdAt: "2026-04-16T21:30:00Z",
      text: "Night market vibes. Best eaten outdoors with cold beer. The peanut sauce is thick and fragrant — we went through 3 portions. Great for groups!",
      tags: ["Smoky", "Rich", "Fragrant"],
      wouldRecommend: true,
      photos: ["https://images.unsplash.com/photo-1529564879024-c54e7c2dd0e5?w=600&q=80"],
    },
    dish: {} as DishDetail,
  },
];

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
    <View style={{ flexDirection: "row", gap: 2 }}>
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

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({
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
  const { palette, radii, spacing, shadows, typography } = useHungryTheme();
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
          borderRadius: radii.lg,
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
        <Pressable onPress={() => onPressDish(item.dishId)}>
          <Image
            source={{ uri: item.review.photos[0] }}
            style={{ width: "100%", height: width * 0.55 }}
            contentFit="cover"
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
                <MessageCircle color={palette.text} size={22} />
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

// ─── ReviewFeedScreen ─────────────────────────────────────────────────────────

export function ReviewFeedScreen() {
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

  const [filterMode, setFilterMode] = useState<FilterMode>("recent");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Gather reviews from all dishes
  const allReviews = useMemo<ReviewFeedItem[]>(() => {
    const dishes = repository.listBuildings().flatMap((building) =>
      repository.listVenuesByBuilding(building.id).flatMap((venue) =>
        repository.listDishesByVenue(venue.id).flatMap((dish) =>
          dish.reviews.map((review) => ({
            review,
            dish,
            dishId: dish.id,
            dishName: dish.name,
            venueName: dish.venueName,
            venueId: dish.venueId,
          })),
        ),
      ),
    );

    // Merge with mock extra reviews
    const combined = [...dishes, ...MOCK_EXTRA_REVIEWS];

    // Sort
    if (filterMode === "top_rated") {
      return [...combined].sort((a, b) => b.review.rating - a.review.rating);
    }
    if (filterMode === "dish") {
      return [...combined].sort((a, b) => a.dishName.localeCompare(b.dishName));
    }
    if (filterMode === "location") {
      return [...combined].sort((a, b) => a.venueName.localeCompare(b.venueName));
    }
    // Default: most recent
    return [...combined].sort(
      (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
    );
  }, [repository, filterMode]);

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
        <ReviewCard
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

  const keyExtractor = useCallback(
    (item: ReviewFeedItem) => `${item.review.id}-${item.dishId}`,
    [],
  );

  const seededCommentsForActiveReview = useMemo<SocialComment[]>(() => {
    if (!activeCommentReview) {
      return [];
    }

    const matchingItem = allReviews.find((item) => item.review.id === activeCommentReview.id);
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
  }, [activeCommentReview, allReviews]);

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
          title="Reviews"
          showBack={false}
          right={
            <ExpandableSearchLauncher
              query={searchQuery}
              onQueryChange={setSearchQuery}
              onSubmit={() => undefined}
              onClear={() => setSearchQuery("")}
              placeholder="Search dish, stall, or taste tag..."
              expandedWidth={searchBarWidth}
              iconAlignment="right"
              iconSize={headerActionSize}
              barHeight={headerActionSize}
              borderColor={palette.border}
              backgroundColor={palette.bgSoft}
              textColor={palette.text}
              placeholderColor={palette.textSecondary}
            />
          }
        />

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <Chip
              key={opt.id}
              label={opt.label}
              selected={filterMode === opt.id}
              onPress={() => setFilterMode(opt.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Review feed */}
      <FlatList
        data={filteredReviews}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: spacing[3],
          paddingBottom: spacing[20],
        }}
        ListEmptyComponent={
          <EmptyState
            title="No reviews yet"
            body={searchQuery ? "Try a different search term." : "Be the first to review a dish!"}
          />
        }
      />
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
