import { Pressable, View } from "react-native";

import { AppText, Skeleton } from "@/components/ui";
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

/**
 * The one stat row for every profile, yours or someone else's: a flat row of number over label,
 * with no box around each stat.
 */
export function ProfileStatRow({ stats, testID }: { stats: ProfileStat[]; testID?: string }) {
  const { spacing } = useHungryTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing[1] }} testID={testID}>
      {stats.map((stat) => (
        <StatBlock key={stat.key} stat={stat} />
      ))}
    </View>
  );
}

function StatBlock({ stat }: { stat: ProfileStat }) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();
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
      {/* Two lines at most, so "Followers" is never cut to "Followe…" on a narrow phone. */}
      <AppText
        variant="micro"
        numberOfLines={2}
        style={{ color: palette.textSecondary, textAlign: "center" }}
      >
        {label}
      </AppText>
    </>
  );
  const baseStyle = {
    alignItems: "center" as const,
    borderRadius: componentRadii.card,
    flex: 1,
    gap: spacing[1],
    minWidth: 0,
    paddingHorizontal: spacing[1],
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        baseStyle,
        pressed &&
          (colorScheme === "dark"
            ? { backgroundColor: palette.surface }
            : { backgroundColor: palette.bgSoft, opacity: 0.92 }),
      ]}
    >
      {content}
    </Pressable>
  );
}
