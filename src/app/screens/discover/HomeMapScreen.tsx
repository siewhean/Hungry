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
import {
  getCatalogRawService,
  getDataRepository,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { CatalogMapItem, CatalogRawVenueCard } from "@/lib/services/catalog";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
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
  const catalogRawService = getCatalogRawService();
  const shouldUseCatalogReadV2 =
    FEATURE_FLAGS.catalogReadV2 && getServiceProvider().mode === "supabase";
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

  const gpsLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const locationPermission = useLocationStore((state) => state.permission);
  // Same effective location as Discover: a manual pick wins over GPS.
  const { coordinate: currentLocation, isApproximate: isLocationApproximate } =
    getEffectiveLocation({
      permission: locationPermission,
      currentLocation: gpsLocation,
      manualCoordinate,
    });
  const selectedBuilding = useDiscoveryStore((state) => state.selectedBuilding);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const highlightedStallVenueId = useDiscoveryStore((state) => state.highlightedStallVenueId);
  const mapFilters = useDiscoveryStore((state) => state.mapFilters);
  const toggleMapFilter = useDiscoveryStore((state) => state.toggleMapFilter);

  const activeBuildingRecord = useMemo(() => {
    const nameMatch = selectedBuilding?.name
      ? singaporeBuildings.find((b) => b.name === selectedBuilding.name)
      : undefined;
    // Without a chosen building, open on the building nearest the user, not Maxwell.
    return (
      nameMatch ??
      getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 50, 1)[0] ??
      getBuildingById(DEFAULT_BUILDING_ID)!
    );
  }, [currentLocation, selectedBuilding]);

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
    if (shouldUseCatalogReadV2) return [];
    const allVenues = visibleBuildings.flatMap((b) => repository.listVenuesByBuilding(b.id));
    return allVenues
      .map((v) => repository.getDishById(v.topDishId))
      .filter((d): d is DishDetail => !!d)
      .slice(0, 10);
  }, [repository, shouldUseCatalogReadV2, visibleBuildings]);

  const [currentZoom, setCurrentZoom] = useState(highlightedStallVenueId ? 17.1 : 15.5);
  const [mapCenter, setMapCenter] = useState(activeBuildingRecord.coordinate);
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">("carousel");
  const [showLegend, setShowLegend] = useState(false);
  const [rawMapItems, setRawMapItems] = useState<CatalogMapItem[]>([]);
  const [rawVenueCards, setRawVenueCards] = useState<CatalogRawVenueCard[]>([]);
  const [rawReleaseId, setRawReleaseId] = useState<string | undefined>();

  const CAROUSEL_HEIGHT = 240;
  const MINIMIZED_HEIGHT = 60;
  const FULL_HEIGHT = 620;

  const animatedHeight = useRef(new Animated.Value(CAROUSEL_HEIGHT)).current;
  const isMinimized = useRef(false);
  // The sheet PanResponder is created once, so it reads the live mode from a ref.
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;

  // Recentre only when the chosen building changes. A GPS refresh or manual
  // pick that moves the nearest building must not yank the map mid-pan; the
  // locate button handles recentring on the user.
  const centeredBuildingNameRef = useRef(selectedBuilding?.name);
  useEffect(() => {
    if (centeredBuildingNameRef.current === selectedBuilding?.name) return;
    centeredBuildingNameRef.current = selectedBuilding?.name;
    setMapCenter(activeBuildingRecord.coordinate);
  }, [selectedBuilding?.name]);

  useEffect(() => {
    if (!shouldUseCatalogReadV2 || !catalogRawService) {
      setRawMapItems([]);
      setRawVenueCards([]);
      setRawReleaseId(undefined);
      return;
    }
    let active = true;
    const span = currentZoom >= 15 ? 0.018 : currentZoom >= 13 ? 0.08 : 0.3;
    const buildingTypes = mapFilters.hawkerOnly ? ["hawker_centre"] : [];
    const nearCoordinate = mapFilters.nearMe ? currentLocation : undefined;
    void (async () => {
      const mapPage = await catalogRawService.getMapViewport({
        minLatitude: mapCenter.latitude - span,
        minLongitude: mapCenter.longitude - span,
        maxLatitude: mapCenter.latitude + span,
        maxLongitude: mapCenter.longitude + span,
        zoom: currentZoom,
        coordinate: nearCoordinate,
        radiusMeters: nearCoordinate ? 3_000 : undefined,
        buildingTypes,
        openOnly: mapFilters.openNow,
        minRating: mapFilters.topRated ? 4.5 : undefined,
      });
      const venuePage = await catalogRawService.listVenues({
        coordinate: nearCoordinate ?? mapCenter,
        limit: 24,
        radiusMeters: nearCoordinate ? 3_000 : undefined,
        buildingTypes,
        openOnly: mapFilters.openNow,
        sort: mapFilters.topRated ? "quality" : "nearby",
        releaseId: mapPage.releaseId,
      });
      if (active) {
        setRawMapItems(mapPage.items);
        setRawVenueCards(venuePage.items);
        setRawReleaseId(mapPage.releaseId);
      }
    })().catch(() => {
      if (!active) return;
      setRawMapItems([]);
      setRawVenueCards([]);
      setRawReleaseId(undefined);
    });
    return () => {
      active = false;
    };
  }, [
    catalogRawService,
    currentLocation,
    currentZoom,
    mapCenter,
    mapFilters,
    shouldUseCatalogReadV2,
  ]);

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

  const handleRawMarkerPress = useCallback(
    (markerId: string) => {
      const item = rawMapItems.find(
        (candidate) =>
          `${candidate.kind === "venue" ? "stall" : candidate.kind}-${candidate.id}` === markerId,
      );
      if (!item) return;
      if (item.kind === "cluster") {
        setMapCenter({ latitude: item.latitude, longitude: item.longitude });
        setCurrentZoom((zoom) => Math.max(14, zoom + 1.5));
        return;
      }
      navigation.navigate("CatalogRawDetail", {
        kind: "venue",
        id: item.id,
        releaseId: rawReleaseId,
      });
    },
    [navigation, rawMapItems, rawReleaseId],
  );

  const handleLegacyMarkerPress = useCallback(
    (markerId: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (markerId.startsWith("stall-")) {
        navigation.navigate("StallDetail", { venueId: markerId.slice("stall-".length) });
        return;
      }
      const building = getBuildingById(markerId);
      if (!building) return;
      setSelectedBuilding(toSummary(building));
      setMapCenter(building.coordinate);
      setCurrentZoom((zoom) => Math.max(zoom, 17));
    },
    [navigation, setSelectedBuilding],
  );

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
        if (displayModeRef.current === "list") {
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
    if (shouldUseCatalogReadV2) {
      return rawMapItems.map((item) =>
        item.kind === "cluster"
          ? {
              id: `cluster-${item.id}`,
              label: `${item.count} venues`,
              coordinate: { latitude: item.latitude, longitude: item.longitude },
              accent: palette.teal,
            }
          : {
              id: `stall-${item.id}`,
              label: item.label,
              coordinate: { latitude: item.latitude, longitude: item.longitude },
              accent: item.verificationStatus === "approved" ? palette.orange : palette.teal,
            },
      );
    }
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
    rawMapItems,
    shouldUseCatalogReadV2,
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
          centerCoordinate={mapCenter}
          currentLocation={isLocationApproximate ? undefined : currentLocation}
          zoomLevel={currentZoom}
          markers={markers}
          cameraPadding={cameraPadding}
          onMapPress={(coordinate) => {
            if (shouldUseCatalogReadV2) {
              setMapCenter(coordinate);
            }
            if (displayMode === "carousel") {
              snapTo(isMinimized.current ? CAROUSEL_HEIGHT : MINIMIZED_HEIGHT);
              isMinimized.current = !isMinimized.current;
            }
          }}
          onZoomChange={setCurrentZoom}
          onViewportChange={({ centerCoordinate, zoom }) => {
            setCurrentZoom(zoom);
            setMapCenter((current) =>
              Math.abs(current.latitude - centerCoordinate.latitude) < 0.00001 &&
              Math.abs(current.longitude - centerCoordinate.longitude) < 0.00001
                ? current
                : centerCoordinate,
            );
          }}
          onMarkerPress={shouldUseCatalogReadV2 ? handleRawMarkerPress : handleLegacyMarkerPress}
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
          {shouldUseCatalogReadV2 ? (
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
          ) : null}
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
          accessibilityLabel={
            isLocationApproximate ? "Choose your area" : "Recenter map on your location"
          }
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (isLocationApproximate) {
              navigation.navigate("OnboardingStack", { screen: "ManualLocationPicker" });
              return;
            }
            setMapCenter(currentLocation);
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
            {shouldUseCatalogReadV2
              ? rawVenueCards.map((venue) => (
                  <Pressable
                    key={venue.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${venue.name} catalog details`}
                    onPress={() =>
                      navigation.navigate("CatalogRawDetail", {
                        kind: "venue",
                        id: venue.id,
                        releaseId: rawReleaseId,
                      })
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
                      <AppText variant="h3">{venue.name}</AppText>
                      <AppText variant="micro" tone="secondary">
                        {venue.representativeDish?.name ?? `${venue.menuCount} listed dishes`}
                      </AppText>
                      <AppText variant="micro" tone="muted">
                        {venue.verificationStatus === "approved"
                          ? "Approved source"
                          : "Raw catalog record"}
                      </AppText>
                    </View>
                    <ChevronRight size={16} color={palette.orange} />
                  </Pressable>
                ))
              : visibleBuildings
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
              {shouldUseCatalogReadV2
                ? rawVenueCards.map((venue) => (
                    <Pressable
                      key={venue.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview ${venue.name}`}
                      onPress={() =>
                        navigation.navigate("CatalogRawDetail", {
                          kind: "venue",
                          id: venue.id,
                          releaseId: rawReleaseId,
                        })
                      }
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
                        {venue.imageUrl || venue.representativeDish?.imageUrl ? (
                          <AccessibleImage
                            source={{
                              uri: venue.imageUrl ?? venue.representativeDish?.imageUrl ?? "",
                            }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            accessibilityLabel={`${venue.name} image`}
                          />
                        ) : (
                          <View
                            style={[
                              StyleSheet.absoluteFill,
                              {
                                alignItems: "center",
                                backgroundColor: palette.bgSoft,
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <AppText tone="muted">Image unavailable</AppText>
                          </View>
                        )}
                      </View>
                      <View style={{ padding: spacing[3], gap: spacing[1] }}>
                        <AppText style={{ fontWeight: "800" }} numberOfLines={1}>
                          {venue.name}
                        </AppText>
                        <AppText variant="micro" tone="secondary">
                          {venue.representativeDish?.name ?? `${venue.menuCount} listed dishes`}
                        </AppText>
                        <AppText variant="micro" tone="muted">
                          {venue.verificationStatus === "approved"
                            ? "Approved source"
                            : "Raw catalog record"}
                        </AppText>
                      </View>
                    </Pressable>
                  ))
                : areaPopularDishes.map((dish) => (
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
