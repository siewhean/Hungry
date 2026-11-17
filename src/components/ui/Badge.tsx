import { StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { getBadgeToneStyles, type BadgeTone } from "./badgeTones";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const { componentCornerCurve, componentRadii, palette, spacing } = useHungryTheme();
  const toneStyles = getBadgeToneStyles(palette, tone);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: toneStyles.bg,
          borderColor: toneStyles.border,
          borderRadius: componentRadii.card,
          borderCurve: componentCornerCurve.borderCurve,
          borderWidth: 1,
          paddingHorizontal: spacing[2],
          paddingVertical: spacing[1],
        },
      ]}
    >
      <AppText variant="micro" style={{ color: toneStyles.text }}>
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
