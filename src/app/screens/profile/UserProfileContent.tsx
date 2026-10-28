import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Lock, MessageCircleMore, MoreHorizontal, Share2 } from "lucide-react-native";

import { FavouriteDishesRow } from "@/components/profile/FavouriteDishesRow";
import { ProfileReviewCard } from "@/components/profile/ProfileReviewCard";
import { ProfileStatRow, type ProfileStat } from "@/components/profile/ProfileStatRow";
import { AccessibleImage, AppText, Avatar, Button, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { FollowPillButton } from "@/components/social/FollowPillButton";
import { listSharedStallPosts, mergeStallPosts } from "@/features/social/sharedStallPosts";
import { shareProfileLink } from "@/features/share/profileShare";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { promptContentSafetyActions } from "@/lib/security/communitySafety";
import { useProfileStore } from "@/store/useProfileStore";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { formatMemberSince } from "@/features/profile/relativeDate";
import { useProfileFavouriteDishes } from "@/features/profile/useProfileFavouriteDishes";
import { useReviewDishDetails } from "@/features/profile/useReviewDishDetails";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { useSocialStore } from "@/store/useSocialStore";
import { useUIStore } from "@/store/useUIStore";
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
/** The posts feed is archived: without it there is no Posts tab and no post reads. */
const showPosts = () => FEATURE_FLAGS.socialFeedEnabled;

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
  const { componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const followPress = useFollowPress();
  const setFollowedUserId = useSocialStore((state) => state.setFollowedUserId);
  const requestedUserIds = useSocialStore((state) => state.requestedUserIds);
  const setFollowRequested = useSocialStore((state) => state.setFollowRequested);
  const showToast = useUIStore((state) => state.showToast);
  const [activeTab, setActiveTab] = useState<"posts" | "reviews">(() =>
    showPosts() ? "posts" : "reviews",
  );
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
        reportError(error, { screen: "UserProfile", action: "load_public_profile" });
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

  // Counted once the profile is on screen: not while loading, and not for a missing profile.
  const profileViewedIsPrivateLocked =
    publicProfile?.isPrivate === true && publicProfile.canViewContent !== true;
  const profileViewTrackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resolvedAuthorId || isSelf || publicProfileStatus !== "loaded") return;
    if (profileViewTrackedRef.current === resolvedAuthorId) return;
    profileViewTrackedRef.current = resolvedAuthorId;
    trackAnalyticsEvent("profile_viewed", {
      self: false,
      target_user_id: resolvedAuthorId,
      source: "navigation",
      is_private_locked:
        profileViewedIsPrivateLocked &&
        !useSocialStore.getState().followedUserIds[resolvedAuthorId],
    });
  }, [isSelf, profileViewedIsPrivateLocked, publicProfileStatus, resolvedAuthorId]);

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
    if (!normalizedAuthorId || !showPosts()) return;
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
        reportError(error, { screen: "UserProfile", action: "load_more_posts" });
        showToast({ message: "Couldn't load more posts. Try again.", tone: "error" });
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
        reportError(error, { screen: "UserProfile", action: "load_reviews" });
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
        reportError(error, { screen: "UserProfile", action: "load_more_reviews" });
        showToast({ message: "Couldn't load more reviews. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMoreReviews(false));
  };

  // One batched dish lookup for every review card on screen.
  const { infoFor: reviewDishInfo } = useReviewDishDetails(reviews);

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

    // Counts and follow status are separate reads: a failed counts read must not leave a stale
    // "Following" from storage uncorrected, and a failed status read keeps the counts.
    void Promise.all([
      service.getFollowCounts(resolvedAuthorId).then(
        (counts) => ({ ok: true as const, counts }),
        (error: unknown) => {
          reportError(error, { screen: "UserProfile", action: "load_follow_counts" });
          return { ok: false as const, counts: null };
        },
      ),
      service.getFollowStatus(resolvedAuthorId).catch((error: unknown) => {
        reportError(error, { screen: "UserProfile", action: "load_follow_status" });
        return null;
      }),
    ]).then(([{ counts }, serverFollowStatus]) => {
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
    });

    return () => {
      isActive = false;
    };
  }, [resolvedAuthorId, setFollowRequested, setFollowedUserId]);

  // null while loading (shows a skeleton). With more pages to load, the server's counter
  // (distinct dishes reviewed) when it has one, otherwise "50+".
  const reviewCount = !reviewsLoaded
    ? null
    : hasMoreReviews
      ? publicProfile?.dishesReviewed !== undefined
        ? Math.max(publicProfile.dishesReviewed, reviews.length)
        : `${reviews.length}+`
      : reviews.length;
  // The server counts stalls the same way as your own Stalls stat (tried or reviewed). Without
  // it (mock data), fall back to the venues of the posts (or, with no posts feed, the reviews)
  // loaded so far.
  const fallbackVenueSource = showPosts()
    ? postsLoaded
      ? posts.map((post) => post.venueId)
      : null
    : reviewsLoaded
      ? reviews.map((review) => review.venueId)
      : null;
  const stallsCount =
    publicProfile?.stallsVisited ??
    (fallbackVenueSource && publicProfileStatus !== "loading"
      ? new Set(fallbackVenueSource.filter(Boolean)).size
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
  const canReadContent = publicProfileStatus === "loaded" && !isSelf && !isPrivateLocked;
  const { dishIds: pinnedDishIds } = useProfileFavouriteDishes(resolvedAuthorId, canReadContent);
  // How close their taste is to yours; null (and hidden) when the server has nothing to say.
  const [tasteMatch, setTasteMatch] = useState<number | null>(null);
  useEffect(() => {
    setTasteMatch(null);
    if (!resolvedAuthorId || !canReadContent) return;
    let isMounted = true;
    void getHungryService()
      .profile.getTasteMatch(resolvedAuthorId)
      .then((score) => {
        if (isMounted) setTasteMatch(score);
      })
      .catch((error) => {
        reportError(error, { screen: "UserProfile", action: "load_taste_match" });
      });
    return () => {
      isMounted = false;
    };
  }, [canReadContent, resolvedAuthorId]);
  const memberSince =
    publicProfile?.id === resolvedAuthorId && publicProfile?.createdAt
      ? formatMemberSince(publicProfile.createdAt)
      : "";
  const handleFollowPress = () => {
    if (!resolvedAuthorId) return;
    followPress({
      userId: resolvedAuthorId,
      name: authorName,
      avatarUrl: authorAvatarUrl,
      isPrivate: publicProfile?.id === resolvedAuthorId && publicProfile.isPrivate === true,
    });
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

  const followStats: ProfileStat[] = [
    {
      key: "followers",
      label: "Followers",
      value: followersCount,
      accessibilityHint: `Opens ${authorName}'s followers`,
      onPress: () => openProfileConnections("UserFollowers"),
    },
    {
      key: "following",
      label: "Following",
      value: followingCount,
      accessibilityHint: `Opens the people ${authorName} follows`,
      onPress: () => openProfileConnections("UserFollowing"),
    },
  ];
  // A private account you do not follow shows only the follow counts.
  const stats: ProfileStat[] = isPrivateLocked
    ? followStats
    : [
        {
          key: "reviews",
          label: "Reviews",
          value: reviewCount,
          accessibilityHint: `Shows ${authorName}'s reviews`,
          onPress: () => setActiveTab("reviews"),
        },
        ...followStats,
        // Count only: the visited-stalls list is the viewer's own and is not shown for others.
        { key: "stalls", label: "Stalls", value: stallsCount },
      ];

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
      title="Profile"
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
                  reportError(error, { screen: "UserProfile", action: "share_profile" }),
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
              {/* 76 inside the 80pt ring and its 2pt border on each side. */}
              <Avatar name={authorName} uri={resolvedAuthorAvatarUrl} size={spacing[20] - 4} />
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
            {tasteMatch !== null || memberSince ? (
              <AppText variant="micro" tone="secondary" testID="user-profile-meta">
                {[
                  tasteMatch !== null ? `${tasteMatch}% taste match` : "",
                  memberSince ? `Member since ${memberSince}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
            <ProfileStatRow stats={stats} testID="user-profile-stats" />

            {isPrivateLocked ? (
              <EmptyState
                title="This account is private"
                body={
                  showPosts()
                    ? `Follow ${authorName} to see their posts and reviews.`
                    : `Follow ${authorName} to see their reviews.`
                }
                icon={<Lock color={palette.textSecondary} size={36} />}
              />
            ) : (
              <View style={{ gap: spacing[4], marginTop: spacing[2] }}>
                <FavouriteDishesRow
                  dishIds={pinnedDishIds}
                  onOpenDish={(dishId) => rootNavigation.navigate("DishDetail", { dishId })}
                />
                <AppText variant="h2">{activeTab === "posts" ? "Posts" : "Reviews"}</AppText>
                {showPosts() ? (
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
                ) : null}

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
                        const image = (
                          <AccessibleImage
                            source={{ uri: post.mediaUrl }}
                            decorative
                            style={{
                              width: "100%",
                              height: "100%",
                            }}
                            contentFit="cover"
                          />
                        );
                        // The post detail lives in Activity; with Activity off a tile is a photo.
                        return FEATURE_FLAGS.activityEnabled ? (
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
                            {image}
                          </Pressable>
                        ) : (
                          <View key={post.id} style={{ width: "33.333%", aspectRatio: 1 }}>
                            {image}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={{ gap: spacing[3] }}>
                      {reviews.map((review, index) => (
                        <ProfileReviewCard
                          key={review.id}
                          review={review}
                          dish={reviewDishInfo(review.dishId)}
                          onOpenDish={
                            review.dishId
                              ? () => {
                                  trackAnalyticsEvent("profile_item_opened", {
                                    kind: "review",
                                    position: index,
                                    source: "user_profile",
                                  });
                                  rootNavigation.navigate("DishDetail", {
                                    dishId: review.dishId as string,
                                  });
                                }
                              : undefined
                          }
                        />
                      ))}
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
                    body={
                      activeTab === "posts"
                        ? `${authorName} hasn't posted anything yet.`
                        : `${authorName} hasn't reviewed anything yet.`
                    }
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
              </View>
            )}
          </>
        )}
      </View>
    </ProfileScreenShell>
  );
}
