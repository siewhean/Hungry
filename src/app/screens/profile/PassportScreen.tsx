/**
 * PassportScreen — full view of the user's Hungry Passport progress.
 *
 * Replaces the old progress-list treatment with the orange Hungry Passport
 * visual system: passport cover, security-paper spread, and immigration-style
 * achievement stamps.
 */

import { View, SectionList, StyleSheet } from "react-native";
import { useEffect } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState } from "@/components/ui";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { usePassportStore, ALL_PASSPORT_CATEGORIES } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";
import {
  GITHUB_ORANGE,
  HungryPassportVisual,
  PassportStampSeal,
} from "@/components/gamification/HungryPassportVisual";

type Props = NativeStackScreenProps<RootStackParamList, "PassportScreen">;

const SECTIONS = [
  {
    title: "Cuisine Achievement Stamps",
    data: ALL_PASSPORT_CATEGORIES.filter((c) => c.type === "cuisine"),
  },
  {
    title: "Neighbourhood Checkpoints",
    data: ALL_PASSPORT_CATEGORIES.filter((c) => c.type === "neighbourhood"),
  },
];

export function PassportScreen({ navigation: _nav }: Props) {
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const progressMap = usePassportStore((s) => s.progressMap);
  const computeProgress = usePassportStore((s) => s.computeProgress);
  const getTriedStallIds = useStallInteractionStore((s) => s.getTriedStallIds);

  useEffect(() => {
    computeProgress(getTriedStallIds());
  }, [computeProgress, getTriedStallIds]);

  const totalStamps = Object.values(progressMap).reduce(
    (sum, p) => sum + p.earnedStampThresholds.length,
    0,
  );
  const triedTotal = Object.values(progressMap).reduce((sum, p) => sum + p.triedCount, 0);

  return (
    <ProfileScreenShell
      title="Hungry Passport"
      subtitle={`${totalStamps} ${totalStamps === 1 ? "stamp" : "stamps"} earned`}
    >
      <SectionList
        sections={SECTIONS}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: spacing[4], marginBottom: spacing[4] }}>
            <HungryPassportVisual
              categories={ALL_PASSPORT_CATEGORIES}
              progressMap={progressMap}
              variant="screen"
            />

            <View
              style={[
                shadows.card,
                styles.summaryCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderRadius: radii.xl,
                  padding: spacing[4],
                },
              ]}
            >
              <View style={styles.summaryHeader}>
                <View style={styles.summaryCopy}>
                  <AppText variant="bodyBold">Collect stamps. Earn badges. Share stories.</AppText>
                  <AppText tone="muted" variant="bodySmall" style={{ marginTop: spacing[1] }}>
                    Mark stalls as tried to fill your Hungry Passport with food-travel checkpoints.
                  </AppText>
                </View>
                <View style={[styles.passportStatBadge, { backgroundColor: GITHUB_ORANGE }]}>
                  <AppText variant="bodyBold" style={styles.passportStatNumber}>
                    {totalStamps}
                  </AppText>
                  <AppText variant="micro" style={styles.passportStatLabel}>
                    STAMPS
                  </AppText>
                </View>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: palette.border }]} />

              <View style={styles.summaryStatsRow}>
                <View style={styles.summaryStatItem}>
                  <AppText variant="h3" style={{ color: GITHUB_ORANGE }}>
                    {triedTotal}
                  </AppText>
                  <AppText tone="muted" variant="micro">
                    TOTAL TRIES
                  </AppText>
                </View>
                <View style={styles.summaryStatItem}>
                  <AppText variant="h3" style={{ color: GITHUB_ORANGE }}>
                    {ALL_PASSPORT_CATEGORIES.length}
                  </AppText>
                  <AppText tone="muted" variant="micro">
                    CHECKPOINTS
                  </AppText>
                </View>
                <View style={styles.summaryStatItem}>
                  <AppText variant="h3" style={{ color: GITHUB_ORANGE }}>
                    4
                  </AppText>
                  <AppText tone="muted" variant="micro">
                    LEVELS EACH
                  </AppText>
                </View>
              </View>
            </View>
          </View>
        }
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeader, { marginBottom: spacing[2], marginTop: spacing[2] }]}>
            <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
            <AppText variant="h3" style={styles.sectionTitle}>
              {title}
            </AppText>
            <View style={[styles.sectionRule, { backgroundColor: palette.border }]} />
          </View>
        )}
        renderItem={({ item: category, index }) => {
          const progress = progressMap[category.id];
          const triedCount = progress?.triedCount ?? 0;
          const earnedCount = progress?.earnedStampThresholds.length ?? 0;
          const nextThreshold = category.stampThresholds[progress?.nextStampIndex ?? 0] ?? null;
          const fraction = nextThreshold ? Math.min(triedCount / nextThreshold, 1) : 1;
          const hasStarted = triedCount > 0;

          return (
            <View
              style={[
                shadows.card,
                styles.stampCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: hasStarted ? `${GITHUB_ORANGE}55` : palette.border,
                  borderRadius: radii.xl,
                  marginBottom: spacing[3],
                  padding: spacing[4],
                },
              ]}
            >
              <View style={styles.stampCardHeader}>
                <PassportStampSeal
                  category={category}
                  index={index}
                  progress={progress}
                  size="large"
                />

                <View style={styles.stampCardCopy}>
                  <View style={styles.stampTitleRow}>
                    <AppText variant="bodyBold" style={styles.stampTitle}>
                      {category.name}
                    </AppText>
                    {earnedCount > 0 && (
                      <View style={[styles.earnedPill, { backgroundColor: `${GITHUB_ORANGE}18` }]}>
                        <AppText variant="micro" style={styles.earnedPillText}>
                          {earnedCount} EARNED
                        </AppText>
                      </View>
                    )}
                  </View>

                  <AppText tone="muted" variant="bodySmall" style={{ marginTop: spacing[1] }}>
                    {category.description}
                  </AppText>

                  <View style={styles.metaRow}>
                    <View style={[styles.metaChip, { borderColor: palette.border }]}>
                      <AppText tone="muted" variant="micro">
                        {triedCount} TRIED
                      </AppText>
                    </View>
                    <View style={[styles.metaChip, { borderColor: palette.border }]}>
                      <AppText tone="muted" variant="micro">
                        {nextThreshold ? `NEXT AT ${nextThreshold}` : "COMPLETE"}
                      </AppText>
                    </View>
                  </View>
                </View>
              </View>

              {nextThreshold ? (
                <View style={{ gap: spacing[1], marginTop: spacing[3] }}>
                  <View
                    style={[
                      styles.progressTrack,
                      {
                        backgroundColor: palette.border,
                        borderRadius: radii.pill,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: GITHUB_ORANGE,
                          borderRadius: radii.pill,
                          width: `${fraction * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabels}>
                    <AppText tone="muted" variant="micro">
                      {triedCount}/{nextThreshold} tried
                    </AppText>
                    <AppText tone="muted" variant="micro">
                      {nextThreshold - triedCount > 0
                        ? `${nextThreshold - triedCount} more to stamp`
                        : "Stamp ready"}
                    </AppText>
                  </View>
                </View>
              ) : (
                <View style={[styles.completeBanner, { backgroundColor: `${GITHUB_ORANGE}14` }]}> 
                  <AppText variant="micro" style={styles.completeBannerText}>
                    ALL PASSPORT STAMPS EARNED
                  </AppText>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Nothing yet"
            body="Mark stalls as tried to earn your first passport stamp."
          />
        }
      />
    </ProfileScreenShell>
  );
}

const styles = StyleSheet.create({
  completeBanner: {
    alignItems: "center",
    borderRadius: 999,
    marginTop: 12,
    paddingVertical: 8,
  },
  completeBannerText: {
    color: GITHUB_ORANGE,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  earnedPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  earnedPillText: {
    color: GITHUB_ORANGE,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    lineHeight: 12,
  },
  metaChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  passportStatBadge: {
    alignItems: "center",
    borderRadius: 18,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passportStatLabel: {
    color: "#FFF6D6",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    lineHeight: 11,
  },
  passportStatNumber: {
    color: "#FFF6D6",
    fontSize: 25,
    lineHeight: 28,
  },
  progressFill: {
    height: 7,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressTrack: {
    height: 7,
    overflow: "hidden",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  sectionRule: {
    flex: 1,
    height: 1,
  },
  sectionTitle: {
    flexShrink: 0,
    textAlign: "center",
  },
  stampCard: {
    borderWidth: 1,
  },
  stampCardCopy: {
    flex: 1,
  },
  stampCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  stampTitle: {
    flex: 1,
  },
  stampTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    borderWidth: 1,
  },
  summaryCopy: {
    flex: 1,
    paddingRight: 12,
  },
  summaryDivider: {
    height: 1,
    marginVertical: 14,
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
  },
  summaryStatItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  summaryStatsRow: {
    flexDirection: "row",
  },
});
