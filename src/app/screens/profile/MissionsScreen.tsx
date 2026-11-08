/**
 * MissionsScreen — full list of active weekly missions with user progress.
 *
 * Navigated to from Profile's MissionBanner or profile links.
 */

import { useEffect, useMemo } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Badge, EmptyState } from "@/components/ui";
import { ProfileScreenShell } from "@/app/screens/profile/ProfileScreenShell";
import { MissionCard } from "@/components/gamification/MissionCard";
import { missionStart } from "@/features/profile/missionStart";
import { useMissionStore } from "@/store/useMissionStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { trackMissionViewed } from "@/lib/analytics/gamificationEvents";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";

type Props = NativeStackScreenProps<RootStackParamList, "MissionsScreen">;

export function MissionsScreen({ navigation }: Props) {
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
  const disclosure = getDataTrustDisclosure("missions");

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
    <ProfileScreenShell title="Weekly missions">
      {missions.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          <Badge
            label={`${completedCount}/${missions.length} completed`}
            tone={completedCount === missions.length ? "success" : "neutral"}
          />
          <Badge label={weekLabel} />
        </View>
      ) : null}
      {missions.length === 0 ? (
        <EmptyState title="No missions this week" body="Check back on Monday for new missions." />
      ) : (
        <View style={{ gap: spacing[3] }}>
          {/* Active first (what is left to do), then completed */}
          {[...activeMissions, ...completedMissions].map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              progress={progressMap[mission.id] ?? null}
              start={(() => {
                const next = missionStart(mission.missionType);
                return { label: next.label, onPress: () => next.open(navigation) };
              })()}
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
      <AppText variant="micro" tone="muted" testID="missions-disclosure">
        {disclosure}
      </AppText>
    </ProfileScreenShell>
  );
}
