import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, Utensils } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "../ui";
import type { StoryItem } from "@/types/domain";

/**
 * Mock story data.
 * Ring colour rule (per user spec):
 *   - Orange gradient ring  = hasUnseen true  (applies to both stall AND user stories)
 *   - Grey ring             = hasUnseen false (story already viewed)
 * Fork badge (🍴) is shown only on isStall stories to identify hawker stalls.
 */
const MOCK_STORIES: StoryItem[] = [
  {
    id: "s0",
    displayName: "Your Story",
    avatarUrl: "https://i.pravatar.cc/150?u=me",
    hasUnseen: false,
    isStall: false,
    isOwn: true,
  },
  {
    id: "s1",
    displayName: "Tian Tian",
    avatarUrl: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=150&h=150&fit=crop",
    hasUnseen: true,
    isStall: true,
  },
  {
    id: "s2",
    displayName: "Wei Ming",
    avatarUrl: "https://i.pravatar.cc/150?u=wm",
    hasUnseen: true,
    isStall: false,
  },
  {
    id: "s3",
    displayName: "Hill Street",
    avatarUrl: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=150&h=150&fit=crop",
    hasUnseen: true,
    isStall: true,
  },
  {
    id: "s4",
    displayName: "Sarah L.",
    avatarUrl: "https://i.pravatar.cc/150?u=sl",
    hasUnseen: true,
    isStall: false,
  },
  {
    id: "s5",
    displayName: "Uncle Tan",
    avatarUrl: "https://i.pravatar.cc/150?u=ut",
    hasUnseen: true,
    isStall: false,
  },
  {
    id: "s6",
    displayName: "Ah Heng",
    avatarUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=150&h=150&fit=crop",
    hasUnseen: false,
    isStall: true,
  },
  {
    id: "s7",
    displayName: "Emma W.",
    avatarUrl: "https://i.pravatar.cc/150?u=ew",
    hasUnseen: false,
    isStall: false,
  },
];

interface CircleStoryCarouselProps {
  stories?: StoryItem[];
  onStoryPress?: (story: StoryItem) => void;
}

export function CircleStoryCarousel({
  stories = MOCK_STORIES,
  onStoryPress,
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
                colors={["#E8531E", "#F59E0B"]}
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
                    borderColor: palette.border,
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
              <View
                style={[
                  styles.addBadge,
                  { backgroundColor: palette.orange, borderColor: palette.bg },
                ]}
              >
                <Plus color="#FFFFFF" size={12} strokeWidth={3} />
              </View>
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
}

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
