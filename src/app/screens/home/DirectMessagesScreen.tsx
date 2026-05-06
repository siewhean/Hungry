import { Alert, View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Search, Edit3, MessageCircle } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";

import { AppText, Input } from "@/components/ui";
import { ACTIVITY_MESSAGES } from "@/features/home/activity";
import { useHungryTheme } from "@/theme";

export function DirectMessagesScreen() {
  const navigation = useNavigation<any>();
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <View style={{ flex: 1 }}>
        {/* Header */}
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
          <View style={{ width: 24, height: 24 }}>
            <Edit3 color={palette.text} size={24} />
          </View>
        </View>

        {/* Search */}
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
          {ACTIVITY_MESSAGES.map((chat) =>
            !chat?.id || !chat?.name || !chat?.avatar ? null : (
              <Pressable
                key={chat.id}
                onPress={() => {
                  const chatId = String(chat.id).trim();
                  const name = typeof chat?.name === "string" ? chat.name.trim() : "";
                  const avatar = typeof chat?.avatar === "string" ? chat.avatar.trim() : "";
                  const isOnline = typeof chat?.isOnline === "boolean" ? chat.isOnline : undefined;

                  if (!chatId || !name || !avatar) {
                    return;
                  }

                  try {
                    navigation.navigate("ChatDetail", {
                      chatId,
                      name,
                      avatar,
                      isOnline,
                    });
                  } catch {
                    Alert.alert("Could not open chat", "Please try again in a moment.");
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                }}
              >
                <Animated.View>
                  <Image
                    source={{ uri: chat.avatar }}
                    style={{ width: 56, height: 56, borderRadius: radii.pill }}
                  />
                </Animated.View>
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText variant="bodyBold">{chat.name}</AppText>
                    <AppText variant="micro" tone="secondary">
                      {chat.time}
                    </AppText>
                  </View>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {chat.lastMessage}
                  </AppText>
                </View>
              </Pressable>
            ),
          )}

          {ACTIVITY_MESSAGES.length === 0 && (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: spacing[12],
              }}
            >
              <MessageCircle
                size={48}
                color={palette.textMuted}
                style={{ marginBottom: spacing[4] }}
              />
              <AppText tone="secondary">No messages yet.</AppText>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
