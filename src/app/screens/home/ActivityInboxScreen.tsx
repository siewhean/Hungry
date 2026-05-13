import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { ChevronLeft, Heart, MessageCircleMore } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppHeader, AppText, EmptyState, IconButton } from "@/components/ui";
import {
  ACTIVITY_UPDATES,
  getActivityReadKey,
  type ActivityUpdate,
} from "@/features/home/activity";
import { listSharedStallPostsSync } from "@/features/social/sharedStallPosts";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { ChatConversation } from "@/lib/services/types";
import { useActivityStore } from "@/store/useActivityStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ActivityInbox">;
type ActivityTab = "messages" | "updates";

const TABS: ActivityTab[] = ["messages", "updates"];

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
  const initialTab = route.params?.initialTab ?? "updates";
  const [activeTab, setActiveTab] = useState<ActivityTab>(initialTab);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const repository = getDataRepository();
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const posts = useMemo(() => listSharedStallPostsSync(repository), [publishedPosts, repository]);
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const allUpdates = useMemo(() => {
    return [...ACTIVITY_UPDATES, ...activityUpdates].map((update) => {
      const post = posts.find((candidate) => candidate.id === update.postId);
      const postName = post?.authorName ?? post?.caption ?? "Post";
      const venueName = post ? `${post.authorLocation}` : "";
      return {
        ...update,
        target: update.target || (venueName ? `${postName} · ${venueName}` : postName),
      };
    });
  }, [posts, activityUpdates]);

  const styles = useMemo(
    () => createStyles({ spacing, semanticSpacing, radii }),
    [spacing, semanticSpacing, radii],
  );

  const loadConversations = useCallback(async () => {
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

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
      return undefined;
    }, [loadConversations]),
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

        <View style={[styles.segmentedControl, { backgroundColor: palette.bgSoft }]}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            const unreadCount =
              tab === "messages"
                ? conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)
                : allUpdates.filter(
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
                  <View style={[styles.segmentBadge, { backgroundColor: palette.orange }]}>
                    <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                      {unreadCount}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

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
          <UpdatesTab navigation={navigation} updates={allUpdates} />
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
          <EmptyState title="Messages unavailable" body={loadError} />
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
                  void getHungryService().chat.markConversationRead(chatId);
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
                    <Image
                      source={{ uri: normalizedAvatar }}
                      style={{ width: 56, height: 56, borderRadius: radii.pill }}
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
                      backgroundColor={palette.orange}
                      borderColor={palette.bg}
                      count={unreadCount}
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
}: {
  navigation: Props["navigation"];
  updates: ActivityUpdate[];
}) {
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const repository = getDataRepository();
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const markActivityRead = useActivityStore((state) => state.markActivityRead);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        gap: spacing[4],
        paddingHorizontal: semanticSpacing.screenEdge,
        paddingTop: semanticSpacing.screenEdge,
        paddingBottom: spacing[12],
      }}
    >
      {updates.map((update) => {
        const post = repository
          .listStallPosts()
          .find((candidate) => candidate.id === update.postId);
        const kindColor = update.kind === "like" ? palette.error : palette.orange;
        const isUnread =
          update.unread && !readActivityIds.includes(getActivityReadKey("update", update.id));

        return (
          <Pressable
            key={update.id}
            accessibilityRole="button"
            accessibilityLabel={`Open update for ${update.target}`}
            onPress={() => {
              markActivityRead("update", update.id);
              navigation.navigate("ActivityPostDetail", {
                postId: update.postId,
                updateId: update.id,
              });
            }}
            style={[stylesInline.updateRow, { gap: spacing[3] }]}
          >
            <View style={[stylesInline.kindBadge, { backgroundColor: palette.bgSoft }]}>
              {update.kind === "like" ? (
                <Heart color={kindColor} size={20} />
              ) : (
                <MessageCircleMore color={kindColor} size={20} />
              )}
              <AppText variant="micro" style={{ color: kindColor, fontWeight: "800" }}>
                {update.kind === "like" ? "Like" : "Comment"}
              </AppText>
            </View>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <View style={stylesInline.rowBetween}>
                <AppText variant="bodySmallBold">{update.actorName}</AppText>
                <AppText variant="micro" tone="secondary">
                  {update.time}
                </AppText>
              </View>
              <AppText variant="bodySmall" tone="secondary">
                {update.text}
              </AppText>
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {update.target}
              </AppText>
            </View>
            <View style={stylesInline.updateMediaSlot}>
              {post ? (
                <Image
                  source={{ uri: post.mediaUrl }}
                  style={{ width: 56, height: 56, borderRadius: radii.md }}
                />
              ) : null}
              <View style={stylesInline.updateUnreadSlot}>
                {isUnread ? (
                  <UnreadDot
                    accessibilityLabel="Unread update"
                    backgroundColor={palette.orange}
                    borderColor={palette.bg}
                  />
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}

      {updates.length === 0 ? (
        <EmptyState title="No updates yet" body="Comments, likes, and shares will appear here." />
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
}: {
  accessibilityLabel: string;
  backgroundColor: string;
  borderColor: string;
  count: number;
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
      <AppText variant="micro" style={stylesInline.unreadCountText}>
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
    color: "#FFFFFF",
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
