import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
  type PressableProps,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "glass";
type ButtonSize = "sm" | "md" | "lg";

type ButtonHaptics = false | "light" | "medium";

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  haptics?: ButtonHaptics;
  accessibilityHint?: string;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  fullWidth = true,
  style,
  leftIcon,
  rightIcon,
  haptics = "light",
  accessibilityHint,
  ...props
}: ButtonProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const isDisabled = disabled || loading;

  const variantStyle: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: palette.orange,
      borderColor: palette.orange,
      borderWidth: 1,
    },
    secondary: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 1,
    },
    destructive: {
      backgroundColor: palette.error,
      borderColor: palette.error,
      borderWidth: 1,
    },
    glass: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      borderColor: "rgba(255, 255, 255, 0.4)",
      borderWidth: 1,
    },
  };

  const disabledVariantStyle: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: palette.orangeDark, borderColor: palette.orangeDark },
    destructive: { backgroundColor: palette.error, borderColor: palette.error },
    secondary: { backgroundColor: palette.surfaceRaised, borderColor: palette.border },
    ghost: { backgroundColor: "transparent", borderColor: "transparent" },
    glass: {
      backgroundColor: "rgba(255, 255, 255, 0.12)",
      borderColor: "rgba(255, 255, 255, 0.28)",
    },
  };

  const sizeStyle: Record<ButtonSize, ViewStyle> = {
    sm: { minHeight: 36, paddingVertical: spacing[1.5], paddingHorizontal: spacing[3] },
    md: { minHeight: 52, paddingVertical: spacing[3], paddingHorizontal: spacing[4] },
    lg: { minHeight: 60, paddingVertical: spacing[4], paddingHorizontal: spacing[6] },
  };

  const labelTone =
    variant === "primary" || variant === "destructive" || variant === "glass"
      ? "inverse"
      : "default";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      disabled={isDisabled}
      onPressIn={() => {
        if (!isDisabled) {
          if (haptics === "light") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          if (haptics === "medium") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      }}
      style={({ pressed }) => [
        styles.base,
        isDisabled ? disabledVariantStyle[variant] : variantStyle[variant],
        sizeStyle[size],
        {
          borderRadius: radii.pill,
          opacity: isDisabled ? (variant === "ghost" ? 0.45 : 0.62) : 1,
          width: fullWidth ? "100%" : undefined,
          transform: [{ scale: pressed ? 0.985 : 1 }, { translateY: pressed ? 1 : 0 }],
        },
        pressed && !isDisabled && variant === "primary"
          ? { backgroundColor: palette.orangeDark }
          : null,
        pressed && !isDisabled && variant === "secondary"
          ? { backgroundColor: palette.surfaceRaised }
          : null,
        pressed && !isDisabled && variant === "ghost"
          ? { backgroundColor: palette.surfaceRaised }
          : null,
        pressed && !isDisabled && variant === "destructive" ? { opacity: 0.9 } : null,
        pressed && !isDisabled && variant === "glass"
          ? { backgroundColor: "rgba(255, 255, 255, 0.28)" }
          : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" || variant === "destructive" ? palette.white : palette.text}
        />
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[2],
          }}
        >
          {leftIcon}
          <AppText variant={size === "sm" ? "bodySmallBold" : "h3"} tone={labelTone}>
            {label}
          </AppText>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
});
