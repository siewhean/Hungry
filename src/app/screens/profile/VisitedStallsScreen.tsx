import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import { AppText, Button, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { useResolvedProfileEntities } from "@/features/profile/useResolvedProfileEntities";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import type { VenueSummary } from "@/types/domain";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import { isVenueOpenFromHours } from "@/utils/stallStatus";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "VisitedStalls">;

export function VisitedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const interactions = useStallInteractionStore((state) => state.interactions);
  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoadFailed(false);
    void loadInteractions(profile.id).catch(() => {
      if (active) setLoadFailed(true);
    });
    return () => {
      active = false;
    };
  }, [loadInteractions, profile.id, attempt]);
  const rootNavigation = getRootNavigation(navigation as any);

  const ids = Object.values(interactions)
    .filter((item) => item.isTried)
    .map((item) => item.stallId);
  const resolved = useResolvedProfileEntities(ids, "venue");
  const visitedVenues = resolved.items as VenueSummary[];

  return (
    <ProfileScreenShell title="Visited stalls" subtitle="Stalls you marked as visited.">
      <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {resolved.loading ? <AppText>Loading visited stalls…</AppText> : null}
        {resolved.failed || loadFailed ? (
          <Button
            label="Retry loading visited stalls"
            onPress={() => {
              resolved.retry();
              setAttempt((v) => v + 1);
            }}
          />
        ) : null}
        {resolved.missing ? (
          <AppText>{resolved.missing} visited stalls are no longer available.</AppText>
        ) : null}
        {visitedVenues.length ? (
          visitedVenues.map((venue) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${venue.name}`}
              key={venue.id}
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
                  <MapPin color={palette.orange} size={18} />
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <AppText variant="bodyBold">{venue.name}</AppText>
                    <AppText tone="secondary">
                      {venue.unitNumber
                        ? `${venue.unitNumber} ${venue.floor ? `· ${venue.floor}` : ""}`
                        : ""}
                    </AppText>
                    <AppText tone="secondary" variant="micro">
                      {venue.operatingHours
                        ? `${venue.operatingHours} · ${isVenueOpenFromHours(venue.operatingHours, !!venue.isOpen) ? "Open now" : "Closed"}`
                        : "Hours unavailable"}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        ) : !resolved.loading && !resolved.failed && !loadFailed && !resolved.missing ? (
          <EmptyState
            title="No visited stalls yet"
            body="Use Visited this stall on a stall page to keep a record here."
          />
        ) : null}
      </View>
    </ProfileScreenShell>
  );
}
