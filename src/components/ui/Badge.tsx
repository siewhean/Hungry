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
    orange: { bg: palette.orangeLight, text: palette.orange },
    amber: { bg: palette.amberLight, text: palette.warning },
    success: { bg: palette.successSoft, text: palette.success },
    warning: { bg: palette.warningSoft, text: palette.warning },
    error: { bg: palette.errorSoft, text: palette.error },
    info: { bg: palette.infoSoft, text: palette.info },
    neutral: { bg: palette.bgMuted, text: palette.textSecondary },
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: tones[tone].bg,
          borderRadius: radii.pill,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        },
      ]}
    >
      <AppText variant="micro" style={{ color: tones[tone].text, textTransform: "uppercase" }}>
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

