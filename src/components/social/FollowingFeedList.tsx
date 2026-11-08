/**
 * The newest dishes from people you follow, grouped by day in a two-column grid: the Feed tab
 * of People, and the screen the daily digest push opens. Opened from a stall page it shows only
 * that stall's dishes, with a chip to see them all.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { FeedEmptyIllustration } from "@/components/icons/food/SocialIllustrations";
import { PeopleSuggestionsSection } from "@/components/social/PeopleSuggestionsSection";
import {
  AccessibleImage,
  AppSymbol,
  AppText,
  Avatar,
  Button,
  Chip,
  EmptyState,
} from "@/components/ui";
import {
  mergePortfolioPosts,
  portfolioPostImage,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import { groupPostsByDay } from "@/features/foodPortfolio/followingFeedDays";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

/** Posts per page; get_following_dish_feed allows up to 50. */
export const FOLLOWING_FEED_PAGE_SIZE = 20;

type Navigation = { navigate: (...args: any[]) => void };

function FeedTile({
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
    <View testID={`following-feed-post-${post.id}`} style={{ gap: spacing[1], width: "48.5%" }}>
      <View
        style={{
          aspectRatio: 1,
          backgroundColor: palette.bgSoft,
          borderRadius: componentRadii.card,
          overflow: "hidden",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${dishName}${post.venueName ? ` at ${post.venueName}` : ""}`}
          onPress={onOpenPost}
          style={{ flex: 1 }}
        >
          {image ? (
            <AccessibleImage
              decorative
              source={{ uri: image }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <AppSymbol name="dish" size={28} color={palette.textMuted} />
            </View>
          )}
        </Pressable>
        {/* The poster, on the photo: tap for their Food Portfolio. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.authorName}'s Food Portfolio`}
          onPress={onOpenAuthor}
          hitSlop={6}
          style={{
            borderColor: palette.surface,
            borderRadius: 999,
            borderWidth: 2,
            bottom: spacing[2],
            left: spacing[2],
            position: "absolute",
          }}
        >
          <Avatar name={post.authorName} uri={post.authorAvatar} size={28} />
        </Pressable>
      </View>
      <AppText variant="bodyBold" numberOfLines={2}>
        {dishName}
      </AppText>
      <AppText variant="micro" tone="secondary" numberOfLines={1}>
        {[post.authorName, post.venueName].filter(Boolean).join(" · ")}
      </AppText>
    </View>
  );
}

export function FollowingFeedList({
  navigation,
  venueId,
  venueName,
  onClearVenue,
  onFindPeople,
}: {
  navigation: Navigation;
  /** Only this stall's dishes (from a stall page's "Posted here"). */
  venueId?: string;
  venueName?: string;
  onClearVenue?: () => void;
  onFindPeople: () => void;
}) {
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

  const shown = useMemo(
    () => (venueId ? posts.filter((post) => post.venueId === venueId) : posts),
    [posts, venueId],
  );
  const days = useMemo(() => groupPostsByDay(shown), [shown]);

  const openAuthor = (post: Bite) =>
    navigation.navigate("UserProfile", {
      authorId: post.authorId,
      authorName: post.authorName,
      authorAvatarUrl: post.authorAvatar,
    });
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

  const venueChip =
    venueId && onClearVenue ? (
      <View style={{ flexDirection: "row" }}>
        <Chip
          label={venueName || "This stall"}
          selected
          accessibilityLabel={`Showing dishes at ${venueName || "this stall"}. Show all dishes`}
          rightIcon={<AppSymbol name="close" size={12} color={palette.text} />}
          onPress={onClearVenue}
        />
      </View>
    ) : null;

  return (
    <View testID="following-feed" style={{ gap: spacing[4], paddingBottom: spacing[8] }}>
      {venueChip}
      {state === "loading" && posts.length === 0 ? (
        <View testID="following-feed-loading" style={{ minHeight: 200 }} />
      ) : state === "failed" && posts.length === 0 ? (
        <EmptyState
          title="Couldn't load the feed"
          body="Check your connection and try again."
          icon={<AppSymbol name="retry" size={36} weight="regular" color={palette.textSecondary} />}
          ctaLabel="Retry"
          onPress={() => setReloadKey((key) => key + 1)}
        />
      ) : shown.length === 0 && !venueId ? (
        <>
          <EmptyState
            title="Follow someone to see their dishes"
            body="The dishes people you follow post show up here."
            icon={<FeedEmptyIllustration testID="following-feed-empty-art" />}
            ctaLabel="Find people"
            onPress={onFindPeople}
          />
          <PeopleSuggestionsSection onOpen={openSuggestedPerson} />
        </>
      ) : (
        <>
          {shown.length === 0 ? (
            <AppText tone="secondary" testID="following-feed-venue-empty">
              {hasMore
                ? "Nothing from this stall in the newest dishes yet."
                : "Nobody you follow has posted from this stall yet."}
            </AppText>
          ) : null}
          {days.map((day) => (
            <View
              key={day.key}
              style={{ gap: spacing[2] }}
              testID={`following-feed-day-${day.key}`}
            >
              <AppText variant="h3" accessibilityRole="header">
                {day.label}
              </AppText>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  rowGap: spacing[3],
                }}
              >
                {day.posts.map((post) => (
                  <FeedTile
                    key={post.id}
                    post={post}
                    onOpenPost={() =>
                      navigation.navigate("ActivityPostDetail", { postId: post.id })
                    }
                    onOpenAuthor={() => openAuthor(post)}
                  />
                ))}
              </View>
            </View>
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
  );
}
