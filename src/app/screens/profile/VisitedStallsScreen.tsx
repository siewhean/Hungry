import { useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { useVisitedStallIds } from "@/features/profile/visitedStalls";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "VisitedStalls">;

type VenueItem = {
  id: string;
  name: string;
  unitNumber?: string;
  floor?: string;
  operatingHours?: string;
};

export function VisitedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const profile = useProfileStore((state) => state.profile);
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation as any);

  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const isLoaded = useStallInteractionStore((state) => state.isLoaded);
  const visitedStallIds = useVisitedStallIds();
  const loadVisited = useCallback(
    () => loadInteractions(profile.id),
    [loadInteractions, profile.id],
  );
  const { failed: loadFailed, retry } = useRetryableLoad(loadVisited, "visited stalls");

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
                    {venue.unitNumber ? (
                      <AppText tone="secondary">
                        {[venue.unitNumber, venue.floor].filter(Boolean).join(" · ")}
                      </AppText>
                    ) : null}
                    {/* No open/closed here: free-text hours cannot be trusted to say "open now". */}
                    {venue.operatingHours ? (
                      <AppText tone="secondary" variant="micro">
                        {venue.operatingHours}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        ) : !isLoaded && !loadFailed ? (
          <ProfileReviewsSkeleton />
        ) : loadFailed ? (
          <EmptyState
            title="Couldn't load visited stalls"
            body="Check your connection and try again."
            ctaLabel="Retry"
            onPress={retry}
          />
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
