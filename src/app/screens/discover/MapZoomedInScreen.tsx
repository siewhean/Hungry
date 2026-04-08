import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Navigation, Store } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppText, Button } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "MapZoomedIn">;

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

export function MapZoomedInScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);

  const building = useMemo(
    () => resolveBuilding(route.params?.buildingId, selectedBuilding?.name),
    [route.params?.buildingId, selectedBuilding?.name],
  );

  useEffect(() => {
    setSelectedBuilding(toSummary(building));
    setSelectedFloor(building.floors[0]);
  }, [building, setSelectedBuilding, setSelectedFloor]);

  const markers = useMemo<MapSurfaceMarker[]>(
    () => [
      {
        id: building.id,
        label: building.name.replace(" Food Centre", ""),
        coordinate: building.coordinate,
        accent: palette.orange,
      },
    ],
    [building.coordinate, building.id, building.name, palette.orange],
  );

  const featuredStalls = getBuildingVenues(building.id).filter((venue) => venue.isOpen).slice(0, 3);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[1] }}>
          <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: spacing[2], width: 32 }}>
            <ArrowLeft color={palette.text} size={20} />
          </Pressable>
          <AppText variant="bodySmall" tone="muted">
            Map detail
          </AppText>
          <AppText variant="h1">{building.name}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            A tighter map view before you jump into the floor plan and stall list.
          </AppText>
        </View>

        <View style={{ flex: 1, marginTop: spacing[4] }}>
          <MapSurface
            style={styles.mapSurface}
            centerCoordinate={building.coordinate}
            zoomLevel={16.65}
            markers={markers}
            selectedMarkerId={building.id}
            currentLocation={currentLocation}
          />

          <View
            style={[
              styles.bottomDock,
              {
                backgroundColor: "rgba(255,255,255,0.98)",
                borderColor: palette.border,
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                paddingBottom: Math.max(insets.bottom, spacing[5]),
                paddingHorizontal: spacing[5],
                paddingTop: spacing[4],
              },
              shadows.floating,
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Navigation size={14} color={palette.textMuted} />
              <AppText variant="bodySmall" tone="muted">
                {building.address}
              </AppText>
            </View>

            <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
              {featuredStalls.map((venue) => (
                <Pressable
                  key={venue.id}
                  onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="h3">{venue.name}</AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        {venue.unitNumber} · {venue.operatingHours}
                      </AppText>
                    </View>
                    <Store size={16} color={palette.textMuted} />
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[4] }}>
              <Button
                label="Open building layout"
                onPress={() => navigation.navigate("BuildingDrillDown", { buildingId: building.id })}
                style={{ flex: 1 }}
              />
              <Button
                label="Open first stall"
                variant="secondary"
                onPress={() => {
                  const firstVenue = featuredStalls[0];
                  if (firstVenue) {
                    navigation.navigate("StallDetail", { venueId: firstVenue.id });
                  }
                }}
                style={{ flex: 1 }}
              />
            </View>
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
  mapSurface: {
    flex: 1,
  },
  bottomDock: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
