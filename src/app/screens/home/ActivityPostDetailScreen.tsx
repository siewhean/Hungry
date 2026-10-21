import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { OwnContentEditDialog } from "@/components/social";
import { FeedPostCard, type FeedPostCardActions } from "@/components/social/FeedPostCard";
import { AppText, EmptyState, Screen, Skeleton } from "@/components/ui";
import { venueFromPost, type HomeFeedItem } from "@/features/home/feed";
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

type Props = NativeStackScreenProps<RootStackParamList, "ActivityPostDetail">;

export function ActivityPostDetailScreen({ navigation, route }: Props) {
  const { palette, spacing, semanticSpacing } = useHungryTheme();
  // Pause the video when DishDetail or another screen is pushed on top.
  const isFocused = useIsFocused();
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
  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
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

  const venue = repository.getVenueById(post.venueId) ?? venueFromPost(post);
  const dishes = post.dishIds
    .map((dishId) => repository.getDishById(dishId))
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish));
  const primaryDish = dishes[0];
  const dishName =
    primaryDish?.name ?? (fetchedBite?.id === post.id ? fetchedBite.dishName : undefined);
  // The same card as the Home feed: photo carousel, author row with Follow, tappable
  // dish and venue, caption and counts. A venue the catalog lacks is built from the post.
  const cardItem: HomeFeedItem = {
    ...post,
    venue: venue ?? {
      id: post.venueId,
      buildingId: post.buildingId,
      name: post.authorLocation || "Hungry",
      unitNumber: "",
      floor: "",
      isOpen: true,
      topDishId: "",
      operatingHours: "",
      deliveryLinks: [],
    },
    dishes,
  };
  const canUseAuthorFallbackFollow =
    getServiceProvider().mode === "mock" || (typeof __DEV__ !== "undefined" && __DEV__);
  const cardActions: FeedPostCardActions = {
    like: () => {
      if (requireSignIn()) void toggleLike(post.id);
    },
    save: () => {
      if (requireSignIn()) void toggleSave(post.id);
    },
    share: () => {
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
    },
    openComments: () => {
      if (!requireSignIn()) return;
      setActiveCommentReview({
        id: post.id,
        authorName: post.authorName,
        dishName: dishName ?? post.authorName,
        caption: post.caption,
      });
      openCommentsSheet();
    },
    openMenu: () =>
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
          }),
    toggleFollow: () => {
      if (!requireSignIn()) return;
      void (post.authorId ? toggleFollow(post.authorId) : toggleAuthorFollow(post.authorName));
    },
    openProfile: () =>
      navigation.navigate("UserProfile", {
        authorName: post.authorName.trim(),
        authorAvatarUrl: post.authorAvatarUrl?.trim(),
        authorLocation: post.authorLocation?.trim(),
        authorId: post.authorId?.trim(),
      }),
    openDish: () => {
      if (primaryDish) navigation.navigate("DishDetail", { dishId: primaryDish.id });
      else if (post.venueId) navigation.navigate("StallDetail", { venueId: post.venueId });
    },
    openVenue: () => {
      if (post.venueId) navigation.navigate("StallDetail", { venueId: post.venueId });
    },
    prefetchProfile: () => undefined,
    prefetchVenue: () => undefined,
    prefetchDish: () => undefined,
  };
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

      <FeedPostCard
        item={cardItem}
        actions={cardActions}
        isVideoActive={isFocused}
        canAccessMap={false}
        canShowFollow={Boolean(post.authorId) || canUseAuthorFallbackFollow}
        commentsEnabled={commentsEnabled}
        leftHandedMode={false}
        viewerId={viewerId}
      />

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
