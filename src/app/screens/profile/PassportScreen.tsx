/**
 * PassportScreen — full view of the user's Hungry Passport progress.
 *
 * Shows cuisine and neighbourhood categories in two sections.
 * Each row displays: category name, tried count / next threshold, progress bar, earned stamps.
 */

import { View, SectionList } from "react-native";
import { useEffect } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Stamp } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState } from "@/components/ui";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { usePassportStore, ALL_PASSPORT_CATEGORIES } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "PassportScreen">;

// Sections: cuisine first, then neighbourhood
const SECTIONS = [
  {
    title: "Cuisine Explorer",
    data: ALL_PASSPORT_CATEGORIES.filter((c) => c.type === "cuisine"),
  },
  {
    title: "Neighbourhood Trails",
    data: ALL_PASSPORT_CATEGORIES.filter((c) => c.type === "neighbourhood"),
  },
];

export function PassportScreen({ navigation: _nav }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const progressMap = usePassportStore((s) => s.progressMap);
  const computeProgress = usePassportStore((s) => s.computeProgress);
  const getTriedStallIds = useStallInteractionStore((s) => s.getTriedStallIds);

  // Recompute on mount in case interactions changed
  useEffect(() => {
    computeProgress(getTriedStallIds());
  }, [computeProgress, getTriedStallIds]);

  const totalStamps = Object.values(progressMap).reduce(
    (sum, p) => sum + p.earnedStampThresholds.length,
    0,
  );

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
        renderSectionHeader={({ section: { title } }) => (
          <AppText variant="h3" style={{ marginBottom: spacing[2], marginTop: spacing[2] }}>
            {title}
          </AppText>
        )}
        renderItem={({ item: category }) => {
          const progress = progressMap[category.id];
          const triedCount = progress?.triedCount ?? 0;
          const earnedCount = progress?.earnedStampThresholds.length ?? 0;
          const nextThreshold = category.stampThresholds[progress?.nextStampIndex ?? 0] ?? null;
          const fraction = nextThreshold ? Math.min(triedCount / nextThreshold, 1) : 1;

          return (
            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.xl,
                borderWidth: 1,
                marginBottom: spacing[3],
                padding: spacing[4],
                gap: spacing[2],
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <AppText variant="bodyBold" style={{ flex: 1 }}>
                  {category.name}
                </AppText>
                {earnedCount > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Stamp size={14} color={palette.orange} />
                    <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
                      {earnedCount}
                    </AppText>
                  </View>
                )}
              </View>

              {/* Description */}
              <AppText tone="muted" variant="bodySmall">
                {category.description}
              </AppText>

              {/* Progress bar */}
              {nextThreshold && (
                <View style={{ gap: spacing[1] }}>
                  <View
                    style={{
                      backgroundColor: palette.border,
                      borderRadius: radii.pill,
                      height: 6,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: palette.orange,
                        borderRadius: radii.pill,
                        height: 6,
                        width: `${fraction * 100}%`,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText tone="muted" variant="micro">
                      {triedCount}/{nextThreshold} tried
                    </AppText>
                    <AppText tone="muted" variant="micro">
                      Next stamp at {nextThreshold}
                    </AppText>
                  </View>
                </View>
              )}

              {!nextThreshold && triedCount > 0 && (
                <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
                  All stamps earned!
                </AppText>
              )}

              {triedCount === 0 && (
                <AppText tone="muted" variant="micro">
                  Try a stall to start
                </AppText>
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
