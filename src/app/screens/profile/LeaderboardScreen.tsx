import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppSymbol, AppText, Avatar, EmptyState, SegmentedControl } from "@/components/ui";
import {
  LEADERBOARD_FULL_BOARD,
  LEADERBOARD_PAGE_SIZE,
  PORTFOLIO_POINT_LIMITS,
  PORTFOLIO_POINT_RULES,
  TRENDING_RULES,
  boardScoreLabel,
  dailyCreditLabel,
  portfolioPointsLabel,
  portfolioPointsValue,
  rankLabel,
  shouldPinOwnRow,
  summaryRankFor,
} from "@/features/leaderboard/leaderboardDisplay";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type {
  LeaderboardBoard,
  LeaderboardPeriod,
  LeaderboardRow,
  LeaderboardScope,
  LeaderboardSummary,
  PortfolioPointsEntry,
} from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<RootStackParamList, "Leaderboard">;

const BOARD_OPTIONS = [
  { value: "active", label: "Most active" },
  { value: "trending", label: "Trending" },
] as const;
const PERIOD_OPTIONS = [
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
] as const;
const SCOPE_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "Following" },
] as const;

function LeaderboardRowView({
  row,
  board,
  onPress,
}: {
  row: LeaderboardRow;
  board: LeaderboardBoard;
  onPress?: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const score = boardScoreLabel(board, row.score);
  return (
    <Pressable
      testID={`leaderboard-row-${row.userId}`}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${rankLabel(row.rank)}, ${row.isMe ? "you" : row.displayName}, ${score}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: row.isMe ? palette.bgSoft : pressed ? palette.bgSoft : palette.surface,
        borderRadius: componentRadii.card,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 56,
        paddingHorizontal: spacing[3],
      })}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 2, width: 44 }}>
        {row.rank <= 3 ? <AppSymbol name="topRank" size={14} color={palette.accentText} /> : null}
        <AppText variant="bodyBold">{row.rank}</AppText>
      </View>
      <Avatar name={row.displayName} uri={row.avatarUrl} size={36} />
      <AppText variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
        {row.isMe ? "You" : row.displayName}
      </AppText>
      <AppText variant="bodySmall" tone="secondary">
        {score}
      </AppText>
    </Pressable>
  );
}

/** Most active (Portfolio points) and Trending (last 7 days of engagement), plus your points. */
export function LeaderboardScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [board, setBoard] = useState<LeaderboardBoard>("active");
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [scope, setScope] = useState<LeaderboardScope>("everyone");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
  const [points, setPoints] = useState<PortfolioPointsEntry[]>([]);
  const trackedRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    const service = getHungryService();
    void service.leaderboard
      .getMySummary()
      .then((result) => {
        if (isActive) setSummary(result);
      })
      .catch((error) => reportError(error, { screen: "Leaderboard", action: "load_summary" }));
    void service.leaderboard
      .listMyPoints(20)
      .then((result) => {
        if (isActive) setPoints(result);
      })
      .catch((error) => reportError(error, { screen: "Leaderboard", action: "load_points" }));
    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let isActive = true;
    setState("loading");
    void getHungryService()
      .leaderboard.getLeaderboard({ board, period, scope, limit: LEADERBOARD_PAGE_SIZE })
      .then((result) => {
        if (!isActive) return;
        setRows(result);
        setState("loaded");
        if (!trackedRef.current) {
          trackedRef.current = true;
          trackAnalyticsEvent("leaderboard_viewed", { board, row_count: result.length });
        }
      })
      .catch((error) => {
        reportError(error, { screen: "Leaderboard", action: "load_board" });
        if (isActive) setState("failed");
      });
    return () => {
      isActive = false;
    };
  }, [board, period, scope, reloadKey]);

  const openPerson = (row: LeaderboardRow) =>
    navigation.navigate("UserProfile", {
      authorId: row.userId,
      authorName: row.displayName,
      authorAvatarUrl: row.avatarUrl,
    });

  const ownRank = summaryRankFor(summary, board, period);
  const ownScore = board === "trending" ? null : period === "week" ? summary?.weekPoints : null;
  const cardStyle = {
    backgroundColor: palette.surface,
    borderRadius: componentRadii.card,
    gap: spacing[2],
    padding: spacing[4],
  } as const;

  return (
    <ProfileScreenShell title="Leaderboard" subtitle="Post dishes to climb. Weeks start on Monday.">
      <View style={{ gap: spacing[4], paddingBottom: spacing[8] }}>
        {summary ? (
          <View testID="leaderboard-summary" style={cardStyle}>
            <AppText variant="micro" tone="secondary">
              Your Portfolio points
            </AppText>
            <AppText variant="h1">{Math.round(summary.totalPoints)}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {`This week ${rankLabel(summary.activeWeekRank)} · ${Math.round(summary.weekPoints)} pts`}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {dailyCreditLabel(summary)}
            </AppText>
          </View>
        ) : null}

        <SegmentedControl
          testID="leaderboard-board"
          accessibilityLabel="Choose a leaderboard"
          options={BOARD_OPTIONS}
          value={board}
          onChange={setBoard}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {board === "active" ? (
            <SegmentedControl
              compact
              testID="leaderboard-period"
              accessibilityLabel="Show this week or all time"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
            />
          ) : null}
          <SegmentedControl
            compact
            testID="leaderboard-scope"
            accessibilityLabel="Show everyone or only people you follow"
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={setScope}
          />
        </View>

        {state === "loading" && rows.length === 0 ? (
          <View testID="leaderboard-loading" style={{ minHeight: 200 }} />
        ) : state === "failed" ? (
          <EmptyState
            title="Couldn't load the leaderboard"
            body="Check your connection and try again."
            icon={
              <AppSymbol name="retry" size={36} weight="regular" color={palette.textSecondary} />
            }
            ctaLabel="Retry"
            onPress={() => setReloadKey((key) => key + 1)}
          />
        ) : (
          <View testID="leaderboard-rows" style={{ gap: spacing[2] }}>
            {rows.map((row) => (
              <LeaderboardRowView
                key={row.userId}
                row={row}
                board={board}
                onPress={row.isMe ? undefined : () => openPerson(row)}
              />
            ))}
            {shouldPinOwnRow(rows, ownRank) ? (
              <View testID="leaderboard-own-row">
                <LeaderboardRowView
                  board={board}
                  row={{
                    rank: ownRank ?? 0,
                    userId: "me",
                    displayName: "You",
                    score: ownScore ?? 0,
                    isMe: true,
                  }}
                />
              </View>
            ) : null}
            {rows.length < LEADERBOARD_FULL_BOARD ? (
              <View testID="leaderboard-be-first" style={cardStyle}>
                <AppText variant="bodyBold">
                  {rows.length === 0 ? "Nobody here yet" : "Plenty of room at the top"}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {scope === "following"
                    ? "Follow people whose taste you like to see how you compare."
                    : "Post a dish with a photo to get on the board. It refreshes every 10 minutes."}
                </AppText>
              </View>
            ) : null}
          </View>
        )}

        <View testID="leaderboard-how-points-work" style={cardStyle}>
          <AppText variant="bodyBold">How points work</AppText>
          {board === "trending" ? (
            <AppText variant="bodySmall" tone="secondary">
              {TRENDING_RULES}
            </AppText>
          ) : (
            <>
              {PORTFOLIO_POINT_RULES.map((rule) => (
                <View key={rule.label} style={{ flexDirection: "row", gap: spacing[3] }}>
                  <AppText variant="bodySmall" style={{ flex: 1 }}>
                    {rule.label}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {rule.points}
                  </AppText>
                </View>
              ))}
              <AppText variant="micro" tone="secondary">
                {PORTFOLIO_POINT_LIMITS}
              </AppText>
            </>
          )}
        </View>

        {points.length > 0 ? (
          <View testID="leaderboard-points-history" style={cardStyle}>
            <AppText variant="bodyBold">Your recent points</AppText>
            {points.map((entry) => (
              <View key={entry.id} style={{ flexDirection: "row", gap: spacing[3] }}>
                <AppText variant="bodySmall" style={{ flex: 1 }} numberOfLines={1}>
                  {portfolioPointsLabel(entry)}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {portfolioPointsValue(entry)}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ProfileScreenShell>
  );
}
