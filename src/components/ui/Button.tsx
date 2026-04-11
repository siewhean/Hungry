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
  leftIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  fullWidth = true,
  leftIcon,
  style,
  ...props
}: ButtonProps) {
  const { palette, radii, spacing } = useHungryTheme();
  const isDisabled = disabled || loading;

  const variantStyle: Record<ButtonVariant, ViewStyle> = {
    primary: {
      backgroundColor: "#FFFFFF",
      borderColor: palette.orange,
      borderWidth: 2,
    },
    secondary: {
      backgroundColor: "#FFFFFF",
      borderColor: palette.border,
      borderWidth: 1,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderWidth: 1,
    },
    destructive: {
      backgroundColor: "#FFFFFF",
      borderColor: palette.error,
      borderWidth: 2,
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
          borderRadius: radii.md,
          minHeight: 52,
          opacity: isDisabled ? 0.5 : 1,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          width: fullWidth ? "100%" : undefined,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        pressed ? { backgroundColor: palette.bgSoft } : null,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "destructive" ? palette.error : palette.orange}
        />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {leftIcon}
          <AppText
            variant="body"
            style={[
              styles.label,
              { color: variant === "destructive" ? palette.error : variant === "primary" ? palette.orange : palette.text }
            ]}
          >
            {label}
          </AppText>
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
  label: {
    fontFamily: "Nunito_600SemiBold",
  },
});
