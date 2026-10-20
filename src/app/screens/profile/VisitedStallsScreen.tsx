import { useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useVisitedStallIds } from "@/features/profile/visitedStalls";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";
import { isVenueOpenFromHours } from "@/utils/stallStatus";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "VisitedStalls">;

type VenueItem = {
  id: string;
  name: string;
  unitNumber?: string;
  floor?: string;
  isOpen?: boolean;
  operatingHours?: string;
};

export function VisitedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation as any);

  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const visitedStallIds = useVisitedStallIds();

  useEffect(() => {
    void loadInteractions(profile.id).catch((error) => {
      console.error("Failed to load visited stalls:", error);
    });
  }, [loadInteractions, profile.id]);

  const visitedVenues = useMemo<VenueItem[]>(
    () =>
      visitedStallIds.flatMap((stallId) => {
        const venue = repository.getVenueById(stallId);
        if (!venue) return [];
        return [
          {
            id: venue.id,
            name: venue.name,
            unitNumber: venue.unitNumber,
            floor: venue.floor,
            isOpen: venue.isOpen,
            operatingHours: venue.operatingHours,
          },
        ];
      }),
    [repository, visitedStallIds],
  );

  return (
    <ProfileScreenShell
      title="Visited stalls"
      subtitle="Stalls you marked as tried or ate a dish at."
    >
      <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {visitedVenues.length ? (
          visitedVenues.map((venue) => (
            <Pressable
              key={venue.id}
              accessibilityRole="button"
              accessibilityLabel={venue.name}
              accessibilityHint="Opens the stall"
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
                      {venue.operatingHours ?? "Hours unavailable"} ·{" "}
                      {isVenueOpenFromHours(venue.operatingHours, !!venue.isOpen)
                        ? "Open now"
                        : "Closed"}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState
            title="No visited stalls yet"
            body="Mark stalls or dishes as tried to add them to this list."
          />
        )}
      </View>
    </ProfileScreenShell>
  );
}
