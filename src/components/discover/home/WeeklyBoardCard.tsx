/**
 * Home's "This week's board": the top three posters' avatars and your own place, opening the
 * Leaderboard. Shown once the diner follows someone or has posted; before their first post it
 * invites one instead of showing a rank.
 */
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { FirstPostIllustration } from "@/components/icons/food/SocialIllustrations";
import { AppSymbol, AppText, Avatar } from "@/components/ui";
import { rankLabel } from "@/features/leaderboard/leaderboardDisplay";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LeaderboardRow, LeaderboardSummary } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

/** True when the card has something to say: a follow, or points of your own. */
export function shouldShowWeeklyBoard(
  followCount: number,
  summary: LeaderboardSummary | null,
  rows: readonly LeaderboardRow[],
): boolean {
  if (rows.length === 0) return false;
  return followCount > 0 || (summary?.totalPoints ?? 0) > 0;
}

export function WeeklyBoardCard({
  enabled,
  followCount,
  onOpen,
}: {
  enabled: boolean;
  /** People you follow (from the social store); the card waits for one. */
  followCount: number;
  onOpen: () => void;
}) {
  const { componentRadii, palette, shadows, spacing } = useHungryTheme();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const leaderboard = getHungryService().leaderboard;
    void Promise.all([
      leaderboard.getLeaderboard({ board: "active", period: "week", limit: 3 }),
      leaderboard.getMySummary(),
    ])
      .then(([top, mine]) => {
        if (!active) return;
        setRows(top);
        setSummary(mine);
      })
      .catch((error) => {
        // The card is extra: Home shows without it.
        reportError(error, { screen: "DiscoverHome", action: "load_weekly_board" });
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled || !shouldShowWeeklyBoard(followCount, summary, rows)) return null;
  const hasPosted = (summary?.totalPoints ?? 0) > 0;
  const yourLine = hasPosted
    ? `You ${rankLabel(summary?.activeWeekRank)} · ${Math.round(summary?.weekPoints ?? 0)} pts this week`
    : "Post a dish to join";

  return (
    <Pressable
      testID="home-weekly-board"
      accessibilityRole="button"
      accessibilityLabel={`This week's board. ${yourLine}`}
      accessibilityHint="Opens the Leaderboard"
      onPress={onOpen}
      style={({ pressed }) => [
        shadows.card,
        {
          alignItems: "center",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderRadius: componentRadii.card,
          flexDirection: "row",
          gap: spacing[3],
          padding: spacing[4],
        },
      ]}
    >
      <View style={{ flex: 1, gap: spacing[2] }}>
        <AppText variant="h3">This week&apos;s board</AppText>
        <View style={{ flexDirection: "row" }}>
          {rows.map((row, index) => (
            <View
              key={row.userId}
              style={{
                borderColor: palette.surface,
                borderRadius: 999,
                borderWidth: 2,
                marginLeft: index === 0 ? 0 : -spacing[2],
              }}
            >
              <Avatar name={row.displayName} uri={row.avatarUrl} size={32} />
            </View>
          ))}
        </View>
        <AppText variant="bodySmall" tone="secondary" testID="home-weekly-board-you">
          {yourLine}
        </AppText>
      </View>
      {hasPosted ? null : <FirstPostIllustration size={64} testID="home-weekly-board-art" />}
      <AppSymbol name="chevronRight" size={14} color={palette.textMuted} />
    </Pressable>
  );
}
