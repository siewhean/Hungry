import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "./AppText";

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** An avatar or picture before the text. */
  leading?: ReactNode;
  /** Width of `leading`, so the hairline can start at the text. */
  leadingWidth?: number;
  /** A button, count or chevron on the right. A sibling of the row's press target, not inside it. */
  trailing?: ReactNode;
  /** Opens something; omit for a row that only shows information. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** The first row of a list has no hairline above it. */
  first?: boolean;
  /** Title lines before it is cut off. */
  titleLines?: number;
  /** Subtitle lines before it is cut off; two where buttons leave little room. */
  subtitleLines?: number;
  testID?: string;
};

/**
 * One row of a plain list, as on iOS: the picture, the name and a line under it, an accessory on
 * the right, and a hairline above it that starts at the text. Rows are about 60pt tall, so a screen
 * of people shows eleven of them instead of five cards.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  leadingWidth = 44,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  first = false,
  titleLines = 1,
  subtitleLines = 1,
  testID,
}: ListRowProps) {
  const { palette, spacing } = useHungryTheme();
  const body = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyBold" numberOfLines={titleLines} style={{ color: palette.text }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" tone="secondary" numberOfLines={subtitleLines}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </>
  );
  const bodyStyle = {
    alignItems: "center" as const,
    flex: 1,
    flexDirection: "row" as const,
    gap: spacing[3],
    minHeight: 60,
    minWidth: 0,
    paddingVertical: spacing[2],
  };

  return (
    <View testID={testID}>
      {first ? null : (
        <View
          style={{
            backgroundColor: palette.border,
            height: StyleSheet.hairlineWidth,
            marginLeft: leading ? leadingWidth + spacing[3] : 0,
          }}
        />
      )}
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityHint={accessibilityHint}
            onPress={onPress}
            style={({ pressed }) => [
              bodyStyle,
              { backgroundColor: pressed ? palette.bgSoft : "transparent" },
            ]}
          >
            {body}
          </Pressable>
        ) : (
          <View style={bodyStyle}>{body}</View>
        )}
        {trailing}
      </View>
    </View>
  );
}
