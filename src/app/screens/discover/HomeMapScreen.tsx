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
  Filter,
  Utensils,
  Heart,
  X,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { MapSurface, type MapSurfaceMarker, BuildingLegend } from "@/components/map";
import {
  AccessibleImage,
  AppText,
  FilterChipRail,
  FeedErrorBoundary,
  ExpandableSearchLauncher,
} from "@/components/ui";
import {
  getBuildingById,
  getNearestBuildings,
  singaporeBuildings,
} from "@/lib/geo/singaporeBuildings";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type { CatalogMapItem, CatalogRawVenueCard } from "@/lib/services/catalog";
import { DiscoverViewToggle } from "@/components/discover/DiscoverViewToggle";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useHungryTheme } from "@/theme";

const DEFAULT_BUILDING_ID = "hc-maxwell";
type HomeMapFilterId = "nearMe" | "hawkerOnly" | "topRated" | "openNow";

/** Camera moves settle before the catalog is read again. */
const MAP_REFETCH_DEBOUNCE_MS = 350;

/** "Open · 450m · Maxwell Food Centre" from what the catalog card actually knows. */
function formatVenueCardDetail(venue: CatalogRawVenueCard) {
  const distance =
    typeof venue.distanceMeters === "number"
      ? venue.distanceMeters >= 1000
        ? `${(venue.distanceMeters / 1000).toFixed(1)}km`
        : `${Math.round(venue.distanceMeters)}m`
      : undefined;
  return [
    venue.isOpen === true ? "Open" : venue.isOpen === false ? "Closed" : undefined,
    distance,
    venue.buildingName,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Representative dish name with its listed price (never rounded), or the menu size. */
function formatVenueCardDish(venue: CatalogRawVenueCard) {
  const dish = venue.representativeDish;
  if (!dish) return `${venue.menuCount} dishes`;
  return typeof dish.price === "number" && dish.price > 0
    ? `${dish.name} · S$${dish.price.toFixed(2)}`
    : dish.name;
}

const HOME_MAP_FILTER_OPTIONS: readonly { id: HomeMapFilterId; label: string }[] = [
  { id: "nearMe", label: "Near me" },
  { id: "hawkerOnly", label: "Hawker" },
  { id: "topRated", label: "Top Rated" },
  { id: "openNow", label: "Open Now" },
];

export function HomeMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalogRawService = getCatalogRawService();
  // The map and its catalog pins are open to every diner, guests included.
  const insets = useSafeAreaInsets();
  const { componentRadii, palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
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
  const highlightedStallVenueId = useDiscoveryStore((state) => state.highlightedStallVenueId);
  const setHighlightedStallVenueId = useDiscoveryStore((state) => state.setHighlightedStallVenueId);
  // The highlight is a one-shot hand-off from Home: clear it when the map closes.
  useEffect(() => () => setHighlightedStallVenueId(undefined), [setHighlightedStallVenueId]);
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

  const [currentZoom, setCurrentZoom] = useState(highlightedStallVenueId ? 17.1 : 15.5);
  const [mapCenter, setMapCenter] = useState(activeBuildingRecord.coordinate);
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">("carousel");
  const [showLegend, setShowLegend] = useState(false);
  const [rawMapItems, setRawMapItems] = useState<CatalogMapItem[]>([]);
  const [rawVenueCards, setRawVenueCards] = useState<CatalogRawVenueCard[]>([]);
  const [rawReleaseId, setRawReleaseId] = useState<string | undefined>();
  const [mapLoadState, setMapLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [mapReloadKey, setMapReloadKey] = useState(0);

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
    let active = true;
    const span = currentZoom >= 15 ? 0.018 : currentZoom >= 13 ? 0.08 : 0.3;
    const buildingTypes = mapFilters.hawkerOnly ? ["hawker_centre"] : [];
    const nearCoordinate = mapFilters.nearMe ? currentLocation : undefined;
    // Debounced so a pan or pinch reads once it settles; both reads run together.
    const timer = setTimeout(() => {
      setMapLoadState("loading");
      void Promise.all([
        catalogRawService.getMapViewport({
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
        }),
        catalogRawService.listVenues({
          coordinate: nearCoordinate ?? mapCenter,
          limit: 24,
          radiusMeters: nearCoordinate ? 3_000 : undefined,
          buildingTypes,
          openOnly: mapFilters.openNow,
          sort: mapFilters.topRated ? "quality" : "nearby",
        }),
      ])
        .then(([mapPage, venuePage]) => {
          if (!active) return;
          setRawMapItems(mapPage.items);
          setRawVenueCards(venuePage.items);
          setRawReleaseId(mapPage.releaseId);
          setMapLoadState("idle");
        })
        .catch(() => {
          // Keep the last good pins and cards on screen; say the refresh failed.
          if (active) setMapLoadState("error");
        });
    }, MAP_REFETCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    catalogRawService,
    currentLocation,
    currentZoom,
    mapCenter,
    mapFilters,
    mapReloadKey,
  ]);

  const snapTo = (height: number) => {
    Animated.spring(animatedHeight, {
      toValue: height,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const handleRawMarkerPress = useCallback(
    (markerId: string) => {
      const item = rawMapItems.find(
        (candidate) =>
          `${candidate.kind === "venue" ? "stall" : candidate.kind}-${candidate.id}` === markerId,
      );
      if (!item) return;
      trackAnalyticsEvent("map_pin_tapped", { pin_kind: item.kind, pin_id: item.id });
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

  // Left-edge swipe back without an overlay strip: the root view only captures a
  // horizontal move that began at the edge, so taps on the map, legend and cards pass through.
  const edgeBackZoneWidth = Math.max(28, insets.left + 24);
  const edgeBackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          gestureState.x0 <= edgeBackZoneWidth &&
          gestureState.dx > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5,
        onPanResponderRelease: (_, gestureState) => {
          if ((gestureState.dx > 64 || gestureState.vx > 0.35) && navigation.canGoBack()) {
            navigation.goBack();
          }
        },
      }),
    [edgeBackZoneWidth, navigation],
  );

  useEffect(() => {
    snapTo(CAROUSEL_HEIGHT);
  }, [displayMode]);

  const markers = useMemo<MapSurfaceMarker[]>(
    () =>
      rawMapItems.map((item) =>
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
      ),
    [palette, rawMapItems],
  );

  // Always land on Discover: after sign-in or "open on map" the screen below may be Home.
  const backToList = useCallback(() => {
    navigation.popTo("MainTabs", { screen: "Discover" });
  }, [navigation]);

  const cameraPadding = useMemo(
    () => ({
      paddingBottom: displayMode === "list" ? 300 : 260,
    }),
    [displayMode],
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }} {...edgeBackPanResponder.panHandlers}>
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
            setMapCenter(coordinate);
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
          onMarkerPress={handleRawMarkerPress}
          selectedMarkerId={
            highlightedStallVenueId ? `stall-${highlightedStallVenueId}` : undefined
          }
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
          {mapLoadState === "idle" ? null : (
            <Pressable
              accessibilityRole={mapLoadState === "error" ? "button" : "text"}
              accessibilityLabel={
                mapLoadState === "error" ? "Couldn't load places. Tap to retry." : "Loading places"
              }
              accessibilityLiveRegion="polite"
              disabled={mapLoadState !== "error"}
              onPress={() => setMapReloadKey((key) => key + 1)}
              style={{
                alignSelf: "flex-start",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                minHeight: 32,
                justifyContent: "center",
                paddingHorizontal: spacing[3],
                ...shadows.floating,
              }}
            >
              <AppText variant="micro" tone={mapLoadState === "error" ? "accent" : "secondary"}>
                {mapLoadState === "error"
                  ? "Couldn't load places. Tap to retry."
                  : "Loading places…"}
              </AppText>
            </Pressable>
          )}
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
            accessibilityRole="button"
            accessibilityLabel={showLegend ? "Hide map legend" : "Show map legend"}
            accessibilityState={{ expanded: showLegend }}
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

        <DiscoverViewToggle value="map" onChange={backToList} />

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
            {rawVenueCards.map((venue) => (
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
                    {formatVenueCardDish(venue)}
                  </AppText>
                  {formatVenueCardDetail(venue) ? (
                    <AppText variant="micro" tone="muted">
                      {formatVenueCardDetail(venue)}
                    </AppText>
                  ) : null}
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
              {rawVenueCards.map((venue) => (
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
                      {formatVenueCardDish(venue)}
                    </AppText>
                    {formatVenueCardDetail(venue) ? (
                      <AppText variant="micro" tone="muted">
                        {formatVenueCardDetail(venue)}
                      </AppText>
                    ) : null}
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
