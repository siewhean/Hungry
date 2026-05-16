import { forwardRef, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { useMovingSearchPlaceholder } from "@/features/search/useMovingSearchPlaceholder";

interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  error?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  enableMovingPlaceholder?: boolean;
  movingPlaceholderPhrases?: string[];
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
      enableMovingPlaceholder,
      movingPlaceholderPhrases,
      placeholder,
      style,
      secureTextEntry,
      autoCorrect,
      spellCheck,
      autoComplete,
      ...props
    },
    ref,
  ) => {
    const {
      componentCornerCurve,
      componentRadii,
      componentSizes,
      palette,
      semanticSpacing,
      spacing,
      typography,
    } = useHungryTheme();
    const isSecureField = Boolean(secureTextEntry);
    const resolvedAutoCorrect = autoCorrect ?? !isSecureField;
    const resolvedSpellCheck = spellCheck ?? !isSecureField;
    const resolvedAutoComplete = autoComplete ?? (isSecureField ? "off" : undefined);
    const staticPlaceholder = typeof placeholder === "string" ? placeholder : "";
    const shouldAnimatePlaceholder =
      enableMovingPlaceholder ?? /^(search|find)\b/i.test(staticPlaceholder.trim());
    const animatedPlaceholder = useMovingSearchPlaceholder({
      phrases: movingPlaceholderPhrases ?? [staticPlaceholder || "Search..."],
      enabled: shouldAnimatePlaceholder,
    });
    const placeholderValue = shouldAnimatePlaceholder ? animatedPlaceholder : staticPlaceholder;

    return (
      <View style={{ gap: semanticSpacing.textStack }}>
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
              borderRadius: componentRadii.input,
              borderCurve: componentCornerCurve.borderCurve,
              gap: spacing[2],
              minHeight: componentSizes.inputMinHeight,
              paddingHorizontal: spacing[3],
            },
          ]}
        >
          {leftIcon ? (
            <View style={[styles.iconWrap, { minHeight: componentSizes.touchTarget }]}>
              {leftIcon}
            </View>
          ) : null}
          <TextInput
            ref={ref}
            placeholder={placeholderValue}
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
                minHeight: componentSizes.inputMinHeight,
                paddingVertical: spacing[3],
              },
              style,
            ]}
            {...props}
          />
          {rightIcon ? (
            <View style={[styles.iconWrap, { minHeight: componentSizes.touchTarget }]}>
              {rightIcon}
            </View>
          ) : null}
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
  field: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
  },
});
