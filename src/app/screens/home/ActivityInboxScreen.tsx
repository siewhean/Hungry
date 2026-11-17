import { getAccountGeneration } from "@/lib/security/accountScope";
import {
  useCommunitySafetyRevision,
  isContentHiddenForSession,
} from "@/lib/security/communitySafety";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Heart, MessageCircleMore, Share2, Store } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppHeader, AppText, EmptyState, IconButton } from "@/components/ui";
import {
  ACTIVITY_UPDATES,
  getActivityReadKey,
  selectVisibleActivityUpdates,
  type ActivityUpdate,
} from "@/features/home/activity";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { listSharedStallPostsSync } from "@/features/social/sharedStallPosts";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { ChatConversation, PublicAccountSummary } from "@/lib/services/types";
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
  const safetyRevision = useCommunitySafetyRevision();
  const accountScope = `${userId}:${getAccountGeneration()}`;
  const [conversationOwner, setConversationOwner] = useState("");
  const visibleConversations = useMemo(
    () =>
      conversationOwner === accountScope
        ? conversations.filter(
            (conversation) =>
              !conversation.participants.some(
                (participant) =>
                  !participant.isCurrentUser &&
                  participant.userId &&
                  isContentHiddenForSession({ id: "", authorId: participant.userId }),
              ),
          )
        : [],
    [conversations, conversationOwner, accountScope, safetyRevision],
  );
  const repository = getDataRepository();
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const posts = useMemo(() => {
    void publishedPosts;
    return listSharedStallPostsSync(repository);
  }, [publishedPosts, repository]);
  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const allUpdates = useMemo(() => {
    const sourceUpdates =
      getServiceProvider().mode === "mock"
        ? [...ACTIVITY_UPDATES, ...activityUpdates]
        : [...dbActivityEvents, ...activityUpdates];
    return sourceUpdates.map((update) => {
      const post = postById.get(update.postId);
      const postName = post?.authorName ?? post?.caption ?? "Post";
      const venueName = post ? `${post.authorLocation}` : "";
      return {
        ...update,
        target: update.target || (venueName ? `${postName} · ${venueName}` : postName),
      };
    });
  }, [postById, activityUpdates, dbActivityEvents]);

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

    return selectVisibleActivityUpdates(allUpdates, userId).sort(
      (a, b) => createdAt(b.time) - createdAt(a.time),
    );
  }, [allUpdates, userId]);

  const styles = useMemo(
    () => createStyles({ spacing, semanticSpacing, radii }),
    [spacing, semanticSpacing, radii],
  );

  const requestId = useRef(0);
  const loadConversations = useCallback(async () => {
    const request = ++requestId.current;
    const generation = getAccountGeneration();
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
        if (request !== requestId.current || generation !== getAccountGeneration()) return;
        setConversationOwner(accountScope);
        setConversations(loadedConversations);
      })
      .catch((error: unknown) => {
        if (request !== requestId.current || generation !== getAccountGeneration()) return;
        setMessagesError(error instanceof Error ? error.message : "Messages could not be loaded.");
      })
      .finally(() => {
        if (request === requestId.current && generation === getAccountGeneration())
          setIsMessagesLoading(false);
      });
  }, [accountScope]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
      void fetchActivityEvents();
      return () => {
        requestId.current++;
      };
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

        <View style={[styles.segmentedControl, { backgroundColor: palette.bgSoft }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            const unreadCount =
              tab === "messages"
                ? visibleConversations.reduce(
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
            conversations={visibleConversations}
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
          <UpdatesTab navigation={navigation} updates={visibleUpdates} />
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

                  void getHungryService()
                    .chat.markConversationRead(chatId)
                    .then(() => onConversationRead(chatId))
                    .catch(() =>
                      Alert.alert(
                        "Read status not updated",
                        "Messages remain unread. Retry from the conversation.",
                      ),
                    );
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
                      backgroundColor={palette.orange}
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
}: {
  navigation: Props["navigation"];
  updates: ActivityUpdate[];
}) {
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const repository = getDataRepository();
  const activityError = useActivityStore((state) => state.error);
  const fetchActivityEvents = useActivityStore((state) => state.fetchActivityEvents);
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const markActivityRead = useActivityStore((state) => state.markActivityRead);
  const requestSubject = useProfileStore((state) => state.profile.id);
  const [requests, setRequests] = useState<PublicAccountSummary[]>([]);
  const [requestsError, setRequestsError] = useState(false);
  const [busyRequester, setBusyRequester] = useState<string | null>(null);
  const loadRequests = useCallback(() => {
    const generation = getAccountGeneration();
    let active = true;
    setRequests([]);
    setRequestsError(false);
    getHungryService()
      .social.listFollowRequests()
      .then((items) => {
        if (active && generation === getAccountGeneration()) setRequests(items);
      })
      .catch(() => {
        if (active && generation === getAccountGeneration()) setRequestsError(true);
      });
    return () => {
      active = false;
    };
  }, [requestSubject]);
  useFocusEffect(loadRequests);
  const respond = async (requesterId: string, decision: "approved" | "rejected") => {
    if (busyRequester) return;
    const generation = getAccountGeneration();
    setBusyRequester(requesterId);
    try {
      await getHungryService().social.respondToFollowRequest(requesterId, decision);
      if (generation !== getAccountGeneration()) return;
      setRequests((items) => items.filter((item) => item.userId !== requesterId));
    } catch {
      Alert.alert("Request not updated", "Please try again.");
    } finally {
      if (generation === getAccountGeneration()) setBusyRequester(null);
    }
  };

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
      {requestsError ? (
        <EmptyState
          title="Follow requests unavailable"
          body="Your requests could not be loaded."
          ctaLabel="Retry"
          onPress={loadRequests}
        />
      ) : null}
      {requests.map((request) => (
        <View key={request.userId} style={{ gap: spacing[2] }}>
          <AppText variant="bodyBold">{request.displayName} requested to follow you</AppText>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            {(["approved", "rejected"] as const).map((decision) => (
              <Pressable
                key={decision}
                accessibilityRole="button"
                accessibilityLabel={`${decision === "approved" ? "Accept" : "Decline"} ${request.displayName}'s follow request`}
                accessibilityState={{
                  disabled: Boolean(busyRequester),
                  busy: busyRequester === request.userId,
                }}
                disabled={Boolean(busyRequester)}
                onPress={() => void respond(request.userId, decision)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <AppText>{decision === "approved" ? "Accept" : "Decline"}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {activityError ? (
        <EmptyState
          title="Activity refresh failed"
          body={activityError}
          ctaLabel="Retry"
          onPress={() => void fetchActivityEvents()}
        />
      ) : null}
      {updates.map((update) => {
        const post = repository
          .listStallPosts()
          .find((candidate) => candidate.id === update.postId);
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
            accessibilityLabel={`Open update for ${update.target}`}
            onPress={() => {
              if (update.kind === "follow" && update.actorId) {
                markActivityRead("update", update.id);
                navigation.navigate("UserProfile", {
                  authorId: update.actorId,
                  authorName: update.actorName,
                });
              } else if (update.postId) {
                navigation.navigate("ActivityPostDetail", {
                  postId: update.postId,
                  updateId: update.id,
                });
              } else {
                Alert.alert("Update unavailable", "This activity has no supported destination.");
              }
            }}
            style={[stylesInline.updateRow, { gap: spacing[3] }]}
          >
            <View style={[stylesInline.kindBadge, { backgroundColor: palette.bgSoft }]}>
              {update.kind === "like" ? (
                <Heart color={kindColor} size={20} />
              ) : update.kind === "share" ? (
                <Share2 color={kindColor} size={20} />
              ) : update.kind === "submission" ? (
                <Store color={kindColor} size={20} />
              ) : (
                <MessageCircleMore color={kindColor} size={20} />
              )}
            </View>
            <View style={{ flex: 1, gap: spacing[1] }}>
              <View style={stylesInline.rowBetween}>
                <AppText variant="bodySmallBold">{update.actorName}</AppText>
                <AppText variant="micro" tone="secondary">
                  {update.time}
                </AppText>
              </View>
              <AppText variant="bodySmall" tone="secondary" style={stylesInline.updateText}>
                {update.text}
              </AppText>
              <AppText variant="micro" tone="secondary" numberOfLines={1}>
                {update.target}
              </AppText>
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
