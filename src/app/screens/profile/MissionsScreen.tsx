/**
 * MissionsScreen — full list of active weekly missions with user progress.
 *
 * Navigated to from Profile's MissionBanner or profile links.
 */

import { useEffect, useMemo } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState } from "@/components/ui";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { MissionCard } from "@/components/gamification/MissionCard";
import { useMissionStore } from "@/store/useMissionStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { trackMissionViewed } from "@/lib/analytics/gamificationEvents";

type Props = NativeStackScreenProps<RootStackParamList, "MissionsScreen">;

export function MissionsScreen({ navigation: _nav }: Props) {
  const { spacing } = useHungryTheme();
  const profile = useProfileStore((s) => s.profile);
  const progressMap = useMissionStore((s) => s.progressMap);
  const loadMissions = useMissionStore((s) => s.loadMissions);
  const missions = useMissionStore((s) => s.missions);
  const completedMissions = useMemo(() => {
    return missions.filter((mission) => !!progressMap[mission.id]?.completedAt);
  }, [missions, progressMap]);
  const activeMissions = useMemo(() => {
    return missions.filter((mission) => !progressMap[mission.id]?.completedAt);
  }, [missions, progressMap]);
  const completedCount = completedMissions.length;

  useEffect(() => {
    loadMissions(profile.id);
    trackMissionViewed();
  }, [loadMissions, profile.id]);

  const weekLabel = (() => {
    if (!missions[0]) return "This week";
    const d = new Date(missions[0].weekStart);
    return `Week of ${d.toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`;
  })();

  return (
    <ProfileScreenShell
      title="Weekly Missions"
      subtitle={`${completedCount}/${missions.length} completed · ${weekLabel}`}
    >
      {missions.length === 0 ? (
        <EmptyState title="No missions this week" body="Check back on Monday for new missions." />
      ) : (
        <View style={{ gap: spacing[3] }}>
          {/* Completed first, then active */}
          {[...completedMissions, ...activeMissions].map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              progress={progressMap[mission.id] ?? null}
            />
          ))}

          {/* Reward summary */}
          {completedCount > 0 && (
            <View
              style={{
                alignItems: "center",
                paddingTop: spacing[2],
              }}
            >
              <AppText tone="muted" variant="micro">
                New missions every Monday
              </AppText>
            </View>
          )}
        </View>
      )}
    </ProfileScreenShell>
  );
}
