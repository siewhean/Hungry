import { forwardRef, useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

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
  /** Overrides the neutral focus border; only pass when a surface needs a bespoke focus colour. */
  focusBorderColor?: string;
}

/**
 * Accessibility contract:
 * - Prefer a visible `label`; otherwise the static placeholder becomes the accessible name.
 * - Moving search placeholders are disabled while a screen reader is enabled.
 * - Error text uses a polite live region so validation changes are announced.
 * - Focus is a neutral 2px border (`textSecondary`, >=3:1 against the field in light and
 *   dark, WCAG 1.4.11 / 2.4.7) rather than brand orange; error red always wins. On web the
 *   browser's own outline on the inner <input> is suppressed because the wrapper shows focus.
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
      focusBorderColor,
      placeholder,
      onFocus,
      onBlur,
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
    const [isFocused, setIsFocused] = useState(false);
    const borderColor = error
      ? palette.error
      : isFocused
        ? (focusBorderColor ?? palette.textSecondary)
        : palette.border;
    const borderWidth = isFocused ? FOCUSED_BORDER_WIDTH : RESTING_BORDER_WIDTH;
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
              borderColor,
              borderWidth,
              borderRadius: componentRadii.input,
              borderCurve: componentCornerCurve.borderCurve,
              gap: spacing[2],
              minHeight: componentSizes.inputMinHeight,
              // Absorb the thicker focus/error border so content never shifts.
              paddingHorizontal: spacing[3] - (borderWidth - RESTING_BORDER_WIDTH),
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
            onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
            }}
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
              Platform.OS === "web" ? WEB_NO_OUTLINE : null,
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

const RESTING_BORDER_WIDTH = 1;
const FOCUSED_BORDER_WIDTH = 2;
// react-native-web forwards outline styles; the wrapper border is the focus indicator.
const WEB_NO_OUTLINE = { outlineStyle: "none", outlineWidth: 0 } as unknown as object;

const styles = StyleSheet.create({
  field: {
    alignItems: "center",
    flexDirection: "row",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 24,
  },
});
