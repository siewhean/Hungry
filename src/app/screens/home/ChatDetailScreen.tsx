import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Send, Paperclip, Utensils } from "lucide-react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText } from "@/components/ui";
import {
  ACTIVITY_CHAT_MESSAGES,
  ACTIVITY_MESSAGES,
  type ActivityChatMessage,
  type ActivityMediaAttachment,
} from "@/features/home/activity";
import { useActivityStore } from "@/store/useActivityStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

const EMPTY_MESSAGE_LIST: ActivityChatMessage[] = [];

const sanitizeMessages = (incoming: ActivityChatMessage[]) =>
  incoming
    .filter(
      (item) =>
        Boolean(item?.id) &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        typeof item.sent === "boolean" &&
        typeof item.createdAt === "string",
    )
    .map((item) => ({
      ...item,
      media:
        item.media?.uri && item.media.mediaType
          ? {
              uri: item.media.uri,
              mediaType: item.media.mediaType,
              fileName: item.media.fileName,
              mimeType: item.media.mimeType,
            }
          : undefined,
      sharedPost:
        item.sharedPost?.postId &&
        item.sharedPost?.title &&
        item.sharedPost?.subtitle &&
        item.sharedPost?.imageUrl
          ? item.sharedPost
          : undefined,
    }));

const isSameMessage = (left: ActivityChatMessage, right: ActivityChatMessage) =>
  left.id === right.id &&
  left.text === right.text &&
  left.sent === right.sent &&
  left.createdAt === right.createdAt &&
  left.media?.uri === right.media?.uri &&
  left.media?.mediaType === right.media?.mediaType &&
  left.media?.fileName === right.media?.fileName &&
  left.media?.mimeType === right.media?.mimeType &&
  left.sharedPost?.postId === right.sharedPost?.postId &&
  left.sharedPost?.title === right.sharedPost?.title &&
  left.sharedPost?.subtitle === right.sharedPost?.subtitle &&
  left.sharedPost?.imageUrl === right.sharedPost?.imageUrl;

const isMessageListEqual = (left: ActivityChatMessage[], right: ActivityChatMessage[]) =>
  left.length === right.length && left.every((item, index) => isSameMessage(item, right[index]));

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
  const [pendingMedia, setPendingMedia] = useState<ActivityMediaAttachment | null>(null);
  const markActivityRead = useActivityStore((state) => state.markActivityRead);
  const chatId =
    typeof rawChatId === "string" && rawChatId.trim()
      ? rawChatId.trim()
      : typeof rawChatId === "number"
        ? String(rawChatId).trim()
        : "";
  const resolvedChat = useMemo(
    () => ACTIVITY_MESSAGES.find((message) => message.id === chatId) ?? null,
    [chatId],
  );
  const name =
    typeof rawName === "string" && rawName.trim()
      ? rawName
      : (resolvedChat?.name ?? "Unknown user");
  const avatar =
    typeof rawAvatar === "string" && rawAvatar.trim() ? rawAvatar : (resolvedChat?.avatar ?? "");
  const isOnline = useMemo(() => {
    if (typeof initialIsOnline === "boolean") return initialIsOnline;
    return resolvedChat?.isOnline ?? false;
  }, [chatId, initialIsOnline]);
  const hasValidChatTarget = Boolean(chatId && name && avatar);
  const rawSharedPostMessages = useActivityStore(
    (state) => state.sharedPostMessages[chatId] ?? EMPTY_MESSAGE_LIST,
  );
  const sharedPostMessages = useMemo(
    () =>
      Array.isArray(rawSharedPostMessages)
        ? sanitizeMessages(rawSharedPostMessages)
        : EMPTY_MESSAGE_LIST,
    [rawSharedPostMessages],
  );
  const baseMessages = useMemo(
    () =>
      sanitizeMessages([
        ...((ACTIVITY_CHAT_MESSAGES[chatId] ?? []) as ActivityChatMessage[]),
        ...sharedPostMessages,
      ]),
    [chatId, sharedPostMessages],
  );
  const [messages, setMessages] = useState<ActivityChatMessage[]>(baseMessages);

  const styles = useMemo(
    () => createStyles({ palette, spacing, semanticSpacing, radii }),
    [palette, spacing, semanticSpacing, radii],
  );

  useEffect(() => {
    if (!hasValidChatTarget) {
      return;
    }

    markActivityRead("message", chatId);
  }, [chatId, markActivityRead]);

  useEffect(() => {
    if (!hasValidChatTarget) return;
    setMessages((current) => (isMessageListEqual(current, baseMessages) ? current : baseMessages));
  }, [baseMessages, hasValidChatTarget]);

  const sendMessage = () => {
    const text = message.trim();
    if (!text && !pendingMedia) return;

    const media = pendingMedia
      ? {
          uri: pendingMedia.uri,
          mediaType: pendingMedia.mediaType,
          fileName: pendingMedia.fileName,
          mimeType: pendingMedia.mimeType,
        }
      : undefined;

    const sentMessage: ActivityChatMessage = {
      id: `local-${Date.now()}`,
      text: text || (media ? `Shared ${media.mediaType}` : ""),
      sent: true,
      createdAt: "now",
      media,
    };
    setMessages((current) => [...current, sentMessage]);
    setMessage("");
    setPendingMedia(null);

    setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: `reply-${Date.now()}`,
          text: "Got it. Send me the post if you want me to try it too.",
          sent: false,
          createdAt: "now",
        },
      ]);
    }, 650);
  };

  const openMediaPicker = async (mediaTypes: ("images" | "videos")[]) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission required",
        "Please allow media library access to upload attachments.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.75,
      allowsEditing: false,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return;
    }

    const type = asset.type === "video" ? "video" : "image";
    setPendingMedia({
      uri: asset.uri,
      mediaType: type,
      fileName: asset.fileName ?? undefined,
      mimeType: asset.mimeType ?? undefined,
    });
  };

  const openMediaMenu = () => {
    Alert.alert("Upload media", "Choose media type", [
      { text: "Photo", onPress: () => void openMediaPicker(["images"]) },
      { text: "Video", onPress: () => void openMediaPicker(["videos"]) },
      { text: "Any media", onPress: () => void openMediaPicker(["images", "videos"]) },
      { text: "Cancel", style: "cancel" },
    ]);
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
        <View style={styles.chatContent}>
          <View style={styles.unavailableContainer}>
            <AppText variant="body" tone="muted">
              This chat could not be loaded.
            </AppText>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      {/* Header */}
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
          <Animated.View>
            <Image source={{ uri: avatar }} style={[styles.avatar, { borderRadius: radii.pill }]} />
          </Animated.View>
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
            {messages.map((msg) => (
              <Animated.View
                key={msg.id}
                entering={FadeIn.delay(100)}
                style={[
                  styles.messageBubble,
                  {
                    alignSelf: msg.sent ? "flex-end" : "flex-start",
                    backgroundColor: msg.sent ? palette.orange : palette.surface,
                    borderRadius: radii.md,
                    borderBottomRightRadius: msg.sent ? 2 : radii.md,
                    borderBottomLeftRadius: msg.sent ? radii.md : 2,
                  },
                ]}
              >
                {msg.sharedPost ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open shared post ${msg.sharedPost.title}`}
                    onPress={() => {
                      if (!msg.sharedPost?.postId) return;
                      navigation.navigate("ActivityPostDetail", { postId: msg.sharedPost!.postId });
                    }}
                    style={[
                      styles.sharedPostCard,
                      {
                        backgroundColor: msg.sent ? "rgba(255,255,255,0.16)" : palette.bgSoft,
                        borderColor: msg.sent ? "rgba(255,255,255,0.28)" : palette.border,
                        borderRadius: radii.md,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: msg.sharedPost.imageUrl }}
                      style={[styles.sharedPostImage, { borderRadius: radii.sm }]}
                    />
                    <View style={{ flex: 1, gap: spacing[0.5] }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
                        <Utensils color={msg.sent ? palette.white : palette.orange} size={13} />
                        <AppText
                          variant="micro"
                          style={{
                            color: msg.sent ? "rgba(255,255,255,0.78)" : palette.orange,
                            fontWeight: "900",
                          }}
                        >
                          POST
                        </AppText>
                      </View>
                      <AppText
                        variant="bodySmallBold"
                        numberOfLines={1}
                        style={{ color: msg.sent ? palette.white : palette.text }}
                      >
                        {msg.sharedPost.title}
                      </AppText>
                      <AppText
                        variant="micro"
                        numberOfLines={1}
                        style={{ color: msg.sent ? "rgba(255,255,255,0.78)" : palette.textMuted }}
                      >
                        {msg.sharedPost.subtitle}
                      </AppText>
                    </View>
                  </Pressable>
                ) : null}
                {msg.media ? (
                  <View style={styles.mediaAttachment}>
                    {msg.media.mediaType === "image" ? (
                      <Image
                        source={{ uri: msg.media.uri }}
                        style={[styles.attachmentImage, { borderRadius: radii.sm }]}
                      />
                    ) : (
                      <View style={styles.videoAttachment}>
                        <AppText
                          variant="bodySmall"
                          style={{ color: msg.sent ? palette.white : palette.text }}
                        >
                          🎞️ Video attachment
                        </AppText>
                      </View>
                    )}
                    {msg.text && msg.text !== `Shared ${msg.media.mediaType}` ? (
                      <AppText style={{ color: msg.sent ? palette.white : palette.text }}>
                        {msg.text}
                      </AppText>
                    ) : null}
                  </View>
                ) : (
                  <AppText style={{ color: msg.sent ? palette.white : palette.text }}>
                    {msg.text}
                  </AppText>
                )}
                <AppText
                  variant="micro"
                  style={{
                    alignSelf: msg.sent ? "flex-end" : "flex-start",
                    color: msg.sent ? "rgba(255,255,255,0.72)" : palette.textMuted,
                    marginTop: spacing[1],
                  }}
                >
                  {msg.createdAt}
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
            {pendingMedia ? (
              <View style={styles.pendingMediaPreview}>
                <AppText variant="micro" numberOfLines={1}>
                  {pendingMedia.mediaType === "image" ? "📷 Image" : "🎞️ Video"} ready
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached media"
                  onPress={() => setPendingMedia(null)}
                >
                  <AppText variant="micro" tone="muted">
                    Remove
                  </AppText>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.textInputContainer}>
              <TextInput
                placeholder="Type a message..."
                value={message}
                onChangeText={setMessage}
                style={styles.textInput}
                placeholderTextColor={palette.textMuted}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upload media"
                onPress={openMediaMenu}
                style={styles.mediaIconButton}
              >
                <Paperclip color={palette.textMuted} size={20} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={sendMessage}
              style={[styles.sendBtn, { backgroundColor: palette.orange }]}
            >
              <Send color={palette.white} size={20} />
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
    messageBubble: {
      maxWidth: "80%",
      paddingHorizontal: semanticSpacing.screenEdge,
      paddingVertical: spacing[2.5],
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 1,
    },
    mediaAttachment: {
      gap: spacing[2],
      width: "100%",
    },
    attachmentImage: {
      height: 130,
      width: "100%",
      minHeight: 130,
      minWidth: "100%",
    },
    videoAttachment: {
      height: 72,
      width: "100%",
      borderWidth: 1,
      borderRadius: radii.md,
      borderColor: "rgba(255,255,255,0.3)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing[2],
    },
    sharedPostCard: {
      alignItems: "center",
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[2],
      minWidth: 250,
      padding: spacing[2],
    },
    sharedPostImage: {
      height: 58,
      width: 58,
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
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: semanticSpacing.screenEdge,
      paddingTop: spacing[3],
      gap: spacing[3],
      borderTopWidth: 1,
      backgroundColor: palette.bg,
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
      paddingHorizontal: spacing[2],
      backgroundColor: palette.surface,
    },
    textInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      color: palette.text,
      paddingVertical: spacing[3],
    },
    mediaIconButton: {
      minWidth: 36,
      minHeight: 36,
      marginLeft: spacing[1],
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 2,
    },
    pendingMediaPreview: {
      position: "absolute",
      left: semanticSpacing.screenEdge,
      right: semanticSpacing.screenEdge,
      top: -44,
      backgroundColor: palette.bgSoft,
      borderWidth: 1,
      borderRadius: radii.md,
      borderColor: palette.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      gap: spacing[2],
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderRadius: radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
  });
