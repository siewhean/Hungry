import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
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
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  fullWidth = true,
  style,
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
      backgroundColor: "transparent",
      borderColor: palette.orange,
      borderWidth: 1.5,
    },
    ghost: {
      backgroundColor: "transparent",
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
          borderRadius: radii.sm,
          minHeight: 48,
          opacity: isDisabled ? 0.5 : 1,
          paddingHorizontal: spacing[4],
          width: fullWidth ? "100%" : undefined,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "destructive" ? palette.bg : palette.orange} />
      ) : (
        <AppText
          variant="body"
          style={styles.label}
          tone={variant === "primary" || variant === "destructive" ? "inverse" : "accent"}
        >
          {label}
        </AppText>
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
