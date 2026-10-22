import { getHungryService } from "@/lib/services/serviceProvider";
import type { VenueSummary } from "@/types/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Navigation, Store, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppText, Card, Badge, Button, EmptyState, Screen } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import { isVenueOpenFromHours } from "@/utils/stallStatus";

type Props = NativeStackScreenProps<RootStackParamList, "MapZoomedIn">;

const DEFAULT_BUILDING_ID = "hc-maxwell";

function resolveBuilding(buildingId?: string, selectedName?: string) {
  if (buildingId) return getBuildingById(buildingId);
  if (selectedName) {
    const byName = singaporeBuildings.find((b) => b.name === selectedName);
    if (byName) return byName;
  }
  return undefined;
}

export function MapZoomedInScreen(props: Props) {
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const building = resolveBuilding(props.route.params?.buildingId, selectedBuilding?.name);
  if (!building)
    return (
      <Screen title="Map location unavailable">
        <EmptyState
          title="Building unavailable"
          body="This building could not be found. Choose another location."
        />
        <Button label="Back" onPress={() => props.navigation.goBack()} />
      </Screen>
    );
  return <ResolvedMapZoomedInScreen {...props} building={building} />;
}

function ResolvedMapZoomedInScreen({
  navigation,
  route,
  building,
}: Props & { building: NonNullable<ReturnType<typeof resolveBuilding>> }) {
  const insets = useSafeAreaInsets();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);

  const [currentZoom, setCurrentZoom] = useState(16.8);

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

    return [buildingMarker];
  }, [building, palette, currentZoom]);

  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [venueLoading, setVenueLoading] = useState(true);
  const [venueError, setVenueError] = useState(false);
  const [venueRetry, setVenueRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setVenueLoading(true);
    setVenueError(false);
    void getHungryService()
      .discovery.listVenuesByBuilding(building.id)
      .then((next) => {
        if (active) setVenues(next);
      })
      .catch(() => {
        if (active) setVenueError(true);
      })
      .finally(() => {
        if (active) setVenueLoading(false);
      });
    return () => {
      active = false;
    };
  }, [building.id, venueRetry]);
  const featuredStallsWithStatus = useMemo(() => {
    return venues.map((venue) => ({
      venue,
      isOpen: isVenueOpenFromHours(venue.operatingHours, venue.isOpen),
    }));
  }, [venues]);

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

      {venueError ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + spacing[12],
            left: spacing[4],
            right: spacing[4],
          }}
        >
          <Button label="Retry stall loading" onPress={() => setVenueRetry((value) => value + 1)} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
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
                <Button
                  label="Expand stall details"
                  variant="secondary"
                  onPress={() => bottomSheetRef.current?.snapToIndex(2)}
                />
                <AppText variant="bodySmall" tone="secondary">
                  {building.address}
                </AppText>
              </View>
              <Badge
                label={
                  venueLoading
                    ? "Loading stalls…"
                    : venueError
                      ? "Stall data unavailable"
                      : openVenueCount > 0
                        ? `Listed open (${openVenueCount})`
                        : "No stalls listed open"
                }
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
