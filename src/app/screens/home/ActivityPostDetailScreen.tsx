import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MessageCircleMore,
  MoreHorizontal,
  PlayCircle,
  Send,
} from "lucide-react-native";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { OwnContentEditDialog, ZoomableMedia } from "@/components/social";
import { AppText, Avatar, EmptyState, Screen, Skeleton } from "@/components/ui";
import { ACTIVITY_UPDATES } from "@/features/home/activity";
import { listSharedStallPostsSync } from "@/features/social/sharedStallPosts";
import { promptOwnContentActions } from "@/features/profile/ownContentActions";
import {
  isContentHiddenForSession,
  markPostRemovedForSession,
  promptPostSafetyActions,
} from "@/lib/security/communitySafety";
import { POST_CAPTION_MAX_LENGTH } from "@/lib/security/inputSanitization";
import { biteToStallPost } from "@/lib/services/postTransforms";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";
import { ReviewCommentsSheet, type ActiveReviewCommentTarget } from "@/components/social";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import { useActivityStore } from "@/store/useActivityStore";
import { useProfileStore } from "@/store/useProfileStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore, type SocialComment } from "@/store/useSocialStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { webShareUrl } from "@/constants/links";

const CommentIcon = MessageCircle ?? MessageCircleMore;

type Props = NativeStackScreenProps<RootStackParamList, "ActivityPostDetail">;

export function ActivityPostDetailScreen({ navigation, route }: Props) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  // Pause the video when DishDetail or another screen is pushed on top.
  const isFocused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const repository = getDataRepository();
  const commentsEnabled = FEATURE_FLAGS.commentsEnabled;
  const { postId, updateId } = route.params;
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  // Bumped after Hide or Block so the post list re-reads the session safety filters.
  const [safetyFilterVersion, setSafetyFilterVersion] = useState(0);
  const onSafetyHidden = useCallback(() => setSafetyFilterVersion((version) => version + 1), []);
  const posts = useMemo(
    () => listSharedStallPostsSync(repository),
    [publishedPosts, repository, safetyFilterVersion],
  );
  // Shared links can open a post this device never loaded: fetch it by id
  // (works signed out for public posts) instead of trusting local caches.
  const [fetchedBite, setFetchedBite] = useState<Bite | null>(null);
  const [fetchState, setFetchState] = useState<"loading" | "done" | "error">("loading");
  const [fetchAttempt, setFetchAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFetchState("loading");
    getHungryService()
      .social.getPostById(postId)
      .then((bite) => {
        if (cancelled) return;
        setFetchedBite(bite);
        setFetchState("done");
      })
      .catch(() => {
        if (!cancelled) setFetchState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [postId, fetchAttempt]);
  const fetchedPost = useMemo(
    () =>
      fetchedBite
        ? biteToStallPost(fetchedBite, { authorAvatarUrl: fetchedBite.authorAvatar })
        : undefined,
    [fetchedBite],
  );
  const cachedPost = posts.find((candidate) => candidate.id === postId);
  const resolvedPost = fetchedPost ?? cachedPost;
  const post =
    resolvedPost &&
    !isContentHiddenForSession({ id: resolvedPost.id, authorId: resolvedPost.authorId })
      ? resolvedPost
      : undefined;
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const viewerId = useProfileStore((state) => state.profile.id);
  const removePublishedPost = usePublishedPostStore((state) => state.removePost);
  const isOwnPost = Boolean(isAuthenticated && post?.authorId && post.authorId === viewerId);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const deleteOwnPost = useCallback(async () => {
    try {
      await getHungryService().social.deletePost(postId);
      markPostRemovedForSession(postId);
      removePublishedPost(postId);
      showToast({ message: "Post deleted.", tone: "success" });
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("MainTabs", { screen: "Home" });
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Could not delete this post.",
        tone: "error",
      });
    }
  }, [navigation, postId, removePublishedPost, showToast]);
  const saveOwnCaption = useCallback(
    async ({ text }: { text: string }) => {
      try {
        await getHungryService().social.updatePost(postId, { caption: text });
      } catch (error) {
        showToast({
          message: error instanceof Error ? error.message : "Could not save your caption.",
          tone: "error",
        });
        throw error;
      }
      setIsEditingCaption(false);
      // Re-read the post so the caption shows what the server stored.
      setFetchAttempt((attempt) => attempt + 1);
      showToast({ message: "Caption updated.", tone: "success" });
    },
    [postId, showToast],
  );
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const dbActivityEvents = useActivityStore((state) => state.dbActivityEvents);
  const fetchActivityEvents = useActivityStore((state) => state.fetchActivityEvents);
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
  const openCommentsSheet = useCallback(() => {
    void commentsSheetRef.current?.present();
    requestAnimationFrame(() => {
      commentsSheetRef.current?.snapToIndex(0);
    });
  }, []);

  useEffect(() => {
    if (post) initializeInteractions([post]);
  }, [initializeInteractions, post]);

  const requireSignIn = useCallback(() => {
    if (isAuthenticated) return true;
    setReturnRoute({ name: "ActivityPostDetail", params: { postId } });
    showToast({ message: "Sign in to like, save or comment on posts.", tone: "warning" });
    navigation.navigate("AuthStack", { screen: "Login" });
    return false;
  }, [isAuthenticated, navigation, postId, setReturnRoute, showToast]);

  useEffect(() => {
    if (updateId) {
      markActivityRead("update", updateId);
    }
  }, [markActivityRead, updateId]);

  useEffect(() => {
    if (isAuthenticated) void fetchActivityEvents();
  }, [fetchActivityEvents, isAuthenticated]);

  const update = useMemo(() => {
    if (!updateId) return undefined;
    // Sample updates exist only in mock mode.
    const mockUpdates = getServiceProvider().mode === "mock" ? ACTIVITY_UPDATES : [];
    return (
      mockUpdates.find((candidate) => candidate.id === updateId) ??
      dbActivityEvents.find((candidate) => candidate.id === updateId) ??
      activityUpdates.find((candidate) => candidate.id === updateId)
    );
  }, [activityUpdates, dbActivityEvents, updateId]);

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
    if (fetchState === "loading" && !resolvedPost) {
      return (
        <Screen title="Post">
          <View
            accessibilityLabel="Loading post"
            style={{ gap: spacing[3], paddingHorizontal: semanticSpacing.screenEdge }}
          >
            <Skeleton height={360} borderRadius={16} />
            <Skeleton height={20} width="60%" />
            <Skeleton height={16} width="40%" />
          </View>
        </Screen>
      );
    }
    if (fetchState === "error" && !resolvedPost) {
      return (
        <Screen title="Post">
          <EmptyState
            title="Couldn't load this post"
            body="Check your connection and try again."
            ctaLabel="Try again"
            onPress={() => setFetchAttempt((attempt) => attempt + 1)}
          />
        </Screen>
      );
    }
    return (
      <Screen title="Post">
        <EmptyState
          title="This post is no longer available"
          body="It may have been removed, or it's only visible to the author's followers."
        />
      </Screen>
    );
  }

  const venue = repository.getVenueById(post.venueId);
  const primaryDish = post.dishIds
    .map((dishId) => repository.getDishById(dishId))
    .filter(Boolean)[0];
  const dishName =
    primaryDish?.name ?? (fetchedBite?.id === post.id ? fetchedBite.dishName : undefined);
  const interaction = interactions[post.id] ?? {
    liked: false,
    saved: false,
    likeCount: 0,
    saveCount: 0,
    shareCount: 0,
    commentCount: 0,
  };
  const imageHeight = Math.min(Math.max(screenWidth * 1.12, 360), 460);
  const kindLabel =
    update?.kind === "like"
      ? "Like"
      : update?.kind === "share"
        ? "Share"
        : update?.kind === "submission"
          ? "Submission"
          : "Comment";
  const kindColor =
    update?.kind === "like"
      ? palette.error
      : update?.kind === "share"
        ? palette.orange
        : update?.kind === "submission"
          ? palette.orange
          : palette.orange;

  return (
    <Screen
      title={dishName ?? venue?.name ?? "Post"}
      subtitle={update ? `${update.actorName} · ${kindLabel}` : undefined}
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
            accessibilityLabel={`${dishName ?? venue?.name ?? "Post"} ${
              post.mediaType === "video" ? "video" : "image"
            }`}
            isActive={isFocused}
            style={styles.heroImage}
          />

          {post.mediaType === "video" ? (
            <View pointerEvents="none" style={styles.playButtonContainer}>
              <View
                style={[styles.playButtonBackdrop, { backgroundColor: palette.mediaScrimSubtle }]}
              >
                <PlayCircle color={palette.white} size={54} strokeWidth={1.4} />
              </View>
            </View>
          ) : null}

          <LinearGradient
            colors={["transparent", palette.mediaScrimStrong]}
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
              {dishName ?? venue?.name ?? post.authorName}
            </AppText>
            <AppText variant="micro" style={{ color: palette.inverseTextSecondary }}>
              {venue ? `${venue.name} · ${venue.floor} ${venue.unitNumber}` : post.authorLocation}
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${post.authorName}'s post`}
            hitSlop={10}
            onPress={() =>
              isOwnPost
                ? promptOwnContentActions({
                    label: "post",
                    onEdit: () => setIsEditingCaption(true),
                    onDelete: () => void deleteOwnPost(),
                  })
                : requireSignIn() &&
                  promptPostSafetyActions({
                    postId: post.id,
                    authorName: post.authorName,
                    authorId: post.authorId,
                    label: "post",
                    onHidden: () => {
                      onSafetyHidden();
                      if (navigation.canGoBack()) navigation.goBack();
                    },
                    onBlocked: onSafetyHidden,
                  })
            }
            style={[styles.imageMenuButton, { right: spacing[2], top: spacing[2] }]}
          >
            <MoreHorizontal color={palette.white} size={24} />
          </Pressable>
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
                  const title = dishName ?? post.authorName;
                  setActiveShareReview({
                    reviewId: post.id,
                    postId: post.id,
                    title,
                    subtitle: `${venue?.name ?? "Hungry"} · ${post.authorName}`,
                    imageUrl: post.mediaUrl,
                    authorName: post.authorName,
                    message: `Check out ${title} on Hungry. ${post.caption ?? ""}`,
                    link: webShareUrl("post", post.id),
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
                accessibilityLabel={interaction.saved ? "Remove post from saved" : "Save post"}
                accessibilityState={{ selected: interaction.saved }}
                hitSlop={10}
                onPress={() => {
                  if (requireSignIn()) void toggleSave(post.id);
                }}
                style={styles.inlineAction}
              >
                <Bookmark
                  color={interaction.saved ? palette.orange : palette.text}
                  fill={interaction.saved ? palette.orange : "transparent"}
                  size={24}
                />
              </Pressable>
              {commentsEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open comments"
                  hitSlop={10}
                  onPress={() => {
                    if (!requireSignIn()) return;
                    setActiveCommentReview({
                      id: post.id,
                      authorName: post.authorName,
                      dishName: dishName ?? post.authorName,
                      caption: post.caption,
                    });
                    openCommentsSheet();
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
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={interaction.liked ? "Unlike post" : "Like post"}
                accessibilityState={{ selected: interaction.liked }}
                hitSlop={10}
                onPress={() => {
                  if (requireSignIn()) void toggleLike(post.id);
                }}
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

      {commentsEnabled ? (
        <ReviewCommentsSheet
          activeReview={activeCommentReview}
          inputRef={commentInputRef}
          innerRef={commentsSheetRef}
          seededComments={seededCommentsForActiveReview}
          onDismiss={() => setActiveCommentReview(null)}
        />
      ) : null}

      <OwnContentEditDialog
        visible={isEditingCaption}
        title="Edit caption"
        textLabel="Caption"
        maxLength={POST_CAPTION_MAX_LENGTH}
        initialText={post.caption ?? ""}
        onCancel={() => setIsEditingCaption(false)}
        onSave={saveOwnCaption}
      />

      <ReviewShareSheet
        activeReview={activeShareReview}
        bottomInset={insets.bottom}
        innerRef={shareSheetRef}
        onDismiss={() => setActiveShareReview(null)}
        // Signed-out visitors can copy or system-share the link; recording a
        // share (and in-app sends) needs an account.
        inAppSharingEnabled={isAuthenticated}
        onShared={(postId, channel) => {
          if (isAuthenticated) incrementShare(postId, channel);
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
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonBackdrop: {
    alignItems: "center",
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
  imageMenuButton: {
    position: "absolute",
    zIndex: 5,
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
