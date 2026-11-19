import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ChevronLeft,
  Heart,
  MessageCircleMore,
  Share2,
  Store,
  UserPlus,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppHeader,
  AppText,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  Skeleton,
} from "@/components/ui";
import {
  groupActivityUpdates,
  isActivityUpdateForViewer,
  selectActivitySourceUpdates,
  type ActivityUpdate,
} from "@/features/home/activity";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { listSharedStallPostsSync } from "@/features/social/sharedStallPosts";
import { getDataRepository, getServiceProvider } from "@/lib/services/serviceProvider";
import type { StallPost } from "@/types/domain";
import { useActivityStore } from "@/store/useActivityStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { AppSymbol } from "@/components/ui/AppSymbol";
import { FeedEmptyIllustration } from "@/components/icons/food/SocialIllustrations";

type Props = NativeStackScreenProps<RootStackParamList, "ActivityInbox">;

export function ActivityInboxScreen({ navigation }: Props) {
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const dbActivityEvents = useActivityStore((state) => state.dbActivityEvents);
  const fetchActivityEvents = useActivityStore((state) => state.fetchActivityEvents);
  const userId = useProfileStore((state) => state.profile.id);
  const repository = getDataRepository();
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const posts = useMemo(() => {
    void publishedPosts;
    return listSharedStallPostsSync(repository);
  }, [publishedPosts, repository]);
  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const allUpdates = useMemo(() => {
    const sourceUpdates = selectActivitySourceUpdates(
      getServiceProvider().mode,
      dbActivityEvents,
      activityUpdates,
    );
    return sourceUpdates.map((update) => {
      if (update.target) return update;
      if (update.kind === "follow") return { ...update, target: "View profile" };
      // Label the post by its dish and stall, never by its raw id.
      const post = postById.get(update.postId);
      const dishName = post?.dishIds
        .map((dishId) => repository.getDishById(dishId)?.name)
        .find(Boolean);
      const venueName = post?.authorLocation?.trim();
      const label = [dishName, venueName].filter(Boolean).join(" · ");
      return { ...update, target: label || (update.postId ? "Your post" : "") };
    });
  }, [postById, activityUpdates, dbActivityEvents, repository]);

  const visibleUpdates = useMemo(() => {
    const parseRelativeMinutes = (value: string) => {
      const normalized = value.trim().toLowerCase();

      if (normalized === "now") return 0;

      const minutesMatch = normalized.match(/^(\d+)\s*m$/);
      if (minutesMatch) return Number(minutesMatch[1]);

      const hoursMatch = normalized.match(/^(\d+)\s*h$/);
      if (hoursMatch) return Number(hoursMatch[1]) * 60;

      const daysMatch = normalized.match(/^(\d+)\s*d$/);
      if (daysMatch) return Number(daysMatch[1]) * 60 * 24;

      return Number.POSITIVE_INFINITY;
    };

    const createdAt = (value: string, fallbackToRelative = true) => {
      const absolute = Date.parse(value);
      if (Number.isFinite(absolute)) {
        return absolute;
      }

      if (!fallbackToRelative) return Number.POSITIVE_INFINITY;

      return Date.now() - parseRelativeMinutes(value) * 60_000;
    };

    return allUpdates
      .filter((update) => isActivityUpdateForViewer(update, userId))
      .sort((a, b) => createdAt(b.time) - createdAt(a.time));
  }, [allUpdates, userId]);

  const styles = useMemo(
    () => createStyles({ spacing, semanticSpacing, radii }),
    [spacing, semanticSpacing, radii],
  );

  // Focus also covers the first mount: no separate mount effect (it double-fetched).
  useFocusEffect(
    useCallback(() => {
      void fetchActivityEvents();
      return undefined;
    }, [fetchActivityEvents]),
  );

  const markAllActivityRead = useActivityStore((state) => state.markAllActivityRead);
  const updatesHaveUnread = useMemo(
    () => groupActivityUpdates(visibleUpdates, readActivityIds).some((row) => row.isUnread),
    [readActivityIds, visibleUpdates],
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={styles.container}>
        <AppHeader
          title="Activity"
          // An action on the current view lives in the header (HIG, Toolbars), not in the list.
          right={
            updatesHaveUnread ? (
              <Button
                label="Mark all read"
                variant="ghost"
                size="sm"
                fullWidth={false}
                accessibilityLabel="Mark all updates as read"
                onPress={() => void markAllActivityRead()}
                testID="activity-mark-all-read"
              />
            ) : undefined
          }
          horizontalPadding={semanticSpacing.screenEdge}
          left={
            <IconButton
              accessibilityLabel="Go back"
              icon={
                <AppSymbol
                  name="chevron.backward"
                  fallback={ChevronLeft}
                  size={24}
                  color={palette.text}
                />
              }
              onPress={() => navigation.goBack()}
              variant="ghost"
            />
          }
        />

        <UpdatesTab
          navigation={navigation}
          updates={visibleUpdates}
          postById={postById}
          onRefresh={fetchActivityEvents}
        />
      </View>
    </SafeAreaView>
  );
}

function UpdatesTab({
  navigation,
  updates,
  postById,
  onRefresh,
}: {
  navigation: Props["navigation"];
  updates: ActivityUpdate[];
  postById: Map<string, StallPost>;
  onRefresh: () => Promise<void>;
}) {
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const markActivityRead = useActivityStore((state) => state.markActivityRead);
  const fetchMoreActivityEvents = useActivityStore((state) => state.fetchMoreActivityEvents);
  const hasLoadedActivity = useActivityStore((state) => state.hasLoadedActivity);
  const activityLoadFailed = useActivityStore((state) => state.activityLoadFailed);
  const hasMoreActivity = useActivityStore((state) => state.hasMoreActivity);
  const isLoadingMoreActivity = useActivityStore((state) => state.isLoadingMoreActivity);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);
  const rows = useMemo(
    () => groupActivityUpdates(updates, readActivityIds),
    [readActivityIds, updates],
  );
  // Mock mode has no server read to wait for.
  const isFirstLoad = !hasLoadedActivity && getServiceProvider().mode !== "mock";

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={palette.orange}
        />
      }
      contentContainerStyle={{
        gap: spacing[4],
        paddingHorizontal: semanticSpacing.screenEdge,
        paddingTop: semanticSpacing.screenEdge,
        paddingBottom: spacing[12],
      }}
    >
      {activityLoadFailed && rows.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Couldn't refresh updates. Showing the last ones we loaded. Tap to try again"
          onPress={() => void handleRefresh()}
          style={{
            backgroundColor: palette.bgSoft,
            borderColor: palette.border,
            borderRadius: radii.md,
            borderWidth: 1,
            padding: spacing[3],
          }}
        >
          <AppText variant="bodySmall" tone="secondary">
            Couldn&apos;t refresh. Showing the last updates we loaded. Tap to try again.
          </AppText>
        </Pressable>
      ) : null}

      {rows.map((update) => {
        const post = update.postId ? postById.get(update.postId) : undefined;
        const kindColor = update.kind === "like" ? palette.error : palette.orange;
        const isUnread = update.isUnread;
        const description =
          update.kind === "follow_request"
            ? `${update.actorName} requested to follow you. Open follow requests`
            : update.kind === "board"
              ? `${update.text}. Open the Leaderboard`
              : update.kind === "follow"
                ? `${update.actorName} started following you. Open their profile`
                : `${update.actorName} ${update.text}${update.target ? `: ${update.target}` : ""}. ${formatTimeAgo(update.time)}`;

        return (
          <Pressable
            key={update.id}
            accessibilityRole="button"
            accessibilityLabel={isUnread ? `Unread. ${description}` : description}
            onPress={() => {
              update.memberIds.forEach((memberId) => markActivityRead("update", memberId));
              if (update.kind === "follow_request") {
                navigation.navigate("FollowRequests");
                return;
              }
              if (update.kind === "board") {
                navigation.navigate("Leaderboard");
                return;
              }
              if (update.kind === "follow") {
                navigation.navigate("UserProfile", {
                  authorName: update.actorName,
                  authorAvatarUrl: update.actorAvatarUrl,
                  authorId: update.actorId,
                });
                return;
              }
              if (update.postId) {
                navigation.navigate("ActivityPostDetail", {
                  postId: update.postId,
                  updateId: update.id,
                });
              }
            }}
            style={[stylesInline.updateRow, { gap: spacing[3] }]}
          >
            <Avatar uri={update.actorAvatarUrl} name={update.actorName} size={40} />
            <View style={[stylesInline.kindBadge, { backgroundColor: palette.bgSoft }]}>
              {update.kind === "like" ? (
                <AppSymbol name="heart" fallback={Heart} size={20} color={kindColor} />
              ) : update.kind === "share" ? (
                <AppSymbol
                  name="square.and.arrow.up"
                  fallback={Share2}
                  size={20}
                  color={kindColor}
                />
              ) : update.kind === "submission" ? (
                <AppSymbol name="storefront" fallback={Store} size={20} color={kindColor} />
              ) : update.kind === "board" ? (
                <AppSymbol name="leaderboard" size={20} color={kindColor} />
              ) : update.kind === "follow_request" || update.kind === "follow" ? (
                <AppSymbol
                  name="person.badge.plus"
                  fallback={UserPlus}
                  size={20}
                  color={kindColor}
                />
              ) : (
                <AppSymbol
                  name="ellipsis.bubble"
                  fallback={MessageCircleMore}
                  size={20}
                  color={kindColor}
                />
              )}
            </View>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <View style={stylesInline.rowBetween}>
                <AppText variant="bodySmallBold">{update.actorName}</AppText>
                <AppText variant="micro" tone="secondary">
                  {formatTimeAgo(update.time)}
                </AppText>
              </View>
              <AppText variant="bodySmall" tone="secondary" style={stylesInline.updateText}>
                {update.text}
              </AppText>
              {update.target ? (
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {update.target}
                </AppText>
              ) : null}
            </View>
            <View style={stylesInline.updateMediaSlot}>
              {post ? (
                <AccessibleImage
                  source={{ uri: post.mediaUrl }}
                  style={{ width: 56, height: 56, borderRadius: radii.md }}
                  decorative
                />
              ) : null}
              <View style={stylesInline.updateUnreadSlot}>
                {isUnread ? (
                  <UnreadDot
                    accessibilityLabel="Unread update"
                    backgroundColor={palette.orangeControl}
                    borderColor={palette.bg}
                  />
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}

      {hasMoreActivity && rows.length > 0 ? (
        <Button
          label="Show older updates"
          variant="ghost"
          size="sm"
          loading={isLoadingMoreActivity}
          onPress={() => void fetchMoreActivityEvents()}
        />
      ) : null}

      {rows.length === 0 && isFirstLoad ? (
        <View accessibilityLabel="Loading updates" style={{ gap: spacing[4] }}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[stylesInline.updateRow, { gap: spacing[3] }]}>
              <Skeleton width={40} height={40} borderRadius={radii.pill} />
              <View style={{ flex: 1, gap: spacing[1] }}>
                <Skeleton width="40%" height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {rows.length === 0 && !isFirstLoad && activityLoadFailed ? (
        <EmptyState
          title="Couldn't load updates"
          body="Check your connection and try again."
          ctaLabel="Try again"
          onPress={() => void handleRefresh()}
        />
      ) : null}

      {rows.length === 0 && !isFirstLoad && !activityLoadFailed ? (
        <EmptyState
          title="No updates yet"
          body="Activity updates will appear here."
          icon={<FeedEmptyIllustration testID="activity-empty-art" />}
        />
      ) : null}
    </ScrollView>
  );
}

function UnreadDot({
  accessibilityLabel,
  backgroundColor,
  borderColor,
}: {
  accessibilityLabel: string;
  backgroundColor: string;
  borderColor: string;
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        stylesInline.unreadDot,
        {
          backgroundColor,
          borderColor,
        },
      ]}
    />
  );
}

const stylesInline = StyleSheet.create({
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  updateRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  updateText: {
    alignSelf: "stretch",
    width: "100%",
  },
  updateMediaSlot: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    height: 56,
    justifyContent: "flex-start",
    width: 76,
  },
  updateUnreadSlot: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    width: 14,
  },
  unreadDot: {
    borderRadius: 999,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  kindBadge: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});

const createStyles = ({
  spacing,
  semanticSpacing,
  radii,
}: Pick<ReturnType<typeof useHungryTheme>, "spacing" | "semanticSpacing" | "radii">) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: {
      flex: 1,
    },
  });
