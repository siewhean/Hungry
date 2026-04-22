import React from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

import { Plus, UtensilsCrossed } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

interface StoryItem {
  id: string;
  name: string;
  avatarUrl: string;
  hasUnseen?: boolean;
  isStallAccount?: boolean;
  isCurrentUser?: boolean;
}

const MOCK_STORIES: StoryItem[] = [
  {
    id: "s1",
    name: "Your Story",
    avatarUrl: "https://i.pravatar.cc/150?u=me",
    hasUnseen: false,
    isCurrentUser: true,
  },
  {
    id: "s2",
    name: "Tian Tian",
    avatarUrl:
      "https://images.unsplash.com/photo-1591814441349-7ed4299c1cc2?auto=format&fit=crop&q=80&w=150",
    hasUnseen: true,
    isStallAccount: true,
  },
  { id: "s3", name: "Sarah L.", avatarUrl: "https://i.pravatar.cc/150?u=sl", hasUnseen: true },
  {
    id: "s4",
    name: "Han Kee",
    avatarUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=150",
    hasUnseen: true,
    isStallAccount: true,
  },
  { id: "s5", name: "Emma W.", avatarUrl: "https://i.pravatar.cc/150?u=ew", hasUnseen: false },
  { id: "s6", name: "Ahmad J.", avatarUrl: "https://i.pravatar.cc/150?u=aj", hasUnseen: false },
];

export function CircleStoryCarousel() {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[4] }}
    >
      {MOCK_STORIES.map((story) => (
        <Pressable key={story.id} style={styles.item}>
          <View style={{ position: "relative" }}>
            {story.hasUnseen ? (
              <LinearGradient
                colors={
                  story.isStallAccount
                    ? [palette.orange, palette.amber]
                    : [palette.textSecondary, palette.border]
                }
                style={[styles.ring, { borderRadius: radii.pill, padding: 3 }]}
              >
                <View
                  style={[
                    styles.avatarWrap,
                    { backgroundColor: palette.bg, borderRadius: radii.pill },
                  ]}
                >
                  <Image
                    source={{ uri: story.avatarUrl }}
                    style={[styles.avatar, { borderRadius: radii.pill }]}
                  />
                </View>
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.ring,
                  { borderColor: palette.border, borderRadius: radii.pill, padding: 3 },
                ]}
              >
                <View
                  style={[
                    styles.avatarWrap,
                    { backgroundColor: palette.bg, borderRadius: radii.pill },
                  ]}
                >
                  <Image
                    source={{ uri: story.avatarUrl }}
                    style={[styles.avatar, { borderRadius: radii.pill }]}
                  />
                </View>
              </View>
            )}

            {story.isCurrentUser && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: palette.orange,
                    borderColor: palette.bg,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <Plus color={palette.white} size={12} strokeWidth={3} />
              </View>
            )}

            {story.isStallAccount && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: palette.orange,
                    borderColor: palette.bg,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <UtensilsCrossed color={palette.white} size={10} strokeWidth={2.5} />
              </View>
            )}
          </View>
          <AppText variant="micro" numberOfLines={1} style={styles.label}>
            {story.name}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    gap: 6,
    width: 72,
  },
  ring: {
    padding: 2,
    borderWidth: 2,
    borderColor: "transparent", // For the non-unseen state fallback
  },
  avatarWrap: {
    padding: 2,
  },
  avatar: {
    width: 64,
    height: 64,
  },
  badge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    borderWidth: 2,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    textAlign: "center",
    width: "100%",
  },
});
