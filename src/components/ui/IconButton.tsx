import type { ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import { useHungryTheme } from "@/theme";

type IconButtonVariant = "floating" | "surface" | "ghost";

type Props = Omit<PressableProps, "style" | "children"> & {
  icon: ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: IconButtonVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  variant = "surface",
  size = 44,
  style,
  disabled,
  ...props
}: Props) {
  const { palette, radii, shadows } = useHungryTheme();
  const isDisabled = Boolean(disabled);

  const baseStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: Math.min(radii.pill, size / 2),
    alignItems: "center",
    justifyContent: "center",
    opacity: isDisabled ? 0.6 : 1,
  };

  const variantStyle: Record<IconButtonVariant, ViewStyle> = {
    floating: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      ...(shadows.floating as ViewStyle),
    },
    surface: {
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      ...(shadows.card as ViewStyle),
    },
    ghost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: "transparent",
    },
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={10}
      disabled={disabled}
      onPressIn={() => {
        if (!isDisabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      style={({ pressed }) => [
        styles.base,
        baseStyle,
        variantStyle[variant],
        pressed && !isDisabled ? { transform: [{ scale: 0.96 }], backgroundColor: palette.surfaceRaised } : null,
        style,
      ]}
      {...props}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
  },
});

