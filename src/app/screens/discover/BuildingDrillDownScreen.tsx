import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import { AppText, Badge, Button, Card, EmptyState, Input, Screen } from "@/components/ui";
import { getBuildingDishes, getBuildingVenues } from "@/features/discovery/discovery";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";
import { mockRepository } from "@/lib/services/mock/repositories";

function StallRow({
  venueId,
  onPress,
}: {
  venueId: string;
  onPress: () => void;
}) {
  const venue = mockRepository.getVenueById(venueId);

  if (!venue) {
    return null;
  }

  return (
    <Pressable onPress={onPress}>
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{venue.name}</AppText>
            <AppText variant="bodySmall" tone="secondary">
              {venue.floor} {venue.unitNumber}
            </AppText>
          </View>
          <Badge label={`NEA ${venue.hygieneGrade}`} tone={venue.hygieneGrade === "A" ? "success" : "amber"} />
        </View>
        <AppText variant="bodySmall" tone="secondary">
          {venue.isOpen ? venue.operatingHours : venue.closureNotice || "Closed today"}
        </AppText>
        <Button label="Open stall menu" variant="secondary" fullWidth={false} onPress={onPress} />
      </Card>
    </Pressable>
  );
}

export function BuildingDrillDownScreen() {
  const navigation = useNavigation<any>();
  const { spacing } = useHungryTheme();
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const [stallQuery, setStallQuery] = useState("");

  if (!selectedBuilding) {
    return (
      <Screen title="Building drill-down" subtitle="No building selected yet.">
        <EmptyState title="Pick a building first" body="Go back to Maps and tap any building pin." />
      </Screen>
    );
  }

  const venues = getBuildingVenues(selectedBuilding.id);
  const floorVenues = useMemo(
    () =>
      venues.filter((venue) => {
        const matchesFloor = venue.floor === selectedFloor;
        const matchesQuery =
          stallQuery.trim().length === 0 ||
          `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(stallQuery.trim().toLowerCase());
        return matchesFloor && matchesQuery;
      }),
    [selectedFloor, stallQuery, venues],
  );
  const floorDishes = getBuildingDishes(selectedBuilding.id).filter((dish) =>
    floorVenues.some((venue) => venue.id === dish.venueId),
  );

  return (
    <Screen
      title={selectedBuilding.name}
      subtitle="Pick a level, search for a stall, then open the menu."
      headerRight={<Button label="Back" variant="ghost" fullWidth={false} onPress={() => navigation.goBack()} />}
    >
      <View style={{ gap: spacing[4] }}>
        <Input
          label="Search on this building"
          placeholder="Search by stall name or unit"
          value={stallQuery}
          onChangeText={setStallQuery}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {selectedBuilding.floors.map((floor) => (
            <Pressable key={floor} onPress={() => setSelectedFloor(floor)}>
              <Badge label={floor} tone={selectedFloor === floor ? "orange" : "neutral"} />
            </Pressable>
          ))}
        </View>

        <Card style={{ gap: spacing[3] }}>
          <AppText variant="h3">Stalls on {selectedFloor}</AppText>
          {floorVenues.length ? (
            <FlatList
              data={floorVenues}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => (
                <StallRow
                  venueId={item.id}
                  onPress={() =>
                    navigation.getParent()?.getParent()?.navigate("StallDetail", {
                      venueId: item.id,
                    })
                  }
                />
              )}
            />
          ) : (
            <EmptyState title="No stalls match" body="Try a different floor or adjust the search." />
          )}
        </Card>

        <Card style={{ gap: spacing[3] }}>
          <AppText variant="h3">Menu preview on this floor</AppText>
          {floorDishes.length ? (
            floorDishes.map((dish) => (
              <Pressable
                key={dish.id}
                onPress={() => navigation.getParent()?.getParent()?.navigate("DishDetail", { dishId: dish.id })}
              >
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <AppText variant="h3">{dish.name}</AppText>
                    <AppText variant="price">S${dish.price.toFixed(2)}</AppText>
                  </View>
                  <AppText variant="bodySmall" tone="secondary">
                    {dish.rating.toFixed(1)} rating · {dish.reviewCount} reviews
                  </AppText>
                </Card>
              </Pressable>
            ))
          ) : (
            <EmptyState title="No dishes found" body="This floor does not have active dish data yet." />
          )}
        </Card>
      </View>
    </Screen>
  );
}
