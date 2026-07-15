import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "VisitedStalls">;

type VenueItem = {
  id: string;
  name: string;
  unitNumber?: string;
  floor?: string;
  reviewedDishName: string;
};

export function VisitedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const service = getHungryService();
  const rootNavigation = getRootNavigation(navigation as any);
  const [visitedVenues, setVisitedVenues] = useState<VenueItem[]>([]);
  const [isLoading, setIsLoading] = useState(profile.reviewedDishIds.length > 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!profile.reviewedDishIds.length) {
      setVisitedVenues([]);
      setLoadError(null);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    setLoadError(null);
    void service.discovery
      .getDishes(profile.reviewedDishIds)
      .then((dishes) => {
        if (!active) return;
        const venuesById = new Map<string, VenueItem>();
        dishes.forEach((dish) => {
          if (venuesById.has(dish.venueId)) return;
          venuesById.set(dish.venueId, {
            id: dish.venueId,
            name: dish.venueName,
            unitNumber: dish.unitNumber,
            floor: dish.floor,
            reviewedDishName: dish.name,
          });
        });
        setVisitedVenues([...venuesById.values()]);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setVisitedVenues([]);
        setLoadError(
          error instanceof Error ? error.message : "Visited stores are temporarily unavailable.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadAttempt, profile.reviewedDishIds, service]);

  return (
    <ProfileScreenShell
      title="Visited stores"
      subtitle="Stalls tied to dishes in your review history."
    >
      <ScrollView contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {isLoading ? (
          <View accessibilityLabel="Loading visited stores" accessibilityRole="progressbar">
            <ActivityIndicator color={palette.orange} />
          </View>
        ) : loadError ? (
          <EmptyState
            title="Visited stores unavailable"
            body={loadError}
            ctaLabel="Try again"
            onPress={() => setLoadAttempt((attempt) => attempt + 1)}
          />
        ) : visitedVenues.length ? (
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
                      Visited via your {venue.reviewedDishName} review
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
