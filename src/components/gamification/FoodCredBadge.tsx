/**
 * FoodCredBadge — displays the user's current Food Cred tier and optional
 * point total. Designed for profile header and other compact surfaces.
 *
 * Sizes:
 *   sm — inline next to username (level name only)
 *   md — profile card (level name + point total)
 *   lg — full cred panel (level name + points + progress bar)
 */

import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useEffect } from "react";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { useFoodCredStore, FOOD_CRED_LEVELS } from "@/store/useFoodCredStore";

interface FoodCredBadgeProps {
  size?: "sm" | "md" | "lg";
  showPoints?: boolean;
  style?: ViewStyle;
}

export function FoodCredBadge({ size = "md", showPoints = false, style }: FoodCredBadgeProps) {
  const { palette, radii, spacing, typography } = useHungryTheme();
  const totalPoints = useFoodCredStore((s) => s.totalPoints);
  const currentLevel = useFoodCredStore((s) => s.currentLevel());
  const levelProgress = useFoodCredStore((s) => s.levelProgress());
  const isMaxLevel = currentLevel.index >= FOOD_CRED_LEVELS.length - 1;

  // Animate progress bar fill
  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withSpring(levelProgress, { damping: 18, stiffness: 120 });
  }, [levelProgress, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.min(progressWidth.value * 100, 100)}%`,
  }));

  if (size === "sm") {
    return (
      <View
        style={[
          styles.badgePill,
          {
            backgroundColor: palette.orangeLight,
            borderRadius: radii.pill,
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
          },
          style,
        ]}
      >
        <AppText
          style={{
            ...typography.micro,
            color: palette.orange,
            fontWeight: "700",
          }}
        >
          {currentLevel.name}
        </AppText>
      </View>
    );
  }

  if (size === "md") {
    return (
      <View style={[styles.row, style]}>
        <View
          style={[
            styles.badgePill,
            {
              backgroundColor: palette.orangeLight,
              borderRadius: radii.pill,
              paddingHorizontal: spacing[2],
              paddingVertical: spacing["0.5"],
            },
          ]}
        >
          <AppText style={{ ...typography.micro, color: palette.orange, fontWeight: "700" }}>
            {currentLevel.name}
          </AppText>
        </View>
        {showPoints && (
          <AppText tone="muted" variant="micro" style={{ marginLeft: spacing[2] }}>
            {totalPoints} pts
          </AppText>
        )}
      </View>
    );
  }

  // size === "lg" — full panel with progress bar
  const nextLevel = isMaxLevel ? null : FOOD_CRED_LEVELS[currentLevel.index + 1];
  return (
    <View style={{ gap: spacing[2] }}>
      {/* Header row */}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={styles.row}>
          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: palette.orangeLight,
                borderRadius: radii.pill,
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1],
              },
            ]}
          >
            <AppText style={{ ...typography.bodySmall, color: palette.orange, fontWeight: "700" }}>
              {currentLevel.name}
            </AppText>
          </View>
        </View>
        <AppText tone="muted" variant="bodySmall">
          {totalPoints} pts
        </AppText>
      </View>

      {/* Progress bar */}
      {!isMaxLevel && nextLevel && (
        <>
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: palette.border,
                borderRadius: radii.pill,
                height: 6,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                progressStyle,
                {
                  backgroundColor: palette.orange,
                  borderRadius: radii.pill,
                  height: 6,
                },
              ]}
            />
          </View>
          <AppText tone="muted" variant="micro">
            {nextLevel.minPoints - totalPoints} pts to {nextLevel.name}
          </AppText>
        </>
      )}
      {isMaxLevel && (
        <AppText tone="muted" variant="micro">
          Maximum level reached
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badgePill: {
    alignSelf: "flex-start",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressTrack: {
    overflow: "hidden",
    position: "relative",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
