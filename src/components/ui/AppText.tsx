import type { PropsWithChildren } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";

import { useHungryTheme } from "@/theme";

type Variant =
  | "display"
  | "displayBold"
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
  variant?: Variant;
  tone?: "default" | "secondary" | "muted" | "accent" | "inverse" | "success";
  style?: TextStyle | TextStyle[];
}

export function AppText({
  children,
  variant = "body",
  tone = "default",
  style,
  ...props
}: PropsWithChildren<AppTextProps>) {
  const { palette, typography } = useHungryTheme();

  const color =
    tone === "secondary"
      ? palette.textSecondary
      : tone === "muted"
        ? palette.textMuted
        : tone === "accent"
          ? palette.orange
          : tone === "inverse"
            ? palette.textOnDark
            : tone === "success"
              ? palette.statusFast
              : palette.text;

  return (
    <Text
      {...props}
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
