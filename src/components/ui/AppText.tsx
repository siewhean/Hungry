import type { PropsWithChildren } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";

import { useHungryTheme } from "@/theme";

export type TextVariant =
  | "display"
  | "displayBold"
  | "displaySm"
  | "h1"
  | "h2"
  | "h3"
  | "bodyLarge"
  | "body"
  | "bodyBold"
  | "bodySmall"
  | "bodySmallBold"
  | "micro"
  | "price"
  | "code";

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: "default" | "secondary" | "muted" | "accent" | "inverse" | "success";
  style?: TextStyle | TextStyle[];
}

type FontScaling = ReturnType<typeof useHungryTheme>["fontScaling"];

/** How far a text variant may grow with the phone's text-size setting. */
export function getTextMaxFontSizeMultiplier(variant: TextVariant, fontScaling: FontScaling) {
  return variant === "display" || variant === "displayBold" || variant === "displaySm"
    ? fontScaling.displayMaxMultiplier
    : variant === "h1" || variant === "h2" || variant === "h3"
      ? fontScaling.headingMaxMultiplier
      : variant === "micro" || variant === "price" || variant === "code"
        ? fontScaling.compactMaxMultiplier
        : fontScaling.bodyMaxMultiplier;
}

export function AppText({
  children,
  variant = "body",
  tone = "default",
  style,
  maxFontSizeMultiplier,
  allowFontScaling,
  ...props
}: PropsWithChildren<AppTextProps>) {
  const { fontScaling, palette, typography } = useHungryTheme();

  const color =
    tone === "secondary"
      ? palette.textSecondary
      : tone === "muted"
        ? palette.textMuted
        : tone === "accent"
          ? palette.accentText
          : tone === "inverse"
            ? palette.textOnDark
            : tone === "success"
              ? palette.successText
              : palette.text;
  const defaultMaxFontSizeMultiplier = getTextMaxFontSizeMultiplier(variant, fontScaling);

  return (
    <Text
      {...props}
      allowFontScaling={allowFontScaling ?? true}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? defaultMaxFontSizeMultiplier}
      style={[
        typography[variant],
        {
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
