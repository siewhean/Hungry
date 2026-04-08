import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Search } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { FloorPlanViewer } from "@/components/map/FloorPlanViewer";
import { AppText, Button, Input } from "@/components/ui";
import { getBuildingDishes, getBuildingVenues } from "@/features/discovery/discovery";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { getFloorPlan } from "@/lib/geo/floorPlans";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useHungryTheme } from "@/theme";
import type { StallPolygon } from "@/lib/services/types";

type Props = NativeStackScreenProps<RootStackParamList, "BuildingDrillDown">;

const DEFAULT_BUILDING_ID = "hc-maxwell";

function resolveBuilding(buildingId?: string, selectedName?: string) {
  if (buildingId) {
    const byId = getBuildingById(buildingId);
    if (byId) {
      return byId;
    }
  }

  if (selectedName) {
    const byName = singaporeBuildings.find((building) => building.name === selectedName);
    if (byName) {
      return byName;
    }
  }

  return getBuildingById(DEFAULT_BUILDING_ID)!;
}

function FilterButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? palette.navy : palette.surfaceRaised,
        borderColor: selected ? palette.navy : palette.border,
        borderRadius: radii.pill,
        borderWidth: 1,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      <AppText variant="micro" style={{ color: selected ? palette.surface : palette.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function isDessertDish(dishId?: string) {
  if (!dishId) {
    return false;
  }

  const dish = mockRepository.getDishById(dishId);
  if (!dish) {
    return false;
  }

  const haystack = `${dish.name} ${dish.tasteTags.join(" ")}`.toLowerCase();
  return ["dessert", "sweet", "cheng tng", "pancake", "ice", "toast"].some((token) =>
    haystack.includes(token),
  );
}

export function BuildingDrillDownScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const highlightedStallVenueId = useDiscoveryStore((state) => state.highlightedStallVenueId);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setHighlightedStallVenueId = useDiscoveryStore((state) => state.setHighlightedStallVenueId);

  const [stallQuery, setStallQuery] = useState("");
  const [dessertsOnly, setDessertsOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const building = useMemo(
    () => resolveBuilding(route.params?.buildingId, selectedBuilding?.name),
    [route.params?.buildingId, selectedBuilding?.name],
  );

  useEffect(() => {
    setSelectedBuilding(toSummary(building));
    if (!building.floors.includes(selectedFloor)) {
      setSelectedFloor(building.floors[0]);
    }
    setHighlightedStallVenueId(undefined);
  }, [building, selectedFloor, setHighlightedStallVenueId, setSelectedBuilding, setSelectedFloor]);

  const activeFloor = building.floors.includes(selectedFloor) ? selectedFloor : building.floors[0];
  const buildingVenues = useMemo(() => getBuildingVenues(building.id), [building.id]);

  const floorVenues = useMemo(() => {
    const normalizedQuery = stallQuery.trim().toLowerCase();

    return buildingVenues.filter((venue) => {
      if (venue.floor !== activeFloor) {
        return false;
      }

      if (openNowOnly && !venue.isOpen) {
        return false;
      }

      if (dessertsOnly && !isDessertDish(venue.topDishId)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(normalizedQuery);
    });
  }, [activeFloor, buildingVenues, dessertsOnly, openNowOnly, stallQuery]);

  const floorDishes = useMemo(
    () =>
      getBuildingDishes(building.id)
        .filter((dish) => dish.floor === activeFloor)
        .filter((dish) => floorVenues.some((venue) => venue.id === dish.venueId))
        .slice(0, 4),
    [activeFloor, building.id, floorVenues],
  );

  const floorPlan = useMemo(
    () => getFloorPlan(building.id, activeFloor, building.openStalls, building.totalStalls),
    [activeFloor, building.id, building.openStalls, building.totalStalls],
  );

  const selectedStallId = useMemo(
    () => floorPlan.stalls.find((stall) => stall.venueId === highlightedStallVenueId)?.stallId,
    [floorPlan.stalls, highlightedStallVenueId],
  );

  const highlightedVenueId = highlightedStallVenueId ?? floorVenues[0]?.id;

  const handleStallPress = (stall: StallPolygon) => {
    if (stall.venueId) {
      setHighlightedStallVenueId(stall.venueId);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[3],
            paddingBottom: Math.max(insets.bottom + 128, spacing[12]),
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: spacing[1] }}>
              <AppText variant="bodySmall" tone="muted">
                Building drill-down
              </AppText>
              <AppText variant="h1">{building.name}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Search within the building, switch floor, then jump straight into the stall menu.
              </AppText>
            </View>

            <Input
              label=""
              placeholder="Search on this building"
              value={stallQuery}
              onChangeText={setStallQuery}
              leftIcon={<Search color={palette.textMuted} size={18} />}
            />

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {building.floors.map((floor) => (
                <FilterButton
                  key={floor}
                  label={floor}
                  selected={activeFloor === floor}
                  onPress={() => {
                    setSelectedFloor(floor);
                    setHighlightedStallVenueId(undefined);
                  }}
                />
              ))}
              <FilterButton
                label="Desserts"
                selected={dessertsOnly}
                onPress={() => setDessertsOnly((current) => !current)}
              />
              <FilterButton
                label="Open now"
                selected={openNowOnly}
                onPress={() => setOpenNowOnly((current) => !current)}
              />
            </View>

            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: 24,
                borderWidth: 1,
                overflow: "hidden",
              }}
            >
              <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: 4 }}>
                <AppText variant="h3">Floor map · {activeFloor}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Tap any stall to highlight it before opening the stall menu.
                </AppText>
              </View>
              <FloorPlanViewer
                floorPlan={floorPlan}
                selectedStallId={selectedStallId}
                onStallPress={handleStallPress}
                showLegend={false}
                scale={0.96}
              />
            </View>

            <View style={{ gap: spacing[2] }}>
              {floorVenues.map((venue) => {
                const dish = mockRepository.getDishById(venue.topDishId);
                const isHighlighted = highlightedVenueId === venue.id;

                return (
                  <Pressable
                    key={venue.id}
                    onPress={() => {
                      setHighlightedStallVenueId(venue.id);
                      navigation.navigate("StallDetail", { venueId: venue.id });
                    }}
                    style={[
                      {
                        backgroundColor: palette.surface,
                        borderColor: isHighlighted ? palette.orange : palette.border,
                        borderRadius: 22,
                        borderWidth: 1,
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[4],
                        gap: spacing[2],
                      },
                      isHighlighted ? shadows.card : undefined,
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3] }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <AppText variant="h3">{venue.name}</AppText>
                        <AppText variant="bodySmall" tone="secondary">
                          {venue.unitNumber} · {venue.operatingHours} · Hygiene {venue.hygieneGrade}
                        </AppText>
                      </View>
                      <View
                        style={{
                          backgroundColor: palette.surfaceRaised,
                          borderColor: palette.border,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          alignSelf: "flex-start",
                          paddingHorizontal: spacing[2],
                          paddingVertical: 6,
                        }}
                      >
                        <AppText variant="micro" style={{ color: palette.text }}>
                          {venue.isOpen ? "Open" : "Closed"}
                        </AppText>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                      {dish ? (
                        <>
                          <View
                            style={{
                              backgroundColor: palette.surfaceRaised,
                              borderColor: palette.border,
                              borderRadius: radii.pill,
                              borderWidth: 1,
                              paddingHorizontal: spacing[3],
                              paddingVertical: spacing[2],
                            }}
                          >
                            <AppText variant="micro" style={{ color: palette.text }}>
                              {dish.name}
                            </AppText>
                          </View>
                          {dish.tasteTags.slice(0, 1).map((tag) => (
                            <View
                              key={`${venue.id}-${tag}`}
                              style={{
                                backgroundColor: palette.surfaceRaised,
                                borderColor: palette.border,
                                borderRadius: radii.pill,
                                borderWidth: 1,
                                paddingHorizontal: spacing[3],
                                paddingVertical: spacing[2],
                              }}
                            >
                              <AppText variant="micro" style={{ color: palette.text }}>
                                {tag}
                              </AppText>
                            </View>
                          ))}
                        </>
                      ) : null}
                    </View>

                    <AppText variant="bodySmall" style={{ color: palette.orange, fontFamily: "Nunito_700Bold" }}>
                      Open stall menu
                    </AppText>
                  </Pressable>
                );
              })}

              {floorVenues.length === 0 ? (
                <View
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: 22,
                    borderWidth: 1,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[5],
                  }}
                >
                  <AppText variant="h3">No stalls match this view</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    Clear the search or switch floor to see more of the building.
                  </AppText>
                </View>
              ) : null}
            </View>

            <View
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: 22,
                borderWidth: 1,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[4],
                gap: spacing[3],
              }}
            >
              <AppText variant="h3">Menu preview on this floor</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Dish-first browse stays visible before you commit to a stall.
              </AppText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[3] }}
              >
                {floorDishes.map((dish) => (
                  <Pressable
                    key={dish.id}
                    onPress={() => navigation.navigate("DishDetail", { dishId: dish.id })}
                    style={{
                      backgroundColor: palette.bgSoft,
                      borderRadius: 18,
                      minWidth: 148,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      gap: 4,
                    }}
                  >
                    <AppText variant="h3" numberOfLines={1}>
                      {dish.name}
                    </AppText>
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                      {dish.venueName}
                    </AppText>
                    <AppText variant="price" style={{ color: palette.orange }}>
                      S${dish.price.toFixed(2)}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomDock,
            {
              backgroundColor: "rgba(255,255,255,0.98)",
              borderColor: palette.border,
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              paddingHorizontal: spacing[5],
              paddingTop: spacing[3],
            },
            shadows.floating,
          ]}
        >
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <Button
              label="Back to map"
              variant="secondary"
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }
                navigation.navigate("MainTabs", { screen: "Maps" });
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Open highlighted stall"
              onPress={() => {
                if (highlightedVenueId) {
                  navigation.navigate("StallDetail", { venueId: highlightedVenueId });
                }
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  bottomDock: {
    borderTopWidth: 1,
  },
});
