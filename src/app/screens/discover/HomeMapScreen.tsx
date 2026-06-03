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
  Filter,
  Utensils,
  Heart,
  X,
  Flame,
  Zap,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker, BuildingLegend } from "@/components/map";
import {
  AccessibleImage,
  AppText,
  Button,
  FilterChipRail,
  FeedErrorBoundary,
  ExpandableSearchLauncher,
} from "@/components/ui";
import {
  getBuildingById,
  getNearestBuildings,
  singaporeBuildings,
  toSummary,
} from "@/lib/geo/singaporeBuildings";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DishDetail } from "@/types/domain";

const DEFAULT_BUILDING_ID = "hc-maxwell";
type HomeMapFilterId = "nearMe" | "hawkerOnly" | "topRated" | "openNow";

const HOME_MAP_FILTER_OPTIONS: readonly { id: HomeMapFilterId; label: string }[] = [
  { id: "nearMe", label: "Near me" },
  { id: "hawkerOnly", label: "Hawker" },
  { id: "topRated", label: "Top Rated" },
  { id: "openNow", label: "Open Now" },
];

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
  const { componentRadii, palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const mapStatusDisclosure = getDataTrustDisclosure("mapStatus");
  const searchQuery = useSearchStore((state) => state.filters.query);
  const updateSearchQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[3] * 2 - 78, 240),
    [screenWidth, spacing],
  );

  const currentLocation = useLocationStore((state) => state.currentLocation);
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const highlightedStallVenueId = useDiscoveryStore((state) => state.highlightedStallVenueId);
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
    const allVenues = visibleBuildings.flatMap((b) => repository.listVenuesByBuilding(b.id));
    return allVenues
      .map((v) => repository.getDishById(v.topDishId))
      .filter((d): d is DishDetail => !!d)
      .slice(0, 10);
  }, [repository, visibleBuildings]);

  const [currentZoom, setCurrentZoom] = useState(highlightedStallVenueId ? 17.1 : 15.5);
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">("carousel");
  const [showLegend, setShowLegend] = useState(false);

  const CAROUSEL_HEIGHT = 240;
  const MINIMIZED_HEIGHT = 60;
  const FULL_HEIGHT = 620;

  const animatedHeight = useRef(new Animated.Value(CAROUSEL_HEIGHT)).current;
  const isMinimized = useRef(false);

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

  const submitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      rememberSearch(trimmed);
    }
    navigation.navigate("SearchHome");
  }, [navigation, rememberSearch, searchQuery]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
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
        } else if (gestureState.dy < -50) {
          snapTo(CAROUSEL_HEIGHT);
          isMinimized.current = false;
        }
      },
    }),
  ).current;

  const edgeBackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dx > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
        onPanResponderRelease: (_, gestureState) => {
          if ((gestureState.dx > 64 || gestureState.vx > 0.35) && navigation.canGoBack()) {
            navigation.goBack();
          }
        },
      }),
    [navigation],
  );

  useEffect(() => {
    snapTo(CAROUSEL_HEIGHT);
  }, [displayMode]);

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
          accent: v.id === highlightedStallVenueId ? palette.error : palette.orange,
          isTrending: v.id === highlightedStallVenueId,
        };
      });
      return [...bMarkers, ...stallMarkers];
    }
    return bMarkers;
  }, [
    palette,
    repository,
    visibleBuildings,
    currentZoom,
    activeBuildingRecord,
    highlightedStallVenueId,
  ]);

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
          onMapPress={() => {
            if (displayMode === "carousel") {
              snapTo(isMinimized.current ? CAROUSEL_HEIGHT : MINIMIZED_HEIGHT);
              isMinimized.current = !isMinimized.current;
            }
          }}
          onZoomChange={setCurrentZoom}
          selectedMarkerId={
            highlightedStallVenueId ? `stall-${highlightedStallVenueId}` : undefined
          }
        />
      </FeedErrorBoundary>

      <View
        {...edgeBackPanResponder.panHandlers}
        pointerEvents="box-only"
        style={[
          styles.edgeBackGestureZone,
          {
            width: Math.max(28, insets.left + 24),
            zIndex: zIndex.overlay + 1,
          },
        ]}
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
            <ExpandableSearchLauncher
              query={searchQuery}
              onQueryChange={updateSearchQuery}
              onSubmit={submitSearch}
              onClear={() => updateSearchQuery("")}
              placeholder="Search dishes or stalls..."
              expandedWidth={searchBarWidth}
              iconAlignment="left"
              barHeight={52}
              backgroundColor={palette.surface}
              borderColor={palette.border}
              textColor={palette.text}
              placeholderColor={palette.textSecondary}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                displayMode === "carousel" ? "Switch to list view" : "Switch to carousel view"
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
          <FilterChipRail
            options={HOME_MAP_FILTER_OPTIONS}
            selectedIds={HOME_MAP_FILTER_OPTIONS.filter((option) => mapFilters[option.id]).map(
              (option) => option.id,
            )}
            onSelect={toggleMapFilter}
            gap={spacing[2]}
            renderLeftIcon={(option, selected) =>
              option.id === "nearMe" ? (
                <LocateFixed size={14} color={selected ? palette.orange : palette.textMuted} />
              ) : null
            }
          />
        </View>
      </SafeAreaView>

      {/* Floating Buttons & Legend */}
      <View
        style={{
          position: "absolute",
          bottom: CAROUSEL_HEIGHT + spacing[4],
          left: spacing[4],
          right: spacing[4],
          zIndex: zIndex.overlay,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
        pointerEvents="box-none"
      >
        <View style={{ gap: spacing[3], alignItems: "flex-start" }}>
          {showLegend && <BuildingLegend />}
          <Pressable
            onPress={() => {
              setShowLegend(!showLegend);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: palette.surface,
                alignItems: "center",
                justifyContent: "center",
                ...shadows.floating,
              },
            ]}
          >
            <MapIcon color={palette.orange} size={20} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter map to default building"
          onPress={() => {
            setSelectedBuilding(toSummary(getBuildingById(DEFAULT_BUILDING_ID)!));
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          <LocateFixed color={palette.orange} size={24} />
        </Pressable>
      </View>

      {/* Bottom UI Container */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.animatedCard,
          {
            backgroundColor: palette.surface,
            height: animatedHeight,
            zIndex: zIndex.sheet,
            bottom: 0,
            paddingHorizontal: displayMode === "list" ? spacing[4] : 0,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            ...shadows.floating,
          },
        ]}
      >
        <View style={styles.dragHandle}>
          <View style={[styles.dragBar, { backgroundColor: palette.border }]} />
        </View>

        {displayMode === "list" ? (
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
                    <AppText variant="micro" tone="muted">
                      {mapStatusDisclosure}
                    </AppText>
                  </View>
                  <ChevronRight size={16} color={palette.orange} />
                </Pressable>
              ))}
          </ScrollView>
        ) : (
          <Animated.View
            style={{
              height: CAROUSEL_HEIGHT,
              paddingTop: spacing[2],
              transform: [
                {
                  translateY: animatedHeight.interpolate({
                    inputRange: [MINIMIZED_HEIGHT, CAROUSEL_HEIGHT],
                    outputRange: [CAROUSEL_HEIGHT - MINIMIZED_HEIGHT, 0],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: spacing[4],
                paddingHorizontal: spacing[4],
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
                      borderRadius: componentRadii.card,
                      overflow: "hidden",
                      width: 320,
                    },
                    shadows.floating,
                  ]}
                >
                  <View style={{ height: 160 }}>
                    <AnimatedReanimated.View style={StyleSheet.absoluteFill}>
                      <AccessibleImage
                        source={{ uri: dish.imageUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        accessibilityLabel={`${dish.name} photo`}
                      />
                    </AnimatedReanimated.View>
                    {dish.liveCrowd && (
                      <View style={{ position: "absolute", top: 12, right: 12 }}>
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
                      <AppText style={{ fontWeight: "800", flex: 1 }} numberOfLines={1}>
                        {dish.name}
                      </AppText>
                      <AppText style={{ color: palette.orange, fontWeight: "800" }}>
                        S${Math.round(dish.price)}
                      </AppText>
                    </View>
                    <AppText variant="micro" tone="secondary">
                      {dish.venueName}
                    </AppText>
                    <AppText variant="micro" tone="muted">
                      {mapStatusDisclosure}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  animatedCard: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  edgeBackGestureZone: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
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
