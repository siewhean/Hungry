import { Pressable, ScrollView, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Layers3, MapPinned } from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Badge, Button, Card, Screen } from "@/components/ui";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "MapZoomedIn">;

export function MapZoomedInScreen({ navigation }: Props) {
  const { palette, radii, spacing } = useHungryTheme();
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding) ?? mockRepository.listBuildings()[0];
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const venues = mockRepository.listVenuesByBuilding(selectedBuilding.id);

  return (
    <Screen title="Map browse" subtitle="Zoomed into one building so you can pick the right floor, then the right stall.">
      <Card style={{ gap: spacing[3] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="h3">{selectedBuilding.name}</AppText>
            <AppText tone="secondary">
              {selectedBuilding.type === "food_court" ? "Food court" : "Hawker centre"} · {selectedBuilding.venueCount} stalls
            </AppText>
          </View>
          <MapPinned color={palette.orange} size={22} />
        </View>

        <View
          style={{
            backgroundColor: palette.bgMuted,
            borderColor: palette.border,
            borderRadius: radii.lg,
            borderWidth: 1,
            minHeight: 180,
            padding: spacing[4],
            justifyContent: "space-between",
          }}
        >
          <View style={{ gap: spacing[2] }}>
            <AppText variant="body">Zoomed area</AppText>
            <AppText tone="secondary">
              This pass shows the selected building and its floors. The detailed floor directory will replace this placeholder next.
            </AppText>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            {selectedBuilding.floors.map((floor) => (
              <Badge key={floor} label={floor} tone={floor === selectedFloor ? "orange" : "neutral"} />
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
          {selectedBuilding.floors.map((floor) => (
            <Button
              key={floor}
              label={floor}
              fullWidth={false}
              variant={floor === selectedFloor ? "primary" : "secondary"}
              onPress={() => setSelectedFloor(floor)}
            />
          ))}
        </ScrollView>

        <Button
          label="Open floor directory"
          variant="secondary"
          onPress={() =>
            navigation.navigate("NotFound", {
              title: "Building drill-down is coming later",
              body: "The zoomed map is live now. The detailed floor directory is still deferred.",
            })
          }
        />
      </Card>

      <View style={{ gap: spacing[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Layers3 color={palette.orange} size={18} />
          <AppText variant="h2">Nearby stalls on this building</AppText>
        </View>
        {venues.map((venue) => (
          <Pressable key={venue.id} onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}>
            <Card>
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <AppText variant="h3">{venue.name}</AppText>
                  <Badge label={`${venue.floor} ${venue.unitNumber}`} tone="neutral" />
                </View>
                <AppText tone="secondary">{venue.operatingHours}</AppText>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
