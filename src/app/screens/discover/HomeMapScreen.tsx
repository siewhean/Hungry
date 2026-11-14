import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from "react";
import {
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  LocateFixed,
  Star,
  Store,
  X,
} from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  BuildingLegend,
  ClusterStallsSheet,
  EstablishmentDropdown,
  MapSurface,
  establishmentChipLabel,
  getBuildingPinColor,
  getClusterPinColor,
  type ClusterStallRow,
  type MapSurfaceMarker,
} from "@/components/map";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import {
  AccessibleImage,
  AppSymbol,
  AppText,
  FilterChipRail,
  FeedErrorBoundary,
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
import { SavedViewSwitch } from "@/components/saved/SavedViewSwitch";
import { LocationGate } from "@/components/discover/LocationGate";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useUIStore } from "@/store/useUIStore";
import { getVenueOpenStateNow } from "@/features/discovery/decideForMeCandidates";
import { distanceFromDiner, formatDistanceLabel } from "@/features/discovery/distanceLabel";
import {
  formatMapCardDish,
  formatMapCardHours,
  formatMapCardLocation,
  formatMapCardRating,
  mapCardAccessibilityLabel,
  shortOpenLabel,
  type MapCardMatchedDish,
} from "@/features/discovery/mapCardText";
import {
  groupColocatedVenues,
  isColocatedCluster,
  menuStallsFirst,
} from "@/features/discovery/mapPins";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getExperimentVariant } from "@/lib/experiments/experiments";
import { sanitizeSearchQuery } from "@/lib/security/inputSanitization";
import { useHungryTheme } from "@/theme";
import { reportError } from "@/lib/monitoring/reportError";
import type { VenueSummary } from "@/types/domain";

const DEFAULT_BUILDING_ID = "hc-maxwell";
// "Open now" reads each stall's hours (the same rule as the stall page), never the catalog's stored
// open flag, which disagrees with the hours Discover shows (M11). It narrows the cards and pins to
// the stalls whose hours were read and are open.
type HomeMapFilterId = "openNow" | "nearMe" | "places" | "topRated";

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
/** A cluster this small, or any cluster once the map is zoomed in, opens a list of its stalls. */
const CLUSTER_LIST_MAX_COUNT = 60;
const CLUSTER_LIST_MIN_ZOOM = 15;
/** Stalls in one cluster sit within this distance of its pin. */
const CLUSTER_LIST_RADIUS_METERS = 150;
const CLUSTER_LIST_LIMIT = 40;
/** Stalls on one spot are within this distance of each other. */
const COLOCATED_LIST_RADIUS_METERS = 30;
/** The card in the carousel, top to bottom: photo, then padding, a name line and two detail lines. */
const CARD_IMAGE_HEIGHT = 156;
/** Name and rating, then hours and distance, then where it is: three tight lines under the photo. */
const CARD_TEXT_PADDING = 8;
const CARD_TEXT_HEIGHT = CARD_TEXT_PADDING * 2 + 20 + 16 * 2 + 2 * 2;
/** Grabber and the Cards / List switch sit in this strip at the top of the sheet. */
/** Thumbnail beside each row of the list. */
const LIST_THUMB_SIZE = 72;
const SHEET_HEADER_HEIGHT = 48;
/** Clear space between the Cards / List switch and the first card. */
const SHEET_CARD_TOP_PADDING = 14;
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
  { id: "places", label: "Place type" },
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

/** A stall's photo, its dish photo, or its designed no-photo tile, filling its parent. */
function MapVenueImage({ venue }: { venue: CatalogRawVenueCard }) {
  const imageUrl = venue.imageUrl ?? venue.representativeDish?.imageUrl;
  const fallback = (
    <NoDishPhoto
      designed
      dishName={venue.name}
      logoUrl={venue.logoUrl}
      style={StyleSheet.absoluteFill}
    />
  );
  return imageUrl ? (
    <AccessibleImage
      source={{ uri: imageUrl }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      accessibilityLabel={`${venue.name} image`}
      fallback={fallback}
    />
  ) : (
    fallback
  );
}

/**
 * What a stall card says, in three lines: name with its rating, then hours and distance, then
 * where the stall is. A line with nothing to say keeps its height only when `fillWhenEmpty`.
 */
function MapCardLines({
  name,
  rating,
  hours,
  distance,
  location,
  fillWhenEmpty = false,
}: {
  name: string;
  rating?: string;
  hours?: string;
  distance?: string;
  location?: string;
  fillWhenEmpty?: boolean;
}) {
  const { palette, spacing } = useHungryTheme();
  const isOpen = hours?.startsWith("Open");
  return (
    <View style={{ gap: 2 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
        <AppText style={{ flex: 1, fontWeight: "800" }} numberOfLines={1}>
          {name}
        </AppText>
        {rating ? (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <AppSymbol name="star.fill" fallback={Star} filled size={12} color={palette.starFill} />
            <AppText variant="micro" tone="secondary" numberOfLines={1}>
              {rating}
            </AppText>
          </View>
        ) : null}
      </View>
      {hours || distance || fillWhenEmpty ? (
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          {hours ? (
            <AppText
              variant="micro"
              style={{ color: isOpen ? palette.success : palette.textSecondary, fontWeight: "700" }}
            >
              {hours}
            </AppText>
          ) : null}
          {hours && distance ? " · " : ""}
          {distance ?? (hours ? "" : " ")}
        </AppText>
      ) : null}
      {location || fillWhenEmpty ? (
        <AppText variant="micro" tone="muted" numberOfLines={1}>
          {location || " "}
        </AppText>
      ) : null}
    </View>
  );
}

export function HomeMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalogRawService = getCatalogRawService();
  // The map and its catalog pins are open to every diner, guests included.
  const insets = useSafeAreaInsets();
  const { componentRadii, palette, radii, shadows, spacing, typography, zIndex } = useHungryTheme();
  const { height: screenHeight } = useWindowDimensions();
  // Raw text stays local so spaces survive typing; it is sanitised only on submit.
  const [searchText, setSearchText] = useState("");
  const rememberSearch = useSearchStore((state) => state.rememberSearch);

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
  /** Where the diner really is, for distances; undefined without a GPS fix or a picked area. */
  const dinerLocation = isLocationApproximate ? undefined : currentLocation;
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
  const establishmentTypes = useDiscoveryStore((state) => state.establishmentTypes);
  const setEstablishmentTypes = useDiscoveryStore((state) => state.setEstablishmentTypes);
  const [placesOpen, setPlacesOpen] = useState(false);
  // "Near me" needs a real GPS fix; the built-in default point is not the diner.
  const canUseNearMe = locationPermission === "granted" && !isLocationApproximate;
  const filterOptions = useMemo(
    () =>
      (canUseNearMe
        ? HOME_MAP_FILTER_OPTIONS
        : HOME_MAP_FILTER_OPTIONS.filter((option) => option.id !== "nearMe")
      ).map((option) =>
        option.id === "places"
          ? { ...option, label: establishmentChipLabel(establishmentTypes) }
          : option,
      ),
    [canUseNearMe, establishmentTypes],
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
  // Open on the diner when their location is known; a chosen building or stall wins.
  const opensOnBuilding = Boolean(selectedBuilding || highlightedStallVenueId);
  const [mapCenter, setMapCenter] = useState(
    !opensOnBuilding && !isLocationApproximate ? currentLocation : activeBuildingRecord.coordinate,
  );
  // The first fix can land after the map is open (cold start): move to it once, never again, so
  // a later fix does not pull the map away from where the diner has panned.
  const hasAutoCentredRef = useRef(!isLocationApproximate);
  useEffect(() => {
    if (hasAutoCentredRef.current || isLocationApproximate) return;
    hasAutoCentredRef.current = true;
    if (!opensOnBuilding) setMapCenter(currentLocation);
  }, [currentLocation, isLocationApproximate, opensOnBuilding]);
  // Which sheet the map opens on is map_default_sheet_v1; read once so a late flag cannot swap it.
  const [displayMode, setDisplayMode] = useState<"carousel" | "list">(() =>
    getExperimentVariant("map_default_sheet_v1", { expose: true }) === "list" ? "list" : "carousel",
  );
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
  // "Open · Closes 9pm" for the card's hours line.
  const [hoursTextByVenue, setHoursTextByVenue] = useState<ReadonlyMap<string, string>>(new Map());
  // The cards whose hours have been read (or failed to), so "Open now" never empties the map while
  // the hours are still loading, and shows every stall when the hours cannot be read.
  const [hoursReadFor, setHoursReadFor] = useState<CatalogRawVenueCard[] | undefined>();
  const [hoursFailed, setHoursFailed] = useState(false);
  const venueHoursRef = useRef(new Map<string, VenueSummary>());
  // The "Loading places…" pill waits a moment so a quick pan does not flash it (M10).
  const [showLoadingPill, setShowLoadingPill] = useState(false);
  // The stalls behind a tapped cluster, as a list to pick from.
  const [clusterPick, setClusterPick] = useState<{
    count: number;
    venues: CatalogRawVenueCard[];
    hoursById: ReadonlyMap<string, string>;
    loading: boolean;
  } | null>(null);
  const clusterPickRun = useRef(0);
  // The list hides while a stall from it is open and comes back when the diner returns, so Back
  // lands on the list they picked from, not on the bare map.
  const [clusterSheetOpen, setClusterSheetOpen] = useState(false);
  const returnToClusterRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!returnToClusterRef.current) return;
      returnToClusterRef.current = false;
      setClusterSheetOpen(true);
    }, []),
  );
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
      if (filter === "places") {
        trackAnalyticsEvent("map_filter_toggled", { filter, enabled: !placesOpen });
        setPlacesOpen((open) => !open);
        return;
      }
      // Turning "Near me" on brings the map back to the diner.
      if (filter === "nearMe" && !mapFilters.nearMe) setMapCenter(currentLocation);
      trackAnalyticsEvent("map_filter_toggled", { filter, enabled: !mapFilters[filter] });
      toggleMapFilter(filter);
    },
    [currentLocation, mapFilters, placesOpen, toggleMapFilter],
  );

  useEffect(() => {
    let active = true;
    const span = currentZoom >= 15 ? 0.018 : currentZoom >= 13 ? 0.08 : 0.3;
    const buildingTypes = establishmentTypes;
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
    establishmentTypes,
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
      const hoursText = new Map<string, string>();
      for (const card of rawVenueCards) {
        const text = label(card.id);
        if (text) labels.set(card.id, text);
        const venue = venueHoursRef.current.get(card.id);
        const hours = venue ? formatMapCardHours(getVenueOpenStateNow(venue)) : undefined;
        if (hours) hoursText.set(card.id, hours);
      }
      setOpenLabelByVenue(labels);
      setHoursTextByVenue(hoursText);
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
    // Stalls with dishes lead the cards; stalls without a menu follow (never hidden).
    return menuStallsFirst(
      openNowActive
        ? narrowedByPins.filter((card) => openLabelByVenue.get(card.id) === "Open")
        : narrowedByPins,
    );
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

  const openClusterList = useCallback(
    async (item: { id: string; count: number; latitude: number; longitude: number }) => {
      const run = ++clusterPickRun.current;
      returnToClusterRef.current = false;
      setClusterSheetOpen(true);
      setClusterPick({ count: item.count, venues: [], hoursById: new Map(), loading: true });
      try {
        const page = await catalogRawService.listVenues({
          coordinate: { latitude: item.latitude, longitude: item.longitude },
          limit: CLUSTER_LIST_LIMIT,
          radiusMeters: item.id.startsWith("here-")
            ? COLOCATED_LIST_RADIUS_METERS
            : CLUSTER_LIST_RADIUS_METERS,
          buildingTypes: establishmentTypes,
          query: mapQuery || undefined,
          sort: "nearby",
        });
        // Hours come from one batched read; without them the rows just leave the word out.
        const hoursById = new Map<string, string>();
        try {
          const venues = await getHungryService().discovery.getVenuesByIds(
            page.items.map((venue) => venue.id),
          );
          for (const venue of venues) {
            const hours = formatMapCardHours(getVenueOpenStateNow(venue));
            if (hours) hoursById.set(venue.id, hours);
          }
        } catch (error) {
          reportError(error, { screen: "HomeMapScreen", action: "load_cluster_hours" });
        }
        if (run !== clusterPickRun.current) return;
        setClusterPick({
          count: item.count,
          venues: menuStallsFirst(page.items),
          hoursById,
          loading: false,
        });
      } catch (error) {
        reportError(error, { screen: "HomeMapScreen", action: "load_cluster_stalls" });
        if (run !== clusterPickRun.current) return;
        setClusterPick(null);
        setClusterSheetOpen(false);
        showToast({ message: "Couldn't load the stalls here. Try again.", tone: "error" });
      }
    },
    [catalogRawService, establishmentTypes, mapQuery, showToast],
  );

  // Stalls on one spot are one count pin, so each can be reached from the list that pin opens.
  const mapItems = useMemo(
    () =>
      groupColocatedVenues(
        openNowActive
          ? rawMapItems.filter(
              (item) => item.kind === "venue" && venueCards.some((card) => card.id === item.id),
            )
          : rawMapItems,
      ),
    [openNowActive, rawMapItems, venueCards],
  );
  const handleRawMarkerPress = useCallback(
    (markerId: string) => {
      const item = mapItems.find(
        (candidate) =>
          `${candidate.kind === "venue" ? "stall" : candidate.kind}-${candidate.id}` === markerId,
      );
      if (!item) return;
      trackAnalyticsEvent("map_pin_tapped", { pin_kind: item.kind, pin_id: item.id });
      if (item.kind === "cluster") {
        // Stalls on one spot cannot be pulled apart by zooming, so their pin always lists them.
        if (
          isColocatedCluster(item) ||
          item.count <= CLUSTER_LIST_MAX_COUNT ||
          currentZoom >= CLUSTER_LIST_MIN_ZOOM
        ) {
          void openClusterList(item);
          return;
        }
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
    [
      currentZoom,
      displayMode,
      openClusterList,
      mapItems,
      openStall,
      selectedVenueId,
      snapToIndex,
      spacing,
      venueCards,
    ],
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

  useEffect(() => {
    // The list opens half-way so it shows several rows, not one.
    snapToIndex(displayMode === "list" ? LIST_SNAP_INDEX : CARDS_SNAP_INDEX);
  }, [displayMode, snapToIndex]);

  // With "Open now" on, the map shows the open stalls that have cards, and no clusters (a cluster's
  // count cannot be narrowed by hours).
  const markers = useMemo<MapSurfaceMarker[]>(
    () =>
      mapItems.slice(0, MAX_RENDERED_MARKERS).map((item) =>
        item.kind === "cluster"
          ? {
              id: `cluster-${item.id}`,
              label: `${item.count} ${isColocatedCluster(item) ? "stalls" : "venues"}`,
              accessibilityLabel: isColocatedCluster(item)
                ? `${item.count} stalls here. Double tap to choose one.`
                : `${item.count} venues. Double tap to zoom in.`,
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
    [mapItems, palette],
  );

  const cameraPadding = useMemo(
    () => ({
      paddingBottom: 300,
    }),
    [displayMode],
  );

  /** The text of one card or row, and what a screen reader says for it. */
  const cardText = (venue: CatalogRawVenueCard) => {
    const rating = formatMapCardRating(venue);
    const hours = hoursTextByVenue.get(venue.id);
    // From the diner, never from the map's centre; none when their location is unknown.
    const distance = formatDistanceLabel(distanceFromDiner(venue, dinerLocation));
    const location = formatMapCardLocation(venue);
    // What a search matched is the one dish worth naming; otherwise the card is about the stall.
    const matched = matchedDishByVenue.get(venue.id);
    const dishLine = matched ? formatMapCardDish(venue, matched) : undefined;
    const detail = [hours, distance, location].filter(Boolean).join(" · ");
    return {
      rating: rating?.text,
      hours,
      distance,
      location,
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
    <View style={{ flex: 1, backgroundColor: palette.bg }} onLayout={handleContainerLayout}>
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
            Keyboard.dismiss();
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

      {/* A tap outside the place-type dropdown closes it. */}
      {placesOpen ? (
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no"
          onPress={() => setPlacesOpen(false)}
          style={[
            StyleSheet.absoluteFill,
            // Above the sheet and the floating buttons: the dropdown never sits under them.
            { backgroundColor: palette.overlay, zIndex: zIndex.toast - 2 },
          ]}
        />
      ) : null}

      {/* Top Floating UI */}
      <SafeAreaView
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: placesOpen ? zIndex.toast - 1 : zIndex.overlay,
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
            {/* Always showing: the search field is on the map from the start, no icon to tap. */}
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderRadius: componentRadii.search,
                borderWidth: 1,
                flex: 1,
                flexDirection: "row",
                gap: spacing[2],
                height: 52,
                paddingHorizontal: spacing[3],
                ...shadows.floating,
              }}
            >
              <AppSymbol name="search" size={20} color={palette.textMuted} />
              <TextInput
                accessibilityLabel="Search dishes or stalls"
                autoCorrect={false}
                clearButtonMode="never"
                onChangeText={setSearchText}
                onSubmitEditing={submitSearch}
                placeholder="Search dishes or stalls..."
                placeholderTextColor={palette.textSecondary}
                returnKeyType="search"
                style={{
                  color: palette.text,
                  flex: 1,
                  fontFamily: typography.body.fontFamily,
                  fontSize: typography.body.fontSize,
                  height: 52,
                  padding: 0,
                }}
                value={searchText}
              />
              {searchText.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  accessibilityHint="Clears the current search query"
                  hitSlop={12}
                  onPress={clearMapSearch}
                >
                  <AppSymbol name="xmark" fallback={X} color={palette.textMuted} size={18} />
                </Pressable>
              ) : null}
            </View>
          </View>
          <FilterChipRail
            options={filterOptions}
            selectedIds={filterOptions
              .filter((option) =>
                option.id === "nearMe"
                  ? nearMeActive
                  : option.id === "places"
                    ? establishmentTypes.length > 0
                    : mapFilters[option.id],
              )
              .map((option) => option.id)}
            onSelect={handleFilterSelect}
            gap={spacing[2]}
            solidSelected
            renderLeftIcon={(option, selected) =>
              option.id === "nearMe" ? (
                <AppSymbol
                  name="location"
                  fallback={LocateFixed}
                  size={14}
                  color={selected ? palette.textOnOrange : palette.textMuted}
                />
              ) : option.id === "places" ? (
                <AppSymbol
                  name="storefront"
                  fallback={Store}
                  size={14}
                  color={selected ? palette.textOnOrange : palette.textMuted}
                />
              ) : null
            }
            renderRightIcon={(option, selected) =>
              option.id === "places" ? (
                <AppSymbol
                  name={placesOpen ? "chevron.up" : "chevron.down"}
                  fallback={placesOpen ? ChevronUp : ChevronDown}
                  size={12}
                  color={selected ? palette.textOnOrange : palette.textMuted}
                />
              ) : null
            }
          />
          {placesOpen ? (
            <EstablishmentDropdown
              selected={establishmentTypes}
              onChange={setEstablishmentTypes}
              maxHeight={Math.max(240, screenHeight - insets.top - 220 - insets.bottom)}
            />
          ) : null}
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

          <SavedViewSwitch
            accessibilityLabel="Show the map or go back to the list"
            value="map"
            onChange={backToList}
          />

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
        // The cards swipe sideways: the sheet must not claim that drag, or it needs several
        // tries. The grabber strip still moves the sheet.
        enableContentPanningGesture={displayMode === "list"}
        handleComponent={renderSheetHandle}
        onAnimate={(_from, to) => {
          // Dragging the sheet puts the search box away, like any scrolling surface.
          Keyboard.dismiss();
          sheetIndexRef.current = to;
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
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}
          >
            <AppText
              variant="h2"
              style={{ marginBottom: spacing[2], paddingHorizontal: spacing[4] }}
            >
              Nearby stalls
            </AppText>
            {emptyMessage ? (
              <AppText
                tone="secondary"
                accessibilityLiveRegion="polite"
                style={{ paddingHorizontal: spacing[4] }}
              >
                {emptyMessage}
              </AppText>
            ) : null}
            {/* Edge-to-edge rows split by a hairline, like the other lists: no card, no gap. */}
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
                  alignItems: "center",
                  backgroundColor: venue.id === selectedVenueId ? palette.bgSoft : palette.surface,
                  borderBottomColor: palette.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  flexDirection: "row",
                  gap: spacing[3],
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                }}
              >
                <View
                  style={{
                    borderRadius: radii.md,
                    height: LIST_THUMB_SIZE,
                    overflow: "hidden",
                    width: LIST_THUMB_SIZE,
                  }}
                >
                  <MapVenueImage venue={venue} />
                </View>
                <View style={{ flex: 1 }}>
                  <MapCardLines
                    name={venue.name}
                    rating={cardText(venue).rating}
                    hours={cardText(venue).hours}
                    distance={cardText(venue).distance}
                    location={cardText(venue).location}
                  />
                </View>
                <AppSymbol
                  name="chevron.forward"
                  fallback={ChevronRight}
                  color={palette.textMuted}
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
              disableIntervalMomentum
              nestedScrollEnabled
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
                    <MapVenueImage venue={venue} />
                  </View>
                  <View style={{ padding: CARD_TEXT_PADDING }}>
                    <MapCardLines
                      name={venue.name}
                      rating={cardText(venue).rating}
                      hours={cardText(venue).hours}
                      distance={cardText(venue).distance}
                      location={cardText(venue).location}
                      fillWhenEmpty
                    />
                  </View>
                </PressableScale>
              ))}
            </BottomSheetScrollView>
          </View>
        )}
      </BottomSheet>
      <ClusterStallsSheet
        visible={clusterSheetOpen && clusterPick !== null}
        totalCount={clusterPick?.count ?? 0}
        loading={clusterPick?.loading ?? false}
        stalls={(clusterPick?.venues ?? []).map<ClusterStallRow>((venue) => {
          const hours = clusterPick?.hoursById.get(venue.id);
          const distance = formatDistanceLabel(distanceFromDiner(venue, dinerLocation));
          const location = formatMapCardLocation(venue);
          const detail = [hours, distance].filter(Boolean).join(" · ");
          return {
            id: venue.id,
            name: venue.name,
            detail: detail || undefined,
            location: location || undefined,
            accessibilityLabel: [`Open ${venue.name}`, detail, location].filter(Boolean).join(". "),
          };
        })}
        onClose={() => {
          const run = ++clusterPickRun.current;
          returnToClusterRef.current = false;
          setClusterSheetOpen(false);
          // Cleared once the sheet has slid away, so its rows do not vanish mid-animation.
          setTimeout(() => {
            if (run === clusterPickRun.current) setClusterPick(null);
          }, 260);
        }}
        onSelect={(stallId) => {
          trackAnalyticsEvent("map_cluster_stall_picked", { stall_id: stallId });
          returnToClusterRef.current = true;
          setClusterSheetOpen(false);
          openStall(stallId);
        }}
      />
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
    top: 10,
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
