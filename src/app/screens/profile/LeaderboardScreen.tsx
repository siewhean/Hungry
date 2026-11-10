import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { FoodPortfolioShareSheet } from "@/components/foodPortfolio/FoodPortfolioShareSheet";
import {
  EmptyBoardIllustration,
  PodiumIllustration,
} from "@/components/icons/food/SocialIllustrations";
import { FollowPillButton } from "@/components/social/FollowPillButton";
import {
  AppSymbol,
  AppText,
  Avatar,
  Button,
  Chip,
  EmptyState,
  IconButton,
  ListRow,
  SegmentedControl,
} from "@/components/ui";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { rankCardModel } from "@/features/foodPortfolio/shareCards";
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
  movementLabel,
  rankLabel,
  shouldPinOwnRow,
  summaryRankFor,
} from "@/features/leaderboard/leaderboardDisplay";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type {
  LeaderboardBoard,
  LeaderboardMovement,
  LeaderboardPeriod,
  LeaderboardRow,
  LeaderboardScope,
  LeaderboardSummary,
  PortfolioPointsEntry,
} from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
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
/** Podium columns, left to right: second, first, third. */
const PODIUM_ORDER = [1, 0, 2] as const;
const PODIUM_STEP_HEIGHT = [72, 52, 40] as const;

/** The top three: avatars on steps (2, 1, 3), each opening that diner's Food Portfolio. */
function Podium({
  rows,
  board,
  onOpen,
}: {
  rows: LeaderboardRow[];
  board: LeaderboardBoard;
  onOpen: (row: LeaderboardRow) => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  return (
    <View
      testID="leaderboard-podium"
      style={{ alignItems: "flex-end", flexDirection: "row", gap: spacing[2] }}
    >
      {PODIUM_ORDER.map((index) => {
        const row = rows[index];
        if (!row) return <View key={`empty-${index}`} style={{ flex: 1 }} />;
        const first = index === 0;
        const score = boardScoreLabel(board, row.score);
        return (
          <Pressable
            key={row.userId}
            testID={`leaderboard-row-${row.userId}`}
            accessibilityRole={row.isMe ? "text" : "button"}
            accessibilityLabel={`${rankLabel(row.rank)}, ${row.isMe ? "you" : row.displayName}, ${score}`}
            disabled={row.isMe}
            onPress={() => onOpen(row)}
            style={{ alignItems: "center", flex: 1, gap: spacing[1] }}
          >
            <Avatar name={row.displayName} uri={row.avatarUrl} size={first ? 64 : 52} />
            <AppText variant="bodyBold" numberOfLines={1} style={{ textAlign: "center" }}>
              {row.isMe ? "You" : row.displayName}
            </AppText>
            <AppText variant="micro" tone="secondary" numberOfLines={1}>
              {score}
            </AppText>
            <View
              style={{
                alignItems: "center",
                alignSelf: "stretch",
                backgroundColor: first ? palette.orange : palette.amber,
                borderTopLeftRadius: componentRadii.card,
                borderTopRightRadius: componentRadii.card,
                height: PODIUM_STEP_HEIGHT[index],
                justifyContent: "center",
              }}
            >
              <AppText variant="h2" style={{ color: palette.textOnOrange }}>
                {row.rank}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Follow, on a board row of someone you do not follow yet. */
function RowFollowButton({ row }: { row: LeaderboardRow }) {
  const followPress = useFollowPress();
  const isFollowing = useSocialStore((state) => Boolean(state.followedUserIds[row.userId]));
  const isRequested = useSocialStore((state) => Boolean(state.requestedUserIds[row.userId]));
  if (row.isMe || isFollowing) return null;
  return (
    <FollowPillButton
      label={isRequested ? "Requested" : "Follow"}
      accessibilityLabel={
        isRequested ? `Follow request sent to ${row.displayName}` : `Follow ${row.displayName}`
      }
      muted={isRequested}
      tinted
      minWidth={0}
      onPress={() =>
        followPress({ userId: row.userId, name: row.displayName, avatarUrl: row.avatarUrl })
      }
    />
  );
}

function LeaderboardRowView({
  row,
  board,
  onPress,
  showFollow = false,
}: {
  row: LeaderboardRow;
  board: LeaderboardBoard;
  onPress?: () => void;
  showFollow?: boolean;
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
      {showFollow ? <RowFollowButton row={row} /> : null}
    </Pressable>
  );
}

/** How points work, and your own recent points, in a sheet over the board. */
function PointsSheet({
  visible,
  board,
  points,
  onClose,
}: {
  visible: boolean;
  board: LeaderboardBoard;
  points: PortfolioPointsEntry[];
  onClose: () => void;
}) {
  const { palette, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<"rules" | "history">("rules");
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {visible ? (
        <View
          testID="leaderboard-points-sheet"
          style={{
            backgroundColor: palette.bg,
            flex: 1,
            gap: spacing[3],
            paddingBottom: insets.bottom + spacing[3],
            paddingHorizontal: spacing[4],
            paddingTop: spacing[3],
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row" }}>
            <AppText variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
              How points work
            </AppText>
            <IconButton
              variant="ghost"
              accessibilityLabel="Close"
              onPress={onClose}
              icon={<AppSymbol name="close" color={palette.text} size={20} />}
            />
          </View>
          {points.length > 0 ? (
            <SegmentedControl
              accessibilityLabel="Show the rules or your recent points"
              options={[
                { value: "rules", label: "Rules" },
                { value: "history", label: "Your points" },
              ]}
              value={view}
              onChange={setView}
            />
          ) : null}
          <ScrollView contentContainerStyle={{ gap: spacing[2] }}>
            {view === "history" && points.length > 0 ? (
              <View testID="leaderboard-points-history" style={{ gap: spacing[2] }}>
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
            ) : board === "trending" ? (
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
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

/** Most active (Portfolio points) and Trending (last 7 days of engagement), plus your points. */
export function LeaderboardScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  // The board it opens on is an A/B test (leaderboard_default_board_v1); a pick wins after that.
  const openingBoard: LeaderboardBoard =
    useExperimentVariant("leaderboard_default_board_v1") === "trending_first"
      ? "trending"
      : "active";
  const [pickedBoard, setBoard] = useState<LeaderboardBoard | null>(null);
  const board = pickedBoard ?? openingBoard;
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [scope, setScope] = useState<LeaderboardScope>("everyone");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [summary, setSummary] = useState<LeaderboardSummary | null>(null);
  const [movement, setMovement] = useState<LeaderboardMovement | null>(null);
  const [points, setPoints] = useState<PortfolioPointsEntry[]>([]);
  const trackedRef = useRef(false);
  const [isSharingRank, setIsSharingRank] = useState(false);
  const [isShowingPoints, setIsShowingPoints] = useState(false);
  const profile = useProfileStore((state) => state.profile);

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
      .getMyMovement()
      .then((result) => {
        if (isActive) setMovement(result);
      })
      .catch((error) => reportError(error, { screen: "Leaderboard", action: "load_movement" }));
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
  const rankCard = rankCardModel(summary);
  const movementText = movementLabel(movement);
  const ownScore = board === "trending" ? null : period === "week" ? summary?.weekPoints : null;
  const cardStyle = {
    backgroundColor: palette.surface,
    borderRadius: componentRadii.card,
    gap: spacing[2],
    padding: spacing[4],
  } as const;

  const openComposer = () => {
    trackAnalyticsEvent("food_portfolio_post_tapped", { source: "leaderboard" });
    navigation.navigate("Post");
  };
  const podiumRows = rows.slice(0, 3);
  const listRows = rows.slice(3);

  return (
    <ProfileScreenShell title="Leaderboard">
      <View style={{ gap: spacing[4], paddingBottom: spacing[8] }}>
        {summary ? (
          <View
            testID="leaderboard-summary"
            style={[cardStyle, { alignItems: "center", flexDirection: "row", gap: spacing[3] }]}
          >
            <View style={{ flex: 1, gap: spacing[1] }}>
              <AppText variant="micro" tone="secondary">
                Your Portfolio points
              </AppText>
              <AppText variant="h1">{Math.round(summary.totalPoints)}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {`This week ${rankLabel(summary.activeWeekRank)} · ${Math.round(summary.weekPoints)} pts`}
              </AppText>
              {movementText ? (
                <AppText testID="leaderboard-movement" variant="bodySmallBold">
                  {movementText}
                </AppText>
              ) : null}
              <AppText variant="bodySmall" tone="secondary">
                {dailyCreditLabel(summary)}
              </AppText>
              {rankCard ? (
                <Button
                  testID="leaderboard-share-rank"
                  label="Share my rank"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  leftIcon={<AppSymbol name="share" size={16} color={palette.text} />}
                  onPress={() => setIsSharingRank(true)}
                  style={{ alignSelf: "flex-start", marginTop: spacing[1], minHeight: 44 }}
                />
              ) : null}
            </View>
            <PodiumIllustration size={88} testID="leaderboard-summary-art" />
          </View>
        ) : null}
        {isSharingRank && rankCard ? (
          <FoodPortfolioShareSheet
            visible
            onClose={() => setIsSharingRank(false)}
            card={{
              kind: "rank",
              ownerId: profile.id,
              ownerName: profile.displayName,
              rank: rankCard,
            }}
          />
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {BOARD_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={board === option.value}
              onPress={() => setBoard(option.value)}
            />
          ))}
          <Chip
            label="Following"
            accessibilityLabel="Only people you follow"
            selected={scope === "following"}
            leftIcon={<AppSymbol name="following" size={14} color={palette.text} />}
            onPress={() =>
              setScope((current) => (current === "following" ? "everyone" : "following"))
            }
          />
        </View>
        {board === "active" ? (
          <View style={{ gap: spacing[1] }}>
            <SegmentedControl
              testID="leaderboard-period"
              accessibilityLabel="Show this week or all time"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
            />
            {period === "week" ? (
              <AppText variant="micro" tone="secondary" style={{ textAlign: "center" }}>
                Weeks reset on Monday
              </AppText>
            ) : null}
          </View>
        ) : null}

        {state === "loading" && rows.length === 0 ? (
          <View testID="leaderboard-loading" style={{ minHeight: 240 }} />
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
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nobody on the board yet"
            body={
              scope === "following"
                ? "Follow people whose taste you like to see how you compare."
                : "Add a dish with a photo to get on the board. It refreshes every 10 minutes."
            }
            icon={<EmptyBoardIllustration testID="leaderboard-empty-art" />}
            ctaLabel="Add a dish"
            onPress={openComposer}
          />
        ) : (
          <View testID="leaderboard-rows" style={{ gap: spacing[2] }}>
            <Podium rows={podiumRows} board={board} onOpen={openPerson} />
            {listRows.map((row) => (
              <LeaderboardRowView
                key={row.userId}
                row={row}
                board={board}
                showFollow={scope === "everyone"}
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
                <AppText variant="bodyBold">Plenty of room at the top</AppText>
                <Button
                  label="Add a dish"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  leftIcon={<AppSymbol name="camera" size={16} color={palette.text} />}
                  onPress={openComposer}
                  style={{ alignSelf: "flex-start", minHeight: 44 }}
                />
              </View>
            ) : null}
          </View>
        )}

        <ListRow
          testID="leaderboard-how-points-work"
          first
          title="How points work"
          accessibilityHint="Shows the rules and your recent points"
          leading={<AppSymbol name="info" size={20} color={palette.accentText} />}
          onPress={() => setIsShowingPoints(true)}
        />
        <PointsSheet
          visible={isShowingPoints}
          board={board}
          points={points}
          onClose={() => setIsShowingPoints(false)}
        />
      </View>
    </ProfileScreenShell>
  );
}
