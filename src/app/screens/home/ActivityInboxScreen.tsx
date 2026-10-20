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
  EmptyState,
  IconButton,
} from "@/components/ui";
import {
  getActivityReadKey,
  isActivityUpdateForViewer,
  selectActivitySourceUpdates,
  type ActivityUpdate,
} from "@/features/home/activity";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { listSharedStallPostsSync } from "@/features/social/sharedStallPosts";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { ChatConversation } from "@/lib/services/types";
import type { StallPost } from "@/types/domain";
import { useActivityStore } from "@/store/useActivityStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ActivityInbox">;
type ActivityTab = "messages" | "updates";

function formatActivityChatTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export function ActivityInboxScreen({ navigation, route }: Props) {
  const tabs: ActivityTab[] = FEATURE_FLAGS.directMessagesEnabled
    ? ["messages", "updates"]
    : ["updates"];
  const initialTab: ActivityTab = FEATURE_FLAGS.directMessagesEnabled
    ? (route.params?.initialTab ?? "messages")
    : "updates";
  const [activeTab, setActiveTab] = useState<ActivityTab>(initialTab);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
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

  const loadConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setConversations([]);
      setMessagesError(null);
      setIsMessagesLoading(false);
      return;
    }

    setIsMessagesLoading(true);
    setMessagesError(null);
    return getHungryService()
      .chat.listConversations()
      .then((loadedConversations) => {
        setConversations(loadedConversations);
      })
      .catch((error: unknown) => {
        setMessagesError(error instanceof Error ? error.message : "Messages could not be loaded.");
        setConversations([]);
      })
      .finally(() => {
        setIsMessagesLoading(false);
      });
  }, []);

  // Focus also covers the first mount: no separate mount effect (it double-fetched).
  useFocusEffect(
    useCallback(() => {
      void loadConversations();
      void fetchActivityEvents();
      return undefined;
    }, [fetchActivityEvents, loadConversations]),
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top"]}>
      <View style={styles.container}>
        <AppHeader
          title="Activity"
          horizontalPadding={semanticSpacing.screenEdge}
          left={
            <IconButton
              accessibilityLabel="Go back"
              icon={<ChevronLeft color={palette.text} size={24} />}
              onPress={() => navigation.goBack()}
              variant="ghost"
            />
          }
        />

        {/* One tab (DMs off): no segmented control with a single pill. */}
        {tabs.length > 1 ? (
          <View style={[styles.segmentedControl, { backgroundColor: palette.bgSoft }]}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab;
              const unreadCount =
                tab === "messages"
                  ? conversations.reduce(
                      (total, conversation) => total + conversation.unreadCount,
                      0,
                    )
                  : visibleUpdates.filter(
                      (update) =>
                        update.unread &&
                        !readActivityIds.includes(getActivityReadKey("update", update.id)),
                    ).length;

              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setActiveTab(tab)}
                  testID={`activity-tab-${tab}`}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: isActive ? palette.surface : "transparent",
                      borderColor: isActive ? palette.border : "transparent",
                    },
                  ]}
                >
                  <AppText variant="bodySmallBold" style={{ color: palette.text }}>
                    {tab === "messages" ? "Messages" : "Updates"}
                  </AppText>
                  {unreadCount > 0 ? (
                    <View style={[styles.segmentBadge, { backgroundColor: palette.orangeControl }]}>
                      <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                        {unreadCount}
                      </AppText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {activeTab === "messages" ? (
          <MessagesTab
            conversations={conversations}
            isLoading={isMessagesLoading}
            loadError={messagesError}
            navigation={navigation}
            onConversationRead={(conversationId) => {
              setConversations((current) =>
                current.map((conversation) =>
                  conversation.id === conversationId
                    ? { ...conversation, unreadCount: 0 }
                    : conversation,
                ),
              );
            }}
          />
        ) : (
          <UpdatesTab
            navigation={navigation}
            updates={visibleUpdates}
            postById={postById}
            onRefresh={fetchActivityEvents}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function MessagesTab({
  conversations,
  isLoading,
  loadError,
  navigation,
  onConversationRead,
}: Pick<Props, "navigation"> & {
  conversations: ChatConversation[];
  isLoading: boolean;
  loadError: string | null;
  onConversationRead: (conversationId: string) => void;
}) {
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: spacing[4],
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingTop: semanticSpacing.screenEdge,
          paddingBottom: spacing[12],
        }}
      >
        {isLoading ? (
          <EmptyState title="Loading messages" body="Fetching conversations..." />
        ) : null}
        {!isLoading && loadError ? (
          <EmptyState
            title="Messages unavailable"
            body="Unable to load your messages."
            errorMessage={loadError}
            sendErrorContext="Activity inbox"
          />
        ) : null}
        {!isLoading &&
          !loadError &&
          conversations.map((chat) => {
            const chatId = chat.id.trim();
            const normalizedName = chat.title.trim();
            const normalizedAvatar = chat.avatarUrl?.trim() ?? "";
            const isOnline = chat.isOnline;

            if (!chatId || !normalizedName) {
              return null;
            }

            const unreadCount = chat.unreadCount;
            const lastMessage = chat.lastMessage ?? "No messages yet";
            const time = chat.lastMessageAt ? formatActivityChatTime(chat.lastMessageAt) : "";

            return (
              <Pressable
                key={chatId}
                accessibilityRole="button"
                accessibilityLabel={`Open chat with ${normalizedName}`}
                testID={`activity-chat-row-${chatId}`}
                onPress={() => {
                  if (!chatId || !normalizedName) {
                    return;
                  }

                  onConversationRead(chatId);
                  void getHungryService()
                    .chat.markConversationRead(chatId)
                    .catch((error: unknown) => {
                      console.warn("Failed to mark conversation read", error);
                    });
                  navigation.navigate("ChatDetail", {
                    chatId,
                    name: normalizedName,
                    avatar: normalizedAvatar,
                    isOnline,
                  });
                }}
                style={[stylesInline.messageRow, { gap: spacing[3] }]}
              >
                <View style={stylesInline.messageAvatarSlot}>
                  {normalizedAvatar ? (
                    <AccessibleImage
                      source={{ uri: normalizedAvatar }}
                      style={{ width: 56, height: 56, borderRadius: radii.pill }}
                      accessibilityLabel={`Avatar for ${normalizedName}`}
                    />
                  ) : (
                    <View
                      style={[
                        stylesInline.avatarFallback,
                        { backgroundColor: palette.bgSoft, borderRadius: radii.pill },
                      ]}
                    >
                      <AppText variant="bodySmallBold">{normalizedName.slice(0, 1)}</AppText>
                    </View>
                  )}
                  {unreadCount > 0 ? (
                    <UnreadCountBadge
                      accessibilityLabel={`${unreadCount} unread messages`}
                      backgroundColor={palette.orangeControl}
                      borderColor={palette.bg}
                      count={unreadCount}
                      textColor={palette.white}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <View style={stylesInline.rowBetween}>
                    <AppText variant="bodyBold">{normalizedName}</AppText>
                    <AppText variant="micro" tone="secondary">
                      {time}
                    </AppText>
                  </View>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {lastMessage}
                  </AppText>
                </View>
              </Pressable>
            );
          })}

        {!isLoading && !loadError && conversations.length === 0 ? (
          <EmptyState title="No messages yet" body="Chats from food friends will appear here." />
        ) : null}
      </ScrollView>
    </View>
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

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
      {updates.map((update) => {
        const post = update.postId ? postById.get(update.postId) : undefined;
        const kindColor =
          update.kind === "like"
            ? palette.error
            : update.kind === "share"
              ? palette.orange
              : update.kind === "submission"
                ? palette.orange
                : palette.orange;
        const isUnread =
          update.unread && !readActivityIds.includes(getActivityReadKey("update", update.id));

        return (
          <Pressable
            key={update.id}
            accessibilityRole="button"
            accessibilityLabel={
              update.kind === "follow_request"
                ? `${update.actorName} requested to follow you. Open follow requests`
                : update.kind === "follow"
                  ? `${update.actorName} started following you. Open their profile`
                  : `${update.actorName} ${update.text}${update.target ? `: ${update.target}` : ""}. ${formatTimeAgo(update.time)}`
            }
            onPress={() => {
              markActivityRead("update", update.id);
              if (update.kind === "follow_request") {
                navigation.navigate("FollowRequests");
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
                <Heart color={kindColor} size={20} />
              ) : update.kind === "share" ? (
                <Share2 color={kindColor} size={20} />
              ) : update.kind === "submission" ? (
                <Store color={kindColor} size={20} />
              ) : update.kind === "follow_request" || update.kind === "follow" ? (
                <UserPlus color={kindColor} size={20} />
              ) : (
                <MessageCircleMore color={kindColor} size={20} />
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

      {updates.length === 0 ? (
        <EmptyState title="No updates yet" body="Activity updates will appear here." />
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

function UnreadCountBadge({
  accessibilityLabel,
  backgroundColor,
  borderColor,
  count,
  textColor,
}: {
  accessibilityLabel: string;
  backgroundColor: string;
  borderColor: string;
  count: number;
  textColor: string;
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        stylesInline.unreadCountBadge,
        {
          backgroundColor,
          borderColor,
        },
      ]}
    >
      <AppText variant="micro" style={[stylesInline.unreadCountText, { color: textColor }]}>
        {count > 99 ? "99+" : count}
      </AppText>
    </View>
  );
}

const stylesInline = StyleSheet.create({
  messageRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  messageAvatarSlot: {
    height: 56,
    position: "relative",
    width: 56,
  },
  avatarFallback: {
    alignItems: "center",
    height: 56,
    justifyContent: "center",
    width: 56,
  },
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
  unreadCountBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    minWidth: 22,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: "absolute",
    right: -4,
    top: -4,
  },
  unreadCountText: {
    fontWeight: "900",
    lineHeight: 13,
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
    segmentedControl: {
      borderRadius: radii.pill,
      flexDirection: "row",
      gap: spacing[1],
      marginHorizontal: semanticSpacing.screenEdge,
      marginTop: spacing[3],
      padding: spacing[1],
    },
    segment: {
      alignItems: "center",
      borderRadius: radii.pill,
      borderWidth: 1,
      flex: 1,
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      minHeight: 42,
    },
    segmentBadge: {
      alignItems: "center",
      borderRadius: radii.pill,
      minWidth: 20,
      paddingHorizontal: spacing[1],
      paddingVertical: 2,
    },
  });
