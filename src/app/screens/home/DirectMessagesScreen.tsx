import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Search, Edit3, MessageCircle } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { AppText, Input, Screen } from "@/components/ui";
import { useHungryTheme } from "@/theme";

const MOCK_CHATS = [
  { id: "1", name: "Ahmad", lastMessage: "That chicken rice was amazing!", time: "2m", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop" },
  { id: "2", name: "Sarah", lastMessage: "Are we still on for Maxwell later?", time: "1h", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop" },
  { id: "3", name: "Uncle Tan", lastMessage: "The laksa here is very spicy ah.", time: "3h", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop" },
  { id: "4", name: "Wei Ling", lastMessage: "Check out this new stall I found!", time: "5h", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop" },
];

export function DirectMessagesScreen() {
  const navigation = useNavigation();
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top"]}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[3], paddingVertical: spacing[3] }}>
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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing[3], gap: spacing[4] }}>
          {MOCK_CHATS.map((chat) => (
            <View
              key={chat.id} 
              style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}
            >
              <Image source={{ uri: chat.avatar }} style={{ width: 56, height: 56, borderRadius: radii.pill }} />
              <View style={{ flex: 1, gap: spacing[1] }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText variant="bodyBold">{chat.name}</AppText>
                  <AppText variant="micro" tone="secondary">{chat.time}</AppText>
                </View>
                <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                  {chat.lastMessage}
                </AppText>
              </View>
            </View>
          ))}

          {MOCK_CHATS.length === 0 && (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: spacing[12] }}>
              <MessageCircle size={48} color={palette.textMuted} style={{ marginBottom: spacing[4] }} />
              <AppText tone="secondary">No messages yet.</AppText>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
