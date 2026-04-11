import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { getBadgeToneStyles, type BadgeTone } from "./badgeTones";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  rightIcon?: ReactNode;
}

export function Badge({ label, tone = "neutral", rightIcon }: BadgeProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const toneStyles = getBadgeToneStyles(palette, tone);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: toneStyles.bg,
          borderColor: toneStyles.border,
          borderRadius: radii.md,
          borderWidth: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[1],
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        },
      ]}
    >
      <AppText variant="micro" style={{ color: toneStyles.text }}>
        {label}
      </AppText>
      {rightIcon}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
  },
});
