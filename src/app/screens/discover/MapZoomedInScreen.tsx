import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Navigation, Store, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppText, Card, Badge } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { isVenueOpenFromHours } from "@/utils/stallStatus";

type Props = NativeStackScreenProps<RootStackParamList, "MapZoomedIn">;

const DEFAULT_BUILDING_ID = "hc-maxwell";

function resolveBuilding(buildingId?: string, selectedName?: string) {
  if (buildingId) {
    const byId = getBuildingById(buildingId);
    if (byId) return byId;
  }
  if (selectedName) {
    const byName = singaporeBuildings.find((b) => b.name === selectedName);
    if (byName) return byName;
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

  const [currentZoom, setCurrentZoom] = useState(16.8);

  const building = useMemo(
    () => resolveBuilding(route.params?.buildingId, selectedBuilding?.name),
    [route.params?.buildingId, selectedBuilding?.name],
  );

  useEffect(() => {
    setSelectedBuilding(toSummary(building));
    setSelectedFloor(building.floors[0]);
  }, [building, setSelectedBuilding, setSelectedFloor]);

  const markers = useMemo((): MapSurfaceMarker[] => {
    const buildingMarker = {
      id: building.id,
      label: building.name.replace(" Food Centre", ""),
      coordinate: building.coordinate,
      accent: building.type === "hawker_centre" ? palette.orange : palette.teal,
      type: building.type,
    };

    if (currentZoom > 17.0) {
      const stallMarkers = getBuildingVenues(building.id).map((v, index) => {
        // Keep marker placement deterministic to avoid visual jitter on rerenders.
        // This is a temporary spread strategy until exact stall geometry is used.
        const latitudeOffset = ((index % 7) - 3) * 0.00007;
        const longitudeOffset = ((Math.floor(index / 7) % 7) - 3) * 0.00007;
        return {
          id: `stall-${v.id}`,
          label: v.name,
          coordinate: {
            latitude: building.coordinate.latitude + latitudeOffset,
            longitude: building.coordinate.longitude + longitudeOffset,
          },
          accent: palette.orange,
        };
      });
      return [buildingMarker, ...stallMarkers];
    }

    return [buildingMarker];
  }, [building, palette, currentZoom]);

  const featuredStallsWithStatus = useMemo(() => {
    return getBuildingVenues(building.id).map((venue) => ({
      venue,
      isOpen: isVenueOpenFromHours(venue.operatingHours, venue.isOpen),
    }));
  }, [building.id]);

  const openVenueCount = featuredStallsWithStatus.filter((entry) => entry.isOpen).length;
  const featuredStalls = featuredStallsWithStatus
    .filter((entry) => entry.isOpen)
    .map((entry) => entry.venue)
    .slice(0, 3);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  const handleMarkerPress = (id: string) => {
    if (id.startsWith("stall-")) {
      const venueId = id.replace("stall-", "");
      navigation.navigate("StallDetail", { venueId });
      return;
    }
    bottomSheetRef.current?.snapToIndex(1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <MapSurface
        style={StyleSheet.absoluteFill}
        centerCoordinate={building.coordinate}
        zoomLevel={currentZoom}
        markers={markers}
        selectedMarkerId={building.id}
        currentLocation={currentLocation}
        onMarkerPress={handleMarkerPress}
        onMapPress={() => bottomSheetRef.current?.snapToIndex(1)}
        onZoomChange={setCurrentZoom}
      />

      <Pressable
        onPress={() => navigation.goBack()}
        style={[
          {
            position: "absolute",
            top: insets.top + spacing[2],
            left: spacing[4],
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: palette.surface,
            alignItems: "center",
            justifyContent: "center",
          },
          shadows.floating,
        ]}
      >
        <ChevronLeft color={palette.text} size={24} />
      </Pressable>

      <BottomSheet
        ref={bottomSheetRef}
        index={1}
        snapPoints={["2%", "35%", "60%"]}
        enablePanDownToClose={false}
        backgroundStyle={{
          backgroundColor: palette.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
        }}
        handleIndicatorStyle={{ backgroundColor: palette.border, width: 40 }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing[5],
            paddingHorizontal: spacing[3],
            paddingTop: spacing[6],
          }}
        >
          <View style={{ gap: spacing[4] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <View style={{ flex: 1, gap: spacing[1] }}>
                <AppText variant="h2">{building.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {building.address}
                </AppText>
              </View>
              <Badge
                label={openVenueCount > 0 ? `Open now (${openVenueCount})` : "Closed now"}
                tone={openVenueCount > 0 ? "success" : "warning"}
              />
            </View>

            <View style={{ gap: spacing[2] }}>
              {featuredStalls.map((venue) => (
                <Pressable
                  key={venue.id}
                  onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
                  style={{
                    backgroundColor: palette.bgSoft,
                    borderRadius: radii.md,
                    padding: spacing[3],
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[3],
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                >
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <AppText variant="h3">{venue.name}</AppText>
                    <AppText variant="micro" tone="secondary">
                      {venue.unitNumber} · {venue.operatingHours}
                    </AppText>
                  </View>
                  <Store size={16} color={palette.orange} />
                </Pressable>
              ))}
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
