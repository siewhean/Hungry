import type { ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  error?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Input({ label, helperText, errorText, error, leftIcon, rightIcon, style, ...props }: InputProps) {
  const { palette, radii, spacing, typography } = useHungryTheme();

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="bodySmall" tone="secondary">
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: palette.surface,
            borderColor: error ? palette.error : palette.border,
            borderRadius: radii.md,
            gap: spacing[2],
            minHeight: 54,
            paddingHorizontal: spacing[4],
          },
        ]}
      >
        {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={palette.textMuted}
          style={[
            typography.body,
            {
              color: palette.text,
              flex: 1,
              minHeight: 54,
              paddingVertical: spacing[3],
            },
            style,
          ]}
          {...props}
        />
        {rightIcon ? <View style={styles.iconWrap}>{rightIcon}</View> : null}
      </View>
      {error && errorText ? (
        <AppText variant="micro" style={{ color: palette.error }} accessibilityLiveRegion="polite">
          {errorText}
        </AppText>
      ) : helperText ? (
        <AppText variant="bodySmall" tone="muted">
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  field: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 24,
  },
});
