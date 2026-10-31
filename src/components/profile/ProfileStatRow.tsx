import { useState } from "react";
import { useWindowDimensions, View, type LayoutChangeEvent } from "react-native";

import { AppText, PressableScale, Skeleton } from "@/components/ui";
import { useHungryTheme } from "@/theme";

/** A stat whose read failed: a dash on screen, "unavailable" to a screen reader. */
export const STAT_UNAVAILABLE = "–";

export type ProfileStat = {
  key: string;
  label: string;
  /** null while loading; text such as "20+" when only the first page is counted. */
  value: number | string | null;
  /** Omit for a count that opens nothing. */
  onPress?: () => void;
  onPressIn?: () => void;
  accessibilityHint?: string;
};

/** The narrowest a stat may get before its label would not fit on one line at full size. */
export const STAT_MIN_COLUMN_WIDTH = 72;
/** Above this text scale the labels would shrink too far, so the row stacks. */
export const STAT_STACK_FONT_SCALE = 1.3;

/** True when the stats would be too narrow for a one-line label, or the text is very large. */
export function shouldStackStats({
  count,
  width,
  fontScale,
}: {
  count: number;
  /** The row's measured width; null before the first layout. */
  width: number | null;
  fontScale: number;
}): boolean {
  if (count <= 2) return false;
  return (
    fontScale > STAT_STACK_FONT_SCALE || (width !== null && width / count < STAT_MIN_COLUMN_WIDTH)
  );
}

/**
 * The one stat row for every profile, yours or someone else's: a flat row of number over label,
 * with no box around each stat. A label is always one whole line and never breaks inside a word;
 * when the stats are too narrow for that (a 320pt phone, or large text), the row becomes a
 * two-by-two grid instead.
 */
export function ProfileStatRow({ stats, testID }: { stats: ProfileStat[]; testID?: string }) {
  const { spacing } = useHungryTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState<number | null>(null);
  const stacked = shouldStackStats({ count: stats.length, width, fontScale });

  return (
    <View
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", flexWrap: stacked ? "wrap" : "nowrap", gap: spacing[1] }}
    >
      {stats.map((stat) => (
        <StatBlock key={stat.key} stat={stat} stacked={stacked} />
      ))}
    </View>
  );
}

function StatBlock({ stat, stacked }: { stat: ProfileStat; stacked: boolean }) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const { label, value, onPress, onPressIn, accessibilityHint } = stat;

  const content = (
    <>
      {value === null ? (
        <Skeleton width={spacing[6]} height={spacing[5]} borderRadius={4} />
      ) : (
        <AppText variant="h2" style={{ color: palette.text }}>
          {value}
        </AppText>
      )}
      {/* One line that shrinks a little rather than breaking inside a word ("Follower / s"). */}
      <AppText
        variant="micro"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{
          alignSelf: "stretch",
          color: palette.textSecondary,
          // The micro style tracks wide (0.6); a label this short needs no tracking, and without it
          // "Following" fits a 75pt column whole instead of being cut to "Followi…".
          letterSpacing: 0,
          textAlign: "center",
        }}
      >
        {label}
      </AppText>
    </>
  );
  const baseStyle = {
    alignItems: "center" as const,
    borderRadius: componentRadii.card,
    // Stacked: two to a line (the gap is a spacing[1] on each side of the middle).
    ...(stacked ? { flexBasis: "48%" as const, flexGrow: 1 } : { flex: 1 }),
    gap: spacing[1],
    minWidth: 0,
    paddingHorizontal: spacing[0.5],
    paddingVertical: spacing[3],
  };
  const accessibilityLabel =
    value === null
      ? `${label}, loading`
      : value === STAT_UNAVAILABLE
        ? `${label}, unavailable`
        : `${label} ${value}`;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel} style={baseStyle}>
        {content}
      </View>
    );
  }

  // Presses in to 0.97 like every other tile; with Reduce Motion on it does not move.
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPressIn={onPressIn}
      onPress={onPress}
      style={baseStyle}
    >
      {content}
    </PressableScale>
  );
}
