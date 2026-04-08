import { StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface BadgeProps {
  label: string;
  tone?: "orange" | "amber" | "success" | "warning" | "error" | "info" | "neutral";
}

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const { palette, radii, spacing } = useHungryTheme();

  const tones = {
    orange: { bg: palette.surface, border: palette.border, text: palette.text },
    amber: { bg: palette.warningSoft, border: palette.warningSoft, text: palette.warning },
    success: { bg: palette.successSoft, border: palette.successSoft, text: palette.success },
    warning: { bg: palette.warningSoft, border: palette.warningSoft, text: palette.warning },
    error: { bg: palette.errorSoft, border: palette.errorSoft, text: palette.error },
    info: { bg: palette.infoSoft, border: palette.infoSoft, text: palette.info },
    neutral: { bg: palette.surface, border: palette.border, text: palette.textSecondary },
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tones[tone].bg,
          borderColor: tones[tone].border,
          borderRadius: radii.md,
          borderWidth: 1,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        },
      ]}
    >
      <AppText variant="micro" style={{ color: tones[tone].text }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
  },
});
