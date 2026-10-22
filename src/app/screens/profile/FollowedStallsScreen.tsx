import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BellRing } from "lucide-react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { useResolvedProfileEntities } from "@/features/profile/useResolvedProfileEntities";
import type { VenueSummary } from "@/types/domain";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "FollowedStalls">;

export function FollowedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const followedStallIds = useStallFollowStore((state) => state.followedStallIds);
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const rootNavigation = getRootNavigation(navigation as any);

  useEffect(() => {
    setLoadFailed(false);
    void loadFollowedStalls().catch(() => setLoadFailed(true));
  }, [loadFollowedStalls, attempt]);

  const resolved = useResolvedProfileEntities(followedStallIds, "venue");
  const venues = resolved.items as VenueSummary[];

  return (
    <ProfileScreenShell title="Followed stalls" subtitle="Stalls you follow, kept in one place.">
      <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {resolved.loading ? <AppText>Loading followed stalls…</AppText> : null}
        {loadFailed || resolved.failed ? (
          <Button
            label="Retry loading followed stalls"
            onPress={() => {
              setAttempt((v) => v + 1);
              resolved.retry();
            }}
          />
        ) : null}
        {resolved.missing ? (
          <AppText>{resolved.missing} followed stalls are unavailable.</AppText>
        ) : null}
        {venues.length ? (
          venues.map((venue) => (
            <Pressable
              key={venue.id}
              accessibilityRole="button"
              onPress={() => rootNavigation.navigate("StallDetail", { venueId: venue.id })}
              style={({ pressed }) => [
                {
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: componentRadii.card,
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                  overflow: "hidden",
                },
              ]}
            >
              <Card style={{ padding: spacing[4], gap: spacing[3] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                  <BellRing color={palette.orange} size={18} />
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <AppText variant="bodyBold">{venue.name}</AppText>
                    {venue.unitNumber ? (
                      <AppText tone="secondary">
                        {venue.unitNumber}
                        {venue.floor ? ` · ${venue.floor}` : ""}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        ) : !resolved.loading && !resolved.failed && !loadFailed && !resolved.missing ? (
          <EmptyState
            title="No followed stalls yet"
            body="Tap Follow on a stall page to save it here."
          />
        ) : null}
      </View>
    </ProfileScreenShell>
  );
}
