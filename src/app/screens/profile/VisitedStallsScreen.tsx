import { Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { useVisitedStalls } from "@/features/saved/useSavedStalls";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { AppSymbol } from "@/components/ui/AppSymbol";
import { MapPinBowlIllustration } from "@/components/icons/food/PlaceIllustrations";

type Props = NativeStackScreenProps<ProfileStackParamList, "VisitedStalls">;

export function VisitedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const rootNavigation = getRootNavigation(navigation as any);
  // Stall rows come from the server by id, so a stall missing from the cached directory still
  // shows and the list matches the Profile and Passport counts.
  const visited = useVisitedStalls();
  const visitedVenues = visited.stalls;

  return (
    <ProfileScreenShell title="Visited stalls">
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
                  <AppSymbol name="mappin" fallback={MapPin} size={18} color={palette.orange} />
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
        ) : visited.status === "loading" ? (
          <ProfileReviewsSkeleton />
        ) : visited.status === "error" || visited.missingCount > 0 ? (
          <EmptyState
            title="Couldn't load visited stalls"
            body="Check your connection and try again."
            ctaLabel="Retry"
            onPress={visited.retry}
          />
        ) : (
          <EmptyState
            title="No visited stalls yet"
            body="Mark stalls or dishes as tried to add them to this list."
            icon={<MapPinBowlIllustration testID="visited-empty-art" />}
          />
        )}
      </View>
    </ProfileScreenShell>
  );
}
