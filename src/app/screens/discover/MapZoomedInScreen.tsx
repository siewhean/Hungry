import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, Animated, ScrollView } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Navigation, Store, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map/MapSurface";
import { AppText, Button, Card, Badge } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getBuildingById, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";

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
  const { height: screenHeight } = useWindowDimensions();
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
  }, [building]);

  const markers = useMemo<MapSurfaceMarker[]>(
    () => {
      const buildingMarker = {
        id: building.id,
        label: building.name.replace(" Food Centre", ""),
        coordinate: building.coordinate,
        accent: building.type === "hawker_centre" ? palette.orange : palette.teal,
        type: building.type,
      };

      if (currentZoom > 17.5) {
        const stallMarkers = getBuildingVenues(building.id).map(v => ({
          id: `stall-${v.id}`,
          label: v.name,
          coordinate: {
            latitude: building.coordinate.latitude + (Math.random() - 0.5) * 0.0008,
            longitude: building.coordinate.longitude + (Math.random() - 0.5) * 0.0008,
          },
          accent: palette.orange,
        }));
        return [buildingMarker, ...stallMarkers];
      }

      return [buildingMarker];
    },
    [building, palette, currentZoom],
  );

  const featuredStalls = getBuildingVenues(building.id).filter((v) => v.isOpen).slice(0, 3);

  // --- MANUAL ANIMATED CARD LOGIC ---
  const PEEK_HEIGHT = 300; 
  const FULL_HEIGHT = screenHeight * 0.65;
  const animatedHeight = useRef(new Animated.Value(PEEK_HEIGHT)).current;

  const snapTo = (height: number) => {
    Animated.spring(animatedHeight, {
      toValue: height,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  useEffect(() => {
    snapTo(PEEK_HEIGHT);
  }, []);

  const handleMarkerPress = (id: string) => {
    if (id.startsWith("stall-")) {
      const venueId = id.replace("stall-", "");
      navigation.navigate("StallDetail", { venueId });
      return;
    }
    snapTo(FULL_HEIGHT);
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
        onMapPress={() => snapTo(PEEK_HEIGHT)}
        onZoomChange={setCurrentZoom}
      />

      {/* Floating Back Button */}
      <Pressable 
        onPress={() => navigation.goBack()} 
        style={{ position: "absolute", top: insets.top + 10, left: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center", zIndex: 30, ...shadows.floating }}
      >
        <ChevronLeft color={palette.text} size={24} />
      </Pressable>

      <Animated.View
        style={[
          styles.animatedCard,
          shadows.floating,
          {
            backgroundColor: palette.surface,
            height: animatedHeight,
            zIndex: 50,
            elevation: 10,
            bottom: 12, // Clearance for tab bar
            paddingHorizontal: 16,
            borderRadius: 40,
          }
        ]}
      >
        <View style={{ width: "100%", height: 32, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: 10 }}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h2">{building.name}</AppText>
                <AppText variant="bodySmall" tone="secondary">{building.address}</AppText>
              </View>
              <Badge label="Open" tone="success" />
            </View>

            <View style={{ gap: 8 }}>
              {featuredStalls.map((venue) => (
                <Pressable
                  key={venue.id}
                  onPress={() => navigation.navigate("StallDetail", { venueId: venue.id })}
                  style={{
                    backgroundColor: palette.bgSoft,
                    borderRadius: 16,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderWidth: 1,
                    borderColor: palette.border,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="h3">{venue.name}</AppText>
                    <AppText variant="micro" tone="secondary">{venue.unitNumber} · {venue.operatingHours}</AppText>
                  </View>
                  <Store size={16} color={palette.orange} />
                </Pressable>
              ))}
            </View>

            <Button
              label="Explore Layout"
              onPress={() => navigation.navigate("BuildingDrillDown", { buildingId: building.id })}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  animatedCard: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  }
});
