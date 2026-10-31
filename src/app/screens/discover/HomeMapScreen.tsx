import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import {
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, ChevronRight, Layers, LocateFixed, Star, X } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  BuildingLegend,
  MapSurface,
  getBuildingPinColor,
  getClusterPinColor,
  type MapSurfaceMarker,
} from "@/components/map";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import {
  AccessibleImage,
  AppSymbol,
  AppText,
  FilterChipRail,
  FeedErrorBoundary,
  ExpandableSearchLauncher,
  PressableScale,
} from "@/components/ui";
import {
  getBuildingById,
  getNearestBuildings,
  singaporeBuildings,
} from "@/lib/geo/singaporeBuildings";
import { calculateDistanceMeters } from "@/lib/geo/distance";
import { getCatalogRawService, getHungryService } from "@/lib/services/serviceProvider";
import type { CatalogMapItem, CatalogRawVenueCard } from "@/lib/services/catalog";
import { DiscoverViewToggle } from "@/components/discover/DiscoverViewToggle";
import { LocationGate } from "@/components/discover/LocationGate";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useUIStore } from "@/store/useUIStore";
import { getVenueOpenStateNow } from "@/features/discovery/decideForMeCandidates";
import { isMapEdgeBackSwipe } from "@/features/discovery/mapEdgeBack";
import {
  formatMapCardDetail,
  formatMapCardDish,
  formatMapCardRating,
  mapCardAccessibilityLabel,
  shortOpenLabel,
  type MapCardMatchedDish,
} from "@/features/discovery/mapCardText";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getExperimentVariant, useExperimentVariant } from "@/lib/experiments/experiments";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";
import { useHungryTheme } from "@/theme";
import { reportError } from "@/lib/monitoring/reportError";
import type { VenueSummary } from "@/types/domain";

const DEFAULT_BUILDING_ID = "hc-maxwell";
// "Open now" reads each stall's hours (the same rule as the stall page), never the catalog's stored
// open flag, which disagrees with the hours Discover shows (M11). It narrows the cards and pins to
// the stalls whose hours were read and are open.
type HomeMapFilterId = "openNow" | "nearMe" | "hawkerOnly" | "topRated";

/** Camera moves settle before the catalog is read again. */
const MAP_REFETCH_DEBOUNCE_MS = 350;
/** "Near me" reads this radius around the diner's GPS position. */
const NEAR_ME_RADIUS_METERS = 3_000;
/** Moving the map centre further than this from the diner turns "Near me" off. */
const NEAR_ME_PAN_TOLERANCE_METERS = 1_000;
/** Roughly the metres in one degree of latitude; turns the viewport span into a card radius. */
const METERS_PER_DEGREE = 111_000;
/** A pan can return up to 500 pins; drawing each as a JS view is slow on mid-range phones. */
const MAX_RENDERED_MARKERS = 150;
/** "Loading places…" only shows when a read is slow; a quick pan or pinch stays quiet. */
const LOADING_PILL_DELAY_MS = 400;
/** Stalls whose hours are read for the "Open" label: one batched read (cards are capped at 24). */
const CARD_HOURS_BATCH = 24;
const BACK_BUTTON_SIZE = 44;
/** Within this distance of the diner the map counts as centred on them. */
const CENTERED_METERS = 50;
const MINIMIZED_HEIGHT = 60;
/** The three resting heights of the sheet (the list adds a middle and a full one). */
const CARDS_SNAP_INDEX = 1;
const LIST_SNAP_INDEX = 1;
const CARD_WIDTH = 320;
/** The card in the carousel, top to bottom: photo, then padding, a name line and two detail lines. */
const CARD_IMAGE_HEIGHT = 120;
const CARD_TEXT_HEIGHT = 12 * 2 + 20 + 16 * 2 + 4 * 2;
/** Grabber and the Cards / List switch sit in this strip at the top of the sheet. */
const SHEET_HEADER_HEIGHT = 40;
const SHEET_CARD_TOP_PADDING = 8;
/** Room for the 2 pt selected-card border on top and bottom. */
const CARD_BORDER_ALLOWANCE = 4;
/** Tall enough for the whole card, so no detail line is cut off. */
const CAROUSEL_CONTENT_HEIGHT =
  SHEET_CARD_TOP_PADDING + CARD_IMAGE_HEIGHT + CARD_TEXT_HEIGHT + CARD_BORDER_ALLOWANCE;
const CAROUSEL_BASE_HEIGHT = SHEET_HEADER_HEIGHT + CAROUSEL_CONTENT_HEIGHT;
/** The map is the only screen for this; keep it above this rating and review floor. */
const TOP_RATED_MIN_RATING = 4.5;

const HOME_MAP_FILTER_OPTIONS: readonly { id: HomeMapFilterId; label: string }[] = [
  { id: "openNow", label: "Open now" },
  { id: "nearMe", label: "Near me" },
  { id: "hawkerOnly", label: "Hawker" },
  { id: "topRated", label: "Top rated" },
];

/** One switch for what the sheet shows: swipeable cards or a scrolling list. */
function SheetModeToggle({
  value,
  onChange,
}: {
  value: "carousel" | "list";
  onChange: (next: "carousel" | "list") => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const options = [
    { id: "carousel", label: "Cards" },
    { id: "list", label: "List" },
  ] as const;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        backgroundColor: palette.bgSoft,
        borderRadius: radii.pill,
        flexDirection: "row",
        padding: 2,
      }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityLabel={`Show ${option.label.toLowerCase()} in the sheet`}
            accessibilityState={{ selected }}
            hitSlop={8}
            onPress={() => {
              if (!selected) onChange(option.id);
            }}
            style={{
              backgroundColor: selected ? palette.orange : "transparent",
              borderRadius: radii.pill,
              minHeight: 28,
              justifyContent: "center",
              paddingHorizontal: spacing[3],
            }}
          >
            <AppText
              variant="micro"
              style={{
                color: selected ? palette.textOnOrange : palette.textSecondary,
                fontWeight: "700",
              }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** "4.6 (23) · Open · 120 m · Maxwell Food Centre" with a star symbol before the rating. */
function MapCardDetailLine({
  rating,
  detail,
  fillWhenEmpty = false,
}: {
  rating?: string;
  detail: string;
  fillWhenEmpty?: boolean;
}) {
  const { palette } = useHungryTheme();
  const text = [rating, detail].filter(Boolean).join(" · ");
  if (!text && !fillWhenEmpty) return null;
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
      {rating ? (
        <AppSymbol name="star.fill" fallback={Star} filled size={12} color={palette.starFill} />
      ) : null}
      <AppText variant="micro" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {text || " "}
      </AppText>
    </View>
  );
}

export function HomeMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalogRawService = getCatalogRawService();
  // The map and its catalog pins are open to every diner, guests included.
  const insets = useSafeAreaInsets();
  const { componentRadii, palette, radii, shadows, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Raw text stays local so spaces survive typing; it is sanitised only on submit.
  const [searchText, setSearchText] = useState("");
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[3] * 2 - BACK_BUTTON_SIZE - spacing[2], 240),
    [screenWidth, spacing],
  );

  const gpsLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const locationPermission = useLocationStore((state) => state.permission);
  const showToast = useUIStore((state) => state.showToast);
  const grantLocation = useLocationStore((state) => state.grantLocation);
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
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  // The highlight and the chosen building are one-shot hand-offs: clear both when the
  // map closes so the next open starts on the diner, not on an old building (L1).
  useEffect(
    () => () => {
      setHighlightedStallVenueId(undefined);
      setSelectedBuilding(undefined);
    },
    [setHighlightedStallVenueId, setSelectedBuilding],
  );
  useEffect(() => {
    trackAnalyticsEvent("map_opened", { has_location_fix: !isLocationApproximate });
    // Once per open; the fix state is read as it was then.
  }, []);
  const mapFilters = useDiscoveryStore((state) => state.mapFilters);
  const toggleMapFilter = useDiscoveryStore((state) => state.toggleMapFilter);
  // "Near me" needs a real GPS fix; the built-in default point is not the diner.
  const canUseNearMe = locationPermission === "granted" && !isLocationApproximate;
  const filterOptions = useMemo(
    () =>
      canUseNearMe
        ? HOME_MAP_FILTER_OPTIONS
        : HOME_MAP_FILTER_OPTIONS.filter((option) => option.id !== "nearMe"),
    [canUseNearMe],
  );

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
  // Which sheet the map opens on is map_default_sheet_v1; read once so a late flag cannot swap it.
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">(() =>
    getExperimentVariant("map_default_sheet_v1", { expose: true }) === "list" ? "list" : "carousel",
  );
  const richCards = useExperimentVariant("map_card_rich_v1") !== "control";
  const [showLegend, setShowLegend] = useState(false);
  const [rawMapItems, setRawMapItems] = useState<CatalogMapItem[]>([]);
  const [rawVenueCards, setRawVenueCards] = useState<CatalogRawVenueCard[]>([]);
  const [mapLoadState, setMapLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [mapReloadKey, setMapReloadKey] = useState(0);
  // The dish a search matched at each stall (M6) and each stall's open state from its hours (M9).
  const [matchedDishByVenue, setMatchedDishByVenue] = useState<
    ReadonlyMap<string, MapCardMatchedDish>
  >(new Map());
  const [openLabelByVenue, setOpenLabelByVenue] = useState<ReadonlyMap<string, string>>(new Map());
  // The cards whose hours have been read (or failed to), so "Open now" never empties the map while
  // the hours are still loading, and shows every stall when the hours cannot be read.
  const [hoursReadFor, setHoursReadFor] = useState<CatalogRawVenueCard[] | undefined>();
  const [hoursFailed, setHoursFailed] = useState(false);
  const venueHoursRef = useRef(new Map<string, VenueSummary>());
  // The "Loading places…" pill waits a moment so a quick pan does not flash it (M10).
  const [showLoadingPill, setShowLoadingPill] = useState(false);
  // A search typed here stays on the map: it filters the pins and the cards (M19).
  const [mapQuery, setMapQuery] = useState("");
  // The pin and the card of the same stall light up together (M10).
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>();
  const carouselRef = useRef<BottomSheetScrollViewMethods>(null);
  const listRef = useRef<BottomSheetScrollViewMethods>(null);
  const listRowYRef = useRef<Record<string, number>>({});

  // The home-indicator inset sits under the card, never over its text.
  const CAROUSEL_HEIGHT = CAROUSEL_BASE_HEIGHT + insets.bottom;
  // Heights follow the screen: 620 pt covered a 667 pt phone, search row included (L11).
  const FULL_HEIGHT = Math.min(620, Math.round(screenHeight * 0.7));
  const LIST_HEIGHT = Math.min(FULL_HEIGHT, Math.round(screenHeight * 0.5));

  // The sheet is @gorhom/bottom-sheet: it drags and snaps on the UI thread. Its resting heights
  // (detents) are the cards, or collapsed / list / full for the list.
  const sheetRef = useRef<ElementRef<typeof BottomSheet>>(null);
  const snapPoints = useMemo(
    () =>
      displayMode === "list"
        ? [MINIMIZED_HEIGHT, LIST_HEIGHT, FULL_HEIGHT]
        : [MINIMIZED_HEIGHT, CAROUSEL_HEIGHT],
    [CAROUSEL_HEIGHT, FULL_HEIGHT, LIST_HEIGHT, displayMode],
  );
  const snapPointsRef = useRef(snapPoints);
  snapPointsRef.current = snapPoints;
  // Where the sheet is (or is heading); the edge-back swipe only starts above it.
  const sheetTargetHeightRef = useRef(CAROUSEL_HEIGHT);
  const sheetIndexRef = useRef(CARDS_SNAP_INDEX);
  // The sheet's top edge and the container height, read by the floating buttons on the UI thread.
  const sheetPosition = useSharedValue(screenHeight);
  const containerHeight = useSharedValue(screenHeight);
  const handleContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      containerHeight.value = event.nativeEvent.layout.height;
    },
    [containerHeight],
  );

  // Recentre only when the chosen building changes. A GPS refresh or manual
  // pick that moves the nearest building must not yank the map mid-pan; the
  // locate button handles recentring on the user.
  const centeredBuildingNameRef = useRef(selectedBuilding?.name);
  useEffect(() => {
    if (centeredBuildingNameRef.current === selectedBuilding?.name) return;
    centeredBuildingNameRef.current = selectedBuilding?.name;
    setMapCenter(activeBuildingRecord.coordinate);
  }, [selectedBuilding?.name]);

  // "Near me" only holds while the map sits on the diner. Panning to another
  // district (or losing the GPS fix) switches it off so that area's pins show.
  // The recentre arrow fills once the map sits on the diner, as Apple Maps does.
  const isCenteredOnUser =
    !isLocationApproximate && calculateDistanceMeters(mapCenter, currentLocation) < CENTERED_METERS;
  const nearMeActive =
    mapFilters.nearMe &&
    canUseNearMe &&
    calculateDistanceMeters(mapCenter, currentLocation) <= NEAR_ME_PAN_TOLERANCE_METERS;
  useEffect(() => {
    if (mapFilters.nearMe && !nearMeActive) toggleMapFilter("nearMe");
  }, [mapFilters.nearMe, nearMeActive, toggleMapFilter]);

  const handleFilterSelect = useCallback(
    (filter: HomeMapFilterId) => {
      // Turning "Near me" on brings the map back to the diner.
      if (filter === "nearMe" && !mapFilters.nearMe) setMapCenter(currentLocation);
      trackAnalyticsEvent("map_filter_toggled", { filter, enabled: !mapFilters[filter] });
      toggleMapFilter(filter);
    },
    [currentLocation, mapFilters, toggleMapFilter],
  );

  useEffect(() => {
    let active = true;
    const span = currentZoom >= 15 ? 0.018 : currentZoom >= 13 ? 0.08 : 0.3;
    const buildingTypes = mapFilters.hawkerOnly ? ["hawker_centre"] : [];
    const nearCoordinate = nearMeActive ? currentLocation : undefined;
    const query = mapQuery || undefined;
    // The cards read the same region as the pins, not the 24 nearest places anywhere.
    const cardRadiusMeters = nearCoordinate
      ? NEAR_ME_RADIUS_METERS
      : Math.round(span * METERS_PER_DEGREE);
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
          radiusMeters: nearCoordinate ? NEAR_ME_RADIUS_METERS : undefined,
          buildingTypes,
          minRating: mapFilters.topRated ? TOP_RATED_MIN_RATING : undefined,
          query,
        }),
        catalogRawService.listVenues({
          coordinate: nearCoordinate ?? mapCenter,
          limit: 24,
          radiusMeters: cardRadiusMeters,
          buildingTypes,
          query,
          sort: mapFilters.topRated ? "quality" : "nearby",
        }),
        // With a search, the card names the dish that matched, not the stall's usual one.
        query
          ? catalogRawService.listDishes({
              coordinate: nearCoordinate ?? mapCenter,
              limit: 50,
              radiusMeters: cardRadiusMeters,
              buildingTypes,
              query,
            })
          : Promise.resolve(undefined),
      ])
        .then(([mapPage, venuePage, dishPage]) => {
          if (!active) return;
          setRawMapItems(mapPage.items);
          setRawVenueCards(venuePage.items);
          const matched = new Map<string, MapCardMatchedDish>();
          for (const dish of dishPage?.items ?? []) {
            if (!matched.has(dish.venueId)) {
              matched.set(dish.venueId, { name: dish.name, price: dish.price });
            }
          }
          setMatchedDishByVenue(matched);
          setMapLoadState("idle");
        })
        .catch((error) => {
          // Keep the last good pins and cards on screen; say the refresh failed.
          reportError(error, { screen: "HomeMapScreen", action: "load_map" });
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
    mapQuery,
    mapReloadKey,
    nearMeActive,
  ]);

  useEffect(() => {
    if (mapLoadState !== "loading") {
      setShowLoadingPill(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingPill(true), LOADING_PILL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [mapLoadState]);

  // Open or closed comes from each stall's hours (the same rule as the stall page), read once for
  // the cards that are on screen and kept for the visit. A failed read only leaves the word out.
  useEffect(() => {
    const unread = rawVenueCards
      .map((card) => card.id)
      .filter((id) => !venueHoursRef.current.has(id))
      .slice(0, CARD_HOURS_BATCH);
    const label = (id: string) => {
      const venue = venueHoursRef.current.get(id);
      return venue ? shortOpenLabel(getVenueOpenStateNow(venue)) : undefined;
    };
    const publish = () => {
      const labels = new Map<string, string>();
      for (const card of rawVenueCards) {
        const text = label(card.id);
        if (text) labels.set(card.id, text);
      }
      setOpenLabelByVenue(labels);
      setHoursFailed(false);
      setHoursReadFor(rawVenueCards);
    };
    if (unread.length === 0) {
      publish();
      return;
    }
    let active = true;
    getHungryService()
      .discovery.getVenuesByIds(unread)
      .then((venues) => {
        for (const venue of venues) venueHoursRef.current.set(venue.id, venue);
        if (active) publish();
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "HomeMapScreen", action: "load_card_hours" });
        if (active) {
          setHoursFailed(true);
          setHoursReadFor(rawVenueCards);
        }
      });
    return () => {
      active = false;
    };
  }, [rawVenueCards]);

  // Top Rated and a search narrow the pins on the server. Once pins are individual stalls,
  // the cards keep only those stalls so a card never names a place the map hides.
  // "Open now" keeps the stalls whose hours say open, once the hours are read.
  const openNowActive = mapFilters.openNow && hoursReadFor === rawVenueCards && !hoursFailed;
  const venueCards = useMemo(() => {
    const pinIds = new Set(rawMapItems.flatMap((item) => (item.kind === "venue" ? [item.id] : [])));
    const narrowedByPins =
      currentZoom < 14 || !(mapFilters.topRated || mapQuery)
        ? rawVenueCards
        : rawVenueCards.filter((card) => pinIds.has(card.id));
    return openNowActive
      ? narrowedByPins.filter((card) => openLabelByVenue.get(card.id) === "Open")
      : narrowedByPins;
  }, [
    currentZoom,
    mapFilters.topRated,
    mapQuery,
    openLabelByVenue,
    openNowActive,
    rawMapItems,
    rawVenueCards,
  ]);
  const emptyMessage =
    mapLoadState === "idle" && venueCards.length === 0
      ? mapQuery
        ? `No places match "${mapQuery}" here. Zoom out or clear the search.`
        : openNowActive
          ? "No places here are open right now. Zoom out or turn off Open now."
          : mapFilters.topRated
            ? "No places here have enough ratings yet. Turn off Top rated to see them all."
            : "No places here. Zoom out or clear filters."
      : undefined;
  const pinsAreCapped = rawMapItems.length > MAX_RENDERED_MARKERS;

  const snapToIndex = useCallback((index: number) => {
    sheetRef.current?.snapToIndex(index);
  }, []);

  const openStall = useCallback(
    (venueId: string) => navigation.navigate("StallDetail", { venueId }),
    [navigation],
  );
  // A card or list row opened: how far along the sheet it was is what tells map from stall.
  const openCard = useCallback(
    (venueId: string, position: number) => {
      trackAnalyticsEvent("map_card_opened", { position, mode: displayMode });
      openStall(venueId);
    },
    [displayMode, openStall],
  );

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
      // First tap selects the pin's card and brings it into view; a second tap (or a pin
      // with no card) opens the stall. Catalog venue ids are venues.id.
      const cardIndex = venueCards.findIndex((card) => card.id === item.id);
      if (cardIndex >= 0 && selectedVenueId !== item.id) {
        setSelectedVenueId(item.id);
        if (displayMode === "carousel") {
          if (sheetIndexRef.current === 0) snapToIndex(CARDS_SNAP_INDEX);
          carouselRef.current?.scrollTo({
            x: cardIndex * (CARD_WIDTH + spacing[4]),
            animated: true,
          });
        } else {
          listRef.current?.scrollTo({ y: listRowYRef.current[item.id] ?? 0, animated: true });
        }
        return;
      }
      openStall(item.id);
    },
    [displayMode, openStall, rawMapItems, selectedVenueId, snapToIndex, spacing, venueCards],
  );

  const submitSearch = useCallback(() => {
    const query = sanitizeSearchQuery(searchText);
    if (query) {
      rememberSearch(query);
    }
    trackAnalyticsEvent("map_search_submitted", {
      has_query: Boolean(query),
      query_length: query.length,
    });
    setMapQuery(query);
  }, [rememberSearch, searchText]);
  const clearMapSearch = useCallback(() => {
    setSearchText("");
    setMapQuery("");
  }, []);

  // Always land on Discover: after sign-in or "open on map" the screen below may be Home.
  const backToList = useCallback(() => {
    navigation.popTo("MainTabs", { screen: "Discover" });
  }, [navigation]);

  // Left-edge swipe back without an overlay strip: the root view only captures a
  // horizontal move that began at the edge above the sheet, so taps on the map, legend and
  // cards pass through and the card carousel still scrolls.
  const edgeBackZoneWidth = Math.max(28, insets.left + 24);
  const edgeBackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          isMapEdgeBackSwipe(gestureState, {
            edgeZoneWidth: edgeBackZoneWidth,
            screenHeight,
            sheetHeight: sheetTargetHeightRef.current,
          }),
        onPanResponderRelease: (_, gestureState) => {
          // Same place as the List toggle, not whatever screen happens to be below.
          if (gestureState.dx > 64 || gestureState.vx > 0.35) {
            backToList();
          }
        },
      }),
    [backToList, edgeBackZoneWidth, screenHeight],
  );

  useEffect(() => {
    // The list opens half-way so it shows several rows, not one.
    snapToIndex(displayMode === "list" ? LIST_SNAP_INDEX : CARDS_SNAP_INDEX);
  }, [displayMode, snapToIndex]);

  // With "Open now" on, the map shows the open stalls that have cards, and no clusters (a cluster's
  // count cannot be narrowed by hours).
  const markers = useMemo<MapSurfaceMarker[]>(
    () =>
      (openNowActive
        ? rawMapItems.filter(
            (item) => item.kind === "venue" && venueCards.some((card) => card.id === item.id),
          )
        : rawMapItems
      )
        .slice(0, MAX_RENDERED_MARKERS)
        .map((item) =>
          item.kind === "cluster"
            ? {
                id: `cluster-${item.id}`,
                label: `${item.count} venues`,
                accessibilityLabel: `${item.count} venues. Double tap to zoom in.`,
                coordinate: { latitude: item.latitude, longitude: item.longitude },
                accent: getClusterPinColor(palette),
                clusterCount: item.count,
              }
            : {
                id: `stall-${item.id}`,
                label: item.label,
                coordinate: { latitude: item.latitude, longitude: item.longitude },
                // Colour is the building type, as the legend says.
                accent: getBuildingPinColor(item.buildingType, palette),
              },
        ),
    [openNowActive, palette, rawMapItems, venueCards],
  );

  const cameraPadding = useMemo(
    () => ({
      paddingBottom: displayMode === "list" ? 300 : 260,
    }),
    [displayMode],
  );

  /** The text of one card or row, and what a screen reader says for it. */
  const cardText = (venue: CatalogRawVenueCard) => {
    // The plain card of map_card_rich_v1's control arm: the stall's dish, distance and building.
    const dishLine = formatMapCardDish(
      venue,
      richCards ? matchedDishByVenue.get(venue.id) : undefined,
    );
    const rating = richCards ? formatMapCardRating(venue) : undefined;
    const detail = formatMapCardDetail(
      venue,
      richCards ? openLabelByVenue.get(venue.id) : undefined,
    );
    return {
      dishLine,
      rating: rating?.text,
      detail,
      label: mapCardAccessibilityLabel(venue, dishLine, detail, rating?.spoken),
    };
  };

  // The same two moves the drag handle makes, for screen readers and switch users (M11).
  const expandSheet = useCallback(() => {
    snapToIndex(Math.min(sheetIndexRef.current + 1, snapPointsRef.current.length - 1));
  }, [snapToIndex]);
  const collapseSheet = useCallback(() => {
    snapToIndex(Math.max(sheetIndexRef.current - 1, 0));
  }, [snapToIndex]);

  // The buttons ride on top of the sheet and fade once the list is stretched over the map. This
  // runs on the UI thread from the sheet's own position, so it never waits on React.
  const floatingButtonsStyle = useAnimatedStyle(() => {
    const sheetHeight = Math.max(containerHeight.value - sheetPosition.value, MINIMIZED_HEIGHT);
    return {
      opacity: interpolate(sheetHeight, [LIST_HEIGHT, FULL_HEIGHT], [1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: -sheetHeight }],
    };
  });

  /** The sheet's grabber and the Cards / List switch: dragging the strip drags the sheet. */
  const renderSheetHandle = useCallback(
    () => (
      <View style={styles.sheetHeader}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Places sheet"
          accessibilityHint="Swipe up to show more places, down to show fewer"
          accessibilityActions={[
            { name: "increment", label: "Show more places" },
            { name: "decrement", label: "Show fewer places" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") expandSheet();
            else if (event.nativeEvent.actionName === "decrement") collapseSheet();
          }}
          style={styles.dragHandleTarget}
        >
          <View style={[styles.dragBar, { backgroundColor: palette.border }]} />
        </View>
        <View style={[styles.sheetModeToggle, { right: spacing[3] }]}>
          <SheetModeToggle
            value={displayMode}
            onChange={(next) => {
              setDisplayMode(next);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        </View>
      </View>
    ),
    [collapseSheet, displayMode, expandSheet, palette.border, spacing],
  );

  return (
    <View
      style={{ flex: 1, backgroundColor: palette.bg }}
      onLayout={handleContainerLayout}
      {...edgeBackPanResponder.panHandlers}
    >
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
          onMapPress={() => {
            // A tap only folds the sheet. The camera stays where the diner left it.
            if (displayMode === "carousel") {
              snapToIndex(sheetIndexRef.current === 0 ? CARDS_SNAP_INDEX : 0);
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
            selectedVenueId || highlightedStallVenueId
              ? `stall-${selectedVenueId ?? highlightedStallVenueId}`
              : undefined
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={backToList}
              style={{
                alignItems: "center",
                backgroundColor: palette.surface,
                borderRadius: BACK_BUTTON_SIZE / 2,
                height: BACK_BUTTON_SIZE,
                justifyContent: "center",
                width: BACK_BUTTON_SIZE,
                ...shadows.floating,
              }}
            >
              <AppSymbol
                name="chevron.backward"
                fallback={ChevronLeft}
                color={palette.text}
                size={22}
                weight="semibold"
              />
            </Pressable>
            <ExpandableSearchLauncher
              query={searchText}
              onQueryChange={setSearchText}
              onSubmit={submitSearch}
              onClear={clearMapSearch}
              placeholder="Search dishes or stalls..."
              keepOpenWithQuery
              expandedWidth={searchBarWidth}
              iconAlignment="left"
              barHeight={52}
              backgroundColor={palette.surface}
              borderColor={palette.border}
              textColor={palette.text}
              placeholderColor={palette.textSecondary}
            />
          </View>
          <FilterChipRail
            options={filterOptions}
            selectedIds={filterOptions
              .filter((option) => (option.id === "nearMe" ? nearMeActive : mapFilters[option.id]))
              .map((option) => option.id)}
            onSelect={handleFilterSelect}
            gap={spacing[2]}
            renderLeftIcon={(option, selected) =>
              option.id === "nearMe" ? (
                <AppSymbol
                  name="location"
                  fallback={LocateFixed}
                  size={14}
                  color={selected ? palette.orange : palette.textMuted}
                />
              ) : null
            }
          />
          {mapQuery ? (
            <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Clear search ${mapQuery}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={clearMapSearch}
                style={{
                  alignItems: "center",
                  backgroundColor: palette.surface,
                  borderColor: palette.orange,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: spacing[1],
                  minHeight: 32,
                  paddingHorizontal: spacing[3],
                  ...shadows.floating,
                }}
              >
                <AppText variant="micro" numberOfLines={1} style={{ maxWidth: 200 }}>
                  {`"${mapQuery}"`}
                </AppText>
                <AppSymbol name="xmark" fallback={X} color={palette.textMuted} size={14} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`See all results for ${mapQuery}`}
                hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                onPress={() => navigation.navigate("SearchResults", { initialQuery: mapQuery })}
              >
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  See all results
                </AppText>
              </Pressable>
            </View>
          ) : null}
          {isLocationApproximate ? (
            <LocationGate
              compact
              source="map"
              title="See places near you"
              body="Turn on location, or search for a place to look around."
            />
          ) : null}
          {mapLoadState === "idle" || (mapLoadState === "loading" && !showLoadingPill) ? null : (
            <Pressable
              accessibilityRole={mapLoadState === "error" ? "button" : "text"}
              accessibilityLabel={
                mapLoadState === "error" ? "Couldn't load places. Tap to retry." : "Loading places"
              }
              accessibilityLiveRegion="polite"
              disabled={mapLoadState !== "error"}
              hitSlop={6}
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
          {pinsAreCapped ? (
            <AppText
              variant="micro"
              tone="secondary"
              accessibilityLiveRegion="polite"
              style={{ alignSelf: "flex-start" }}
            >
              Zoom in to see all places
            </AppText>
          ) : null}
        </View>
      </SafeAreaView>

      {/* Floating Buttons: legend, List/Map and recentre share one row; the legend opens above it */}
      <Animated.View
        style={[
          {
            position: "absolute",
            // Rides on top of the sheet (translateY follows its top edge) and fades once the
            // list is stretched over the map.
            bottom: spacing[4],
            left: spacing[4],
            right: spacing[4],
            zIndex: zIndex.overlay,
            gap: spacing[3],
          },
          floatingButtonsStyle,
        ]}
        pointerEvents="box-none"
      >
        {showLegend ? (
          <View testID="map-legend">
            <BuildingLegend />
          </View>
        ) : null}
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}
          pointerEvents="box-none"
        >
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
            <AppSymbol
              name="square.3.layers.3d"
              fallback={Layers}
              color={palette.orange}
              size={20}
            />
          </Pressable>

          <DiscoverViewToggle value="map" onChange={backToList} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isLocationApproximate ? "Use my location" : "Recenter map on your location"
            }
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (isLocationApproximate) {
                // Ask for the device location; the map follows the phone, so a refusal just says so.
                void grantLocation().then((granted) => {
                  if (!granted) {
                    showToast({
                      message:
                        "Location access is off. Turn it on in Settings to use your location.",
                      tone: "info",
                    });
                  }
                });
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
            <AppSymbol
              name={isCenteredOnUser ? "location.fill" : "location"}
              fallback={LocateFixed}
              color={palette.orange}
              size={24}
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* Bottom sheet: detents are the resting heights, the handle carries the Cards / List switch */}
      <BottomSheet
        ref={sheetRef}
        index={displayMode === "list" ? LIST_SNAP_INDEX : CARDS_SNAP_INDEX}
        snapPoints={snapPoints}
        animatedPosition={sheetPosition}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        enableOverDrag={false}
        handleComponent={renderSheetHandle}
        onAnimate={(_from, to) => {
          sheetIndexRef.current = to;
          sheetTargetHeightRef.current = snapPointsRef.current[to] ?? CAROUSEL_HEIGHT;
        }}
        backgroundStyle={{
          backgroundColor: palette.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          ...shadows.floating,
        }}
        style={{ zIndex: zIndex.sheet }}
      >
        {displayMode === "list" ? (
          <BottomSheetScrollView
            ref={listRef}
            contentContainerStyle={{
              paddingHorizontal: spacing[4] + spacing[3],
              gap: spacing[4],
              paddingBottom: insets.bottom + spacing[12],
            }}
          >
            <AppText variant="h2" style={{ marginBottom: spacing[2] }}>
              Nearby stalls
            </AppText>
            {emptyMessage ? (
              <AppText tone="secondary" accessibilityLiveRegion="polite">
                {emptyMessage}
              </AppText>
            ) : null}
            {venueCards.map((venue, index) => (
              <PressableScale
                key={venue.id}
                accessibilityRole="button"
                accessibilityLabel={cardText(venue).label}
                accessibilityState={{ selected: venue.id === selectedVenueId }}
                onLayout={(event) => {
                  listRowYRef.current[venue.id] = event.nativeEvent.layout.y;
                }}
                onPress={() => openCard(venue.id, index)}
                style={{
                  backgroundColor: palette.bgSoft,
                  borderRadius: radii.md,
                  padding: spacing[3],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  borderWidth: venue.id === selectedVenueId ? 2 : 1,
                  borderColor: venue.id === selectedVenueId ? palette.orange : palette.border,
                }}
              >
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="h3">{venue.name}</AppText>
                  {cardText(venue).dishLine ? (
                    <AppText variant="micro" tone="secondary">
                      {cardText(venue).dishLine}
                    </AppText>
                  ) : null}
                  <MapCardDetailLine
                    rating={cardText(venue).rating}
                    detail={cardText(venue).detail}
                  />
                </View>
                <AppSymbol
                  name="chevron.forward"
                  fallback={ChevronRight}
                  color={palette.orange}
                  size={16}
                />
              </PressableScale>
            ))}
          </BottomSheetScrollView>
        ) : (
          <View
            style={{
              height: CAROUSEL_CONTENT_HEIGHT + insets.bottom,
              paddingTop: SHEET_CARD_TOP_PADDING,
            }}
          >
            {emptyMessage ? (
              <AppText
                tone="secondary"
                accessibilityLiveRegion="polite"
                style={{ paddingHorizontal: spacing[4] }}
              >
                {emptyMessage}
              </AppText>
            ) : null}
            <BottomSheetScrollView
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + spacing[4]}
              snapToAlignment="start"
              // Swiping to a card lights up its pin.
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing[4]),
                );
                const card = venueCards[index];
                if (card && card.id !== selectedVenueId) setSelectedVenueId(card.id);
              }}
              contentContainerStyle={{
                gap: spacing[4],
                paddingHorizontal: spacing[4],
              }}
            >
              {venueCards.map((venue, index) => (
                <PressableScale
                  key={venue.id}
                  accessibilityRole="button"
                  accessibilityLabel={cardText(venue).label}
                  accessibilityState={{ selected: venue.id === selectedVenueId }}
                  onPress={() => openCard(venue.id, index)}
                  style={[
                    {
                      backgroundColor: palette.surface,
                      borderColor: venue.id === selectedVenueId ? palette.orange : "transparent",
                      borderRadius: componentRadii.card,
                      borderWidth: 2,
                      overflow: "hidden",
                      width: CARD_WIDTH,
                    },
                    shadows.floating,
                  ]}
                >
                  <View style={{ height: CARD_IMAGE_HEIGHT }}>
                    {venue.imageUrl || venue.representativeDish?.imageUrl ? (
                      <AccessibleImage
                        source={{
                          uri: venue.imageUrl ?? venue.representativeDish?.imageUrl ?? "",
                        }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        accessibilityLabel={`${venue.name} image`}
                        fallback={
                          <NoDishPhoto
                            designed
                            dishName={venue.name}
                            logoUrl={venue.logoUrl}
                            style={StyleSheet.absoluteFill}
                          />
                        }
                      />
                    ) : (
                      <NoDishPhoto
                        designed
                        dishName={venue.name}
                        logoUrl={venue.logoUrl}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                  </View>
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText style={{ fontWeight: "800" }} numberOfLines={1}>
                      {venue.name}
                    </AppText>
                    <AppText variant="micro" tone="secondary" numberOfLines={1}>
                      {cardText(venue).dishLine ?? " "}
                    </AppText>
                    <MapCardDetailLine
                      rating={cardText(venue).rating}
                      detail={cardText(venue).detail}
                      fillWhenEmpty
                    />
                  </View>
                </PressableScale>
              ))}
            </BottomSheetScrollView>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetHeader: {
    width: "100%",
    height: SHEET_HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetModeToggle: {
    position: "absolute",
    top: 4,
  },
  dragHandleTarget: {
    alignItems: "center",
    height: SHEET_HEADER_HEIGHT,
    justifyContent: "center",
    width: 80,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
