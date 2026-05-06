import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { ChevronLeft, Heart, MessageCircle } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppHeader, AppText, EmptyState, IconButton } from "@/components/ui";
import {
  ACTIVITY_MESSAGES,
  ACTIVITY_UPDATES,
  getActivityMessageUnreadCount,
  getActivityReadKey,
  type ActivityUpdate,
  type ActivityUpdateKind,
} from "@/features/home/activity";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useActivityStore } from "@/store/useActivityStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ActivityInbox">;
type ActivityTab = "messages" | "updates";

const TABS: ActivityTab[] = ["messages", "updates"];

export function ActivityInboxScreen({ navigation, route }: Props) {
  const initialTab = route.params?.initialTab ?? "updates";
  const [activeTab, setActiveTab] = useState<ActivityTab>(initialTab);
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const repository = getDataRepository();
  const posts = useMemo(() => repository.listStallPosts(), [repository]);
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
                ? ACTIVITY_MESSAGES.reduce(
                    (total, message) =>
                      total + getActivityMessageUnreadCount(message, readActivityIds),
                    0,
                  )
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
          <MessagesTab navigation={navigation} />
        ) : (
          <UpdatesTab navigation={navigation} updates={allUpdates} />
        )}
      </View>
    </SafeAreaView>
  );
}

function MessagesTab({ navigation }: Pick<Props, "navigation">) {
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const markActivityRead = useActivityStore((state) => state.markActivityRead);
  const sharedPostMessages = useActivityStore((state) => state.sharedPostMessages);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: spacing[4],
          padding: semanticSpacing.screenEdge,
          paddingBottom: spacing[12],
        }}
      >
        {ACTIVITY_MESSAGES.map((chat) => {
          const chatId = typeof chat?.id === "string" ? chat.id.trim() : "";
          const normalizedName = typeof chat?.name === "string" ? chat.name.trim() : "";
          const normalizedAvatar = typeof chat?.avatar === "string" ? chat.avatar.trim() : "";
          const isOnline = typeof chat?.isOnline === "boolean" ? chat.isOnline : undefined;

          if (!chatId || !normalizedName || !normalizedAvatar) {
            return null;
          }

          const unreadCount = getActivityMessageUnreadCount(chat, readActivityIds);
          const chatSharedMessages = sharedPostMessages[chatId] ?? [];
          const latestSharedPost = chatSharedMessages[chatSharedMessages.length - 1];
          const lastMessage = latestSharedPost?.sharedPost
            ? `Shared a post: ${latestSharedPost.sharedPost.title}`
            : chat.lastMessage;
          const time = latestSharedPost?.createdAt ?? chat.time;

          return (
            <Pressable
              key={chat.id}
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${chat.name}`}
              onPress={() => {
                if (!chatId || !normalizedName || !normalizedAvatar) {
                  return;
                }

                try {
                  markActivityRead("message", chatId);
                  navigation.navigate("ChatDetail", {
                    chatId,
                    name: normalizedName,
                    avatar: normalizedAvatar,
                    isOnline,
                  });
                } catch {
                  Alert.alert("Could not open chat", "Please try again in a moment.");
                }
              }}
              style={[stylesInline.messageRow, { gap: spacing[3] }]}
            >
              <View style={stylesInline.messageAvatarSlot}>
                <Image
                  source={{ uri: chat.avatar }}
                  style={{ width: 56, height: 56, borderRadius: radii.pill }}
                />
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
                  <AppText variant="bodyBold">{chat.name}</AppText>
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

        {ACTIVITY_MESSAGES.length === 0 ? (
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
        padding: semanticSpacing.screenEdge,
        paddingBottom: spacing[12],
      }}
    >
      {updates.map((update) => {
        const Icon = getUpdateIcon(update.kind);
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
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.bgSoft,
                borderRadius: radii.pill,
                height: 44,
                justifyContent: "center",
                width: 44,
              }}
            >
              <Icon color={kindColor} size={20} />
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

function getUpdateIcon(kind: ActivityUpdateKind) {
  if (kind === "like") return Heart;
  return MessageCircle;
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
