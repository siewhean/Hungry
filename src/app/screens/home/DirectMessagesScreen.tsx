import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Search } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { Image } from "expo-image";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState, Input } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ChatConversation } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

function formatDirectMessageTime(value?: string): string {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export function DirectMessagesScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { palette, spacing, radii } = useHungryTheme();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setLoadError(null);
    getHungryService()
      .chat.listConversations()
      .then((loadedConversations) => {
        if (!isActive) return;
        setConversations(loadedConversations);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : "Messages could not be loaded.");
        setConversations([]);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color={palette.text} size={28} />
          </Pressable>
          <AppText variant="h2">Messages</AppText>
          <View style={{ width: 28 }} />
        </View>

        <View style={{ paddingHorizontal: spacing[3], marginBottom: spacing[4] }}>
          <Input
            placeholder="Search messages..."
            leftIcon={<Search color={palette.textMuted} size={18} />}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[3],
            gap: spacing[4],
          }}
        >
          {isLoading ? (
            <EmptyState title="Loading messages" body="Fetching conversations..." />
          ) : null}
          {!isLoading && loadError ? (
            <EmptyState
              title="Messages unavailable"
              body="Unable to load your conversations."
              errorMessage={loadError}
              sendErrorContext="Direct messages screen"
            />
          ) : null}
          {!isLoading &&
            !loadError &&
            conversations.map((chat) => {
              const chatId = chat.id.trim();
              const name = chat.title.trim();
              const avatar = chat.avatarUrl?.trim() ?? "";
              if (!chatId || !name) return null;
              return (
                <Pressable
                  key={chatId}
                  accessibilityRole="button"
                  accessibilityLabel={`Open chat with ${name}`}
                  onPress={() => {
                    void getHungryService().chat.markConversationRead(chatId);
                    navigation.navigate("ChatDetail", {
                      chatId,
                      name,
                      avatar,
                      isOnline: chat.isOnline,
                    });
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[3],
                  }}
                >
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={{ width: 56, height: 56, borderRadius: radii.pill }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radii.pill,
                        backgroundColor: palette.bgSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AppText variant="bodySmallBold">{name.slice(0, 1)}</AppText>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <AppText variant="bodyBold">{name}</AppText>
                      <AppText variant="micro" tone="secondary">
                        {formatDirectMessageTime(chat.lastMessageAt)}
                      </AppText>
                    </View>
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                      {chat.lastMessage ?? "No messages yet"}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}

          {!isLoading && !loadError && conversations.length === 0 ? (
            <EmptyState
              title="No messages yet"
              body="Chats will appear here once you start messaging."
            />
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
