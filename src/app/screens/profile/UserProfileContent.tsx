import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Heart, MessageCircleMore, PencilLine, Send, Utensils } from "lucide-react-native";

import { AccessibleImage, AppText, Avatar, Card, EmptyState, Skeleton } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { listSharedStallPosts, mergeStallPosts } from "@/features/social/sharedStallPosts";
import { biteToStallPost } from "@/lib/services/postTransforms";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import type { StallPost } from "@/types/domain";
import { ProfileScreenShell } from "./ProfileScreenShell";

type UserProfileContentProps = {
  navigation: any;
  authorName: string;
  authorAvatarUrl?: string;
  authorId?: string;
};
type UserReviewItem = {
  id: string;
  postId?: string;
  text: string;
  createdAt: string;
  kind: "comment" | "reply";
};
type UserProfileItem = {
  userId?: string;
  name: string;
  avatarUrl?: string;
};

function normalizePersonName(name: string) {
  return name.trim().toLowerCase();
}

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

function toEpochMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function UserProfileContent({
  navigation,
  authorName,
  authorAvatarUrl,
  authorId,
}: UserProfileContentProps) {
  const normalizedAuthorName = normalizePersonName(authorName);
  const { colorScheme, componentRadii, palette, radii, shadows, spacing } = useHungryTheme();
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const setFollowedUserId = useSocialStore((state) => state.setFollowedUserId);
  const requestedUserIds = useSocialStore((state) => state.requestedUserIds);
  const setFollowRequested = useSocialStore((state) => state.setFollowRequested);
  const serviceProviderMode = getServiceProvider().mode;
  const canUseAuthorFallbackFollow =
    serviceProviderMode === "mock" || (typeof __DEV__ !== "undefined" && __DEV__);
  const [activeTab, setActiveTab] = useState<"posts" | "reviews">("posts");
  const [posts, setPosts] = useState<StallPost[]>([]);
  const [chatProfilesByName, setChatProfilesByName] = useState<Record<string, UserProfileItem>>({});
  // Server follow counts plus whether the server already had the viewer following this user,
  // so a local follow/unfollow afterwards can adjust the follower count without refetching.
  const [serverFollowState, setServerFollowState] = useState<{
    userId: string;
    followersCount: number;
    followingCount: number;
    viewerIsFollowing: boolean;
  } | null>(null);

  const normalizedAuthorId = authorId?.trim();
  const resolvedAuthorId = useMemo(
    () =>
      normalizedAuthorId ??
      posts.find((post) => normalizePersonName(post.authorName) === normalizedAuthorName)?.authorId,
    [normalizedAuthorId, normalizedAuthorName, posts],
  );

  const openProfileConnections = useCallback(
    (target: "Followers" | "Following", userId?: string) => {
      const targetUserId = userId || resolvedAuthorId;

      if (!targetUserId) {
        return;
      }

      const routeNames = navigation?.getState?.()?.routeNames ?? [];
      const params = { userId: targetUserId, userDisplayName: authorName };

      if (routeNames.includes(target)) {
        navigation.navigate(target, params);
        return;
      }

      rootNavigation.navigate("MainTabs", {
        screen: "Profile",
        params: { screen: target, params },
      });
    },
    [authorName, navigation, resolvedAuthorId, rootNavigation],
  );

  useEffect(() => {
    let isActive = true;
    void getHungryService()
      .chat.listConversations()
      .then((conversations) => {
        if (!isActive) return;
        const next: Record<string, UserProfileItem> = {};

        conversations.forEach((conversation) => {
          const conversationAvatar = conversation.avatarUrl?.trim();

          conversation.participants.forEach((participant) => {
            const normalizedName = normalizePersonName(participant.displayName);
            const avatarUrl = participant.avatarUrl?.trim();
            const resolvedAvatar =
              avatarUrl ||
              (conversationAvatar && !participant.isCurrentUser ? conversationAvatar : "");

            if (!normalizedName || !resolvedAvatar) {
              return;
            }

            if (!next[normalizedName]) {
              next[normalizedName] = {
                userId: participant.userId,
                name: participant.displayName,
                avatarUrl: resolvedAvatar,
              };
            }
          });
        });

        setChatProfilesByName(next);
      })
      .catch(() => {
        if (!isActive) return;
        setChatProfilesByName({});
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const service = getHungryService().social;
      const [sharedPosts, authorPosts] = await Promise.all([
        listSharedStallPosts(repository),
        normalizedAuthorId
          ? service
              .listUserPosts(normalizedAuthorId)
              .then((bites) =>
                bites.map((bite) => biteToStallPost(bite, { authorAvatarUrl: bite.authorAvatar })),
              )
              .catch(() => [])
          : Promise.resolve([]),
      ]);
      if (!isMounted) return;
      const matchingSharedPosts = sharedPosts.filter((post) =>
        normalizedAuthorId
          ? post.authorId === normalizedAuthorId
          : normalizePersonName(post.authorName) === normalizedAuthorName,
      );
      const nextPosts = mergeStallPosts(authorPosts, matchingSharedPosts);
      setPosts((current) => (haveSamePosts(current, nextPosts) ? current : nextPosts));
    })();

    return () => {
      isMounted = false;
    };
  }, [repository, normalizedAuthorId, normalizedAuthorName]);

  const resolvedAuthorAvatarUrl = useMemo(() => {
    if (authorAvatarUrl?.trim()) return authorAvatarUrl.trim();

    const avatarFromPosts = posts.find(
      (post) =>
        normalizePersonName(post.authorName) === normalizedAuthorName && post.authorAvatarUrl,
    )?.authorAvatarUrl;

    if (avatarFromPosts?.trim()) {
      return avatarFromPosts.trim();
    }

    const commentWithAvatar = Object.values(commentsByPostId)
      .flat()
      .find(
        (comment) =>
          normalizePersonName(comment.authorName) === normalizedAuthorName &&
          comment.authorAvatarUrl?.trim(),
      )?.authorAvatarUrl;

    if (commentWithAvatar?.trim()) {
      return commentWithAvatar.trim();
    }

    const replyWithAvatar = Object.values(repliesByCommentId)
      .flat()
      .find(
        (reply) =>
          normalizePersonName(reply.authorName) === normalizedAuthorName &&
          reply.authorAvatarUrl?.trim(),
      )?.authorAvatarUrl;

    return replyWithAvatar?.trim() ?? "";
  }, [authorAvatarUrl, commentsByPostId, normalizedAuthorName, posts, repliesByCommentId]);

  const userReviewItems = useMemo<UserReviewItem[]>(() => {
    const items: UserReviewItem[] = [];
    const postIdByCommentId = new Map<string, string>();

    Object.entries(commentsByPostId).forEach(([postId, comments]) => {
      comments.forEach((comment) => {
        postIdByCommentId.set(comment.id, postId);

        if (normalizePersonName(comment.authorName) === normalizedAuthorName) {
          items.push({
            id: comment.id,
            postId,
            text: comment.text,
            createdAt: comment.createdAt,
            kind: "comment",
          });
        }
      });
    });

    Object.entries(repliesByCommentId).forEach(([parentCommentId, replies]) => {
      const postId = postIdByCommentId.get(parentCommentId);
      replies.forEach((reply) => {
        if (normalizePersonName(reply.authorName) === normalizedAuthorName) {
          items.push({
            id: reply.id,
            postId,
            text: reply.text,
            createdAt: reply.createdAt,
            kind: "reply",
          });
        }
      });
    });

    return items.sort((a, b) => toEpochMs(b.createdAt) - toEpochMs(a.createdAt));
  }, [commentsByPostId, normalizedAuthorName, repliesByCommentId]);

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
          followersCount: counts?.followersCount ?? 0,
          followingCount: counts?.followingCount ?? 0,
          viewerIsFollowing,
        });
      })
      .catch((error) => {
        console.error("Failed to load follow counts:", error);
        if (!isActive) return;
        setServerFollowState({
          userId: resolvedAuthorId,
          followersCount: 0,
          followingCount: 0,
          viewerIsFollowing: false,
        });
      });

    return () => {
      isActive = false;
    };
  }, [resolvedAuthorId, setFollowRequested, setFollowedUserId]);

  const reviewCount = userReviewItems.length;
  const stallsCount = useMemo(
    () => new Set(posts.map((post) => post.venueId).filter(Boolean)).size,
    [posts],
  );
  const isFollowingAuthor = resolvedAuthorId
    ? Boolean(followedUserIds[resolvedAuthorId])
    : canUseAuthorFallbackFollow &&
      Boolean(followedAuthors[authorName] || followedAuthors[normalizedAuthorName]);
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
  const canShowFollowButton = Boolean(resolvedAuthorId) || canUseAuthorFallbackFollow;
  const loadedFollowState =
    serverFollowState && serverFollowState.userId === resolvedAuthorId ? serverFollowState : null;
  // No account id (name-only author): there is no server follow data to show.
  const followersCount = !resolvedAuthorId
    ? 0
    : loadedFollowState
      ? Math.max(
          0,
          loadedFollowState.followersCount +
            (isFollowingAuthor === loadedFollowState.viewerIsFollowing
              ? 0
              : isFollowingAuthor
                ? 1
                : -1),
        )
      : null;
  const followingCount = !resolvedAuthorId ? 0 : (loadedFollowState?.followingCount ?? null);

  const activeTitle = activeTab === "posts" ? "Post" : "Review";
  const activeItemsCount = activeTab === "posts" ? posts.length : userReviewItems.length;

  return (
    <ProfileScreenShell title={authorName}>
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
            <AppText variant="h1">{authorName}</AppText>
            {canShowFollowButton ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowRequested
                    ? `Follow request sent to ${authorName}`
                    : `${followButtonLabel} ${authorName}`
                }
                accessibilityHint={isFollowRequested ? "Cancels your follow request" : undefined}
                hitSlop={8}
                onPress={() =>
                  resolvedAuthorId ? toggleFollow(resolvedAuthorId) : toggleAuthorFollow(authorName)
                }
                style={{
                  alignItems: "center",
                  borderRadius: componentRadii.button,
                  borderWidth: 1,
                  justifyContent: "center",
                  minHeight: 30,
                  minWidth: 92,
                  paddingHorizontal: spacing[3],
                  marginTop: spacing[1],
                  alignSelf: "flex-start",
                  backgroundColor: isFollowMuted ? palette.surface : palette.orange,
                  borderColor: isFollowMuted ? palette.border : palette.orange,
                }}
              >
                <AppText
                  variant="micro"
                  style={{
                    color: isFollowMuted ? palette.text : palette.white,
                    fontWeight: "800",
                  }}
                >
                  {followButtonLabel}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ gap: spacing[4] }}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <StatBlock
              icon={<Heart color={palette.orange} size={14} />}
              label="Followers"
              value={followersCount}
              onPress={() => openProfileConnections("Followers", resolvedAuthorId)}
            />
            <StatBlock
              icon={<Send color={palette.orange} size={14} />}
              label="Following"
              value={followingCount}
              onPress={() => openProfileConnections("Following", resolvedAuthorId)}
            />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <StatBlock
              icon={<PencilLine color={palette.orange} size={14} />}
              label="Reviews"
              value={reviewCount}
              onPress={() => setActiveTab("reviews")}
            />
            <StatBlock
              icon={<Utensils color={palette.orange} size={14} />}
              label="Stalls"
              value={stallsCount}
              onPress={() => navigation.navigate("VisitedStalls")}
            />
          </View>
        </View>

        <View style={{ gap: spacing[4], marginTop: spacing[2] }}>
          <AppText variant="h2">Posts</AppText>
          <View
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
                  color: activeTab === "posts" ? palette.white : palette.text,
                }}
              >
                Posts
              </AppText>
            </Pressable>
            <Pressable
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
                  color: activeTab === "reviews" ? palette.white : palette.text,
                }}
              >
                Reviews
              </AppText>
            </Pressable>
          </View>

          {activeItemsCount > 0 ? (
            activeTab === "posts" ? (
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing[4] }}
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
                {userReviewItems.map((item) => {
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
                      <AppText>{item.text}</AppText>
                    </Card>
                  );

                  return item.postId ? (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        rootNavigation.navigate("ActivityPostDetail", {
                          postId: item.postId as string,
                        })
                      }
                    >
                      {reviewCard}
                    </Pressable>
                  ) : (
                    <View key={item.id}>{reviewCard}</View>
                  );
                })}
              </View>
            )
          ) : (
            <EmptyState
              title={`No ${activeTitle.toLowerCase()}s yet`}
              body="Shared profile activity will appear here."
              icon={<MessageCircleMore color={palette.textSecondary} size={36} />}
            />
          )}
        </View>
      </View>
    </ProfileScreenShell>
  );
}

function StatBlock({
  icon,
  label,
  value,
  onPress,
  onPressIn,
}: {
  icon: ReactNode;
  label: string;
  /** null while loading. */
  value: number | null;
  onPress?: () => void;
  onPressIn?: () => void;
}) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
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
