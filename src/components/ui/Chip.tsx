import { type ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface ChipProps {
  label: string;
  accessibilityLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  accessibilityLabel,
  selected = false,
  onPress,
  leftIcon,
  style,
}: ChipProps) {
  const {
    colorScheme,
    componentCornerCurve,
    componentRadii,
    componentSizes,
    opacity,
    palette,
    spacing,
  } = useHungryTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? palette.orangeLight
            : colorScheme === "dark"
              ? palette.surfaceRaised
              : palette.surface,
          borderColor: selected ? palette.orange : palette.border,
          borderRadius: componentRadii.button,
          borderCurve: componentCornerCurve.borderCurve,
          minHeight: componentSizes.touchTarget,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          opacity: pressed ? opacity.pressed : 1,
          justifyContent: "center",
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        {leftIcon}
        <AppText
          style={{
            color: selected ? palette.orange : palette.textSecondary,
            flexShrink: 1,
            fontWeight: selected ? "700" : "500",
          }}
          numberOfLines={1}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
  },
});
