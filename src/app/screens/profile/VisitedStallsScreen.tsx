import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
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

  const visitedVenues = useMemo<VenueItem[]>(() => {
    const venuesById = new Map<string, VenueItem>();

    profile.reviewedDishIds.forEach((dishId) => {
      const dish = repository.getDishById(dishId);
      if (!dish) return;

      const venue = repository.getVenueById(dish.venueId);
      if (!venue) return;

      venuesById.set(venue.id, {
        id: venue.id,
        name: venue.name,
        unitNumber: venue.unitNumber,
        floor: venue.floor,
        isOpen: venue.isOpen,
        operatingHours: venue.operatingHours,
      });
    });

    return [...venuesById.values()];
  }, [profile.reviewedDishIds, repository]);

  return (
    <ProfileScreenShell
      title="Visited stores"
      subtitle="Stalls tied to dishes in your review history."
    >
      <ScrollView contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {visitedVenues.length ? (
          visitedVenues.map((venue) => (
            <Pressable
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
            title="No visited stores yet"
            body="Review dishes to add stalls to this list."
          />
        )}
      </ScrollView>
    </ProfileScreenShell>
  );
}
