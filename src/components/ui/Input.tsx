import { forwardRef, type ReactNode } from "react";
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

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      helperText,
      errorText,
      error,
      leftIcon,
      rightIcon,
      style,
      secureTextEntry,
      autoCorrect,
      spellCheck,
      autoComplete,
      ...props
    },
    ref,
  ) => {
    const { palette, radii, spacing, typography } = useHungryTheme();
    const isSecureField = Boolean(secureTextEntry);
    const resolvedAutoCorrect = autoCorrect ?? !isSecureField;
    const resolvedSpellCheck = spellCheck ?? !isSecureField;
    const resolvedAutoComplete = autoComplete ?? (isSecureField ? "off" : undefined);

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
              paddingHorizontal: spacing[3],
            },
          ]}
        >
          {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            placeholderTextColor={palette.textMuted}
            secureTextEntry={secureTextEntry}
            autoCorrect={resolvedAutoCorrect}
            spellCheck={resolvedSpellCheck}
            autoComplete={resolvedAutoComplete}
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
          <AppText
            variant="micro"
            style={{ color: palette.error }}
            accessibilityLiveRegion="polite"
          >
            {errorText}
          </AppText>
        ) : helperText ? (
          <AppText variant="bodySmall" tone="muted">
            {helperText}
          </AppText>
        ) : null}
      </View>
    );
  },
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    gap: 4, // Intional small gap for label proximity
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
