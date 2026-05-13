import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MessageCircleMore,
  PlayCircle,
  Send,
} from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ZoomableMedia } from "@/components/social";
import { AppText, Avatar, Screen } from "@/components/ui";
import { ACTIVITY_UPDATES } from "@/features/home/activity";
import { listSharedStallPostsSync } from "@/features/social/sharedStallPosts";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { ReviewCommentsSheet, type ActiveReviewCommentTarget } from "@/components/social";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import { useActivityStore } from "@/store/useActivityStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useSocialStore, type SocialComment } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";

const CommentIcon = MessageCircle ?? MessageCircleMore;

type Props = NativeStackScreenProps<RootStackParamList, "ActivityPostDetail">;

export function ActivityPostDetailScreen({ navigation, route }: Props) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const repository = getDataRepository();
  const { postId, updateId } = route.params;
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const posts = useMemo(() => listSharedStallPostsSync(repository), [publishedPosts, repository]);
  const post = posts.find((candidate) => candidate.id === postId);
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const interactions = useSocialStore((state) => state.interactions);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const toggleLike = useSocialStore((state) => state.toggleLike);
  const toggleSave = useSocialStore((state) => state.toggleSave);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const markActivityRead = useActivityStore((state) => state.markActivityRead);
  const insets = useSafeAreaInsets();
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<TextInput | null>(null);
  const [activeCommentReview, setActiveCommentReview] = useState<ActiveReviewCommentTarget | null>(
    null,
  );
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);

  useEffect(() => {
    initializeInteractions(posts);
  }, [initializeInteractions, posts]);

  useEffect(() => {
    if (updateId) {
      markActivityRead("update", updateId);
    }
  }, [markActivityRead, updateId]);

  const update = useMemo(() => {
    return (
      ACTIVITY_UPDATES.find((candidate) => candidate.id === updateId) ??
      activityUpdates.find((candidate) => candidate.id === updateId)
    );
  }, [activityUpdates, updateId]);

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

  if (!post) {
    return (
      <Screen title="Activity post">
        <View style={styles.empty}>
          <AppText tone="secondary">This post is no longer available.</AppText>
        </View>
      </Screen>
    );
  }

  const venue = repository.getVenueById(post.venueId);
  const primaryDish = post.dishIds
    .map((dishId) => repository.getDishById(dishId))
    .filter(Boolean)[0];
  const interaction = interactions[post.id] ?? {
    liked: false,
    saved: false,
    likeCount: primaryDish?.reviews.length ?? 0,
    saveCount: 0,
    shareCount: 0,
    commentCount: primaryDish?.reviews.length ?? 0,
  };
  const imageHeight = Math.min(Math.max(screenWidth * 1.12, 360), 460);
  const kindLabel = update?.kind === "like" ? "Like" : "Comment";
  const kindColor = update?.kind === "like" ? palette.error : palette.orange;

  return (
    <Screen
      title="Activity post"
      subtitle={update ? `${update.actorName} · ${kindLabel}` : "Food update"}
      fullWidth
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      {update ? (
        <View
          style={{
            marginHorizontal: semanticSpacing.screenEdge,
            marginBottom: spacing[3],
            padding: spacing[3],
            borderRadius: 16,
            backgroundColor: palette.bgSoft,
            gap: spacing[1],
          }}
        >
          <AppText variant="micro" style={{ color: kindColor, fontWeight: "900" }}>
            {kindLabel.toUpperCase()}
          </AppText>
          <AppText variant="bodySmall">
            {update.actorName} {update.text}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.feedItemWrap, { backgroundColor: palette.bg }]}>
        <View style={[styles.imageContainer, { height: imageHeight }]}>
          <ZoomableMedia
            uri={post.mediaUrl}
            type={post.mediaType === "video" ? "video" : "image"}
            style={styles.heroImage}
          />

          {post.mediaType === "video" ? (
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
              left: semanticSpacing.screenEdge,
              right: semanticSpacing.screenEdge,
              gap: spacing[0.5],
            }}
            pointerEvents="none"
          >
            <AppText variant="h3" style={{ color: palette.white }}>
              {primaryDish?.name ?? venue?.name ?? post.authorName}
            </AppText>
            <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)" }}>
              {venue ? `${venue.name} · ${venue.floor} ${venue.unitNumber}` : post.authorLocation}
            </AppText>
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: semanticSpacing.screenEdge,
            paddingVertical: spacing[3],
            gap: spacing[2],
          }}
        >
          <View style={styles.detailRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], flex: 1 }}>
              <Avatar uri={post.authorAvatarUrl} name={post.authorName} size={32} />
              <View>
                <AppText variant="bodySmallBold" style={{ color: palette.text }}>
                  {post.authorName}
                </AppText>
                <AppText variant="micro" tone="secondary">
                  {post.authorLocation}
                </AppText>
              </View>
            </View>

            <View style={styles.inlineActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share post"
                hitSlop={10}
                onPress={() => {
                  const title = primaryDish?.name ?? post.authorName;
                  setActiveShareReview({
                    reviewId: post.id,
                    postId: post.id,
                    title,
                    subtitle: `${venue?.name ?? "Hungry"} · ${post.authorName}`,
                    imageUrl: post.mediaUrl,
                    authorName: post.authorName,
                    message: `Check out ${title} on Hungry. ${post.caption ?? ""}`,
                    link: `https://hungry.sg/post/${post.id}`,
                  });
                  requestAnimationFrame(() => {
                    shareSheetRef.current?.present();
                  });
                }}
                style={styles.inlineAction}
              >
                <Send color={palette.text} size={24} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save post"
                hitSlop={10}
                onPress={() => void toggleSave(post.id)}
                style={styles.inlineAction}
              >
                <Bookmark
                  color={interaction.saved ? palette.orange : palette.text}
                  fill={interaction.saved ? palette.orange : "transparent"}
                  size={24}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open comments"
                hitSlop={10}
                onPress={() => {
                  setActiveCommentReview({
                    id: post.id,
                    authorName: post.authorName,
                    dishName: primaryDish?.name ?? post.authorName,
                    caption: post.caption,
                  });
                  requestAnimationFrame(() => {
                    commentsSheetRef.current?.present();
                    commentsSheetRef.current?.snapToIndex(0);
                  });
                }}
                style={styles.inlineAction}
              >
                <CommentIcon color={palette.text} size={24} />
                {interaction.commentCount > 0 ? (
                  <AppText variant="micro" style={{ color: palette.text }}>
                    {interaction.commentCount}
                  </AppText>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Like post"
                hitSlop={10}
                onPress={() => void toggleLike(post.id)}
                style={styles.inlineAction}
              >
                <Heart
                  color={interaction.liked ? palette.error : palette.text}
                  fill={interaction.liked ? palette.error : "transparent"}
                  size={24}
                />
                {interaction.likeCount > 0 ? (
                  <AppText variant="micro" style={{ color: palette.text }}>
                    {interaction.likeCount}
                  </AppText>
                ) : null}
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open dish details"
            onPress={() => {
              if (primaryDish) navigation.navigate("DishDetail", { dishId: primaryDish.id });
            }}
          >
            <AppText variant="bodySmall" style={{ color: palette.text, marginTop: spacing[1] }}>
              {post.caption}
            </AppText>
          </Pressable>
        </View>
      </View>

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
    alignItems: "center",
    justifyContent: "center",
    minHeight: 320,
  },
  feedItemWrap: {
    width: "100%",
  },
  imageContainer: {
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  heroImage: {
    height: "100%",
    width: "100%",
  },
  gradientScrim: {
    left: 0,
    position: "absolute",
    right: 0,
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  inlineActionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "flex-end",
  },
  inlineAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  commentsSection: {
    borderTopWidth: 1,
    gap: 12,
    marginTop: 8,
    paddingTop: 16,
  },
  commentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
});
