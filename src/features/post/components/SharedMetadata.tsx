import React from "react";
import { View, Pressable, StyleSheet, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { MapPin, Users, Hash, ChevronRight, Info } from "lucide-react-native";
import { AppText, Card, Chip, IconButton } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import { useComposerStore } from "../useComposerStore";
import { spacing } from "@/theme/tokens";

interface SharedMetadataProps {
  onOpenLocation?: () => void;
  onOpenCollaborators?: () => void;
}

export function SharedMetadata({ onOpenLocation, onOpenCollaborators }: SharedMetadataProps) {
  const { palette, radii } = useHungryTheme();
  const location = useComposerStore((state) => state.location);
  const collaborators = useComposerStore((state) => state.collaborators);
  const foodTags = useComposerStore((state) => state.foodTags);
  const tasteTags = useComposerStore((state) => state.tasteTags);
  const toggleTag = useComposerStore((state) => state.toggleTag);

  const handleLocationPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenLocation?.();
  };

  const handleCollaboratorsPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpenCollaborators?.();
  };

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.xl, gap: spacing.lg }]}>
      {/* Location */}
      <Pressable
        onPress={handleLocationPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? palette.surfaceRaised : palette.surface,
            borderRadius: radii.lg,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
          },
        ]}
      >
        <View style={[styles.rowLeft, { gap: spacing.lg, flex: 1 }]}>
          <MapPin size={20} color={palette.text} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">Location</AppText>
            {location && (
              <AppText variant="micro" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
                {location.name}
              </AppText>
            )}
          </View>
        </View>
        <ChevronRight size={18} color={palette.textMuted} style={{ marginLeft: spacing.md }} />
      </Pressable>

      {/* Collaborators */}
      <Pressable
        onPress={handleCollaboratorsPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? palette.surfaceRaised : palette.surface,
            borderRadius: radii.lg,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
          },
        ]}
      >
        <View style={[styles.rowLeft, { gap: spacing.lg, flex: 1 }]}>
          <Users size={20} color={palette.text} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyBold">Collaborators</AppText>
            {collaborators.length > 0 && (
              <AppText variant="micro" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
                {collaborators.join(", ")}
              </AppText>
            )}
          </View>
        </View>
        <ChevronRight size={18} color={palette.textMuted} style={{ marginLeft: spacing.md }} />
      </Pressable>

      {/* Tags Section */}
      <View
        style={[
          styles.tagsContainer,
          { backgroundColor: palette.surface, borderRadius: radii.lg, padding: spacing.xl },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <Hash size={18} color={palette.textMuted} />
          <AppText variant="bodyBold">Taste Tags</AppText>
        </View>

        <View style={{ gap: spacing.lg }}>
          <View>
            <AppText variant="micro" tone="muted" style={{ marginBottom: spacing.md }}>
              TASTE PROFILE
            </AppText>
            <View style={[styles.chipRow, { gap: spacing.md }]}>
              {["Spicy", "Savoury", "Sweet", "Umami", "Smoky"].map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  selected={tasteTags.includes(tag)}
                  onPress={() => toggleTag(tag, "taste")}
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagsContainer: {
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
