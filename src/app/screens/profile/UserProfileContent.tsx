import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import {
  Bookmark,
  Heart,
  MessageCircleMore,
  PencilLine,
  Send,
  Utensils,
} from "lucide-react-native";

import { AccessibleImage, AppText, Avatar, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
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

function mergeFollowerNames(
  users: { name: string; userId?: string }[],
  targetName: string,
): Set<string> {
  const normalizedTarget = normalizePersonName(targetName);
  const names = new Set<string>();

  users.forEach((user) => {
    const normalized = normalizePersonName(user.name);
    if (!normalized || normalized === normalizedTarget) return;
    names.add(normalized);
  });

  return names;
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
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const [activeTab, setActiveTab] = useState<"posts" | "reviews">("posts");
  const [posts, setPosts] = useState<StallPost[]>([]);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [chatProfilesByName, setChatProfilesByName] = useState<Record<string, UserProfileItem>>({});
  const [serviceFollowers, setServiceFollowers] = useState<UserProfileItem[]>([]);
  const localFollowerNames = useMemo(() => {
    const names = [
      ...Object.values(commentsByPostId)
        .flat()
        .map((comment) => ({ name: comment.authorName, userId: comment.userId })),
      ...Object.values(repliesByCommentId)
        .flat()
        .map((reply) => ({ name: reply.authorName, userId: reply.userId })),
      ...repository
        .listStallPosts()
        .map((post) => ({ name: post.authorName, userId: post.authorId })),
      ...Object.values(serviceFollowers).map((user) => ({ name: user.name, userId: user.userId })),
      ...Object.values(chatProfilesByName).map((user) => ({
        name: user.name,
        userId: user.userId,
      })),
    ];

    return mergeFollowerNames(names, authorName);
  }, [
    authorName,
    chatProfilesByName,
    commentsByPostId,
    repository,
    repliesByCommentId,
    serviceFollowers,
  ]);

  const openProfileConnections = useCallback(
    (target: "Followers" | "Following", params: { userId?: string; userDisplayName?: string }) => {
      const routeNames = navigation?.getState?.()?.routeNames ?? [];
      if (routeNames.includes(target)) {
        navigation.navigate(target, params);
        return;
      }

      rootNavigation.navigate("MainTabs", {
        screen: "Profile",
        params: { screen: target, params },
      });
    },
    [navigation, rootNavigation],
  );

  const normalizedAuthorId = authorId?.trim();
  const resolvedAuthorId = useMemo(
    () =>
      normalizedAuthorId ??
      posts.find((post) => normalizePersonName(post.authorName) === normalizedAuthorName)?.authorId,
    [normalizedAuthorId, normalizedAuthorName, posts],
  );
  const followerLookupId = resolvedAuthorId || "_followers-fallback";

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
    let isActive = true;
    const service = getHungryService().social;
    void service
      .listFollowers(followerLookupId)
      .then((followersList) => {
        if (!isActive) return;
        setServiceFollowers(
          followersList.map((user) => ({
            userId: user.userId,
            name: user.displayName,
            avatarUrl: user.avatarUrl ?? "",
          })),
        );
      })
      .catch(() => {
        if (!isActive) return;
        setServiceFollowers([]);
      });

    return () => {
      isActive = false;
    };
  }, [followerLookupId]);

  useEffect(() => {
    let isMounted = true;
    void listSharedStallPosts(repository).then((sharedPosts) => {
      if (!isMounted) return;
      setPosts(
        sharedPosts.filter((post) => normalizePersonName(post.authorName) === normalizedAuthorName),
      );
    });

    return () => {
      isMounted = false;
    };
  }, [publishedPosts, repository, normalizedAuthorName]);

  useEffect(() => {
    let isActive = true;
    const service = getHungryService().social;

    void Promise.all([
      service.listFollowers(followerLookupId),
      service.listFollowing(followerLookupId),
    ])
      .then(([followersList, followingList]) => {
        if (!isActive) return;
        const followersFromService = mergeFollowerNames(
          followersList.map((user) => ({ name: user.displayName, userId: user.userId })),
          authorName,
        );
        const nextFollowerCount = new Set([...followersFromService, ...localFollowerNames]).size;
        setFollowerCount(nextFollowerCount);
        setFollowingCount(followingList.length);
      })
      .catch(() => {
        if (!isActive) return;
        setFollowerCount(localFollowerNames.size);
        setFollowingCount(0);
      });

    return () => {
      isActive = false;
    };
  }, [followerLookupId, localFollowerNames, authorName]);

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

  const reviewCount = userReviewItems.length;
  const stallsCount = useMemo(
    () => new Set(posts.map((post) => post.venueId).filter(Boolean)).size,
    [posts],
  );
  const isFollowingAuthor = Boolean(
    followedAuthors[authorName] || followedAuthors[normalizedAuthorName],
  );

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
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View followers for ${authorName}`}
                disabled={!resolvedAuthorId}
                onPress={() =>
                  resolvedAuthorId &&
                  openProfileConnections("Followers", {
                    userId: resolvedAuthorId,
                    userDisplayName: authorName,
                  })
                }
                style={{
                  alignItems: "center",
                  backgroundColor: palette.surface,
                  borderRadius: componentRadii.button,
                  borderColor: palette.border,
                  borderWidth: 1,
                  minHeight: 28,
                  justifyContent: "center",
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  opacity: resolvedAuthorId ? 1 : 0.6,
                }}
              >
                <AppText variant="micro" style={{ color: palette.text }}>
                  Followers: {followerCount}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View users followed by ${authorName}`}
                disabled={!resolvedAuthorId}
                onPress={() =>
                  resolvedAuthorId &&
                  openProfileConnections("Following", {
                    userId: resolvedAuthorId,
                    userDisplayName: authorName,
                  })
                }
                style={{
                  alignItems: "center",
                  backgroundColor: palette.surface,
                  borderRadius: componentRadii.button,
                  borderColor: palette.border,
                  borderWidth: 1,
                  minHeight: 28,
                  justifyContent: "center",
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  opacity: resolvedAuthorId ? 1 : 0.6,
                }}
              >
                <AppText variant="micro" style={{ color: palette.text }}>
                  Following: {followingCount}
                </AppText>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isFollowingAuthor ? "Following" : "Follow"} ${authorName}`}
              hitSlop={8}
              onPress={() => toggleAuthorFollow(authorName)}
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
                backgroundColor: isFollowingAuthor ? palette.surface : palette.orange,
                borderColor: isFollowingAuthor ? palette.border : palette.orange,
              }}
            >
              <AppText
                variant="micro"
                style={{
                  color: isFollowingAuthor ? palette.text : palette.white,
                  fontWeight: "800",
                }}
              >
                {isFollowingAuthor ? "Following" : "Follow"}
              </AppText>
            </Pressable>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <StatBlock
            icon={<Heart color={palette.orange} size={14} />}
            label="Followers"
            value={followerCount}
            onPress={() =>
              resolvedAuthorId &&
              openProfileConnections("Followers", {
                userId: resolvedAuthorId,
                userDisplayName: authorName,
              })
            }
          />
          <StatBlock
            icon={<Send color={palette.orange} size={14} />}
            label="Following"
            value={followingCount}
            onPress={() =>
              resolvedAuthorId &&
              openProfileConnections("Following", {
                userId: resolvedAuthorId,
                userDisplayName: authorName,
              })
            }
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <StatBlock
            icon={<PencilLine color={palette.orange} size={14} />}
            label="Reviews"
            value={reviewCount}
          />
          <StatBlock
            icon={<Utensils color={palette.orange} size={14} />}
            label="Stalls"
            value={stallsCount}
          />
          <StatBlock icon={<Bookmark color={palette.orange} size={14} />} label="Saved" value={0} />
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
  value: number;
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
        <AppText variant="h3" style={{ color: palette.text }}>
          {value}
        </AppText>
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
