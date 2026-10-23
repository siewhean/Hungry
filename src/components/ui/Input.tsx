import { forwardRef, useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";
import { useMovingSearchPlaceholder } from "@/features/search/useMovingSearchPlaceholder";

const WEB_NO_OUTLINE = { outlineStyle: "none", outlineWidth: 0 } as unknown as TextStyle;

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
 * - Error text uses a polite live region (Android) and is announced on iOS, where
 *   live regions are not supported, so validation changes reach VoiceOver too.
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
      onFocus,
      onBlur,
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
    const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
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
    const visibleErrorText = error && errorText ? errorText : undefined;
    useEffect(() => {
      if (visibleErrorText && Platform.OS === "ios") {
        AccessibilityInfo.announceForAccessibility(visibleErrorText);
      }
    }, [visibleErrorText]);
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
              borderColor: error ? palette.error : isFocused ? palette.orange : palette.border,
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
            autoComplete={autoComplete}
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
              // The field's own rounded border already shows focus; drop the browser's square outline.
              Platform.OS === "web" ? WEB_NO_OUTLINE : null,
              style,
            ]}
            {...props}
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
          />
          {rightIcon ? (
            <View style={[styles.iconWrap, { minHeight: componentSizes.touchTarget }]}>
              {rightIcon}
            </View>
          ) : null}
        </View>
        {visibleErrorText ? (
          <AppText
            variant="bodySmall"
            style={{ color: palette.error }}
            accessibilityLiveRegion="polite"
          >
            {visibleErrorText}
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
