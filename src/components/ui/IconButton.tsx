import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
  size,
  style,
  disabled,
  onPressIn,
  ...props
}: Props) {
  const {
    componentCornerCurve,
    componentRadii,
    componentSizes,
    opacity,
    palette,
    shadows,
    spacing,
  } = useHungryTheme();
  const isDisabled = Boolean(disabled);
  const resolvedSize = size ?? componentSizes.iconButton;

  const baseStyle: ViewStyle = {
    width: resolvedSize,
    height: resolvedSize,
    borderRadius: componentRadii.iconButton,
    borderCurve: componentCornerCurve.borderCurve,
    alignItems: "center",
    justifyContent: "center",
    opacity: isDisabled ? opacity.disabledSubtle : 1,
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
      hitSlop={spacing[2.5]}
      disabled={disabled}
      onPressIn={(event) => {
        if (!isDisabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPressIn?.(event);
        }
      }}
      style={({ pressed }) => [
        styles.base,
        baseStyle,
        variantStyle[variant],
        pressed && !isDisabled
          ? { transform: [{ scale: opacity.pressedScale }], backgroundColor: palette.surfaceRaised }
          : null,
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
