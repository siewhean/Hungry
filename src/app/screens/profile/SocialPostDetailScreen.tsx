import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Heart, MessageCircle, PlayCircle, Send } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Avatar, Screen } from "@/components/ui";
import {
  ReviewCommentsSheet,
  type ActiveReviewCommentTarget,
  ZoomableMedia,
} from "@/components/social";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSocialStore, type SocialComment } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import type { StallPost } from "@/types/domain";

type Props = NativeStackScreenProps<ProfileStackParamList, "SocialPostDetail">;

export function SocialPostDetailScreen({ navigation, route }: Props) {
  const { palette, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { postId, type } = route.params;
  const interactions = useSocialStore((state) => state.interactions);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const toggleLike = useSocialStore((state) => state.toggleLike);
  const toggleSave = useSocialStore((state) => state.toggleSave);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const repository = getDataRepository();
  const insets = useSafeAreaInsets();
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<TextInput | null>(null);
  const [activeCommentReview, setActiveCommentReview] = useState<ActiveReviewCommentTarget | null>(
    null,
  );
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);

  const posts = useMemo(() => repository.listStallPosts(), [repository]);

  useEffect(() => {
    initializeInteractions(posts);
  }, [initializeInteractions, posts]);

  const visiblePosts = useMemo(
    () =>
      posts.filter((post) => {
        const interaction = interactions[post.id];
        if (!interaction) return false;
        return type === "liked" ? interaction.liked : interaction.saved;
      }),
    [interactions, posts, type],
  );

  const selectedPost = posts.find((candidate) => candidate.id === postId) ?? visiblePosts[0];
  const orderedPosts = useMemo(() => {
    if (!selectedPost) return visiblePosts;
    return [selectedPost, ...visiblePosts.filter((candidate) => candidate.id !== selectedPost.id)];
  }, [selectedPost, visiblePosts]);

  const seededCommentsForActiveReview = useMemo<SocialComment[]>(() => {
    if (!activeCommentReview) {
      return [];
    }

    const targetPost = posts.find((candidate) => candidate.id === activeCommentReview.id);
    if (!targetPost) {
      return [];
    }

    const seededComments = targetPost.dishIds
      .map((dishId) => repository.getDishById(dishId))
      .flatMap((dish) => dish?.reviews ?? [])
      .map((review) => ({
        id: review.id,
        authorName: review.authorName,
        authorAvatarUrl: undefined,
        text: review.text,
        createdAt: review.createdAt,
      }));

    return seededComments;
  }, [activeCommentReview, posts, repository]);

  if (!selectedPost || orderedPosts.length === 0) {
    return (
      <Screen title={type === "liked" ? "Liked post" : "Saved post"}>
        <View style={styles.empty}>
          <AppText tone="secondary">This post is no longer available.</AppText>
        </View>
      </Screen>
    );
  }

  const imageHeight = Math.min(Math.max(screenWidth * 1.12, 360), 460);

  const renderFeedPost = (feedPost: StallPost) => {
    const venue = repository.getVenueById(feedPost.venueId);
    const primaryDish = feedPost.dishIds
      .map((dishId) => repository.getDishById(dishId))
      .filter(Boolean)[0];
    const interaction = interactions[feedPost.id] ?? {
      liked: false,
      saved: false,
      likeCount: primaryDish?.reviews.length ?? 0,
      saveCount: 0,
      shareCount: 0,
      commentCount: primaryDish?.reviews.length ?? 0,
    };
    const isLiked = interaction.liked;
    const isSaved = interaction.saved;
    const mediaUrls =
      feedPost.mediaType === "photo" && feedPost.mediaUrls?.length
        ? feedPost.mediaUrls
        : [feedPost.mediaUrl];
    const isCarousel = feedPost.mediaType === "photo" && mediaUrls.length > 1;

    return (
      <View
        key={feedPost.id}
        style={[styles.feedItemWrap, { backgroundColor: palette.bg, marginBottom: spacing[12] }]}
      >
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          {isCarousel ? (
            <ScrollView
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
            >
              {mediaUrls.map((uri, index) => (
                <Pressable
                  key={`${feedPost.id}-detail-media-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${primaryDish?.name ?? venue?.name ?? "post"} details`}
                  onPress={() => {
                    if (primaryDish) {
                      navigation.navigate(
                        "DishDetail" as never,
                        {
                          dishId: primaryDish.id,
                        } as never,
                      );
                    }
                  }}
                  style={[styles.carouselPage, { width: screenWidth, height: imageHeight }]}
                >
                  <ZoomableMedia uri={uri} type="image" style={styles.heroImage} />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${primaryDish?.name ?? venue?.name ?? "post"} details`}
              onPress={() => {
                if (primaryDish) {
                  navigation.navigate("DishDetail" as never, { dishId: primaryDish.id } as never);
                }
              }}
              style={StyleSheet.absoluteFill}
            >
              <ZoomableMedia
                uri={mediaUrls[0]}
                type={feedPost.mediaType === "video" ? "video" : "image"}
                style={styles.heroImage}
              />
            </Pressable>
          )}

          {isCarousel ? (
            <View pointerEvents="none" style={styles.carouselBadge}>
              <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                1 / {mediaUrls.length}
              </AppText>
            </View>
          ) : null}

          {feedPost.mediaType === "video" ? (
            <View pointerEvents="none" style={styles.playButtonContainer}>
              <View style={styles.playButtonBackdrop}>
                <PlayCircle color={palette.white} size={54} strokeWidth={1.4} />
              </View>
            </View>
          ) : null}

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)"]}
            style={[styles.gradientScrim, { height: "40%", top: "60%" }]}
            pointerEvents="none"
          />

          <View
            style={{
              position: "absolute",
              bottom: spacing[3],
              left: spacing[3],
              right: spacing[3],
              gap: spacing[0.5],
            }}
            pointerEvents="none"
          >
            <AppText variant="h3" style={{ color: palette.white }}>
              {primaryDish?.name ?? venue?.name ?? feedPost.authorName}
            </AppText>
            <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)" }}>
              {venue
                ? `${venue.name} · ${venue.floor} ${venue.unitNumber}`
                : feedPost.authorLocation}
            </AppText>
          </View>
        </View>

        <View
          style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[3], gap: spacing[2] }}
        >
          <View style={styles.detailRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], flex: 1 }}>
              <Avatar uri={feedPost.authorAvatarUrl} name={feedPost.authorName} size={32} />
              <View>
                <AppText variant="bodySmallBold" style={{ color: palette.text }}>
                  {feedPost.authorName}
                </AppText>
                <AppText variant="micro" tone="secondary">
                  {feedPost.authorLocation}
                </AppText>
              </View>
            </View>

            <View style={styles.inlineActionsRow}>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  if (!primaryDish) return;
                  setActiveShareReview({
                    reviewId: feedPost.id,
                    postId: feedPost.id,
                    title: primaryDish.name,
                    subtitle: `${venue?.name ?? feedPost.authorLocation} · ${feedPost.authorName}`,
                    imageUrl: primaryDish.imageUrl,
                    authorName: feedPost.authorName,
                    message: `Check out ${primaryDish.name} at ${
                      venue?.name ?? feedPost.authorLocation
                    } on Hungry.`,
                    link: `https://hungry.sg/post/${feedPost.id}`,
                  });
                  requestAnimationFrame(() => {
                    shareSheetRef.current?.present();
                  });
                }}
                style={styles.inlineAction}
              >
                <Send color={palette.text} size={24} />
                {interaction.shareCount > 0 && (
                  <AppText
                    variant="micro"
                    style={[styles.inlineActionCount, { color: palette.text }]}
                  >
                    {interaction.shareCount}
                  </AppText>
                )}
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={() => void toggleSave(feedPost.id)}
                style={styles.inlineAction}
              >
                <Bookmark
                  color={isSaved ? palette.orange : palette.text}
                  fill={isSaved ? palette.orange : "transparent"}
                  size={24}
                />
                {interaction.saveCount > 0 && (
                  <AppText
                    variant="micro"
                    style={[styles.inlineActionCount, { color: palette.text }]}
                  >
                    {interaction.saveCount}
                  </AppText>
                )}
              </Pressable>
              <Pressable
                hitSlop={10}
                style={styles.inlineAction}
                onPress={() => {
                  setActiveCommentReview({
                    id: feedPost.id,
                    authorName: feedPost.authorName,
                    dishName: primaryDish?.name ?? feedPost.authorName,
                    caption: feedPost.caption,
                  });
                  requestAnimationFrame(() => {
                    commentsSheetRef.current?.present();
                    commentsSheetRef.current?.snapToIndex(0);
                  });
                }}
              >
                <MessageCircle color={palette.text} size={24} />
                {interaction.commentCount > 0 && (
                  <AppText
                    variant="micro"
                    style={[styles.inlineActionCount, { color: palette.text }]}
                  >
                    {interaction.commentCount}
                  </AppText>
                )}
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={() => void toggleLike(feedPost.id)}
                style={styles.inlineAction}
              >
                <Heart
                  color={isLiked ? palette.error : palette.text}
                  fill={isLiked ? palette.error : "transparent"}
                  size={24}
                />
                {interaction.likeCount > 0 && (
                  <AppText
                    variant="micro"
                    style={[styles.inlineActionCount, { color: palette.text }]}
                  >
                    {interaction.likeCount}
                  </AppText>
                )}
              </Pressable>
            </View>
          </View>

          <AppText variant="bodySmall" style={{ color: palette.text, marginTop: spacing[1] }}>
            {feedPost.caption}
          </AppText>
        </View>
      </View>
    );
  };

  return (
    <Screen
      title={type === "liked" ? "Liked post" : "Saved post"}
      fullWidth
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      <View style={{ paddingBottom: spacing[4] }}>{orderedPosts.map(renderFeedPost)}</View>

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
        onShared={() => {
          if (!activeShareReview) return;
          incrementShare(activeShareReview.postId);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  feedItemWrap: {
    width: "100%",
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  carouselPage: {
    overflow: "hidden",
  },
  carouselBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gradientScrim: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonBackdrop: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  inlineActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineActionCount: {
    fontWeight: "600",
  },
});
