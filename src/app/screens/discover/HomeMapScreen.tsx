import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  Animated,
  PanResponder,
} from "react-native";
import AnimatedReanimated, { FadeInUp, FadeOutDown } from "react-native-reanimated";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import {
  LocateFixed,
  Map as MapIcon,
  ChevronRight,
  Star,
  Search,
  Filter,
  Utensils,
  Heart,
  X,
  Flame,
  Zap,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker, BuildingLegend } from "@/components/map";
import { AppText, Chip, Button, FeedErrorBoundary, IconButton, Badge } from "@/components/ui";
import {
  getBuildingById,
  getNearestBuildings,
  singaporeBuildings,
  toSummary,
} from "@/lib/geo/singaporeBuildings";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";
import { StallCard } from "@/components/stall";

import { LinearGradient } from "expo-linear-gradient";

const DEFAULT_BUILDING_ID = "hc-maxwell";

function CrowdIndicator({ level }: { level?: "low" | "medium" | "high" }) {
  const { palette, spacing, radii } = useHungryTheme();
  if (!level) return null;

  const config = {
    low: {
      color: palette.statusFast,
      label: "Fast",
      icon: <Zap size={10} color={palette.statusFast} fill={palette.statusFast} />,
    },
    medium: { color: palette.statusModerate, label: "Moderate", icon: null },
    high: {
      color: palette.statusBusy,
      label: "Trending",
      icon: <Flame size={10} color={palette.statusBusy} fill={palette.statusBusy} />,
    },
  };

  const { color, label, icon } = config[level];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[1],
        backgroundColor: `${color}15`,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
      }}
    >
      {icon}
      {!icon && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      )}
      <AppText
        style={{
          color,
          fontSize: 10,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        {label}
      </AppText>
    </View>
  );
}

export function HomeMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const repository = getDataRepository();
  const insets = useSafeAreaInsets();
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const currentLocation = useLocationStore((state) => state.currentLocation);
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

  const areaStalls = useMemo(() => {
    return visibleBuildings.flatMap((b) => repository.listVenuesByBuilding(b.id));
  }, [repository, visibleBuildings]);

  const areaPopularDishes = useMemo(() => {
    const dishes = areaStalls
      .map((v) => repository.getDishById(v.topDishId))
      .filter((d): d is DishDetail => !!d)
      .slice(0, 10);

    // Fallback for demo purposes if no dishes found nearby
    if (dishes.length === 0) {
      return [
        {
          id: "demo-1",
          name: "Wild Truffle Tagliatelle",
          price: 28,
          description: "Handmade egg pasta, seasonal black truffle, parmigiano-reggiano emulsion.",
          imageUrl:
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
          venueName: "Pasta Express",
          dietaryFlags: [],
          tasteTags: [],
          rating: 4.9,
          reviewCount: 45,
          distanceMeters: 120,
        } as unknown as DishDetail,
        {
          id: "demo-2",
          name: "Burrata & Prosciutto Pizza",
          price: 24,
          description: "Wood-fired crust, creamy burrata, 24-month aged prosciutto di parma.",
          imageUrl:
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
          venueName: "Napoli Pizza",
          dietaryFlags: [],
          tasteTags: [],
          rating: 4.7,
          reviewCount: 89,
          distanceMeters: 350,
        } as unknown as DishDetail,
      ];
    }
    return dishes;
  }, [repository, areaStalls]);

  const [currentZoom, setCurrentZoom] = useState(15.5);
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">("carousel");
  const [showLegend, setShowLegend] = useState(false);
  const [selectedStallId, setSelectedStallId] = useState<string | null>(null);

  const selectedStall = useMemo(() => {
    if (!selectedStallId) return null;
    const allVenues = visibleBuildings.flatMap((b) => repository.listVenuesByBuilding(b.id));
    return allVenues.find((v) => v.id === selectedStallId) || null;
  }, [selectedStallId, repository, visibleBuildings]);

  const CAROUSEL_HEIGHT = 160;
  const MINIMIZED_HEIGHT = 60;
  const FULL_HEIGHT = 620;

  const animatedHeight = useRef(new Animated.Value(CAROUSEL_HEIGHT)).current;
  const isMinimized = useRef(false);

  // Width and Snapping Constants
  const CARD_WIDTH = screenWidth * 0.82; // Slightly wider
  const CARD_GAP = spacing[3];
  const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

  // Fading logic: carousel fades out as it approaches 30% of screen height
  const FADE_START = 160;
  const FADE_END = 240;

  const carouselOpacity = animatedHeight.interpolate({
    inputRange: [CAROUSEL_HEIGHT, FADE_START, FADE_END],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const gradientOpacity = animatedHeight.interpolate({
    inputRange: [FADE_START, FADE_END],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

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
    // Continuity Transition: Navigate to full detail screen
    navigation.navigate("DishDetail", { dishId: dish.id });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        const newHeight = isMinimized.current
          ? MINIMIZED_HEIGHT - gestureState.dy
          : CAROUSEL_HEIGHT - gestureState.dy;

        // Clamp height
        if (newHeight >= MINIMIZED_HEIGHT && newHeight <= FULL_HEIGHT) {
          animatedHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (displayMode === "list") {
          if (gestureState.dy > 100) snapTo(CAROUSEL_HEIGHT);
          else if (gestureState.dy < -100) snapTo(FULL_HEIGHT);
          return;
        }

        // Swipe down to peek
        if (gestureState.dy > 50) {
          snapTo(MINIMIZED_HEIGHT);
          isMinimized.current = true;
        } else if (
          gestureState.dy < -50 ||
          (gestureState.dy < 0 && Math.abs(gestureState.dy) > 50)
        ) {
          snapTo(CAROUSEL_HEIGHT);
          isMinimized.current = false;
        } else {
          // Snap back
          snapTo(isMinimized.current ? MINIMIZED_HEIGHT : CAROUSEL_HEIGHT);
        }
      },
    }),
  ).current;

  useEffect(() => {
    snapTo(CAROUSEL_HEIGHT);
  }, [displayMode]);

  const markers = useMemo<MapSurfaceMarker[]>(() => {
    const filteredBuildings = visibleBuildings.filter((b) => {
      if (mapFilters.hawkerOnly && b.type !== "hawker_centre") return false;
      if (mapFilters.mallOnly && b.type !== "mall") return false;
      return true;
    });

    const bMarkers = filteredBuildings.map((b) => ({
      id: b.id,
      label: b.name.replace(" Food Centre", ""),
      coordinate: b.coordinate,
      accent: b.type === "hawker_centre" ? palette.orange : palette.teal,
      type: b.type,
      // For V2: Imagine we have trending info. Let's mock it for Maxwell.
      isTrending: b.id === "hc-maxwell" && mapFilters.trendingOnly,
    }));

    if (currentZoom > 16.5) {
      const venues = repository.listVenuesByBuilding(activeBuildingRecord.id);
      const stallMarkers = venues.map((v, index) => {
        const latitudeOffset = ((index % 7) - 3) * 0.00007;
        const longitudeOffset = ((Math.floor(index / 7) % 7) - 3) * 0.00007;
        return {
          id: `stall-${v.id}`,
          label: v.name,
          coordinate: {
            latitude: activeBuildingRecord.coordinate.latitude + latitudeOffset,
            longitude: activeBuildingRecord.coordinate.longitude + longitudeOffset,
          },
          accent: palette.orange,
        };
      });
      return [...bMarkers, ...stallMarkers];
    }
    return bMarkers;
  }, [palette, repository, visibleBuildings, currentZoom, activeBuildingRecord, mapFilters]);

  const cameraPadding = useMemo(
    () => ({
      paddingBottom: displayMode === "list" ? 300 : 260,
    }),
    [displayMode],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FeedErrorBoundary
        title="Map currently unavailable"
        body="We hit a rendering issue with the map. Please try again."
      >
        <MapSurface
          style={StyleSheet.absoluteFill}
          centerCoordinate={activeBuildingRecord.coordinate}
          zoomLevel={currentZoom}
          markers={markers}
          cameraPadding={cameraPadding}
          selectedMarkerId={selectedBuilding?.id}
          onMarkerPress={(id) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (id.startsWith("stall-")) {
              const venueId = id.replace("stall-", "");
              setSelectedStallId(venueId);
            } else {
              setSelectedStallId(null);
              const building = visibleBuildings.find((b) => b.id === id);
              if (building) {
                setSelectedBuilding(toSummary(building));
                if (currentZoom < 16) setCurrentZoom(17);
              }
            }
            snapTo(CAROUSEL_HEIGHT);
            isMinimized.current = false;
          }}
          onMapPress={() => {
            if (displayMode === "carousel") {
              snapTo(isMinimized.current ? CAROUSEL_HEIGHT : MINIMIZED_HEIGHT);
              isMinimized.current = !isMinimized.current;
            }
          }}
          onZoomChange={setCurrentZoom}
        />
      </FeedErrorBoundary>

      {/* Top Floating UI */}
      <SafeAreaView
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: zIndex.overlay,
        }}
        edges={["top"]}
      >
        <View
          style={{
            paddingHorizontal: spacing[3],
            paddingTop: spacing[2],
            gap: spacing[3],
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: spacing[2],
              alignItems: "center",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search dishes or stalls"
              onPress={() => navigation.navigate("SearchHome")}
              style={[
                styles.searchBar,
                {
                  backgroundColor: palette.surface,
                  borderRadius: radii.pill,
                  flex: 1,
                  ...shadows.floating,
                },
              ]}
            >
              <Search color={palette.textMuted} size={20} />
              <AppText tone="secondary" style={{ flex: 1 }}>
                Search dishes or stalls...
              </AppText>
              <View
                style={{
                  width: 1,
                  height: 20,
                  backgroundColor: palette.border,
                }}
              />
              <Filter color={palette.orange} size={20} />
            </Pressable>
            <IconButton
              variant="floating"
              size={52}
              accessibilityLabel={
                displayMode === "carousel" ? "Switch to list view" : "Switch to carousel view"
              }
              onPress={() => {
                const next = displayMode === "carousel" ? "list" : "carousel";
                setDisplayMode(next);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              icon={
                displayMode === "carousel" ? (
                  <Utensils color={palette.orange} size={22} />
                ) : (
                  <MapIcon color={palette.orange} size={22} />
                )
              }
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[2] }}
          >
            <Chip
              label="Near me"
              selected={mapFilters.nearMe}
              onPress={() => toggleMapFilter("nearMe")}
              leftIcon={
                <LocateFixed
                  size={14}
                  color={mapFilters.nearMe ? palette.orange : palette.textMuted}
                />
              }
            />
            <Chip
              label="Trending"
              selected={mapFilters.trendingOnly}
              onPress={() => toggleMapFilter("trendingOnly")}
              leftIcon={
                <Flame
                  size={14}
                  color={mapFilters.trendingOnly ? palette.orange : palette.textMuted}
                />
              }
            />
            <Chip
              label="Hawker"
              selected={mapFilters.hawkerOnly}
              onPress={() => toggleMapFilter("hawkerOnly")}
            />
            <Chip
              label="Mall"
              selected={mapFilters.mallOnly}
              onPress={() => toggleMapFilter("mallOnly")}
            />
            <Chip
              label="Open Now"
              selected={mapFilters.openNow}
              onPress={() => toggleMapFilter("openNow")}
            />
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Floating Spotlight Carousel - Anchored to card top */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: animatedHeight, // Direct anchor
          left: 0,
          right: 0,
          zIndex: zIndex.sheet - 1,
          opacity: carouselOpacity,
          transform: [{ translateY: -spacing["1.5"] }], // Tighter, constant gap
          paddingBottom: spacing["1.5"],
        }}
        pointerEvents="box-none"
      >
        {!selectedStall && (
          <View style={{ width: screenWidth }}>
            <ScrollView
              horizontal
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="center"
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: (screenWidth - CARD_WIDTH) / 2,
                gap: CARD_GAP,
                paddingBottom: spacing[2],
              }}
              {...panResponder.panHandlers}
            >
              {areaPopularDishes.map((dish) => (
                <View key={dish.id} style={{ width: CARD_WIDTH }}>
                  <Pressable
                    onPress={() => handleCardPress(dish)}
                    style={[
                      {
                        backgroundColor: palette.surface,
                        borderRadius: radii.xl,
                        overflow: "hidden",
                      },
                      shadows.floating,
                    ]}
                  >
                    <View style={{ height: 120 }}>
                      <Image
                        source={{ uri: dish.imageUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                      <View style={{ position: "absolute", top: 12, left: 12 }}>
                        <Badge label="TOP PICK" tone="orange" />
                      </View>
                    </View>
                    <View style={{ padding: spacing[3], gap: spacing[1] }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <AppText
                          variant="bodyBold"
                          numberOfLines={1}
                          style={{ flex: 1, marginRight: spacing[2], fontSize: 18 }}
                        >
                          {dish.name}
                        </AppText>
                        <AppText variant="bodyBold" style={{ color: palette.orange, fontSize: 18 }}>
                          ${Math.round(dish.price)}
                        </AppText>
                      </View>
                      <AppText
                        variant="micro"
                        tone="secondary"
                        numberOfLines={2}
                        style={{ lineHeight: 16 }}
                      >
                        {dish.description ||
                          "Handmade with fresh ingredients and seasonal spices for an authentic taste."}
                      </AppText>
                    </View>
                  </Pressable>

                  {/* Directional Fade Overlay - Simulates Top-to-Bottom Fade */}
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      { opacity: gradientOpacity, borderRadius: radii.xl, overflow: "hidden" },
                    ]}
                    pointerEvents="none"
                  >
                    <LinearGradient
                      colors={[palette.bg, "transparent"]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 0.6 }}
                    />
                  </Animated.View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>

      {/* Bottom UI Container */}
      <Animated.View
        style={[
          styles.animatedCard,
          {
            backgroundColor: palette.surface,
            height: animatedHeight,
            zIndex: zIndex.sheet,
            bottom: 0,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            ...shadows.floating,
          },
        ]}
      >
        {/* Interactive Header Area for Dragging */}
        <View {...panResponder.panHandlers}>
          <View style={styles.dragHandle}>
            <View style={[styles.dragBar, { backgroundColor: palette.border }]} />
          </View>

          {activeBuildingRecord && !selectedStall && (
            <View
              style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[2], gap: spacing[3] }}
            >
              <View>
                <AppText variant="h2" numberOfLines={1}>
                  {activeBuildingRecord.name}
                </AppText>
                <AppText variant="micro" tone="secondary" numberOfLines={1}>
                  {activeBuildingRecord.type.replace("_", " ")} · {activeBuildingRecord.address}
                </AppText>
                <View style={{ flexDirection: "row", gap: spacing[2], marginTop: 2 }}>
                  <AppText variant="micro" tone="secondary">
                    {activeBuildingRecord.openStalls} / {activeBuildingRecord.totalStalls} Stalls
                    Open
                  </AppText>
                </View>
              </View>
              <Button
                label="View Directory"
                onPress={() =>
                  navigation.navigate("VenueDirectory", { venueId: activeBuildingRecord.id })
                }
                style={{ backgroundColor: palette.orange }}
              />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {selectedStall ? (
            <View
              style={{
                paddingHorizontal: spacing[4],
                paddingBottom: insets.bottom + spacing[4],
                gap: spacing[4],
              }}
            >
              <StallCard
                venue={selectedStall}
                topDish={
                  selectedStall.topDishId
                    ? repository.getDishById(selectedStall.topDishId)
                    : undefined
                }
                onPress={() => navigation.navigate("StallDetail", { venueId: selectedStall.id })}
              />
              <Button
                label="View Full Stall Details"
                onPress={() => navigation.navigate("StallDetail", { venueId: selectedStall.id })}
              />
            </View>
          ) : (
            <>
              {displayMode === "list" && (
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: spacing[4],
                    gap: spacing[4],
                    paddingBottom: insets.bottom + spacing[12],
                  }}
                >
                  <AppText variant="h2" style={{ marginBottom: spacing[2], marginTop: spacing[2] }}>
                    Nearby Stalls
                  </AppText>
                  {visibleBuildings
                    .flatMap((b) => repository.listVenuesByBuilding(b.id))
                    .map((venue) => (
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
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <AppText variant="h3">{venue.name}</AppText>
                            <CrowdIndicator level={venue.liveCrowd} />
                          </View>
                          <AppText variant="micro" tone="secondary">
                            {venue.floor} {venue.unitNumber} · {venue.operatingHours}
                          </AppText>
                        </View>
                        <ChevronRight size={16} color={palette.orange} />
                      </Pressable>
                    ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </Animated.View>

      {/* Floating Action Buttons - Following the card top */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: Animated.add(animatedHeight, spacing[4]),
          right: spacing[4],
          zIndex: zIndex.overlay,
        }}
        pointerEvents="box-none"
      >
        <IconButton
          variant="floating"
          size={52}
          accessibilityLabel="Recenter map"
          onPress={() => {
            setSelectedStallId(null);
            setSelectedBuilding(toSummary(getBuildingById(DEFAULT_BUILDING_ID)!));
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          icon={<LocateFixed color={palette.orange} size={24} />}
        />
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
  animatedCard: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  dragHandle: {
    width: "100%",
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
