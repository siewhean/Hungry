import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppSymbol, AppText, Avatar, Button, EmptyState } from "@/components/ui";
import {
  mergePortfolioPosts,
  portfolioPostImage,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import { PeopleSuggestionsSection } from "@/components/social/PeopleSuggestionsSection";
import { formatRelativeDate } from "@/features/profile/relativeDate";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<RootStackParamList, "FollowingFeed">;

/** Posts per page; get_following_dish_feed allows up to 50. */
export const FOLLOWING_FEED_PAGE_SIZE = 20;

function FollowingFeedRow({
  post,
  onOpenPost,
  onOpenAuthor,
}: {
  post: Bite;
  onOpenPost: () => void;
  onOpenAuthor: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const image = portfolioPostImage(post);
  const dishName = post.dishName || "A dish";
  return (
    <View
      testID={`following-feed-post-${post.id}`}
      style={{
        borderRadius: componentRadii.card,
        backgroundColor: palette.surface,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${post.authorName}'s Food Portfolio`}
        onPress={onOpenAuthor}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[3],
          minHeight: 56,
          paddingHorizontal: spacing[3],
        }}
      >
        <Avatar name={post.authorName} uri={post.authorAvatar} size={36} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyBold" numberOfLines={1}>
            {post.authorName}
          </AppText>
          <AppText variant="micro" tone="secondary" numberOfLines={1}>
            {formatRelativeDate(post.createdAt)}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${dishName}${post.venueName ? ` at ${post.venueName}` : ""}`}
        onPress={onOpenPost}
      >
        {image ? (
          <AccessibleImage
            decorative
            source={{ uri: image }}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="cover"
          />
        ) : null}
        <View style={{ gap: spacing[1], padding: spacing[3] }}>
          <AppText variant="bodyBold" numberOfLines={2}>
            {dishName}
          </AppText>
          {post.venueName ? (
            <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
              {[post.venueName, post.buildingName].filter(Boolean).join(" · ")}
            </AppText>
          ) : null}
          {post.caption && post.caption !== post.dishName ? (
            <AppText variant="bodySmall" numberOfLines={3}>
              {post.caption}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

/** Newest dishes posted by the people you follow (approved follows only), a page at a time. */
export function FollowingFeedScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const [posts, setPosts] = useState<Bite[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const trackedRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    setState("loading");
    void getHungryService()
      .foodPortfolio.getFollowingFeed({ limit: FOLLOWING_FEED_PAGE_SIZE })
      .then((rows) => {
        if (!isActive) return;
        setPosts(rows);
        setHasMore(rows.length === FOLLOWING_FEED_PAGE_SIZE);
        setState("loaded");
        if (!trackedRef.current) {
          trackedRef.current = true;
          trackAnalyticsEvent("following_feed_viewed", { post_count: rows.length });
        }
      })
      .catch((error) => {
        reportError(error, { screen: "FollowingFeed", action: "load_feed" });
        if (isActive) setState("failed");
      });
    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  const loadMore = useCallback(() => {
    const last = posts[posts.length - 1];
    if (!last || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    void getHungryService()
      .foodPortfolio.getFollowingFeed({
        limit: FOLLOWING_FEED_PAGE_SIZE,
        cursor: { createdAt: last.createdAt, postId: last.id },
      })
      .then((rows) => {
        setPosts((current) => mergePortfolioPosts(current, rows));
        setHasMore(rows.length === FOLLOWING_FEED_PAGE_SIZE);
      })
      .catch((error) => {
        reportError(error, { screen: "FollowingFeed", action: "load_more" });
      })
      .finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, posts]);

  const openSuggestedPerson = (person: {
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }) =>
    navigation.navigate("UserProfile", {
      authorId: person.userId,
      authorName: person.displayName,
      authorAvatarUrl: person.avatarUrl,
    });
  const findPeople = () =>
    navigation.navigate("MainTabs", {
      screen: "Profile",
      params: { screen: "Following" },
    } as never);

  return (
    <ProfileScreenShell title="Following" subtitle="New dishes from people you follow">
      <View style={{ gap: spacing[4], paddingBottom: spacing[8] }}>
        {state === "loading" && posts.length === 0 ? (
          <View testID="following-feed-loading" style={{ minHeight: 200 }} />
        ) : state === "failed" && posts.length === 0 ? (
          <EmptyState
            title="Couldn't load the feed"
            body="Check your connection and try again."
            icon={
              <AppSymbol name="retry" size={36} weight="regular" color={palette.textSecondary} />
            }
            ctaLabel="Retry"
            onPress={() => setReloadKey((key) => key + 1)}
          />
        ) : posts.length === 0 ? (
          <>
            <EmptyState
              title="No dishes yet"
              body="Follow people whose taste you like. The dishes they post show up here."
              icon={
                <AppSymbol name="people" size={36} weight="regular" color={palette.textSecondary} />
              }
              ctaLabel="Find people"
              onPress={findPeople}
            />
            {/* Somewhere to start: people with a palate like yours, and people your follows follow. */}
            <PeopleSuggestionsSection onOpen={openSuggestedPerson} />
          </>
        ) : (
          <>
            {posts.map((post) => (
              <FollowingFeedRow
                key={post.id}
                post={post}
                onOpenPost={() => navigation.navigate("ActivityPostDetail", { postId: post.id })}
                onOpenAuthor={() =>
                  navigation.navigate("UserProfile", {
                    authorId: post.authorId,
                    authorName: post.authorName,
                    authorAvatarUrl: post.authorAvatar,
                  })
                }
              />
            ))}
            {hasMore ? (
              <Button
                label="Load more"
                variant="ghost"
                size="sm"
                loading={isLoadingMore}
                onPress={loadMore}
              />
            ) : null}
          </>
        )}
      </View>
    </ProfileScreenShell>
  );
}
