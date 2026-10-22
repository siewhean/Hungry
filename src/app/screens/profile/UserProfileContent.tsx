import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import {
  Lock,
  MessageCircleMore,
  MoreHorizontal,
  PencilLine,
  Share2,
  UserCheck,
  Users,
  Utensils,
} from "lucide-react-native";

import {
  AccessibleImage,
  AppText,
  Avatar,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { FollowPillButton } from "@/components/social/FollowPillButton";
import { listSharedStallPosts, mergeStallPosts } from "@/features/social/sharedStallPosts";
import { shareProfileLink } from "@/features/share/profileShare";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { promptContentSafetyActions } from "@/lib/security/communitySafety";
import { useProfileStore } from "@/store/useProfileStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import type { PublicUserProfile, Review, StallPost } from "@/types/domain";
import { ProfileGridSkeleton, ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";

type UserProfileContentProps = {
  navigation: any;
  /** Empty when opened from a user/:id link; the public profile fills it in. */
  authorName: string;
  authorAvatarUrl?: string;
  authorId?: string;
};
/** Posts per server page; matches listUserPosts' default page size. */
const USER_POSTS_PAGE_SIZE = 60;
/** Reviews per server page. */
const USER_REVIEWS_PAGE_SIZE = 50;

function haveSamePosts(left: StallPost[], right: StallPost[]) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (
      a.id !== b.id ||
      a.authorId !== b.authorId ||
      a.authorName !== b.authorName ||
      a.createdAt !== b.createdAt ||
      a.venueId !== b.venueId
    ) {
      return false;
    }
  }
  return true;
}

export function UserProfileContent({
  navigation,
  authorName: authorNameParam,
  authorAvatarUrl,
  authorId,
}: UserProfileContentProps) {
  const { colorScheme, componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const followPress = useFollowPress();
  const setFollowedUserId = useSocialStore((state) => state.setFollowedUserId);
  const requestedUserIds = useSocialStore((state) => state.requestedUserIds);
  const setFollowRequested = useSocialStore((state) => state.setFollowRequested);
  const [activeTab, setActiveTab] = useState<"posts" | "reviews">("posts");
  const [posts, setPosts] = useState<StallPost[]>([]);
  // Server rows fetched so far (offset for the next page) and whether another page may exist.
  const [loadedPostRows, setLoadedPostRows] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [postsLoadFailed, setPostsLoadFailed] = useState(false);
  // Empty lists show a skeleton until the first read finishes, so "No posts yet" never flashes.
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsReloadKey, setPostsReloadKey] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadedReviewRows, setLoadedReviewRows] = useState(0);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const [reviewsLoadFailed, setReviewsLoadFailed] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  // Server follow counts (null when the server hides them) plus whether the server already had
  // the viewer following this user, so a local follow/unfollow afterwards can adjust the
  // follower count without refetching.
  const [serverFollowState, setServerFollowState] = useState<{
    userId: string;
    followersCount: number | null;
    followingCount: number | null;
    viewerIsFollowing: boolean;
  } | null>(null);

  // Posts, reviews and follows are matched only by account id: display names are not unique.
  const normalizedAuthorId = authorId?.trim() || undefined;
  // Name, avatar and bio from public_profiles (RLS hides private accounts from non-followers).
  const [publicProfile, setPublicProfile] = useState<PublicUserProfile | null>(null);
  // "missing": the account does not exist, was deleted, or is hidden from this viewer.
  const [publicProfileStatus, setPublicProfileStatus] = useState<
    "loading" | "loaded" | "missing" | "failed"
  >("loading");
  const [publicProfileReloadKey, setPublicProfileReloadKey] = useState(0);
  useEffect(() => {
    if (!normalizedAuthorId) return;
    let isMounted = true;
    setPublicProfileStatus("loading");
    void getHungryService()
      .profile.getPublicProfile(normalizedAuthorId)
      .then((row) => {
        if (!isMounted) return;
        setPublicProfile(row ?? null);
        setPublicProfileStatus(row ? "loaded" : "missing");
      })
      .catch((error) => {
        console.error("Failed to load public profile:", error);
        if (isMounted) setPublicProfileStatus("failed");
      });
    return () => {
      isMounted = false;
    };
  }, [normalizedAuthorId, publicProfileReloadKey]);
  const authorName =
    authorNameParam.trim() ||
    publicProfile?.displayName?.trim() ||
    (publicProfileStatus === "loading" ? "Profile" : "Hungry member");
  const authorBio = publicProfile?.id === normalizedAuthorId ? publicProfile?.bio : undefined;
  const resolvedAuthorId = normalizedAuthorId;
  const viewerId = useProfileStore((state) => state.profile.id);
  // Your own posts can link here: never offer Follow, Report or Block on yourself.
  const isSelf = Boolean(resolvedAuthorId && resolvedAuthorId === viewerId);

  useEffect(() => {
    if (!resolvedAuthorId || isSelf) return;
    trackAnalyticsEvent("profile_viewed", {
      self: false,
      target_user_id: resolvedAuthorId,
      source: "navigation",
    });
  }, [isSelf, resolvedAuthorId]);

  const openProfileConnections = useCallback(
    (target: "UserFollowers" | "UserFollowing") => {
      if (!resolvedAuthorId) return;
      // Root routes, so Back returns to this profile instead of switching to the Profile tab.
      rootNavigation.navigate(target, { userId: resolvedAuthorId, userDisplayName: authorName });
    },
    [authorName, resolvedAuthorId, rootNavigation],
  );

  const loadAuthorPosts = useCallback(
    (offset: number) =>
      getHungryService()
        .social.listUserPosts(normalizedAuthorId as string, {
          limit: USER_POSTS_PAGE_SIZE,
          offset,
        })
        .then((bites) => ({
          rowCount: bites.length,
          nextPosts: bites.map((bite) =>
            biteToStallPost(bite, { authorAvatarUrl: bite.authorAvatar }),
          ),
        })),
    [normalizedAuthorId],
  );

  useEffect(() => {
    if (!normalizedAuthorId) return;
    let isMounted = true;
    setPostsLoadFailed(false);
    void (async () => {
      const [sharedPosts, authorPage] = await Promise.all([
        listSharedStallPosts(repository).catch(() => [] as StallPost[]),
        loadAuthorPosts(0).catch(() => null),
      ]);
      if (!isMounted) return;
      const matchingSharedPosts = sharedPosts.filter(
        (post) => post.authorId === normalizedAuthorId,
      );
      const nextPosts = mergeStallPosts(authorPage?.nextPosts ?? [], matchingSharedPosts);
      setPosts((current) => (haveSamePosts(current, nextPosts) ? current : nextPosts));
      setPostsLoadFailed(authorPage === null);
      setPostsLoaded(true);
      setLoadedPostRows(authorPage?.rowCount ?? 0);
      setHasMorePosts(authorPage?.rowCount === USER_POSTS_PAGE_SIZE);
    })();

    return () => {
      isMounted = false;
    };
  }, [loadAuthorPosts, normalizedAuthorId, postsReloadKey, repository]);

  const loadMorePosts = () => {
    if (isLoadingMorePosts || !hasMorePosts) return;
    setIsLoadingMorePosts(true);
    void loadAuthorPosts(loadedPostRows)
      .then(({ nextPosts, rowCount }) => {
        setPosts((current) => mergeStallPosts(current, nextPosts));
        setLoadedPostRows((current) => current + rowCount);
        setHasMorePosts(rowCount === USER_POSTS_PAGE_SIZE);
      })
      .catch((error) => {
        console.error("Failed to load more posts:", error);
      })
      .finally(() => setIsLoadingMorePosts(false));
  };

  // The Reviews tab lists this user's own dish reviews from the server, a page at a time.
  const loadAuthorReviews = useCallback(
    (offset: number) =>
      getHungryService().reviews.getUserReviews(normalizedAuthorId as string, {
        limit: USER_REVIEWS_PAGE_SIZE,
        offset,
      }),
    [normalizedAuthorId],
  );

  useEffect(() => {
    if (!normalizedAuthorId) return;
    let isMounted = true;
    setReviewsLoadFailed(false);
    void loadAuthorReviews(0)
      .then((rows) => {
        if (!isMounted) return;
        setReviews(rows);
        setLoadedReviewRows(rows.length);
        setHasMoreReviews(rows.length === USER_REVIEWS_PAGE_SIZE);
        setReviewsLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load user reviews:", error);
        if (!isMounted) return;
        setReviewsLoadFailed(true);
        setReviewsLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, [loadAuthorReviews, normalizedAuthorId, reviewsReloadKey]);

  const loadMoreReviews = () => {
    if (isLoadingMoreReviews || !hasMoreReviews) return;
    setIsLoadingMoreReviews(true);
    void loadAuthorReviews(loadedReviewRows)
      .then((rows) => {
        setReviews((current) => {
          const seen = new Set(current.map((review) => review.id));
          return [...current, ...rows.filter((review) => !seen.has(review.id))];
        });
        setLoadedReviewRows((current) => current + rows.length);
        setHasMoreReviews(rows.length === USER_REVIEWS_PAGE_SIZE);
      })
      .catch((error) => {
        console.error("Failed to load more reviews:", error);
      })
      .finally(() => setIsLoadingMoreReviews(false));
  };

  const resolvedAuthorAvatarUrl = useMemo(() => {
    if (authorAvatarUrl?.trim()) return authorAvatarUrl.trim();
    if (publicProfile?.avatarUrl?.trim()) return publicProfile.avatarUrl.trim();
    return posts.find((post) => post.authorAvatarUrl?.trim())?.authorAvatarUrl?.trim() ?? "";
  }, [authorAvatarUrl, posts, publicProfile]);

  useEffect(() => {
    if (!resolvedAuthorId) return;
    let isActive = true;
    const service = getHungryService().social;
    setServerFollowState(null);

    void Promise.all([
      service.getFollowCounts(resolvedAuthorId),
      service.getFollowStatus(resolvedAuthorId).catch(() => null),
    ])
      .then(([counts, serverFollowStatus]) => {
        if (!isActive) return;
        const serverIsFollowing =
          serverFollowStatus === null ? null : serverFollowStatus === "approved";
        // The server wins both ways, so a stale persisted follow is cleared too.
        if (serverIsFollowing !== null) setFollowedUserId(resolvedAuthorId, serverIsFollowing);
        if (serverFollowStatus !== null) {
          setFollowRequested(resolvedAuthorId, serverFollowStatus === "pending");
        }
        const viewerIsFollowing =
          serverIsFollowing ?? Boolean(useSocialStore.getState().followedUserIds[resolvedAuthorId]);
        setServerFollowState({
          userId: resolvedAuthorId,
          followersCount: counts?.followersCount ?? null,
          followingCount: counts?.followingCount ?? null,
          viewerIsFollowing,
        });
      })
      .catch((error) => {
        console.error("Failed to load follow counts:", error);
        if (!isActive) return;
        setServerFollowState({
          userId: resolvedAuthorId,
          followersCount: null,
          followingCount: null,
          viewerIsFollowing: false,
        });
      });

    return () => {
      isActive = false;
    };
  }, [resolvedAuthorId, setFollowRequested, setFollowedUserId]);

  // null while loading (shows a skeleton); "12+" when more pages exist.
  const reviewCount = !reviewsLoaded
    ? null
    : hasMoreReviews
      ? `${reviews.length}+`
      : reviews.length;
  // The server counts stalls the same way as your own Stalls stat (tried or reviewed). Without
  // it (mock data), fall back to the venues of the posts loaded so far.
  const stallsCount =
    publicProfile?.stallsVisited ??
    (postsLoaded && publicProfileStatus !== "loading"
      ? new Set(posts.map((post) => post.venueId).filter(Boolean)).size
      : null);
  const isFollowingAuthor = resolvedAuthorId ? Boolean(followedUserIds[resolvedAuthorId]) : false;
  // Pending request to a private account: tapping again cancels it.
  const isFollowRequested = Boolean(
    resolvedAuthorId && !isFollowingAuthor && requestedUserIds[resolvedAuthorId],
  );
  const isFollowMuted = isFollowingAuthor || isFollowRequested;
  const followButtonLabel = isFollowRequested
    ? "Requested"
    : isFollowingAuthor
      ? "Following"
      : "Follow";
  const canShowFollowButton = Boolean(resolvedAuthorId) && !isSelf;
  // Private account the viewer does not follow: header and follow counts only.
  const isPrivateLocked =
    !isSelf &&
    !isFollowingAuthor &&
    publicProfile?.id === resolvedAuthorId &&
    publicProfile?.isPrivate === true &&
    publicProfile.canViewContent !== true;
  const handleFollowPress = () => {
    if (!resolvedAuthorId) return;
    followPress({ userId: resolvedAuthorId, name: authorName, avatarUrl: authorAvatarUrl });
  };
  const openProfileSafetyActions = () => {
    if (!resolvedAuthorId) return;
    promptContentSafetyActions({
      targetType: "profile",
      targetId: resolvedAuthorId,
      authorName,
      authorId: resolvedAuthorId,
      label: "profile",
      onBlocked: () => {
        setFollowedUserId(resolvedAuthorId, false);
        if (navigation?.canGoBack?.()) navigation.goBack();
      },
    });
  };
  const loadedFollowState =
    serverFollowState && serverFollowState.userId === resolvedAuthorId ? serverFollowState : null;
  // No account id (name-only author): there is no server follow data to show.
  // "–" when the server hides the counts (blocked, or an older backend); never a made-up 0.
  const followersCount: number | string | null = !resolvedAuthorId
    ? 0
    : loadedFollowState
      ? loadedFollowState.followersCount === null
        ? "–"
        : Math.max(
            0,
            loadedFollowState.followersCount +
              (isFollowingAuthor === loadedFollowState.viewerIsFollowing
                ? 0
                : isFollowingAuthor
                  ? 1
                  : -1),
          )
      : null;
  const followingCount: number | string | null = !resolvedAuthorId
    ? 0
    : loadedFollowState
      ? (loadedFollowState.followingCount ?? "–")
      : null;

  const activeTitle = activeTab === "posts" ? "Post" : "Review";
  const activeItemsCount = activeTab === "posts" ? posts.length : reviews.length;

  // A wrong or deleted id (or an account hidden from this viewer) is not a profile: no fake
  // "Hungry member" with a Follow button. A failed read keeps the name from the link, if any.
  if (
    resolvedAuthorId &&
    (publicProfileStatus === "missing" ||
      (publicProfileStatus === "failed" && !authorNameParam.trim()))
  ) {
    const failed = publicProfileStatus === "failed";
    return (
      <ProfileScreenShell title="Profile">
        <EmptyState
          title={failed ? "Couldn't load this profile" : "Profile not found"}
          body={
            failed
              ? "Check your connection and try again."
              : "This profile doesn't exist or isn't available."
          }
          icon={<MessageCircleMore color={palette.textSecondary} size={36} />}
          ctaLabel={failed ? "Retry" : undefined}
          onPress={failed ? () => setPublicProfileReloadKey((key) => key + 1) : undefined}
        />
      </ProfileScreenShell>
    );
  }

  return (
    <ProfileScreenShell
      title={authorName}
      headerRight={
        resolvedAuthorId && !isSelf ? (
          <View style={{ flexDirection: "row" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Share ${authorName}'s profile`}
              accessibilityHint="Shares a link to this Hungry profile"
              hitSlop={8}
              onPress={() =>
                void shareProfileLink(resolvedAuthorId, authorName).catch((error) =>
                  console.error("Error sharing profile:", error),
                )
              }
              style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
            >
              <Share2 color={palette.text} size={20} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`More options for ${authorName}`}
              accessibilityHint="Report or block this user"
              hitSlop={8}
              onPress={openProfileSafetyActions}
              style={{ alignItems: "center", height: 44, justifyContent: "center", width: 44 }}
            >
              <MoreHorizontal color={palette.text} size={22} />
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: spacing[4], paddingBottom: spacing[8] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[4],
          }}
        >
          <View style={{ position: "relative" }}>
            <View
              style={[
                shadows.card,
                {
                  alignItems: "center",
                  backgroundColor: palette.orangeLight,
                  borderRadius: radii.pill,
                  height: spacing[20],
                  justifyContent: "center",
                  width: spacing[20],
                  borderWidth: 2,
                  borderColor: palette.surface,
                },
              ]}
            >
              <Avatar name={authorName} uri={resolvedAuthorAvatarUrl} size={80} />
            </View>
          </View>

          <View style={{ flex: 1, gap: spacing[1] }}>
            <AppText variant="h1" numberOfLines={2}>
              {authorName}
            </AppText>
            {authorBio ? (
              <AppText variant="bodySmall" tone="secondary">
                {authorBio}
              </AppText>
            ) : null}
            {canShowFollowButton ? (
              <FollowPillButton
                label={followButtonLabel}
                accessibilityLabel={
                  isFollowRequested
                    ? `Follow request sent to ${authorName}`
                    : `${followButtonLabel} ${authorName}`
                }
                accessibilityHint={isFollowRequested ? "Cancels your follow request" : undefined}
                muted={isFollowMuted}
                minWidth={92}
                onPress={handleFollowPress}
                style={{ marginTop: spacing[1], alignSelf: "flex-start" }}
              />
            ) : null}
          </View>
        </View>

        {!resolvedAuthorId ? (
          // Without an account id there is no reliable way to tell whose posts these are.
          <EmptyState
            title="Profile unavailable"
            body={`We can't open ${authorName}'s profile right now.`}
            icon={<MessageCircleMore color={palette.textSecondary} size={36} />}
          />
        ) : (
          <>
            <View style={{ gap: spacing[4] }}>
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <StatBlock
                  icon={<Users color={palette.orange} size={14} />}
                  label="Followers"
                  value={followersCount}
                  accessibilityHint={`Opens ${authorName}'s followers`}
                  onPress={() => openProfileConnections("UserFollowers")}
                />
                <StatBlock
                  icon={<UserCheck color={palette.orange} size={14} />}
                  label="Following"
                  value={followingCount}
                  accessibilityHint={`Opens the people ${authorName} follows`}
                  onPress={() => openProfileConnections("UserFollowing")}
                />
              </View>
              {isPrivateLocked ? null : (
                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  <StatBlock
                    icon={<PencilLine color={palette.orange} size={14} />}
                    label="Reviews"
                    value={reviewCount}
                    accessibilityHint={`Shows ${authorName}'s reviews`}
                    onPress={() => setActiveTab("reviews")}
                  />
                  {/* Count only: the visited-stalls list is the viewer's own and is not shown for others. */}
                  <StatBlock
                    icon={<Utensils color={palette.orange} size={14} />}
                    label="Stalls"
                    value={stallsCount}
                  />
                </View>
              )}
            </View>

            {isPrivateLocked ? (
              <EmptyState
                title="This account is private"
                body={`Follow ${authorName} to see their posts and reviews.`}
                icon={<Lock color={palette.textSecondary} size={36} />}
              />
            ) : (
              <View style={{ gap: spacing[4], marginTop: spacing[2] }}>
                <AppText variant="h2">{activeTab === "posts" ? "Posts" : "Reviews"}</AppText>
                <View
                  accessibilityRole="tablist"
                  style={{
                    alignSelf: "stretch",
                    flexDirection: "row",
                    borderWidth: 1,
                    borderRadius: componentRadii.button,
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel="Show posts"
                    accessibilityState={{ selected: activeTab === "posts" }}
                    onPress={() => setActiveTab("posts")}
                    style={{
                      flex: 1,
                      paddingVertical: spacing[2],
                      alignItems: "center",
                      backgroundColor: activeTab === "posts" ? palette.orange : "transparent",
                    }}
                  >
                    <AppText
                      style={{
                        fontWeight: activeTab === "posts" ? 700 : 500,
                        color: activeTab === "posts" ? palette.textOnOrange : palette.text,
                      }}
                    >
                      Posts
                    </AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityLabel="Show reviews"
                    accessibilityState={{ selected: activeTab === "reviews" }}
                    onPress={() => setActiveTab("reviews")}
                    style={{
                      flex: 1,
                      paddingVertical: spacing[2],
                      alignItems: "center",
                      backgroundColor: activeTab === "reviews" ? palette.orange : "transparent",
                    }}
                  >
                    <AppText
                      style={{
                        fontWeight: activeTab === "reviews" ? 700 : 500,
                        color: activeTab === "reviews" ? palette.textOnOrange : palette.text,
                      }}
                    >
                      Reviews
                    </AppText>
                  </Pressable>
                </View>

                {activeItemsCount > 0 ? (
                  activeTab === "posts" ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        marginHorizontal: -spacing[4],
                      }}
                    >
                      {posts.map((post) => {
                        return (
                          <Pressable
                            key={post.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Open post ${post.caption || post.id}`}
                            onPress={() =>
                              rootNavigation.navigate("ActivityPostDetail", {
                                postId: post.id,
                              })
                            }
                            style={{ width: "33.333%", aspectRatio: 1 }}
                          >
                            <AccessibleImage
                              source={{ uri: post.mediaUrl }}
                              decorative
                              style={{
                                width: "100%",
                                height: "100%",
                              }}
                              contentFit="cover"
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={{ gap: spacing[3] }}>
                      {reviews.map((review) => {
                        const dishName = review.dishId
                          ? repository.getDishById(review.dishId)?.name
                          : undefined;
                        const reviewCard = (
                          <Card
                            style={{
                              borderColor: palette.border,
                              borderWidth: 1,
                              gap: spacing[2],
                              padding: spacing[3],
                              backgroundColor:
                                colorScheme === "dark" ? palette.surfaceRaised : palette.surface,
                            }}
                          >
                            {dishName ? <AppText variant="bodyBold">{dishName}</AppText> : null}
                            <AppText variant="micro" tone="secondary">
                              {`Rated ${review.rating}/5`}
                            </AppText>
                            {review.text ? <AppText>{review.text}</AppText> : null}
                          </Card>
                        );

                        return review.dishId ? (
                          <Pressable
                            key={review.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Review of ${dishName ?? "dish"}, rated ${review.rating} out of 5`}
                            accessibilityHint="Opens the dish"
                            onPress={() =>
                              rootNavigation.navigate("DishDetail", {
                                dishId: review.dishId as string,
                              })
                            }
                          >
                            {reviewCard}
                          </Pressable>
                        ) : (
                          <View key={review.id}>{reviewCard}</View>
                        );
                      })}
                    </View>
                  )
                ) : activeTab === "posts" && !postsLoaded ? (
                  <ProfileGridSkeleton />
                ) : activeTab === "reviews" && !reviewsLoaded ? (
                  <ProfileReviewsSkeleton />
                ) : activeTab === "posts" && postsLoadFailed ? (
                  <EmptyState
                    title="Couldn't load posts"
                    body="Check your connection and try again."
                    icon={<MessageCircleMore color={palette.textSecondary} size={36} />}
                    ctaLabel="Retry"
                    onPress={() => {
                      setPostsLoaded(false);
                      setPostsReloadKey((key) => key + 1);
                    }}
                  />
                ) : activeTab === "reviews" && reviewsLoadFailed ? (
                  <EmptyState
                    title="Couldn't load reviews"
                    body="Check your connection and try again."
                    icon={<MessageCircleMore color={palette.textSecondary} size={36} />}
                    ctaLabel="Retry"
                    onPress={() => {
                      setReviewsLoaded(false);
                      setReviewsReloadKey((key) => key + 1);
                    }}
                  />
                ) : (
                  <EmptyState
                    title={`No ${activeTitle.toLowerCase()}s yet`}
                    body="Shared profile activity will appear here."
                    icon={<MessageCircleMore color={palette.textSecondary} size={36} />}
                  />
                )}
                {activeTab === "reviews" && hasMoreReviews ? (
                  <Button
                    label="Load more"
                    variant="ghost"
                    size="sm"
                    loading={isLoadingMoreReviews}
                    onPress={loadMoreReviews}
                  />
                ) : null}
                {activeTab === "posts" && hasMorePosts ? (
                  <Button
                    label="Load more"
                    variant="ghost"
                    size="sm"
                    loading={isLoadingMorePosts}
                    onPress={loadMorePosts}
                  />
                ) : null}
                {activeTab === "reviews" && hasMoreReviews ? (
                  <Button
                    label="Load more"
                    variant="ghost"
                    size="sm"
                    loading={isLoadingMoreReviews}
                    onPress={loadMoreReviews}
                  />
                ) : null}
              </View>
            )}
          </>
        )}
      </View>
    </ProfileScreenShell>
  );
}

function StatBlock({
  icon,
  label,
  value,
  accessibilityHint,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  /** null while loading. */
  value: number | string | null;
  accessibilityHint?: string;
  onPress?: () => void;
}) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessible
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={value === null ? `${label}, loading` : `${value} ${label}`}
      accessibilityHint={accessibilityHint}
      disabled={!onPress}
      onPress={onPress}
      style={{
        backgroundColor: colorScheme === "dark" ? palette.surfaceRaised : palette.bgSoft,
        borderRadius: componentRadii.card,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[3],
        alignItems: "center",
        flex: 1,
        gap: spacing[1],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
        {icon}
        {value === null ? (
          <Skeleton width={spacing[6]} height={spacing[5]} borderRadius={4} />
        ) : (
          <AppText variant="h3" style={{ color: palette.text }}>
            {value}
          </AppText>
        )}
      </View>
      <AppText
        variant="micro"
        tone="secondary"
        style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
