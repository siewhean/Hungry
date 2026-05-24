/**
 * PassportScreen — branded Hungry Passport progress and stamp collection.
 */

import { AccessibilityInfo, ScrollView, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { PassportBook } from "@/components/gamification/PassportBook";
import { PassportPageFlip } from "@/components/gamification/PassportPageFlip";
import { PassportStampCard } from "@/components/gamification/PassportStampCard";
import { AppText, EmptyState } from "@/components/ui";
import {
  ALL_PASSPORT_CATEGORIES,
  PASSPORT_BADGE_DEFINITIONS,
  PASSPORT_STAMP_DEFINITIONS,
  createPassportCelebrateMarker,
  getEarnedPassportStamps,
  getNewlyEarnedUncelebratedStamp,
  getNextPassportStamp,
} from "@/constants/passportConfig";
import { usePassportStore } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";

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

export function PassportScreen({ navigation: _nav }: Props) {
  const { spacing } = useHungryTheme();
  const progressMap = usePassportStore((s) => s.progressMap);
  const celebratedStampIds = usePassportStore((s) => s.celebratedStampIds);
  const computeProgress = usePassportStore((s) => s.computeProgress);
  const markStampCelebrated = usePassportStore((s) => s.markStampCelebrated);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [celebratingStampId, setCelebratingStampId] = useState<string | null>(null);

  const triedStallIds = useMemo(
    () =>
      Object.values(stallInteractions)
        .filter((interaction) => interaction.isTried)
        .map((interaction) => interaction.stallId),
    [stallInteractions],
  );

  const earnedStamps = useMemo(() => getEarnedPassportStamps(progressMap), [progressMap]);
  const nextStamp = useMemo(() => getNextPassportStamp(progressMap), [progressMap]);
  const celebrateMarker = useMemo(
    () =>
      createPassportCelebrateMarker(
        getNewlyEarnedUncelebratedStamp(progressMap, celebratedStampIds),
      ),
    [progressMap, celebratedStampIds],
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    computeProgress(triedStallIds);
  }, [computeProgress, triedStallIds]);
  const totalStamps = earnedStamps.length;

  useEffect(() => {
    if (!celebrateMarker?.shouldCelebrate || celebratingStampId === celebrateMarker.stampId) {
      return;
    }

    setCelebratingStampId(celebrateMarker.stampId);
    AccessibilityInfo.announceForAccessibility(`Achievement stamped: ${celebrateMarker.title}`);
    if (!reduceMotion) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const timeout = setTimeout(
      () => {
        markStampCelebrated(celebrateMarker.stampId);
        setCelebratingStampId(null);
      },
      reduceMotion ? 300 : 1400,
    );

    return () => clearTimeout(timeout);
  }, [celebrateMarker, celebratingStampId, markStampCelebrated, reduceMotion]);

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
    <ProfileScreenShell
      title="Hungry Passport"
      subtitle={`${totalStamps} ${totalStamps === 1 ? "stamp" : "stamps"} earned`}
    >
      <ScrollView contentContainerStyle={{ gap: spacing[5], paddingBottom: spacing[8] }}>
        <PassportPageFlip
          pageKey={`${totalStamps}-${celebratingStampId ?? "idle"}`}
          reduceMotion={reduceMotion}
        >
          <PassportBook
            badges={PASSPORT_BADGE_DEFINITIONS}
            earnedStamps={earnedStamps}
            nextStamp={nextStamp}
          />
        </PassportPageFlip>

        {earnedStamps.length === 0 && !nextStamp ? (
          <EmptyState
            title="Nothing yet"
            body="Mark stalls as tried to earn your first passport stamp."
          />
        ) : null}

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
      </ScrollView>
    </ProfileScreenShell>
  );
}
