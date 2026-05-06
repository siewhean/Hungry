import { memo } from "react";
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, Utensils } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";
import type { StoryItem } from "@/types/domain";

interface CircleStoryCarouselProps {
  stories?: StoryItem[];
  onStoryPress?: (story: StoryItem) => void;
  onAddStoryPress?: () => void;
}

export const CircleStoryCarousel = memo(function CircleStoryCarousel({
  stories = [],
  onStoryPress,
  onAddStoryPress,
}: CircleStoryCarouselProps) {
  const { palette, spacing, radii } = useHungryTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
    >
      {stories.map((story) => (
        <Pressable
          key={story.id}
          style={styles.item}
          onPress={() => onStoryPress?.(story)}
          accessibilityLabel={
            story.isOwn ? "Add to your story" : `View ${story.displayName}'s story`
          }
        >
          <View style={styles.ringOuter}>
            {/* Ring: orange gradient = unseen (any story type), grey = already seen */}
            {story.hasUnseen ? (
              <LinearGradient
                colors={[palette.orange, palette.amber]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.gradientRing, { borderRadius: radii.pill }]}
              >
                <View
                  style={[
                    styles.avatarInner,
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
                  styles.solidRing,
                  {
                    borderColor: palette.textMuted,
                    borderRadius: radii.pill,
                  },
                ]}
              >
                <View
                  style={[
                    styles.avatarInner,
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

            {/* "Your story" + add icon */}
            {story.isOwn && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a story"
                style={[
                  styles.addBadge,
                  { backgroundColor: palette.orange, borderColor: palette.bg },
                ]}
                onPress={(event) => {
                  event.stopPropagation();
                  onAddStoryPress?.();
                }}
              >
                <Plus color="#FFFFFF" size={12} strokeWidth={3} />
              </Pressable>
            )}

            {/* Stall fork badge */}
            {story.isStall && !story.isOwn && (
              <View
                style={[
                  styles.forkBadge,
                  { backgroundColor: palette.orange, borderColor: palette.bg },
                ]}
              >
                <Utensils color="#FFFFFF" size={9} strokeWidth={2.5} />
              </View>
            )}
          </View>

          <AppText
            variant="micro"
            numberOfLines={1}
            style={[styles.label, { color: story.isOwn ? palette.textMuted : palette.text }]}
          >
            {story.displayName}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  item: {
    alignItems: "center",
    gap: 6,
    width: 72,
  },
  ringOuter: {
    position: "relative",
  },
  gradientRing: {
    padding: 3,
  },
  solidRing: {
    borderWidth: 2.5,
    padding: 2,
  },
  avatarInner: {
    padding: 2,
  },
  avatar: {
    width: 56,
    height: 56,
  },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  forkBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    textAlign: "center",
    width: "100%",
  },
});
