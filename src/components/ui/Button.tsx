import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { PressableProps } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  fullWidth = true,
  style,
  leftIcon,
  rightIcon,
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
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle[variant],
        {
          borderRadius: radii.pill,
          minHeight: 52,
          opacity: isDisabled ? 0.5 : 1,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[3],
          width: fullWidth ? "100%" : undefined,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        pressed && variant === "secondary"
          ? { backgroundColor: palette.surfaceRaised }
          : null,
        pressed && variant === "ghost"
          ? { backgroundColor: palette.surfaceRaised }
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          {leftIcon}
          <AppText
            variant="h3"
            tone={variant === "primary" || variant === "destructive" ? "inverse" : "default"}
          >
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
