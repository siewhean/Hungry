import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, Animated, PanResponder } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { LocateFixed, Map as MapIcon, Navigation, ChevronRight, Star, Search, Filter, Utensils, Info, Heart, X, Users } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker } from "@/components/map";
import { AppText, Button, Chip, Badge } from "@/components/ui";
import { getBuildingVenues } from "@/features/discovery/discovery";
import { getBuildingById, getNearestBuildings, singaporeBuildings, toSummary } from "@/lib/geo/singaporeBuildings";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import type { Coordinate, VenueSummary, DishDetail } from "@/types/domain";

const DEFAULT_BUILDING_ID = "hc-maxwell";

function CrowdIndicator({ level }: { level?: "low" | "medium" | "high" }) {
  const { palette } = useHungryTheme();
  if (!level) return null;

  const config = {
    low: { color: "#10B981", label: "Quiet" },
    medium: { color: "#F59E0B", label: "Moderate" },
    high: { color: "#EF4444", label: "Busy" },
  };

  const { color, label } = config[level];

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${color}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <AppText style={{ color, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>{label}</AppText>
    </View>
  );
}

export function HomeMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { palette, radii, spacing, shadows } = useHungryTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const gpsBadgeState = useLocationStore((state) => state.gpsBadgeState);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const mapFilters = useDiscoveryStore((state) => state.mapFilters);
  const toggleMapFilter = useDiscoveryStore((state) => state.toggleMapFilter);

  const activeBuildingRecord = useMemo(() => {
    const nameMatch = selectedBuilding?.name
      ? singaporeBuildings.find((b) => b.name === selectedBuilding.name)
      : undefined;
    return nameMatch ?? getBuildingById(DEFAULT_BUILDING_ID)!;
  }, [selectedBuilding]);

  const visibleBuildings = useMemo(() => {
    const nearest = getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 5, 8);
    const combined = [activeBuildingRecord, ...nearest];
    const seen = new Set<string>();
    return combined.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [activeBuildingRecord, currentLocation]);

  const areaPopularDishes = useMemo(() => {
    const allVenues = visibleBuildings.flatMap(b => mockRepository.listVenuesByBuilding(b.id));
    return allVenues
      .map(v => mockRepository.getDishById(v.topDishId))
      .filter((d): d is DishDetail => !!d)
      .slice(0, 10);
  }, [visibleBuildings]);

  const [currentZoom, setCurrentZoom] = useState(15.5);
  const [selectedDish, setSelectedDish] = useState<DishDetail | null>(null);
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">("carousel");

  // --- MANUAL ANIMATED CARD LOGIC ---
  const PEEK_HEIGHT = 250; // Increased to clear tab bar
  const FULL_HEIGHT = 560; 

  const animatedHeight = useRef(new Animated.Value(PEEK_HEIGHT)).current;

  const snapTo = (height: number) => {
    Animated.spring(animatedHeight, {
      toValue: height,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const handleCardPress = (dish: DishDetail) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedDish(dish);
    snapTo(FULL_HEIGHT);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          setSelectedDish(null);
          snapTo(PEEK_HEIGHT);
        }
      },
    })
  ).current;

  useEffect(() => {
    snapTo(PEEK_HEIGHT);
  }, []);

  const markers = useMemo<MapSurfaceMarker[]>(() => {
    const bMarkers = visibleBuildings.map((b) => ({
      id: b.id,
      label: b.name.replace(" Food Centre", ""),
      coordinate: b.coordinate,
      accent: b.type === "hawker_centre" ? palette.orange : palette.teal,
      type: b.type,
    }));
    if (currentZoom > 17) {
      const stallMarkers = mockRepository.listVenuesByBuilding(activeBuildingRecord.id).map(v => ({
        id: `stall-${v.id}`,
        label: v.name,
        coordinate: {
          latitude: activeBuildingRecord.coordinate.latitude + (Math.random() - 0.5) * 0.0005,
          longitude: activeBuildingRecord.coordinate.longitude + (Math.random() - 0.5) * 0.0005,
        },
        accent: palette.orange,
      }));
      return [...bMarkers, ...stallMarkers];
    }
    return bMarkers;
  }, [palette, visibleBuildings, currentZoom, activeBuildingRecord]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <MapSurface
        style={StyleSheet.absoluteFill}
        centerCoordinate={activeBuildingRecord.coordinate}
        zoomLevel={currentZoom}
        markers={markers}
        onMapPress={() => {
          setSelectedDish(null);
          snapTo(PEEK_HEIGHT);
        }}
        onZoomChange={setCurrentZoom}
      />

      {/* Top Floating UI */}
      <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }} edges={["top"]}>
        <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[2], gap: spacing[3] }}>
          <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
            <Pressable onPress={() => navigation.navigate("SearchHome")} style={[styles.searchBar, shadows.floating, { backgroundColor: palette.surface, borderRadius: radii.pill, flex: 1 }]}>
              <Search color={palette.textMuted} size={20} />
              <AppText tone="secondary" style={{ flex: 1 }}>Search dishes or stalls...</AppText>
              <View style={{ width: 1, height: 20, backgroundColor: palette.border }} />
              <Filter color={palette.orange} size={20} />
            </Pressable>
            <Pressable 
              onPress={() => {
                const next = displayMode === "carousel" ? "list" : "carousel";
                setDisplayMode(next);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[shadows.floating, { width: 52, height: 52, borderRadius: 26, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }]}
            >
              {displayMode === "carousel" ? <Utensils color={palette.orange} size={22} /> : <MapIcon color={palette.orange} size={22} />}
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
            <Chip 
              label="Near me" 
              selected={mapFilters.nearMe} 
              onPress={() => toggleMapFilter("nearMe")}
              leftIcon={<LocateFixed size={14} color={mapFilters.nearMe ? palette.orange : palette.textMuted} />} 
            />
            <Chip 
              label="Hawker" 
              selected={mapFilters.hawkerOnly} 
              onPress={() => toggleMapFilter("nearMe")} 
            />
            <Chip label="Top Rated" selected={mapFilters.topRated} onPress={() => toggleMapFilter("topRated")} />
            <Chip label="Open Now" selected={mapFilters.openNow} onPress={() => toggleMapFilter("openNow")} />
          </ScrollView>
        </View>
      </SafeAreaView>

      <Pressable onPress={() => setSelectedBuilding(toSummary(getBuildingById(DEFAULT_BUILDING_ID)!))} style={[styles.floatingButton, { bottom: PEEK_HEIGHT + 20, right: spacing[4], backgroundColor: palette.surface }, shadows.floating]}>
        <LocateFixed color={palette.orange} size={24} />
      </Pressable>

      <Animated.View 
        {...panResponder.panHandlers}
        style={[
          styles.animatedCard, 
          shadows.floating, 
          { 
            backgroundColor: (selectedDish || displayMode === "list") ? "#FFFFFF" : "transparent",
            height: animatedHeight,
            zIndex: 50,
            elevation: 10,
            bottom: 0, // Increased clearance
            paddingHorizontal: (selectedDish || displayMode === "list") ? 16 : 0,
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            borderRadius: (selectedDish || displayMode === "list") ? 40 : 0,
          }
        ]}
      >
        {/* Handle Bar / Close Header */}
        <View style={{ width: "100%", height: 40, alignItems: "center", justifyContent: "center", position: "relative" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: palette.border, opacity: (selectedDish || displayMode === "list") ? 1 : 0 }} />
          {selectedDish && (
            <Pressable 
              onPress={() => { setSelectedDish(null); snapTo(PEEK_HEIGHT); }}
              style={{ position: "absolute", right: spacing[4], top: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
            >
              <X color={palette.text} size={18} />
            </Pressable>
          )}
        </View>

        {selectedDish ? (
          <View style={{ gap: spacing[4], paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: "100%", height: 240, borderRadius: 32, overflow: "hidden", position: "relative" }}>
              <Image source={{ uri: selectedDish.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={{ position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", ...shadows.floating }}>
                <Heart color={palette.error} size={22} fill={palette.error} />
              </View>
              <View style={{ position: "absolute", bottom: 16, left: 16, backgroundColor: "#FACC15", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 }}>
                <AppText style={{ color: "#1A2E44", fontSize: 11, fontWeight: "800" }}>TRENDING NOW</AppText>
              </View>
              {selectedDish.liveCrowd && (
                <View style={{ position: "absolute", bottom: 16, right: 16 }}>
                  <CrowdIndicator level={selectedDish.liveCrowd} />
                </View>
              )}
            </View>

            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <AppText style={{ fontSize: 26, fontWeight: "900", color: "#1A2E44", flex: 1, lineHeight: 30 }}>{selectedDish.name}</AppText>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Star color={palette.amber} fill={palette.amber} size={18} />
                  <AppText style={{ fontSize: 20, fontWeight: "800", color: "#1A2E44" }}>{selectedDish.rating.toFixed(1)}</AppText>
                </View>
              </View>
              <AppText style={{ fontSize: 16, color: palette.textSecondary }}>
                {selectedDish.venueName} • {(selectedDish.distanceMeters / 1609).toFixed(1)} miles
              </AppText>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 36, height: 32, borderRadius: 18, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#E5E7EB" }} />
                <View style={{ width: 36, height: 32, borderRadius: 18, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#D1D5DB", marginLeft: -14 }} />
                <View style={{ width: 36, height: 32, borderRadius: 18, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: palette.orangeLight, marginLeft: -14, alignItems: "center", justifyContent: "center" }}>
                  <AppText style={{ fontSize: 10, fontWeight: "800", color: palette.orange }}>+12</AppText>
                </View>
              </View>
              <AppText variant="bodySmall" style={{ flex: 1, color: "#4B5563", fontStyle: "italic", lineHeight: 18 }}>
                "Best {selectedDish.name.toLowerCase()} in the city, hands down."
              </AppText>
            </View>

            <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[1] }}>
              <Pressable 
                onPress={() => navigation.navigate("DishDetail", { dishId: selectedDish.id })}
                style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}
              >
                <AppText style={{ fontSize: 16, fontWeight: "700", color: "#1F2937" }}>View Menu</AppText>
              </Pressable>
              <Pressable 
                style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: palette.orange, alignItems: "center", justifyContent: "center", ...shadows.floating }}
              >
                <AppText style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>Reserve Now</AppText>
              </Pressable>
            </View>
          </View>
        ) : displayMode === "list" ? (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], gap: spacing[4], paddingBottom: insets.bottom + 40 }}>
            <AppText variant="h2" style={{ marginBottom: spacing[2] }}>Nearby Stalls</AppText>
            {visibleBuildings.flatMap(b => mockRepository.listVenuesByBuilding(b.id)).map((venue) => (
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
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <AppText variant="h3">{venue.name}</AppText>
                    <CrowdIndicator level={venue.liveCrowd} />
                  </View>
                  <AppText variant="micro" tone="secondary">{venue.floor} {venue.unitNumber} · {venue.operatingHours}</AppText>
                </View>
                <ChevronRight size={16} color={palette.orange} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: 200 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[4], paddingHorizontal: spacing[4] }}>
              {areaPopularDishes.map((dish) => (
                <Pressable key={dish.id} onPress={() => handleCardPress(dish)} style={[shadows.floating, styles.carouselCard]}>
                  <View style={{ height: 140 }}>
                    <Image source={{ uri: dish.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    {dish.liveCrowd && (
                      <View style={{ position: "absolute", top: 10, right: 10 }}>
                        <CrowdIndicator level={dish.liveCrowd} />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: spacing[3], gap: 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText style={{ fontWeight: "800", flex: 1 }} numberOfLines={1}>{dish.name}</AppText>
                      <AppText style={{ color: palette.orange, fontWeight: "800" }}>S${Math.round(dish.price)}</AppText>
                    </View>
                    <AppText variant="micro" tone="secondary">{dish.venueName}</AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 52,
    gap: 8,
  },
  floatingButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    zIndex: 30,
  },
  animatedCard: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  carouselCard: {
    width: 280,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
  }
});
