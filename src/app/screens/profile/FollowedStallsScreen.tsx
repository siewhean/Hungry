import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BellRing } from "lucide-react-native";

import { AppText, Card, EmptyState } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "FollowedStalls">;

export function FollowedStallsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const followedStallIds = useStallFollowStore((state) => state.followedStallIds);
  const loadFollowedStalls = useStallFollowStore((state) => state.loadFollowedStalls);
  const repository = getDataRepository();
  const rootNavigation = getRootNavigation(navigation as any);

  useEffect(() => {
    void loadFollowedStalls().catch(() => {});
  }, [loadFollowedStalls]);

  const venues = useMemo(
    () => followedStallIds.map((id) => repository.getVenueById(id)).filter((venue) => !!venue),
    [followedStallIds, repository],
  );

  return (
    <ProfileScreenShell
      title="Followed stalls"
      subtitle="Get an alert when these stalls add a dish, change a price or restock."
    >
      <ScrollView contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[5] }}>
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
        ) : (
          <EmptyState
            title="No followed stalls yet"
            body="Tap Follow on a stall page to hear about its menu changes."
          />
        )}
      </ScrollView>
    </ProfileScreenShell>
  );
}
