/**
 * PassportScreen — branded Hungry Passport progress and stamp collection.
 */

import { AccessibilityInfo, Pressable, View, useWindowDimensions } from "react-native";
import { Award, ChevronRight, Flag, Star } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "@/lib/haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { AchievementsSection } from "@/components/gamification/AchievementsSection";
import { PassportPageFlip } from "@/components/gamification/PassportPageFlip";
import { HeritageStampTile } from "@/components/gamification/HeritageStampTile";
import { PassportStampCard } from "@/components/gamification/PassportStampCard";
import { WeeklyGoalCard } from "@/components/gamification/WeeklyGoalCard";
import { AppText, EmptyState } from "@/components/ui";
import {
  ALL_PASSPORT_CATEGORIES,
  PASSPORT_STAMP_DEFINITIONS,
  createPassportCelebrateMarker,
  getEarnedPassportStamps,
  getNewlyEarnedUncelebratedStamp,
  getNextPassportStamp,
} from "@/constants/passportConfig";
import { computeAchievements } from "@/features/achievements/achievements";
import { useAchievementInput } from "@/features/achievements/useAchievementInput";
import { computeWeeklyGoal, milestoneReachedThisWeek } from "@/features/passport/weeklyGoal";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { trackPassportViewed } from "@/lib/analytics/gamificationEvents";
import { useChecklistStore } from "@/store/useChecklistStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";
import type { PassportContributionStats, PassportProgressEvent } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "PassportScreen">;

const CONTRIBUTION_EVENT_LABELS: Record<PassportProgressEvent["eventType"], string> = {
  dish_tried: "Tried a dish",
  stall_visited: "Visited a stall",
  stall_submitted: "Submitted a stall",
  review_posted: "Posted a review",
  photo_posted: "Added a photo",
  portfolio_item_added: "Added to a portfolio",
  public_portfolio_published: "Published a portfolio",
  trail_completed: "Completed a trail",
};

function formatContributionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const PASSPORT_RANKS = [
  { min: 0, title: "New Taster" },
  { min: 1, title: "Hawker Explorer" },
  { min: 5, title: "Food Trailblazer" },
  { min: 12, title: "Master Foodie" },
  { min: 25, title: "Hawker Legend" },
] as const;

/** The hero's rank title for a stamp count. */
export function passportRankTitle(stamps: number): string {
  return [...PASSPORT_RANKS].reverse().find((rank) => stamps >= rank.min)?.title ?? "New Taster";
}

/** "Level 1" for no stamps, then one level per rank reached. */
export function passportLevelLabel(stamps: number): string {
  return `Level ${PASSPORT_RANKS.filter((rank) => stamps >= rank.min).length}`;
}

export function PassportScreen({ navigation }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Three stamps per row inside the screen's spacing[4] gutters.
  const stampTileWidth = (screenWidth - spacing[4] * 2 - spacing[2] * 2) / 3;
  const progressMap = usePassportStore((s) => s.progressMap);
  const celebratedStampIds = usePassportStore((s) => s.celebratedStampIds);
  // Celebrated ids load asynchronously; celebrating before then would replay old stamps.
  const [passportHydrated, setPassportHydrated] = useState(() =>
    usePassportStore.persist.hasHydrated(),
  );
  const computeProgress = usePassportStore((s) => s.computeProgress);
  const markStampCelebrated = usePassportStore((s) => s.markStampCelebrated);
  const loadPassportStamps = usePassportStore((s) => s.loadStamps);
  const loadPassportEvents = usePassportStore((s) => s.loadEvents);
  const passportStamps = usePassportStore((s) => s.stamps);
  const passportEvents = usePassportStore((s) => s.events);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const checklistItems = useChecklistStore((state) => state.items);
  const celebratedGoalWeeks = usePassportStore((s) => s.celebratedGoalWeeks);
  const markGoalWeekCelebrated = usePassportStore((s) => s.markGoalWeekCelebrated);
  const achievementInput = useAchievementInput();
  const achievements = useMemo(() => computeAchievements(achievementInput), [achievementInput]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [celebratingStampId, setCelebratingStampId] = useState<string | null>(null);
  const [celebratingGoal, setCelebratingGoal] = useState(false);

  const triedStallIds = useMemo(
    () =>
      Object.values(stallInteractions)
        .filter((interaction) => interaction.isTried)
        .map((interaction) => interaction.stallId),
    [stallInteractions],
  );

  // One entry per tried stall or dish (a stall tried and on a checklist counts once).
  const weeklyGoal = useMemo(() => {
    const triedAtByItem = new Map<string, string>();
    for (const interaction of Object.values(stallInteractions)) {
      if (interaction.isTried && interaction.triedAt) {
        triedAtByItem.set(`stall:${interaction.stallId}`, interaction.triedAt);
      }
    }
    for (const item of Object.values(checklistItems).flat()) {
      if (!item.triedAt) continue;
      const key = item.dishId
        ? `dish:${item.dishId}`
        : item.stallId
          ? `stall:${item.stallId}`
          : `item:${item.id}`;
      if (!triedAtByItem.has(key)) triedAtByItem.set(key, item.triedAt);
    }
    return computeWeeklyGoal([...triedAtByItem.values()]);
  }, [checklistItems, stallInteractions]);

  const earnedStamps = useMemo(() => getEarnedPassportStamps(progressMap), [progressMap]);
  const nextStamp = useMemo(() => getNextPassportStamp(progressMap), [progressMap]);
  const contributionStats = useMemo(
    () => usePassportStore.getState().getPortfolioContributionStats(),
    [passportEvents, passportStamps],
  );
  const celebrateMarker = useMemo(
    () =>
      createPassportCelebrateMarker(
        getNewlyEarnedUncelebratedStamp(progressMap, celebratedStampIds),
      ),
    [progressMap, celebratedStampIds],
  );

  useEffect(() => {
    if (passportHydrated) return;
    if (usePassportStore.persist.hasHydrated()) {
      setPassportHydrated(true);
      return;
    }
    return usePassportStore.persist.onFinishHydration(() => setPassportHydrated(true));
  }, [passportHydrated]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    computeProgress(triedStallIds);
  }, [computeProgress, triedStallIds]);

  useEffect(() => {
    trackPassportViewed("profile");
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadPassportStamps(), loadPassportEvents()]).catch(() => undefined);
    }, [loadPassportEvents, loadPassportStamps]),
  );

  const totalStamps = earnedStamps.length;
  const stampPreview = ALL_PASSPORT_CATEGORIES.map((category) => {
    const earned = earnedStamps.filter((stamp) => stamp.categoryId === category.id);
    return {
      category,
      stamp:
        earned.at(-1) ??
        PASSPORT_STAMP_DEFINITIONS.find(
          (stamp) => stamp.categoryId === category.id && stamp.index === 0,
        ),
      earned: earned.length > 0,
    };
  }).filter((item) => item.stamp !== undefined);

  // Mark the stamp celebrated as soon as the celebration starts, so it never re-fires;
  // the visual flag is local state cleared by its own timer below.
  useEffect(() => {
    if (!passportHydrated || !celebrateMarker?.shouldCelebrate) return;

    markStampCelebrated(celebrateMarker.stampId);
    setCelebratingStampId(celebrateMarker.stampId);
    AccessibilityInfo.announceForAccessibility(`Achievement stamped: ${celebrateMarker.title}`);
    if (!reduceMotion) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [celebrateMarker, markStampCelebrated, passportHydrated, reduceMotion]);

  // Celebrate this week's goal once, the first time the Passport sees it met.
  useEffect(() => {
    if (!passportHydrated || !weeklyGoal.completed || celebratedGoalWeeks[weeklyGoal.weekKey]) {
      return;
    }

    markGoalWeekCelebrated(weeklyGoal.weekKey);
    setCelebratingGoal(true);
    const milestone = milestoneReachedThisWeek(weeklyGoal);
    trackAnalyticsEvent("weekly_goal_completed", {
      week: weeklyGoal.weekKey,
      count: weeklyGoal.count,
      weeks_completed: weeklyGoal.weeksCompleted,
      ...(milestone ? { milestone: milestone.title } : {}),
    });
    AccessibilityInfo.announceForAccessibility(
      milestone ? `Weekly goal complete. ${milestone.title}!` : "Weekly goal complete!",
    );
    if (!reduceMotion) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [celebratedGoalWeeks, markGoalWeekCelebrated, passportHydrated, reduceMotion, weeklyGoal]);

  useEffect(() => {
    if (!celebratingGoal) return;
    const timeout = setTimeout(() => setCelebratingGoal(false), reduceMotion ? 300 : 1600);
    return () => clearTimeout(timeout);
  }, [celebratingGoal, reduceMotion]);

  useEffect(() => {
    if (!celebratingStampId) return;
    const timeout = setTimeout(() => setCelebratingStampId(null), reduceMotion ? 300 : 1400);
    return () => clearTimeout(timeout);
  }, [celebratingStampId, reduceMotion]);

  return (
    <ProfileScreenShell title="Achievements">
      <View style={{ gap: spacing[5], paddingBottom: spacing[8] }}>
        <PassportPageFlip
          pageKey={`${totalStamps}-${celebratingStampId ?? "idle"}`}
          reduceMotion={reduceMotion}
        >
          <View
            style={{
              backgroundColor: palette.navy,
              borderRadius: componentRadii.card,
              gap: spacing[4],
              overflow: "hidden",
              padding: spacing[5],
            }}
          >
            {/* Watermark star, like a passport seal */}
            <View pointerEvents="none" style={{ bottom: -36, position: "absolute", right: -28 }}>
              <Star color={palette.inverseIndicator} size={170} strokeWidth={1} />
            </View>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1.5] }}>
                <Award color={palette.amber} size={16} />
                <AppText variant="micro" style={{ color: palette.amber, fontWeight: "700" }}>
                  HUNGRY PASSPORT
                </AppText>
              </View>
              <View
                style={{
                  backgroundColor: palette.inverseSurfaceSubtle,
                  borderRadius: radii.pill,
                  paddingHorizontal: spacing[2.5],
                  paddingVertical: spacing[0.5],
                }}
              >
                <AppText variant="micro" style={{ color: palette.textOnDark, fontWeight: "700" }}>
                  {passportLevelLabel(totalStamps)}
                </AppText>
              </View>
            </View>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="h2" style={{ color: palette.textOnDark }}>
                Your Singapore food trail
              </AppText>
              <AppText variant="bodySmall" style={{ color: palette.inverseTextSecondary }}>
                Try stalls and share discoveries to collect stamps.
              </AppText>
            </View>
            <View
              style={{
                backgroundColor: palette.inverseSurfaceSubtle,
                borderRadius: radii.md,
                gap: spacing[2],
                padding: spacing[3],
              }}
            >
              <View
                style={{
                  alignItems: "baseline",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <AppText variant="h3" style={{ color: palette.textOnDark }}>
                  {totalStamps} / {PASSPORT_STAMP_DEFINITIONS.length} stamps
                </AppText>
                <AppText variant="bodySmallBold" style={{ color: palette.amber }}>
                  {passportRankTitle(totalStamps)}
                </AppText>
              </View>
              <View
                accessibilityLabel={`${totalStamps} of ${PASSPORT_STAMP_DEFINITIONS.length} stamps earned`}
                style={{
                  backgroundColor: palette.inverseIndicator,
                  borderRadius: radii.pill,
                  height: spacing[2],
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    backgroundColor: palette.orange,
                    height: "100%",
                    width: `${(totalStamps / PASSPORT_STAMP_DEFINITIONS.length) * 100}%`,
                  }}
                />
              </View>
              <AppText variant="bodySmall" style={{ color: palette.inverseTextSecondary }}>
                {nextStamp
                  ? `${nextStamp.remainingCount} more to earn ${nextStamp.stamp.title}`
                  : "All available stamps collected"}
              </AppText>
            </View>
          </View>
        </PassportPageFlip>

        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          <Flag color={palette.orange} size={18} />
          <AppText variant="h2" style={{ flex: 1 }}>
            Active missions
          </AppText>
          <AppText variant="bodySmall" tone="muted">
            {weeklyGoal.completed ? "Done this week" : "1 in progress"}
          </AppText>
        </View>
        <WeeklyGoalCard
          progress={weeklyGoal}
          celebrating={celebratingGoal}
          reduceMotion={reduceMotion}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Visited stalls, ${achievementInput.stallsVisited}`}
          onPress={() =>
            navigation.navigate("MainTabs", {
              screen: "Profile",
              params: { screen: "VisitedStalls" },
            })
          }
          style={{
            alignItems: "center",
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 56,
            paddingHorizontal: spacing[4],
          }}
        >
          <AppText variant="bodyBold">Visited stalls</AppText>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <AppText tone="secondary" variant="bodySmall">
              {achievementInput.stallsVisited}
            </AppText>
            <ChevronRight size={18} color={palette.textMuted} />
          </View>
        </Pressable>

        {earnedStamps.length === 0 && !nextStamp ? (
          <EmptyState
            title="Nothing yet"
            body="Mark stalls as tried to earn your first passport stamp."
          />
        ) : null}

        <View style={{ gap: spacing[3] }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
            <Award color={palette.orange} size={18} />
            <AppText variant="h2">Heritage stamps ({totalStamps})</AppText>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {stampPreview.map(({ category, stamp, earned }) =>
              stamp ? (
                <HeritageStampTile
                  key={category.id}
                  title={stamp.title}
                  subtitle={stamp.subtitle}
                  detail={`${progressMap[category.id]?.triedCount ?? 0} tried`}
                  earned={earned}
                  width={stampTileWidth}
                />
              ) : null,
            )}
          </View>
        </View>

        <AchievementsSection rows={achievements} />

        <PortfolioContributionPanel
          componentRadii={componentRadii}
          contributionStats={contributionStats}
          palette={palette}
          radii={radii}
          spacing={spacing}
        />

        {nextStamp ? (
          <View style={{ gap: spacing[2] }}>
            <AppText variant="h3">Next stamp</AppText>
            <PassportStampCard
              category={nextStamp.category}
              nextStamp={nextStamp}
              triedInCategory={progressMap[nextStamp.category.id]?.triedCount ?? 0}
              reduceMotion={reduceMotion}
              stamp={nextStamp.stamp}
            />
          </View>
        ) : null}
      </View>
    </ProfileScreenShell>
  );
}

function PortfolioContributionPanel({
  componentRadii,
  contributionStats,
  palette,
  radii,
  spacing,
}: {
  componentRadii: ReturnType<typeof useHungryTheme>["componentRadii"];
  contributionStats: PassportContributionStats;
  palette: ReturnType<typeof useHungryTheme>["palette"];
  radii: ReturnType<typeof useHungryTheme>["radii"];
  spacing: ReturnType<typeof useHungryTheme>["spacing"];
}) {
  const stats = [
    { label: "Stalls added", value: contributionStats.stallsSubmitted },
    { label: "Items", value: contributionStats.portfolioItemsAdded },
    { label: "Published", value: contributionStats.publicPortfoliosPublished },
    { label: "Trails", value: contributionStats.trailsCompleted },
  ];
  const hasRecentActivity = contributionStats.recentEvents.length > 0;

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: componentRadii.card,
        borderWidth: 1,
        gap: spacing[4],
        padding: spacing[4],
      }}
    >
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h3">Portfolio contributions</AppText>
        <AppText tone="muted" variant="bodySmall">
          Public lists, trails, and ranked picks that help other diners discover where to eat.
        </AppText>
      </View>

      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              backgroundColor: palette.orangeLight,
              borderColor: palette.orange,
              borderRadius: radii.lg,
              borderWidth: 1,
              flex: 1,
              gap: spacing[1],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
            }}
          >
            <AppText style={{ color: palette.orangeDark }} variant="bodyBold">
              {stat.value}
            </AppText>
            <AppText tone="muted" variant="micro">
              {stat.label}
            </AppText>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing[2] }}>
        <AppText variant="bodySmallBold">Recent contribution activity</AppText>
        {hasRecentActivity ? (
          contributionStats.recentEvents.map((event) => (
            <View
              key={event.id}
              style={{
                alignItems: "center",
                borderColor: palette.border,
                borderRadius: radii.md,
                borderWidth: 1,
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[2],
              }}
            >
              <AppText variant="bodySmall">
                {CONTRIBUTION_EVENT_LABELS[event.eventType] ?? "Contribution recorded"}
              </AppText>
              <AppText tone="muted" variant="micro">
                {formatContributionDate(event.createdAt)}
              </AppText>
            </View>
          ))
        ) : (
          <View
            style={{
              backgroundColor: palette.bg,
              borderRadius: radii.md,
              padding: spacing[3],
            }}
          >
            <AppText tone="muted" variant="bodySmall">
              Add dishes or stalls to a portfolio, then publish a public list to build your
              contributor marks.
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
