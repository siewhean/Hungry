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

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
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
  onPressIn,
  ...props
}: ButtonProps) {
  const { componentCornerCurve, componentRadii, componentSizes, opacity, palette, spacing } =
    useHungryTheme();
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
      backgroundColor: palette.surfaceGlass,
      borderColor: palette.surfaceTranslucent,
      borderWidth: 1,
    },
  };

  const sizeStyle: Record<ButtonSize, ViewStyle> = {
    sm: {
      minHeight: componentSizes.buttonSmMinHeight,
      paddingVertical: spacing[1.5],
      paddingHorizontal: spacing[3],
    },
    md: {
      minHeight: componentSizes.buttonMdMinHeight,
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
    },
    lg: {
      minHeight: componentSizes.buttonLgMinHeight,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
    },
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPressIn={(event) => {
        if (!isDisabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPressIn?.(event);
        }
      }}
      style={({ pressed }) => [
        styles.base,
        variantStyle[variant],
        sizeStyle[size],
        {
          borderRadius: componentRadii.button,
          borderCurve: componentCornerCurve.borderCurve,
          opacity: isDisabled ? opacity.disabled : 1,
          width: fullWidth ? "100%" : undefined,
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
        pressed && variant === "secondary" ? { backgroundColor: palette.surfaceRaised } : null,
        pressed && variant === "ghost" ? { backgroundColor: palette.surfaceRaised } : null,
        pressed && variant === "glass" ? { backgroundColor: palette.surfaceTranslucent } : null,
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
          <AppText
            variant={size === "sm" ? "bodySmallBold" : "h3"}
            tone={
              variant === "primary" || variant === "destructive" || variant === "glass"
                ? "inverse"
                : "default"
            }
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
