import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import {
  Bookmark,
  Heart,
  MessageCircleMore,
  PencilLine,
  Send,
  Utensils,
} from "lucide-react-native";

import { AppText, Avatar, Card, EmptyState } from "@/components/ui";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import type { StallPost } from "@/types/domain";
import { ProfileScreenShell } from "./ProfileScreenShell";

type UserProfileContentProps = {
  navigation: any;
  authorName: string;
  authorAvatarUrl?: string;
};
type UserReviewItem = {
  id: string;
  postId?: string;
  text: string;
  createdAt: string;
  kind: "comment" | "reply";
};

function normalizePersonName(name: string) {
  return name.trim().toLowerCase();
}

function toEpochMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function UserProfileContent({
  navigation,
  authorName,
  authorAvatarUrl,
}: UserProfileContentProps) {
  const normalizedAuthorName = normalizePersonName(authorName);
  const { palette, radii, shadows, spacing, colorScheme } = useHungryTheme();
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const [activeTab, setActiveTab] = useState<"posts" | "reviews">("posts");
  const [posts, setPosts] = useState<StallPost[]>([]);

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

  const isFollowedByCurrentUser = useMemo(() => {
    return (
      Object.entries(followedAuthors).find(([author]) => {
        return normalizePersonName(author) === normalizedAuthorName;
      })?.[1] ?? false
    );
  }, [followedAuthors, normalizedAuthorName]);

  const reviewCount = userReviewItems.length;
  const stallsCount = useMemo(
    () => new Set(posts.map((post) => post.venueId).filter(Boolean)).size,
    [posts],
  );
  const savedCount = 0;

  const connectionStats = useMemo(
    () => ({
      followers: 0,
      following: isFollowedByCurrentUser ? 1 : 0,
    }),
    [isFollowedByCurrentUser],
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
              <AppText variant="body" tone="secondary">
                {connectionStats.followers} followers
              </AppText>
              <AppText variant="body" tone="secondary">
                {connectionStats.following} following
              </AppText>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <StatBlock
            icon={<Heart color={palette.orange} size={14} />}
            label="Followers"
            value={connectionStats.followers}
            onPress={() =>
              rootNavigation.navigate("MainTabs", {
                screen: "Profile",
                params: {
                  screen: "Followers",
                },
              })
            }
          />
          <StatBlock
            icon={<Send color={palette.orange} size={14} />}
            label="Following"
            value={connectionStats.following}
            onPress={() =>
              rootNavigation.navigate("MainTabs", {
                screen: "Profile",
                params: {
                  screen: "Following",
                },
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
          <StatBlock
            icon={<Bookmark color={palette.orange} size={14} />}
            label="Saved"
            value={savedCount}
          />
        </View>

        <View style={{ gap: spacing[4], marginTop: spacing[2] }}>
          <AppText variant="h2">Posts</AppText>
          <View
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              borderWidth: 1,
              borderRadius: radii.pill,
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
                      onPress={() =>
                        rootNavigation.navigate("ActivityPostDetail", {
                          postId: post.id,
                        })
                      }
                      style={{ width: "33.333%", aspectRatio: 1 }}
                    >
                      <Image
                        source={{ uri: post.mediaUrl }}
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <MessageCircleMore color={palette.orange} size={14} />
                        <AppText variant="micro" style={{ textTransform: "capitalize" }}>
                          {item.kind}
                        </AppText>
                      </View>
                      <AppText>{item.text}</AppText>
                      <AppText variant="micro" tone="secondary">
                        {item.postId ? "Posted in this thread • " : ""}
                        {formatTimeAgo(item.createdAt)}
                      </AppText>
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
              body={
                activeTab === "posts"
                  ? "This user has not shared any posts yet."
                  : "This user has no visible reviews yet."
              }
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
  const { palette, radii, spacing, colorScheme } = useHungryTheme();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      style={{
        backgroundColor: colorScheme === "dark" ? palette.surfaceRaised : palette.bgSoft,
        borderRadius: radii.lg,
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
