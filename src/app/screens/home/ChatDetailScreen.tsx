import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Send } from "lucide-react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ChatMessage } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

function appendUniqueMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (messages.some((candidate) => candidate.id === message.id)) return messages;
  return [...messages, message];
}

function formatChatTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export function ChatDetailScreen({ navigation, route }: Props) {
  const safeParams = route.params ?? {};
  const {
    chatId: rawChatId,
    name: rawName,
    avatar: rawAvatar,
    isOnline: initialIsOnline,
  } = safeParams as Partial<Props["route"]["params"]>;
  const { palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const chatId =
    typeof rawChatId === "string" && rawChatId.trim()
      ? rawChatId.trim()
      : typeof rawChatId === "number"
        ? String(rawChatId).trim()
        : "";
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "Conversation";
  const avatar = typeof rawAvatar === "string" && rawAvatar.trim() ? rawAvatar.trim() : "";
  const isOnline = typeof initialIsOnline === "boolean" ? initialIsOnline : false;
  const hasValidChatTarget = Boolean(chatId);

  const styles = useMemo(
    () => createStyles({ palette, spacing, semanticSpacing, radii }),
    [palette, spacing, semanticSpacing, radii],
  );

  useEffect(() => {
    if (!hasValidChatTarget) {
      setIsLoading(false);
      return undefined;
    }

    let isActive = true;
    const service = getHungryService().chat;

    setIsLoading(true);
    setLoadError(null);
    service
      .listMessages(chatId)
      .then((loadedMessages) => {
        if (!isActive) return;
        setMessages(loadedMessages);
        void service.markConversationRead(chatId);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : "This chat could not be loaded.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    const subscription = service.subscribeToConversation(chatId, {
      onMessage: (incomingMessage) => {
        setMessages((current) => appendUniqueMessage(current, incomingMessage));
        if (!incomingMessage.sentByCurrentUser) {
          void service.markConversationRead(chatId);
        }
      },
      onReadReceipt: (messageId, readAt) => {
        setMessages((current) =>
          current.map((item) => (item.id === messageId ? { ...item, readAt } : item)),
        );
      },
      onError: () => {
        setLoadError(
          "Realtime updates are unavailable. Pull back and reopen this chat to refresh.",
        );
      },
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [chatId, hasValidChatTarget]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || isSending || !hasValidChatTarget) return;

    setIsSending(true);
    try {
      const sentMessage = await getHungryService().chat.sendMessage({
        conversationId: chatId,
        body: text,
      });
      setMessages((current) => appendUniqueMessage(current, sentMessage));
      setMessage("");
    } catch {
      Alert.alert("Message not sent", "Please check your connection and try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (!hasValidChatTarget) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to activity"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <ChevronLeft color={palette.text} size={28} />
          </Pressable>
          <View style={styles.userInfo}>
            <AppText variant="bodyBold">Chat unavailable</AppText>
          </View>
        </View>
        <View style={styles.unavailableContainer}>
          <AppText variant="body" tone="muted">
            This chat could not be loaded.
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to activity"
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft color={palette.text} size={28} />
        </Pressable>

        <View style={styles.userInfo}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={[styles.avatar, { borderRadius: radii.pill }]} />
          ) : (
            <View style={[styles.avatarFallback, { borderRadius: radii.pill }]}>
              <AppText variant="bodySmallBold">{name.slice(0, 1).toUpperCase()}</AppText>
            </View>
          )}
          <View>
            <AppText variant="bodyBold">{name}</AppText>
            {isOnline ? (
              <AppText variant="micro" tone="success">
                Online
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.chatContent}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: semanticSpacing.screenEdge,
              paddingBottom: 120,
              gap: spacing[3],
            }}
            showsVerticalScrollIndicator={false}
            style={styles.messageList}
          >
            {isLoading ? (
              <View style={styles.unavailableContainer}>
                <AppText variant="body" tone="muted">
                  Loading messages...
                </AppText>
              </View>
            ) : null}
            {!isLoading && loadError ? (
              <View style={styles.unavailableContainer}>
                <AppText variant="body" tone="muted">
                  {loadError}
                </AppText>
              </View>
            ) : null}
            {!isLoading && !loadError && messages.length === 0 ? (
              <View style={styles.unavailableContainer}>
                <AppText variant="body" tone="muted">
                  Start with a text message.
                </AppText>
              </View>
            ) : null}
            {messages.map((msg) => (
              <Animated.View
                key={msg.id}
                entering={FadeIn.delay(80)}
                style={[
                  styles.messageBubble,
                  {
                    alignSelf: msg.sentByCurrentUser ? "flex-end" : "flex-start",
                    backgroundColor: msg.sentByCurrentUser ? palette.orange : palette.surface,
                    borderRadius: radii.md,
                    borderBottomRightRadius: msg.sentByCurrentUser ? 2 : radii.md,
                    borderBottomLeftRadius: msg.sentByCurrentUser ? radii.md : 2,
                  },
                ]}
              >
                <AppText style={{ color: msg.sentByCurrentUser ? palette.white : palette.text }}>
                  {msg.body}
                </AppText>
                <AppText
                  variant="micro"
                  style={{
                    alignSelf: msg.sentByCurrentUser ? "flex-end" : "flex-start",
                    color: msg.sentByCurrentUser ? "rgba(255,255,255,0.72)" : palette.textMuted,
                    marginTop: spacing[1],
                  }}
                >
                  {formatChatTime(msg.createdAt)}
                  {msg.sentByCurrentUser && msg.readAt ? " · Read" : ""}
                </AppText>
              </Animated.View>
            ))}
          </ScrollView>

          <View
            style={[
              styles.inputContainer,
              { borderTopColor: palette.border, paddingBottom: insets.bottom },
            ]}
          >
            <View style={styles.composerCopy}>
              <AppText variant="micro" tone="muted">
                Text messages only for now.
              </AppText>
            </View>
            <View style={styles.textInputContainer}>
              <TextInput
                placeholder="Type a message..."
                value={message}
                onChangeText={setMessage}
                editable={!isSending}
                style={styles.textInput}
                placeholderTextColor={palette.textMuted}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !message.trim() || isSending }}
              onPress={sendMessage}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: message.trim() && !isSending ? palette.orange : palette.bgSoft,
                },
              ]}
            >
              <Send
                color={message.trim() && !isSending ? palette.white : palette.textMuted}
                size={20}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = ({
  palette,
  spacing,
  semanticSpacing,
  radii,
}: Pick<ReturnType<typeof useHungryTheme>, "palette" | "spacing" | "semanticSpacing" | "radii">) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: semanticSpacing.screenEdge,
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
    },
    backBtn: {
      marginRight: spacing[3],
    },
    userInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[3],
    },
    avatar: {
      width: 40,
      height: 40,
    },
    avatarFallback: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.bgSoft,
    },
    chatContent: {
      flex: 1,
    },
    messageList: {
      flex: 1,
    },
    unavailableContainer: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      padding: semanticSpacing.screenEdge,
    },
    messageBubble: {
      maxWidth: "80%",
      paddingHorizontal: semanticSpacing.screenEdge,
      paddingVertical: spacing[2.5],
      shadowColor: palette.text,
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 1,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: semanticSpacing.screenEdge,
      paddingTop: spacing[3],
      gap: spacing[3],
      borderTopWidth: 1,
      backgroundColor: palette.bg,
    },
    composerCopy: {
      position: "absolute",
      left: semanticSpacing.screenEdge,
      top: spacing[0.5],
    },
    textInputContainer: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: radii.md,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing[3],
      backgroundColor: palette.surface,
      marginTop: spacing[3],
    },
    textInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      color: palette.text,
      paddingVertical: spacing[3],
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing[3],
    },
  });
