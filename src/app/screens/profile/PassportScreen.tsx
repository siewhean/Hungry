/**
 * PassportScreen — branded Hungry Passport progress and stamp collection.
 */

import { AccessibilityInfo, Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "@/lib/haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { AchievementsSection } from "@/components/gamification/AchievementsSection";
import { PassportPageFlip } from "@/components/gamification/PassportPageFlip";
import { PassportStampBadge } from "@/components/gamification/PassportStampBadge";
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

const CATEGORY_LABELS: Record<string, string> = {
  cuisine: "Cuisine Explorer",
  neighbourhood: "Neighbourhood Trails",
  classic: "Singapore Classics",
  dietary: "Dietary Trails",
  contributor: "Contributor Marks",
};

const CATEGORIES_BY_ID = ALL_PASSPORT_CATEGORIES.reduce<
  Record<string, (typeof ALL_PASSPORT_CATEGORIES)[number]>
>((map, category) => {
  map[category.id] = category;
  return map;
}, {});

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

export function PassportScreen({ navigation }: Props) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
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

  const sections = useMemo(
    () =>
      ALL_PASSPORT_CATEGORIES.reduce<{ title: string; data: typeof ALL_PASSPORT_CATEGORIES }[]>(
        (acc, category) => {
          const title = CATEGORY_LABELS[category.type] ?? category.type;
          const existing = acc.find((section) => section.title === title);
          if (existing) {
            existing.data.push(category);
          } else {
            acc.push({ title, data: [category] });
          }
          return acc;
        },
        [],
      ),
    [],
  );

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
              padding: spacing[5],
            }}
          >
            <AppText variant="micro" style={{ color: palette.amber }}>
              HUNGRY PASSPORT
            </AppText>
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
              <AppText variant="h3" style={{ color: palette.textOnDark }}>
                {totalStamps} / {PASSPORT_STAMP_DEFINITIONS.length} stamps
              </AppText>
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

        <WeeklyGoalCard
          progress={weeklyGoal}
          celebrating={celebratingGoal}
          reduceMotion={reduceMotion}
        />

        <AchievementsSection rows={achievements} />

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
          <AppText variant="h2">Heritage stamps ({totalStamps})</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {stampPreview.map(({ category, stamp, earned }) =>
              stamp ? (
                <View
                  key={category.id}
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    borderWidth: 1,
                    flexBasis: "48%",
                    flexGrow: 1,
                    gap: spacing[1],
                    padding: spacing[3],
                  }}
                >
                  <PassportStampBadge stamp={stamp} earned={earned} size="sm" />
                  <AppText
                    variant="bodySmallBold"
                    numberOfLines={2}
                    style={{ textAlign: "center" }}
                  >
                    {stamp.title}
                  </AppText>
                  <AppText tone="muted" variant="micro" numberOfLines={1}>
                    {earned ? "Earned" : "Locked"}
                  </AppText>
                </View>
              ) : null,
            )}
          </View>
        </View>

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
              reduceMotion={reduceMotion}
              stamp={nextStamp.stamp}
            />
          </View>
        ) : null}

        {sections.map((section) => (
          <View key={section.title} style={{ gap: spacing[3] }}>
            <AppText variant="h3">{section.title}</AppText>
            {section.data.map((category) => {
              const progress = progressMap[category.id];
              const earnedForCategory = earnedStamps.filter(
                (stamp) => stamp.categoryId === category.id,
              );
              const stamps =
                earnedForCategory.length > 0
                  ? earnedForCategory
                  : PASSPORT_STAMP_DEFINITIONS.filter(
                      (stamp) => stamp.categoryId === category.id && stamp.index === 0,
                    );

              return (
                <View key={category.id} style={{ gap: spacing[2] }}>
                  {stamps.map((stamp) => (
                    <PassportStampCard
                      key={stamp.id}
                      category={CATEGORIES_BY_ID[stamp.categoryId] ?? category}
                      celebrating={celebratingStampId === stamp.id}
                      earned={earnedForCategory.some((earned) => earned.id === stamp.id)}
                      nextStamp={nextStamp}
                      triedInCategory={progress?.triedCount ?? 0}
                      reduceMotion={reduceMotion}
                      stamp={stamp}
                    />
                  ))}
                  {!progress || progress.triedCount === 0 ? (
                    <AppText tone="muted" variant="micro">
                      Try a matching stall to start this page.
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
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
