import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { LocateFixed, Navigation } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppText, Button } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import {
  getBuildingById,
  getNearestBuildings,
  singaporeBuildings,
  toSummary,
} from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import type { Coordinate, VenueSummary } from "@/types/domain";

const DEFAULT_BUILDING_ID = "hc-maxwell";
const PILOT_MALL_ID = "fc-koufu-jem";

function distanceMeters(from: Coordinate, to: Coordinate) {
  const earthRadius = 6371e3;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatWalkTime(from: Coordinate, to: Coordinate) {
  const minutes = Math.max(2, Math.round(distanceMeters(from, to) / 78));
  return `${minutes} min walk`;
}

function MetaTag({ label }: { label: string }) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
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
        {label}
      </AppText>
    </View>
  );
}

function ActiveStallRow({
  venue,
  onPress,
}: {
  venue: VenueSummary;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderRadius: radii.lg,
        borderWidth: 1,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        gap: 4,
      }}
    >
      <AppText variant="h3">{venue.name}</AppText>
      <AppText variant="bodySmall" tone="secondary">
        {venue.unitNumber} · {venue.operatingHours}
      </AppText>
    </Pressable>
  );
}

export function HomeMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const gpsBadgeState = useLocationStore((state) => state.gpsBadgeState);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const selectedFloor = useDiscoveryStore((state) => state.selectedFloor);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setHighlightedStallVenueId = useDiscoveryStore((state) => state.setHighlightedStallVenueId);

  const nearestBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 5, 8),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const pilotBuilding = useMemo(() => getBuildingById(PILOT_MALL_ID), []);

  const activeBuildingRecord = useMemo(() => {
    const directMatch = selectedBuilding?.id ? getBuildingById(selectedBuilding.id) : undefined;
    if (directMatch) {
      return directMatch;
    }

    const nameMatch = selectedBuilding?.name
      ? singaporeBuildings.find((building) => building.name === selectedBuilding.name)
      : undefined;
    return nameMatch ?? getBuildingById(DEFAULT_BUILDING_ID)!;
  }, [selectedBuilding]);

  const visibleBuildings = useMemo(() => {
    const combined = [activeBuildingRecord, ...nearestBuildings, ...(pilotBuilding ? [pilotBuilding] : [])];
    const seen = new Set<string>();

    return combined.filter((building) => {
      if (seen.has(building.id)) {
        return false;
      }
      seen.add(building.id);
      return true;
    });
  }, [activeBuildingRecord, nearestBuildings, pilotBuilding]);

  const [cameraCenter, setCameraCenter] = useState<Coordinate>(activeBuildingRecord.coordinate);
  const [sheetIndex, setSheetIndex] = useState(1);
  const snapPoints = useMemo(() => ["16%", "44%", "82%"], []);
  const mapBottomPadding = useMemo(() => {
    if (sheetIndex <= 0) {
      return 172;
    }

    if (sheetIndex === 1) {
      return 320;
    }

    return 520;
  }, [sheetIndex]);
  const cameraPadding = useMemo(
    () => ({
      paddingTop: spacing[4],
      paddingLeft: spacing[4],
      paddingRight: spacing[4],
      paddingBottom: mapBottomPadding + Math.max(insets.bottom, spacing[3]),
    }),
    [insets.bottom, mapBottomPadding, spacing],
  );

  useEffect(() => {
    setSelectedBuilding(toSummary(activeBuildingRecord));
    if (!activeBuildingRecord.floors.includes(selectedFloor)) {
      setSelectedFloor(activeBuildingRecord.floors[0]);
    }
    setCameraCenter(activeBuildingRecord.coordinate);
  }, [activeBuildingRecord, selectedFloor, setSelectedBuilding, setSelectedFloor]);

  const markers = useMemo<MapSurfaceMarker[]>(
    () =>
      visibleBuildings.map((building) => ({
        id: building.id,
        label: building.name.replace(" Food Centre", "").replace(" Festival Market", ""),
        coordinate: building.coordinate,
        accent:
          building.id === activeBuildingRecord.id
            ? palette.orange
            : building.type === "food_court"
              ? palette.amber
              : palette.navy,
      })),
    [activeBuildingRecord.id, palette.amber, palette.navy, palette.orange, visibleBuildings],
  );

  const activeStalls = useMemo(
    () => getBuildingVenues(activeBuildingRecord.id).filter((venue) => venue.isOpen).slice(0, 2),
    [activeBuildingRecord.id],
  );

  const openStallCount = activeStalls.length;
  const handleBuildingSelect = (buildingId: string, options?: { openDirectory?: boolean }) => {
    const building = getBuildingById(buildingId);
    if (!building) {
      return;
    }

    setSelectedBuilding(toSummary(building));
    setSelectedFloor(building.floors[0]);
    setHighlightedStallVenueId(undefined);
    setCameraCenter(building.coordinate);

    if (options?.openDirectory) {
      navigation.navigate("BuildingDrillDown", { buildingId: building.id });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[2], gap: spacing[1] }}>
          <AppText variant="bodySmall" tone="muted">
            Map
          </AppText>
          <AppText variant="display">Discover on map</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Tap a building, see what is open, then drill into levels and unit numbers.
          </AppText>
        </View>

        <View style={{ flex: 1, marginTop: spacing[4] }}>
          <MapSurface
            style={styles.mapSurface}
            centerCoordinate={cameraCenter}
            zoomLevel={15.35}
            markers={markers}
            selectedMarkerId={activeBuildingRecord.id}
            cameraPadding={cameraPadding}
            currentLocation={gpsBadgeState === "live" ? currentLocation : undefined}
            onMarkerPress={(buildingId) =>
              handleBuildingSelect(buildingId, { openDirectory: true })
            }
          />

          <Pressable
            onPress={() => setCameraCenter(currentLocation)}
            style={[
              styles.recenterButton,
              {
                backgroundColor: palette.orange,
                borderRadius: radii.lg,
                right: spacing[4],
                top: spacing[4],
              },
              shadows.floating,
            ]}
          >
            <LocateFixed color={palette.surface} size={18} />
          </Pressable>

          <BottomSheet
            index={1}
            snapPoints={snapPoints}
            onChange={(index) => setSheetIndex(Math.max(0, index))}
            enablePanDownToClose={false}
            backgroundStyle={{
              backgroundColor: "rgba(255,255,255,0.98)",
              borderColor: palette.border,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
            }}
            handleIndicatorStyle={{ backgroundColor: palette.border }}
            style={[styles.sheetOverlay, shadows.floating]}
          >
            <BottomSheetScrollView
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom + spacing[6], spacing[8]),
                paddingHorizontal: spacing[5],
                paddingTop: spacing[3],
              }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[3], marginTop: spacing[1] }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="h1">{activeBuildingRecord.name}</AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {activeBuildingRecord.address}
                  </AppText>
                </View>
                <View
                  style={{
                    backgroundColor: palette.surfaceRaised,
                    borderColor: palette.border,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    alignSelf: "flex-start",
                  }}
                >
                  <AppText variant="micro" style={{ color: palette.text }}>
                    {Math.max(openStallCount, activeBuildingRecord.openStalls)} active stalls
                  </AppText>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] }}>
                <MetaTag label={activeBuildingRecord.floors.join(" · ")} />
                <MetaTag label={formatWalkTime(currentLocation, activeBuildingRecord.coordinate)} />
              </View>

              <View style={{ gap: spacing[2], marginTop: spacing[4] }}>
                {activeStalls.map((venue) => (
                  <ActiveStallRow
                    key={venue.id}
                    venue={venue}
                    onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
                  />
                ))}
                {activeStalls.length === 0 ? (
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: radii.lg,
                      borderWidth: 1,
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                    }}
                  >
                    <AppText variant="bodySmall" tone="secondary">
                      No active stalls available in this view right now.
                    </AppText>
                  </View>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", gap: spacing[2], marginTop: spacing[4] }}>
                <Button
                  label="View floors"
                  onPress={() => {
                    setSelectedBuilding(toSummary(activeBuildingRecord));
                    setSelectedFloor(activeBuildingRecord.floors[0]);
                    navigation.navigate("BuildingDrillDown", { buildingId: activeBuildingRecord.id });
                  }}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Zoom in"
                  variant="secondary"
                  onPress={() => {
                    setSelectedBuilding(toSummary(activeBuildingRecord));
                    navigation.navigate("MapZoomedIn", { buildingId: activeBuildingRecord.id });
                  }}
                  style={{ flex: 1 }}
                />
              </View>

              <View style={{ marginTop: spacing[2] }}>
                <Button
                  label="Focus pilot mall: Koufu @ JEM"
                  variant="secondary"
                  onPress={() => handleBuildingSelect(PILOT_MALL_ID)}
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[3] }}>
                <Navigation size={14} color={palette.textMuted} />
                <AppText variant="bodySmall" tone="muted">
                  Map supports live Mapbox when token is set and includes a pilot directory flow for Koufu @ JEM.
                </AppText>
              </View>
            </BottomSheetScrollView>
          </BottomSheet>
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
  recenterButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    position: "absolute",
    width: 48,
    zIndex: 2,
  },
  sheetOverlay: {
    left: 0,
    position: "absolute",
    right: 0,
    bottom: 0,
  },
});
