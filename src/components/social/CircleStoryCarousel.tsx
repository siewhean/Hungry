import React from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";

interface StoryItem {
  id: string;
  name: string;
  avatarUrl: string;
  hasUnseen?: boolean;
}

const MOCK_STORIES: StoryItem[] = [
  { id: "s1", name: "Your Story", avatarUrl: "https://i.pravatar.cc/150?u=me", hasUnseen: false },
  { id: "s2", name: "Wei Ming", avatarUrl: "https://i.pravatar.cc/150?u=wm", hasUnseen: true },
  { id: "s3", name: "Sarah L.", avatarUrl: "https://i.pravatar.cc/150?u=sl", hasUnseen: true },
  { id: "s4", name: "Uncle Tan", avatarUrl: "https://i.pravatar.cc/150?u=ut", hasUnseen: true },
  { id: "s5", name: "Emma W.", avatarUrl: "https://i.pravatar.cc/150?u=ew", hasUnseen: true },
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
          <View
            style={[
              styles.ring,
              {
                borderColor: story.hasUnseen ? palette.orange : palette.border,
                borderRadius: radii.pill,
              },
            ]}
          >
            <View
              style={[styles.avatarWrap, { backgroundColor: palette.bg, borderRadius: radii.pill }]}
            >
              <Image
                source={{ uri: story.avatarUrl }}
                style={[styles.avatar, { borderRadius: radii.pill }]}
              />
            </View>
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
    borderWidth: 2,
    padding: 2,
  },
  avatarWrap: {
    padding: 2,
  },
  avatar: {
    width: 60,
    height: 60,
  },
  label: {
    textAlign: "center",
    width: "100%",
  },
});
