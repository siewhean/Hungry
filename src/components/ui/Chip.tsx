import { type ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import { selectHaptic } from "@/lib/haptics";

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

  const chipStyle = {
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
    justifyContent: "center" as const,
  };

  const content = (
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
  );

  // A label with nothing to press is plain text: no button role, no haptic.
  if (!onPress) {
    return (
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel ?? label}
        style={[styles.chip, chipStyle, style]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={() => {
        selectHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        chipStyle,
        { opacity: pressed ? opacity.pressed : 1 },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
  },
});
