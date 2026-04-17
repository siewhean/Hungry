import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Send, Phone, Video } from "lucide-react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Input } from "@/components/ui";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

export function ChatDetailScreen({ navigation, route }: Props) {
  const { name, avatar } = route.params;
  const { palette, spacing, radii } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");

  const MOCK_MESSAGES = [
    { id: "1", text: "Hey! Have you tried the new laksa stall at Maxwell?", sent: false },
    { id: "2", text: "Not yet, is it good?", sent: true },
    { id: "3", text: "Amazing! You have to try the extra cockles.", sent: false },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={palette.text} size={28} />
        </Pressable>

        <View style={styles.userInfo}>
          <Animated.View>
            <Image source={{ uri: avatar }} style={[styles.avatar, { borderRadius: radii.pill }]} />
          </Animated.View>
          <View>
            <AppText variant="bodyBold">{name}</AppText>
            <AppText variant="micro" tone="success">
              Online
            </AppText>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Phone color={palette.text} size={20} />
          <Video color={palette.text} size={22} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}
          showsVerticalScrollIndicator={false}
        >
          {MOCK_MESSAGES.map((msg) => (
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
              <AppText style={{ color: msg.sent ? palette.white : palette.text }}>
                {msg.text}
              </AppText>
            </Animated.View>
          ))}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + spacing[2] }]}>
          <Input
            placeholder="Type a message..."
            value={message}
            onChangeText={setMessage}
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={() => setMessage("")}
            style={[styles.sendBtn, { backgroundColor: palette.orange }]}
          >
            <Send color={palette.white} size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  inputRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    alignItems: "center",
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
