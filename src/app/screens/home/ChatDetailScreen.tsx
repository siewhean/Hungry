import {
  promptContentSafetyActions,
  useCommunitySafetyRevision,
  isContentHiddenForSession,
} from "@/lib/security/communitySafety";
import { mergeChatMessages } from "@/features/home/socialState";
import { useChatDraftStore } from "@/store/useChatDraftStore";
import { useProfileStore } from "@/store/useProfileStore";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import Animated, { FadeIn } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AccessibleImage, AppText, EmptyState } from "@/components/ui";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ChatMessage, ChatParticipant } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

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
  const { componentRadii, palette, spacing, semanticSpacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();

  const safetyRevision = useCommunitySafetyRevision();
  const [otherParticipant, setOtherParticipant] = useState<ChatParticipant | undefined>();
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
  useEffect(() => {
    if (
      otherParticipant?.userId &&
      isContentHiddenForSession({ id: "", authorId: otherParticipant.userId })
    )
      navigation.goBack();
  }, [otherParticipant, safetyRevision, navigation]);
  const accountId = useProfileStore((state) => state.profile.id);
  const draftKey = `${accountId}:${chatId}`;
  const currentScope = useRef(draftKey);
  const scopeGeneration = useRef(0);
  if (currentScope.current !== draftKey) {
    currentScope.current = draftKey;
    scopeGeneration.current++;
  }
  const [messagesScope, setMessagesScope] = useState(draftKey);
  const visibleMessages = messagesScope === draftKey ? messages : [];

  const message = useChatDraftStore((state) => state.drafts[draftKey]?.text ?? "");
  const setMessage = (text: string) => useChatDraftStore.getState().setDraft(draftKey, text);
  const [refresh, setRefresh] = useState(0);
  const [readError, setReadError] = useState(false);

  const styles = useMemo(
    () => createStyles({ componentRadii, palette, spacing, semanticSpacing, radii }),
    [componentRadii, palette, spacing, semanticSpacing, radii],
  );

  useEffect(() => {
    if (!hasValidChatTarget) {
      setIsLoading(false);
      return undefined;
    }

    let isActive = true;
    const service = getHungryService().chat;
    const acknowledge = () =>
      service.markConversationRead(chatId).catch(() => {
        if (isActive) setReadError(true);
      });

    setMessagesScope(draftKey);
    setMessages([]);
    setReadError(false);
    setIsSending(false);
    setIsLoading(true);
    setLoadError(null);
    setOtherParticipant(undefined);
    service
      .listConversations()
      .then((items) => {
        if (isActive)
          setOtherParticipant(
            items
              .find((item) => item.id === chatId)
              ?.participants.find((item) => !item.isCurrentUser),
          );
      })
      .catch(() => {
        /* Message loading and retry remain available without optional header context. */
      });
    service
      .listMessages(chatId)
      .then((loadedMessages) => {
        if (!isActive) return;
        setMessages((current) => mergeChatMessages(loadedMessages, current));
        void acknowledge();
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
        if (!isActive) return;
        setMessages((current) => mergeChatMessages(current, [incomingMessage]));
        if (!incomingMessage.sentByCurrentUser) {
          void acknowledge();
        }
      },
      onReadReceipt: (messageId, readAt) => {
        if (!isActive) return;
        setMessages((current) =>
          current.map((item) => (item.id === messageId ? { ...item, readAt } : item)),
        );
      },
      onError: () => {
        if (!isActive) return;
        setLoadError(
          "Realtime updates are unavailable. Pull back and reopen this chat to refresh.",
        );
      },
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [chatId, hasValidChatTarget, accountId, refresh]);

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || isSending || !hasValidChatTarget) return;

    const generation = scopeGeneration.current;
    const isCurrent = () =>
      generation === scopeGeneration.current &&
      currentScope.current === draftKey &&
      useProfileStore.getState().profile.id === accountId;
    setIsSending(true);
    try {
      const sentMessage = await getHungryService().chat.sendMessage({
        conversationId: chatId,
        body: text,
        clientNonce: useChatDraftStore.getState().getNonce(draftKey),
      });
      if (!isCurrent()) return;
      setMessages((current) => mergeChatMessages(current, [sentMessage]));
      useChatDraftStore.getState().clearDraft(draftKey, text);
    } catch {
      if (!isCurrent()) return;
      Alert.alert("Message not sent", "Please check your connection and try again.");
    } finally {
      if (isCurrent()) setIsSending(false);
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
        <EmptyState
          title="Chat unavailable"
          body="This chat could not be loaded."
          errorMessage="Unable to resolve chat target. The chat may have been removed."
          sendErrorContext="Chat detail"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      testID="chat-detail-screen"
      style={{ flex: 1, backgroundColor: palette.bg }}
      edges={["top"]}
    >
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
            <AccessibleImage
              source={{ uri: avatar }}
              style={[styles.avatar, { borderRadius: radii.pill }]}
              accessibilityLabel={`Avatar for ${name}`}
            />
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
        {otherParticipant?.userId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${otherParticipant.displayName}`}
            onPress={() =>
              promptContentSafetyActions({
                targetType: "profile",
                targetId: otherParticipant.userId!,
                authorId: otherParticipant.userId,
                authorName: otherParticipant.displayName,
                label: "conversation author",
                onBlocked: () => navigation.goBack(),
              })
            }
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <AppText>Safety</AppText>
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.chatContent}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            testID="chat-message-list"
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
              <EmptyState
                title="Unable to load messages"
                body="There was a problem loading this chat."
                errorMessage={loadError}
                sendErrorContext={`Chat ${name}`}
                ctaLabel="Retry"
                onPress={() => setRefresh((value) => value + 1)}
              />
            ) : null}
            {!isLoading && !loadError && visibleMessages.length === 0 ? (
              <View style={styles.unavailableContainer}>
                <AppText variant="body" tone="muted">
                  Start with a text message.
                </AppText>
              </View>
            ) : null}
            {readError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry read acknowledgement"
                onPress={() => {
                  void getHungryService()
                    .chat.markConversationRead(chatId)
                    .then(() => setReadError(false))
                    .catch(() => setReadError(true));
                }}
              >
                <AppText variant="bodySmall">
                  Messages are visible, but could not be marked read. Retry
                </AppText>
              </Pressable>
            ) : null}
            {visibleMessages.map((msg) => (
              <Animated.View
                key={msg.id}
                entering={FadeIn.delay(80)}
                testID={msg.sentByCurrentUser ? "chat-message-sent" : "chat-message-received"}
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
                    color: msg.sentByCurrentUser ? palette.inverseTextMuted : palette.textMuted,
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
            <View testID="chat-text-only-copy" style={styles.composerCopy}>
              <AppText variant="micro" tone="muted">
                Text messages only for now.
              </AppText>
            </View>
            <View style={styles.textInputContainer}>
              <TextInput
                accessibilityLabel="Message input"
                testID="chat-message-input"
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
              accessibilityState={{ disabled: !message.trim() || isSending, busy: isSending }}
              disabled={!message.trim() || isSending}
              onPress={sendMessage}
              testID="chat-send-message"
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
  componentRadii,
  palette,
  spacing,
  semanticSpacing,
  radii,
}: Pick<
  ReturnType<typeof useHungryTheme>,
  "componentRadii" | "palette" | "spacing" | "semanticSpacing" | "radii"
>) =>
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
      minWidth: 44,
      minHeight: 44,
      justifyContent: "center",
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
      borderRadius: componentRadii.iconButton,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing[3],
    },
  });
