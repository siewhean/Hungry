import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, TextInput, View, type TextInputProps } from "react-native";

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

/**
 * Accessibility contract:
 * - Prefer a visible `label`; otherwise the static placeholder becomes the accessible name.
 * - Moving search placeholders are disabled while a screen reader is enabled.
 * - Error text uses a polite live region so validation changes are announced.
 */
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
      allowFontScaling,
      maxFontSizeMultiplier,
      ...props
    },
    ref,
  ) => {
    const {
      componentCornerCurve,
      componentRadii,
      componentSizes,
      fontScaling,
      palette,
      semanticSpacing,
      spacing,
      typography,
    } = useHungryTheme();
    const isSecureField = Boolean(secureTextEntry);
    const resolvedAutoCorrect = autoCorrect ?? !isSecureField;
    const resolvedSpellCheck = spellCheck ?? !isSecureField;
    const resolvedAutoComplete = autoComplete ?? (isSecureField ? "off" : undefined);
    const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
    useEffect(() => {
      let mounted = true;
      void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
        if (mounted) setIsScreenReaderEnabled(enabled);
      });
      const subscription = AccessibilityInfo.addEventListener(
        "screenReaderChanged",
        setIsScreenReaderEnabled,
      );
      return () => {
        mounted = false;
        subscription.remove();
      };
    }, []);
    const staticPlaceholder = typeof placeholder === "string" ? placeholder : "";
    const shouldAnimatePlaceholder = !isScreenReaderEnabled && enableMovingPlaceholder === true;
    const animatedPlaceholder = useMovingSearchPlaceholder({
      phrases: movingPlaceholderPhrases ?? [staticPlaceholder || "Search..."],
      enabled: shouldAnimatePlaceholder,
    });
    const placeholderValue = shouldAnimatePlaceholder ? animatedPlaceholder : staticPlaceholder;
    const accessibilityLabel =
      props.accessibilityLabel ?? label ?? (staticPlaceholder ? staticPlaceholder : undefined);

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
            accessibilityLabel={accessibilityLabel}
            placeholderTextColor={palette.textMuted}
            secureTextEntry={secureTextEntry}
            autoCorrect={resolvedAutoCorrect}
            spellCheck={resolvedSpellCheck}
            autoComplete={resolvedAutoComplete}
            allowFontScaling={allowFontScaling ?? true}
            maxFontSizeMultiplier={maxFontSizeMultiplier ?? fontScaling.bodyMaxMultiplier}
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
