import { View, type StyleProp, type ViewStyle } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

export type StatusChipTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

interface StatusChipProps {
  label: string;
  tone?: StatusChipTone;
  style?: StyleProp<ViewStyle>;
}

export function StatusChip({ label, tone = "neutral", style }: StatusChipProps) {
  const { componentCornerCurve, palette, radii, spacing } = useHungryTheme();
  const toneStyles: Record<
    StatusChipTone,
    { backgroundColor: string; borderColor: string; color: string }
  > = {
    neutral: {
      backgroundColor: palette.surfaceRaised,
      borderColor: palette.border,
      color: palette.textSecondary,
    },
    success: {
      backgroundColor: palette.successSoft,
      borderColor: palette.success,
      color: palette.successText,
    },
    warning: {
      backgroundColor: palette.warningSoft,
      borderColor: palette.warning,
      color: palette.warningText,
    },
    danger: {
      backgroundColor: palette.errorSoft,
      borderColor: palette.error,
      color: palette.errorText,
    },
    info: {
      backgroundColor: palette.infoSoft,
      borderColor: palette.info,
      color: palette.infoText,
    },
    accent: {
      backgroundColor: palette.orangeLight,
      borderColor: palette.orange,
      color: palette.orangeText,
    },
  };
  const resolvedTone = toneStyles[tone];

  return (
    <View
      accessibilityRole="text"
      style={[
        {
          alignSelf: "flex-start",
          backgroundColor: resolvedTone.backgroundColor,
          borderColor: resolvedTone.borderColor,
          borderCurve: componentCornerCurve.borderCurve,
          borderRadius: radii.pill,
          borderWidth: 1,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[0.5],
        },
        style,
      ]}
    >
      <AppText variant="micro" style={{ color: resolvedTone.color, fontWeight: "800" }}>
        {label}
      </AppText>
    </View>
  );
}
