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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  MapSurface,
  type MapSurfaceMarker,
  BuildingLegend,
} from "@/components/map";
import { AppText, Chip } from "@/components/ui";
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

const DEFAULT_BUILDING_ID = "hc-maxwell";

function CrowdIndicator({ level }: { level?: "low" | "medium" | "high" }) {
  const { palette, spacing, radii } = useHungryTheme();
  if (!level) return null;

  const config = {
    low: {
      color: palette.statusFast,
      label: "Fast",
      icon: (
        <Zap size={10} color={palette.statusFast} fill={palette.statusFast} />
      ),
    },
    medium: { color: palette.statusModerate, label: "Moderate", icon: null },
    high: {
      color: palette.statusBusy,
      label: "Trending",
      icon: (
        <Flame size={10} color={palette.statusBusy} fill={palette.statusBusy} />
      ),
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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const repository = getDataRepository();
  const insets = useSafeAreaInsets();
  const { palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();

  const currentLocation = useLocationStore((state) => state.currentLocation);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore(
    (state) => state.setSelectedBuilding,
  );
  const mapFilters = useDiscoveryStore((state) => state.mapFilters);
  const toggleMapFilter = useDiscoveryStore((state) => state.toggleMapFilter);

  const activeBuildingRecord = useMemo(() => {
    const nameMatch = selectedBuilding?.name
      ? singaporeBuildings.find((b) => b.name === selectedBuilding.name)
      : undefined;
    return nameMatch ?? getBuildingById(DEFAULT_BUILDING_ID)!;
  }, [selectedBuilding]);

  const visibleBuildings = useMemo(() => {
    const nearest = getNearestBuildings(
      currentLocation.latitude,
      currentLocation.longitude,
      5,
      8,
    );
    const combined = [activeBuildingRecord, ...nearest];
    const seen = new Set<string>();
    return combined.filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });
  }, [activeBuildingRecord, currentLocation]);

  const areaPopularDishes = useMemo(() => {
    const allVenues = visibleBuildings.flatMap((b) =>
      repository.listVenuesByBuilding(b.id),
    );
    return allVenues
      .map((v) => repository.getDishById(v.topDishId))
      .filter((d): d is DishDetail => !!d)
      .slice(0, 10);
  }, [repository, visibleBuildings]);

  const [currentZoom, setCurrentZoom] = useState(15.5);
  const [selectedDish, setSelectedDish] = useState<DishDetail | null>(null);
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">(
    "carousel",
  );

  const PEEK_HEIGHT = 240;
  const FULL_HEIGHT = 600;

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
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          setSelectedDish(null);
          snapTo(PEEK_HEIGHT);
        }
      },
    }),
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
    if (currentZoom > 16.5) {
      const venues = repository.listVenuesByBuilding(activeBuildingRecord.id);
      const stallMarkers = venues.map((v) => ({
        id: `stall-${v.id}`,
        label: v.name,
        coordinate: {
          latitude:
            activeBuildingRecord.coordinate.latitude +
            (Math.random() - 0.5) * 0.0005,
          longitude:
            activeBuildingRecord.coordinate.longitude +
            (Math.random() - 0.5) * 0.0005,
        },
        accent: palette.orange,
      }));
      return [...bMarkers, ...stallMarkers];
    }
    return bMarkers;
  }, [
    palette,
    repository,
    visibleBuildings,
    currentZoom,
    activeBuildingRecord,
  ]);

  const cameraPadding = useMemo(
    () => ({
      paddingBottom: selectedDish || displayMode === "list" ? 300 : 260,
    }),
    [selectedDish, displayMode],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <MapSurface
        style={StyleSheet.absoluteFill}
        centerCoordinate={activeBuildingRecord.coordinate}
        zoomLevel={currentZoom}
        markers={markers}
        cameraPadding={cameraPadding}
        onMapPress={() => {
          setSelectedDish(null);
          snapTo(PEEK_HEIGHT);
        }}
        onZoomChange={setCurrentZoom}
      />

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                displayMode === "carousel"
                  ? "Switch to list view"
                  : "Switch to carousel view"
              }
              onPress={() => {
                const next = displayMode === "carousel" ? "list" : "carousel";
                setDisplayMode(next);
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                {
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: palette.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadows.floating,
                },
              ]}
            >
              {displayMode === "carousel" ? (
                <Utensils color={palette.orange} size={22} />
              ) : (
                <MapIcon color={palette.orange} size={22} />
              )}
            </Pressable>
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
              label="Hawker"
              selected={mapFilters.hawkerOnly}
              onPress={() => toggleMapFilter("hawkerOnly")}
            />
            <Chip
              label="Top Rated"
              selected={mapFilters.topRated}
              onPress={() => toggleMapFilter("topRated")}
            />
            <Chip
              label="Open Now"
              selected={mapFilters.openNow}
              onPress={() => toggleMapFilter("openNow")}
            />
          </ScrollView>
        </View>
      </SafeAreaView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter map to default building"
        onPress={() =>
          setSelectedBuilding(toSummary(getBuildingById(DEFAULT_BUILDING_ID)!))
        }
        style={[
          styles.floatingButton,
          {
            bottom: PEEK_HEIGHT + spacing[6],
            right: spacing[4],
            backgroundColor: palette.surface,
            zIndex: zIndex.fab,
            ...shadows.floating,
          },
        ]}
      >
        <LocateFixed color={palette.orange} size={24} />
      </Pressable>

      {/* Floating Legend */}
      <View
        style={{
          position: "absolute",
          bottom: PEEK_HEIGHT + spacing[4],
          left: spacing[4],
          zIndex: zIndex.overlay,
        }}
      >
        <BuildingLegend />
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.animatedCard,
          {
            backgroundColor: palette.surface,
            height: animatedHeight,
            zIndex: zIndex.sheet,
            bottom: 0,
            paddingHorizontal:
              selectedDish || displayMode === "list" ? spacing[4] : 0,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            ...shadows.floating,
          },
        ]}
      >
        <View
          style={{
            width: "100%",
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: palette.border,
            }}
          />
          {selectedDish && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dish details"
              onPress={() => {
                setSelectedDish(null);
                snapTo(PEEK_HEIGHT);
              }}
              style={{
                position: "absolute",
                right: spacing[4],
                top: 8,
                width: 32,
                height: 32,
                borderRadius: radii.pill,
                backgroundColor: palette.bgSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X color={palette.text} size={18} />
            </Pressable>
          )}
        </View>

        {selectedDish ? (
          <View
            style={{
              gap: spacing[4],
              paddingBottom: insets.bottom + spacing[4],
              paddingHorizontal: spacing[3],
            }}
          >
            <View
              style={{
                width: "100%",
                height: 240,
                borderRadius: radii.xl,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Image
                source={{ uri: selectedDish.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              <View
                style={[
                  {
                    position: "absolute",
                    top: spacing[4],
                    right: spacing[4],
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
                <Heart color={palette.error} size={22} fill={palette.error} />
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: spacing[4],
                  left: spacing[4],
                  backgroundColor: palette.amber,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radii.md,
                }}
              >
                <AppText
                  style={{
                    color: palette.navy,
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  TRENDING NOW
                </AppText>
              </View>
              {selectedDish.liveCrowd && (
                <View
                  style={{
                    position: "absolute",
                    bottom: spacing[4],
                    right: spacing[4],
                  }}
                >
                  <CrowdIndicator level={selectedDish.liveCrowd} />
                </View>
              )}
            </View>

            <View style={{ gap: spacing[1] }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <AppText
                  style={{
                    fontSize: 26,
                    fontWeight: "900",
                    color: palette.text,
                    flex: 1,
                    lineHeight: 30,
                  }}
                >
                  {selectedDish.name}
                </AppText>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[1],
                    marginTop: 4,
                  }}
                >
                  <Star color={palette.amber} fill={palette.amber} size={18} />
                  <AppText
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      color: palette.text,
                    }}
                  >
                    {selectedDish.rating.toFixed(1)}
                  </AppText>
                </View>
              </View>
              <AppText style={{ fontSize: 16, color: palette.textSecondary }}>
                {selectedDish.venueName} •{" "}
                {(() => {
                  const venues = repository.listVenuesByBuilding(
                    activeBuildingRecord.id,
                  );
                  const openCount = venues.filter((v) => v.isOpen).length;
                  return openCount > 0
                    ? `${openCount} stalls open now`
                    : "Building currently closed";
                })()}
              </AppText>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: spacing[3],
                marginTop: spacing[1],
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View menu for ${selectedDish.name}`}
                onPress={() =>
                  navigation.navigate("DishDetail", { dishId: selectedDish.id })
                }
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: radii.pill,
                  backgroundColor: palette.surfaceRaised,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: palette.text,
                  }}
                >
                  View Menu
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open stall details for ${selectedDish.venueName}`}
                onPress={() =>
                  navigation.navigate("StallDetail", {
                    venueId: selectedDish.venueId,
                  })
                }
                style={[
                  {
                    flex: 1,
                    height: 56,
                    borderRadius: radii.pill,
                    backgroundColor: palette.orange,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  shadows.floating,
                ]}
              >
                <AppText
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: palette.surface,
                  }}
                >
                  Reserve Now
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : displayMode === "list" ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing[3],
              gap: spacing[4],
              paddingBottom: insets.bottom + spacing[12],
            }}
          >
            <AppText variant="h2" style={{ marginBottom: spacing[2] }}>
              Nearby Stalls
            </AppText>
            {visibleBuildings
              .flatMap((b) => repository.listVenuesByBuilding(b.id))
              .map((venue) => (
                <Pressable
                  key={venue.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${venue.name} stall details`}
                  onPress={() =>
                    navigation.navigate("StallDetail", { venueId: venue.id })
                  }
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
        ) : (
          <View style={{ height: 200 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: spacing[4],
                paddingHorizontal: spacing[3],
              }}
            >
              {areaPopularDishes.map((dish) => (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${dish.name} at ${dish.venueName}`}
                  onPress={() => handleCardPress(dish)}
                  style={[
                    {
                      backgroundColor: palette.surface,
                      borderRadius: radii.xl,
                      overflow: "hidden",
                      width: 280,
                    },
                    shadows.floating,
                  ]}
                >
                  <View style={{ height: 140 }}>
                    <Image
                      source={{ uri: dish.imageUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    {dish.liveCrowd && (
                      <View
                        style={{ position: "absolute", top: 10, right: 10 }}
                      >
                        <CrowdIndicator level={dish.liveCrowd} />
                      </View>
                    )}
                  </View>
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <AppText
                        style={{ fontWeight: "800", flex: 1 }}
                        numberOfLines={1}
                      >
                        {dish.name}
                      </AppText>
                      <AppText
                        style={{ color: palette.orange, fontWeight: "800" }}
                      >
                        S${Math.round(dish.price)}
                      </AppText>
                    </View>
                    <AppText variant="micro" tone="secondary">
                      {dish.venueName}
                    </AppText>
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
    paddingHorizontal: 16, // Maintained for search bar aesthetic
    height: 52,
    gap: 8, // Maintained for search bar aesthetic
  },
  floatingButton: {
    width: 52,
    height: 52,
    borderRadius: 26, // Half of 52 for pill shape
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  animatedCard: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
