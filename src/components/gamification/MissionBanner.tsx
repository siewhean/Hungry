/**
 * MissionBanner — compact inline summary for the HomeScreen.
 *
 * Shows the most-in-progress incomplete mission with a progress bar.
 * Tapping navigates to MissionsScreen.
 */

import { View, Pressable, StyleSheet } from "react-native";
import { useMemo } from "react";
import { ChevronRight, Target } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import { useMissionStore } from "@/store/useMissionStore";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";

interface MissionBannerProps {
  onPress?: () => void;
}

export function MissionBanner({ onPress }: MissionBannerProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const missions = useMissionStore((s) => s.missions);
  const progressMap = useMissionStore((s) => s.progressMap);
  const disclosure = getDataTrustDisclosure("missions");
  const activeMissions = useMemo(() => {
    return missions.filter((mission) => !progressMap[mission.id]?.completedAt);
  }, [missions, progressMap]);
  const completedMissions = useMemo(() => {
    return missions.filter((mission) => !!progressMap[mission.id]?.completedAt);
  }, [missions, progressMap]);

  const featured = useMemo(() => {
    return activeMissions.slice().sort((a, b) => {
      const pa = progressMap[a.id]?.currentCount ?? 0;
      const pb = progressMap[b.id]?.currentCount ?? 0;
      const ra = pa / a.requirementCount;
      const rb = pb / b.requirementCount;
      return rb - ra;
    })[0];
  }, [activeMissions, progressMap]);

  // Pick the most-in-progress active mission to feature
  const allDone = activeMissions.length === 0 && completedMissions.length > 0;

  if (!featured && !allDone) return null;

  if (allDone) {
    return (
      <Pressable
        accessibilityLabel="Weekly missions complete"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: palette.successSoft,
            opacity: pressed ? 0.8 : 1,
            borderColor: palette.success,
            borderRadius: componentRadii.card,
            borderWidth: 1,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[3],
          },
        ]}
      >
        <View style={styles.row}>
          <Target size={16} color={palette.success} style={{ marginRight: spacing[2] }} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodySmall" style={{ color: palette.success, fontWeight: "700" }}>
              All missions complete this week!
            </AppText>
            <AppText tone="muted" variant="micro">
              {disclosure}
            </AppText>
          </View>
          <ChevronRight size={16} color={palette.success} />
        </View>
      </Pressable>
    );
  }

  const currentCount = progressMap[featured!.id]?.currentCount ?? 0;
  const total = featured!.requirementCount;
  const fraction = Math.min(currentCount / total, 1);

  return (
    <Pressable
      accessibilityLabel={`Mission: ${featured!.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          borderColor: palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[2],
        },
      ]}
    >
      {/* Header row */}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={styles.row}>
          <Target size={16} color={palette.orange} style={{ marginRight: spacing[2] }} />
          <AppText variant="bodySmall" style={{ color: palette.orange, fontWeight: "700" }}>
            This week
          </AppText>
        </View>
        <ChevronRight size={16} color={palette.textMuted} />
      </View>
      {/* Disclosure on its own line so the header is not squeezed. */}
      <AppText tone="muted" variant="micro">
        {disclosure}
      </AppText>

      {/* Mission title */}
      <AppText variant="bodySmall" numberOfLines={1}>
        {featured!.title}
      </AppText>

      {/* Progress bar + label */}
      <View style={{ gap: spacing[1] }}>
        <View
          style={{
            backgroundColor: palette.border,
            borderRadius: radii.pill,
            height: 5,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              backgroundColor: palette.orange,
              borderRadius: radii.pill,
              height: 5,
              width: `${fraction * 100}%`,
            }}
          />
        </View>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <AppText tone="muted" variant="micro">
            {currentCount}/{total}
          </AppText>
          {completedMissions.length > 0 && (
            <AppText tone="muted" variant="micro">
              {completedMissions.length} done
            </AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
