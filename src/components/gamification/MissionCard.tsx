/**
 * MissionCard — single mission row showing title, progress bar, and reward.
 * Used inside MissionsScreen.
 */

import { View, StyleSheet } from "react-native";
import { CircleCheck } from "lucide-react-native";

import { useHungryTheme } from "@/theme";
import { AppText } from "@/components/ui/AppText";
import type { UserMissionProgress, WeeklyMission } from "@/types/domain";

interface MissionCardProps {
  mission: WeeklyMission;
  progress: UserMissionProgress | null;
}

export function MissionCard({ mission, progress }: MissionCardProps) {
  const { componentRadii, palette, radii, spacing } = useHungryTheme();

  const current = progress?.currentCount ?? 0;
  const total = mission.requirementCount;
  const isComplete = !!progress?.completedAt;
  const fraction = Math.min(current / total, 1);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isComplete ? palette.successSoft : palette.surface,
          borderColor: isComplete ? palette.success : palette.border,
          borderRadius: componentRadii.card,
          borderWidth: 1,
          padding: spacing[4],
          gap: spacing[2],
        },
      ]}
    >
      {/* Title row */}
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <AppText
          variant="bodySmallBold"
          style={{ flex: 1, color: isComplete ? palette.success : palette.text }}
          numberOfLines={1}
        >
          {mission.title}
        </AppText>
        {isComplete && <CircleCheck size={18} color={palette.success} />}
      </View>

      {/* Description */}
      <AppText tone="muted" variant="micro" numberOfLines={2}>
        {mission.description}
      </AppText>

      {/* Progress bar */}
      {!isComplete && (
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
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <AppText tone="muted" variant="micro">
              {current}/{total}
            </AppText>
            <AppText variant="micro" style={{ color: palette.orange, fontWeight: "700" }}>
              +{mission.rewardValue} cred
            </AppText>
          </View>
        </View>
      )}

      {isComplete && (
        <AppText variant="micro" style={{ color: palette.success, fontWeight: "700" }}>
          +{mission.rewardValue} cred earned
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
