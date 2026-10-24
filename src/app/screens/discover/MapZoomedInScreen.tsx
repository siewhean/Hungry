import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Navigation, Store } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppText, Card, Badge } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { buildMapsSearchUrl } from "@/features/detail/stallLocation";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { isVenueOpenNow } from "@/features/discovery/decideForMeCandidates";

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
  const gpsLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const locationPermission = useLocationStore((state) => state.permission);
  // The dot only draws for a real position, never the built-in default point.
  const { coordinate: effectiveLocation, isApproximate: isLocationApproximate } =
    getEffectiveLocation({
      permission: locationPermission,
      currentLocation: gpsLocation,
      manualCoordinate,
    });
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

  // Stalls have no coordinates of their own, so only the building is plotted;
  // the sheet below lists its stalls.
  const markers = useMemo(
    (): MapSurfaceMarker[] => [
      {
        id: building.id,
        label: building.name.replace(" Food Centre", ""),
        coordinate: building.coordinate,
        accent: building.type === "hawker_centre" ? palette.orange : palette.teal,
        type: building.type,
      },
    ],
    [building, palette],
  );

  const featuredStallsWithStatus = useMemo(() => {
    return getBuildingVenues(building.id).map((venue) => ({
      venue,
      // Same rule as Decide for Me and the stall page: the merchant's schedule wins.
      isOpen: isVenueOpenNow(venue),
    }));
  }, [building.id]);

  const openVenueCount = featuredStallsWithStatus.filter((entry) => entry.isOpen).length;
  // Every stall, open ones first, so a closed centre is not a dead end.
  const featuredStalls = [...featuredStallsWithStatus].sort(
    (left, right) => Number(right.isOpen) - Number(left.isOpen),
  );
  const openDirections = useCallback(() => {
    trackAnalyticsEvent("directions_opened", { building_id: building.id, source: "MapZoomedIn" });
    void openTrustedMapsUrl(buildMapsSearchUrl(building.address || building.name));
  }, [building.address, building.id, building.name]);
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  const handleMarkerPress = (id: string) => {
    trackAnalyticsEvent("map_pin_tapped", { pin_kind: "building", pin_id: id });
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
        currentLocation={isLocationApproximate ? undefined : effectiveLocation}
        onMarkerPress={handleMarkerPress}
        onMapPress={() => bottomSheetRef.current?.snapToIndex(1)}
        onZoomChange={setCurrentZoom}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${building.name}`}
              onPress={openDirections}
              style={{
                alignItems: "center",
                alignSelf: "flex-start",
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                flexDirection: "row",
                gap: spacing[1.5],
                minHeight: 44,
                paddingHorizontal: spacing[3],
              }}
            >
              <Navigation size={16} color={palette.orange} />
              <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                Directions
              </AppText>
            </Pressable>

            <View style={{ gap: spacing[2] }}>
              {featuredStalls.map(({ venue, isOpen }) => (
                <Pressable
                  key={venue.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${venue.name}, ${isOpen ? "open now" : "closed now"}`}
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
                      {[isOpen ? "Open" : "Closed", venue.unitNumber, venue.operatingHours]
                        .filter(Boolean)
                        .join(" · ")}
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
