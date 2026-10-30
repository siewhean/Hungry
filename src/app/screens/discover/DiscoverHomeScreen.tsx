import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";
import {
  ChevronRight,
  Drumstick,
  Moon,
  Salad,
  Search,
  SearchX,
  Shuffle,
  Star,
  Flame,
  Dices,
  Users,
  Tag,
} from "lucide-react-native";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
  useScrollToTop,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, EmptyState, FilterChipRail, Screen, Skeleton } from "@/components/ui";
import { DiscoverModeTabs, type DiscoverMode } from "@/components/discover/DiscoverModeTabs";
import { DiscoverViewToggle } from "@/components/discover/DiscoverViewToggle";
import { ForYouCard } from "@/components/discover/ForYouCard";
import { MenuLessStallGroup } from "@/components/discover/MenuLessStallGroup";
import { TrendingList } from "@/components/discover/TrendingList";
import { WhatsHerePanel } from "@/components/discover/WhatsHerePanel";
import { WelcomeBackCard } from "@/components/home/WelcomeBackCard";
import {
  DISCOVER_FEED_LIMIT,
  getDiscoverBiteCollections,
  getDiscoverBites,
  getDiscoverCardImage,
  getDishImageCandidates,
  isLateNightDish,
  isLateNightHour,
  searchResultToDiscoverBite,
  type DiscoverCardImageCandidate,
} from "@/features/discover/bites";
import { stallBuildingLabel } from "@/features/detail/stallLocation";
import { getDiscoverAreaCountLabel } from "@/features/discover/areaCount";
import { orderHawkerClassics } from "@/features/discover/hawkerClassics";
import { getDietaryChipLabel, HOME_CHEAP_PRICE_LIMIT } from "@/features/discover/homeFilters";
import { buildBiteLabel } from "@/features/discover/biteLabel";
import { pickRailsWithoutRepeats, tasteOrderBites } from "@/features/discover/homeRanking";
import {
  compareHomeStalls,
  getStallRowOpenLabel,
  isStallClosed,
} from "@/features/discover/homeStalls";
import { rankForYou, type HereStall } from "@/features/discover/mallMode";
import { dedupeNearestVenueCandidates } from "@/features/search/venueDedupe";
import {
  prefetchDishDetail,
  prefetchBrowseResults,
  prefetchImages,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { countNegativeTasteSignals, hasTrustedTasteProfile } from "@/lib/ai/tasteEngine";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import {
  getNearestBuildings,
  getNearestSingaporeArea,
  getNearestSingaporeAreaWithin,
} from "@/lib/geo/singaporeBuildings";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import type { Bite, DiscoveryLocationFeed } from "@/lib/services/types";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useCurrentPlace } from "@/features/discover/currentPlace";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { decideInitialRadiusMeters } from "@/features/discovery/decideForMeCandidates";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";
import type { BuildingSummary, DietaryFlag, DishDetail, VenueSummary } from "@/types/domain";
import { getSingaporeHour } from "@/utils/operatingHours";
import { DiscoverBiteRail, DiscoverRailBadge } from "@/components/discover/home/DiscoverBiteRail";
import { DiscoverStallThumbnail } from "@/components/discover/home/DiscoverImages";
import {
  DiscoverStallListLoadingSkeleton,
  PopularFoodStyleSkeleton,
} from "@/components/discover/home/DiscoverLoadingSkeletons";
import {
  DiscoverSearchPlaceholder,
  NARROW_SEARCH_WIDTH,
} from "@/components/discover/home/DiscoverSearchPlaceholder";
import {
  DISCOVER_TEXT_LINK_HIT_SLOP,
  type DiscoverRailLayout,
} from "@/components/discover/home/homeLayout";
import {
  PopularFoodStyleItem,
  type PopularFoodStyleItemData,
} from "@/components/discover/home/PopularFoodStyleItem";
import { VerticalStallShowcaseSection } from "@/components/discover/home/VerticalStallShowcaseSection";
import { POPULAR_FOOD_STYLES } from "@/features/discover/popularFoodStyles";
import {
  buildStallShowcaseCardsFromVenues,
  STALL_SHOWCASE_CARD_LIMIT,
  type DiscoverRepositoryLookup,
  type DiscoverStallShowcaseCard,
} from "@/features/discover/stallShowcase";

type DiscoverChipId = "dietary" | "spicy" | "halal" | "late" | "cheap";

const INTENT_CHIPS: readonly {
  id: Exclude<DiscoverChipId, "dietary">;
  label: string;
}[] = [
  { id: "spicy", label: "Spicy" },
  { id: "halal", label: "Halal" },
  { id: "late", label: "Late night" },
  { id: "cheap", label: "Under S$5" },
] as const;

const DISCOVER_STALL_INITIAL_VISIBLE_COUNT = 10;
const DISCOVER_STALL_SHOW_MORE_COUNT = 20;

/** A horizontal rail with fewer dishes than this is hidden. */
const MIN_DISCOVER_RAIL_ITEMS = 3;
/** The rows TrendingList shows. */
const TRENDING_LIST_ROWS = 5;
const NO_BITE_REASONS: ReadonlyMap<string, string> = new Map();
/** Stable empties so memos keyed on the feed do not rerun every render. */
const EMPTY_FEED_VENUES: DiscoveryLocationFeed["venues"] = [];
const EMPTY_FEED_RESULTS: DiscoveryLocationFeed["results"] = [];
const DISCOVER_AREA_RADIUS_METERS = 3000;
/** Location off: picks from the whole island, read around the built-in default point. */
const DISCOVER_ISLAND_RADIUS_METERS = 30_000;
/** 500 steps per degree ≈ a 220m grid: small GPS moves keep the same Discover read. */
const DISCOVER_GEOCELL_STEPS_PER_DEGREE = 500;

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Discover">,
  NativeStackNavigationProp<RootStackParamList>
>;

function DiscoverSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  return (
    <View style={{ gap: spacing[6], padding: spacing[4] }}>
      <Skeleton width="40%" height={24} />
      <Skeleton width="100%" height={56} borderRadius={radii.lg} />
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Skeleton width={140} height={120} borderRadius={radii.lg} />
        <Skeleton width={140} height={120} borderRadius={radii.lg} />
      </View>
      <View style={{ gap: spacing[4] }}>
        <Skeleton width="60%" height={28} />
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <Skeleton width={200} height={280} borderRadius={radii.xl} />
          <Skeleton width={200} height={280} borderRadius={radii.xl} />
        </View>
      </View>
    </View>
  );
}

export type DiscoverHomeScreenProps = {
  /**
   * Called when the live feed read fails (or only the saved cache answered). The Supabase entry
   * then shows the offline Home, which reads the catalog and, during an outage, the bundled copy.
   */
  onLiveFeedUnavailable?: () => void;
};

export function DiscoverHomeScreen({ onLiveFeedUnavailable }: DiscoverHomeScreenProps = {}) {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute();
  const isFocused = useIsFocused();
  const isTabSwipeLockedRef = useRef(false);
  const repository = getDataRepository();
  const isSupabaseDataSource = getServiceProvider().mode === "supabase";
  const [supabaseDiscoverAreaCount, setSupabaseDiscoverAreaCount] = useState<number | null>(null);
  const [supabaseDiscoveryFeed, setSupabaseDiscoveryFeed] = useState<DiscoveryLocationFeed | null>(
    null,
  );
  const [isSupabaseDiscoveryFeedLoading, setIsSupabaseDiscoveryFeedLoading] = useState(false);
  const [discoverLoadError, setDiscoverLoadError] = useState(false);
  const [discoverReloadKey, setDiscoverReloadKey] = useState(0);
  const [isDiscoverRefreshing, setIsDiscoverRefreshing] = useState(false);
  // The area the cards on screen were read for: a reload of the same area keeps them.
  const [loadedDiscoverFeedKey, setLoadedDiscoverFeedKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const {
    componentSizes,
    componentRadii,
    palette,
    radii,
    spacing,
    semanticSpacing,
    shadows,
    colorScheme,
    typography,
  } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const [discoverViewportHeight, setDiscoverViewportHeight] = useState(0);
  const discoverSectionGap = spacing[4];
  const discoverContentGap = spacing[2];
  const decisionCardGap = discoverContentGap;
  const decisionCardInnerGap = spacing[2];
  const discoverRailCardWidth = screenWidth * 0.55;
  const discoverRailImageHeight = 130;
  const decisionCardWidth = (screenWidth - semanticSpacing.screenEdge * 2 - decisionCardGap) / 2;
  const decisionCardPadding = spacing[2];
  const decisionCardIconSize = 36;
  const decisionCardIconGraphicSize = 19;
  const decisionCardLabelFontSize = Math.max(15, typography.bodySmallBold.fontSize + 1);
  const decisionCardLabelLineHeight = decisionCardLabelFontSize + spacing[1];
  const decisionCardLabelMaxWidth = Math.max(
    76,
    decisionCardWidth - decisionCardPadding * 2 - decisionCardIconSize - decisionCardInnerGap,
  );
  const bottomTabVisibleHeight = componentSizes.bottomTabBar + Math.max(insets.bottom, spacing[2]);
  const fallbackDiscoverViewportHeight = Math.max(0, screenHeight - insets.top);
  const effectiveDiscoverViewportHeight = discoverViewportHeight || fallbackDiscoverViewportHeight;
  const stallShowcasePageHeight =
    Math.max(0, effectiveDiscoverViewportHeight - bottomTabVisibleHeight) ||
    effectiveDiscoverViewportHeight ||
    fallbackDiscoverViewportHeight;
  const stallShowcaseCardWidth = screenWidth - semanticSpacing.screenEdge * 2;
  const edgeToEdgeHorizontalScrollStyle = {
    width: screenWidth,
  };
  const setTabSwipeLocked = useCallback(
    (isLocked: boolean) => {
      if (isTabSwipeLockedRef.current === isLocked) {
        return;
      }

      isTabSwipeLockedRef.current = isLocked;
      navigation.setOptions({ swipeEnabled: !isLocked });
    },
    [navigation],
  );
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const manualPlaceName = useLocationStore((state) => state.manualPlaceName);
  const grantLocation = useLocationStore((state) => state.grantLocation);
  const clearManualLocation = useLocationStore((state) => state.clearManualLocation);
  const showToast = useUIStore((state) => state.showToast);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const isUserMode = !isDeveloperMode && !isMerchantMode;

  useEffect(() => {
    const cancelWarmup = scheduleIdleWork(
      () => {
        preloadRoute(navigation, "BrowseDishes");
      },
      { timeout: 1_200, fallbackDelayMs: 500 },
    );

    return cancelWarmup;
  }, [navigation, repository]);

  useEffect(
    () => () => {
      if (isTabSwipeLockedRef.current) {
        navigation.setOptions({ swipeEnabled: true });
      }
    },
    [navigation],
  );

  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const searchIconSize = 52;
  const openSearchHome = useCallback(() => {
    trackAnalyticsEvent("discover_search_opened", { surface: "home" });
    navigation.navigate("SearchHome");
  }, [navigation]);

  // Dietary Needs starts on for a diner who has set dietary needs, so nothing unsuitable shows.
  const [activeDiscoverChipIds, setActiveDiscoverChipIds] = useState<DiscoverChipId[]>(() =>
    profile.dietaryPreferences.length ? ["dietary"] : [],
  );
  const dietaryAutoOnRef = useRef(profile.dietaryPreferences.length > 0);
  useEffect(() => {
    if (profile.dietaryPreferences.length === 0) {
      // No needs left (cleared in Settings): the chip filters nothing, and the next save
      // switches it on again.
      dietaryAutoOnRef.current = false;
      setActiveDiscoverChipIds((ids) =>
        ids.includes("dietary") ? ids.filter((id) => id !== "dietary") : ids,
      );
      return;
    }
    // The profile can finish loading after the first render; switch it on once, never again.
    if (dietaryAutoOnRef.current) return;
    dietaryAutoOnRef.current = true;
    setActiveDiscoverChipIds((ids) => (ids.includes("dietary") ? ids : [...ids, "dietary"]));
  }, [profile.dietaryPreferences.length]);
  const [discoverMode, setDiscoverMode] = useState<DiscoverMode>("forYou");
  const [visibleAreaStallCount, setVisibleAreaStallCount] = useState(
    DISCOVER_STALL_INITIAL_VISIBLE_COUNT,
  );
  const supabaseFeedVenues = supabaseDiscoveryFeed?.venues ?? EMPTY_FEED_VENUES;
  const supabaseFeedResults = supabaseDiscoveryFeed?.results ?? EMPTY_FEED_RESULTS;
  // Live builds look dishes and stalls up in the feed already on screen. The synchronous
  // repository would start a full-table download (again every 45 s), miss rows past the
  // 1,000-row cap and never re-render when it lands (HOME-X5).
  const repositoryLookup = useMemo<DiscoverRepositoryLookup>(() => {
    const dishById = new Map<string, DishDetail | undefined>();
    const dishesByVenue = new Map<string, DishDetail[]>();
    const venuesByBuilding = new Map<string, VenueSummary[]>();

    if (isSupabaseDataSource) {
      for (const { dish } of supabaseFeedResults) {
        dishById.set(dish.id, dish);
        dishesByVenue.set(dish.venueId, [...(dishesByVenue.get(dish.venueId) ?? []), dish]);
      }
      for (const venue of supabaseFeedVenues) {
        venuesByBuilding.set(venue.buildingId, [
          ...(venuesByBuilding.get(venue.buildingId) ?? []),
          venue,
        ]);
      }
      return {
        getDishById: (dishId: string) => dishById.get(dishId),
        listDishesByVenue: (venueId: string) => dishesByVenue.get(venueId) ?? [],
        listVenuesByBuilding: (buildingId: string) => venuesByBuilding.get(buildingId) ?? [],
      };
    }

    return {
      getDishById: (dishId: string) => {
        if (!dishById.has(dishId)) {
          dishById.set(dishId, repository.getDishById(dishId));
        }
        return dishById.get(dishId);
      },
      listDishesByVenue: (venueId: string) => {
        const cached = dishesByVenue.get(venueId);
        if (cached) {
          return cached;
        }
        const dishes = repository.listDishesByVenue(venueId);
        dishesByVenue.set(venueId, dishes);
        dishes.forEach((dish) => {
          dishById.set(dish.id, dish);
        });
        return dishes;
      },
      listVenuesByBuilding: (buildingId: string) => {
        const cached = venuesByBuilding.get(buildingId);
        if (cached) {
          return cached;
        }
        const venues = repository.listVenuesByBuilding(buildingId);
        venuesByBuilding.set(buildingId, venues);
        return venues;
      },
    };
  }, [isSupabaseDataSource, repository, supabaseFeedResults, supabaseFeedVenues]);
  const supabaseDiscoverBites = useMemo(
    () => supabaseFeedResults.map(searchResultToDiscoverBite),
    [supabaseFeedResults],
  );
  const feedVenueHoursById = useMemo(
    () => new Map(supabaseFeedVenues.map((venue) => [venue.id, venue.operatingHours] as const)),
    [supabaseFeedVenues],
  );
  // Hours for the late-night rail and chip: the live feed (live builds read nothing else),
  // otherwise the local data.
  const getVenueHours = useCallback(
    (venueId?: string) =>
      venueId
        ? feedVenueHoursById.get(venueId) ||
          (isSupabaseDataSource ? undefined : repository.getVenueById(venueId)?.operatingHours) ||
          undefined
        : undefined,
    [feedVenueHoursById, isSupabaseDataSource, repository],
  );
  const deferredDiscoverChipIds = useDeferredValue(activeDiscoverChipIds);
  const deferredDiscoverChipSet = useMemo(
    () => new Set<DiscoverChipId>(deferredDiscoverChipIds),
    [deferredDiscoverChipIds],
  );
  const activeDiscoverChipSignature = activeDiscoverChipIds.join("|");
  const deferredDiscoverChipSignature = deferredDiscoverChipIds.join("|");
  // Filtering is local and instant: the skeleton only covers the deferred re-render.
  const isPopularFoodFilterPending = activeDiscoverChipSignature !== deferredDiscoverChipSignature;
  const isDiscoverFiltering = deferredDiscoverChipIds.length > 0;
  const handleDiscoverViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight <= 0) {
      return;
    }

    setDiscoverViewportHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight,
    );
  }, []);

  const { coordinate: discoverCoordinate, isApproximate: isDiscoverLocationApproximate } =
    getEffectiveLocation({
      permission: locationPermission,
      currentLocation,
      manualCoordinate,
    });
  const discoverLocationLatitude = discoverCoordinate.latitude;
  const discoverLocationLongitude = discoverCoordinate.longitude;
  // GPS jitter must not refetch Discover: reads are keyed on a ~200m grid cell.
  const discoverGeoCellLatitude =
    Math.round(discoverLocationLatitude * DISCOVER_GEOCELL_STEPS_PER_DEGREE) /
    DISCOVER_GEOCELL_STEPS_PER_DEGREE;
  const discoverGeoCellLongitude =
    Math.round(discoverLocationLongitude * DISCOVER_GEOCELL_STEPS_PER_DEGREE) /
    DISCOVER_GEOCELL_STEPS_PER_DEGREE;
  // Without a GPS fix or a manual pick the coordinate is only the built-in default,
  // so the header asks the user to choose an area instead of asserting one.
  const needsDiscoverAreaChoice = isDiscoverLocationApproximate && !manualLocation;
  const wheelCtaLabel = FEATURE_FLAGS.wheelPartyEnabled ? "Pick with friends" : "Spin the wheel";
  const areaBuildings = useMemo(
    () => getNearestBuildings(discoverLocationLatitude, discoverLocationLongitude, 3, 14),
    [discoverLocationLatitude, discoverLocationLongitude],
  );
  // Only a manual area pick asks the server for that planning area. A GPS fix reads
  // the radius around the diner, so a stall 300 m away over an area line is not dropped.
  const discoverAreaRequest = manualLocation;
  // The nearest named area, only when the phone is within ~5 km of one (not in Woodlands
  // when it is overseas). Without a name the screen says "near you".
  // With location off there is no area to name: Discover shows picks across Singapore instead.
  const discoverAreaName = needsDiscoverAreaChoice
    ? undefined
    : (manualLocation ??
      getNearestSingaporeAreaWithin(discoverLocationLatitude, discoverLocationLongitude));
  const discoverLocationLabel = needsDiscoverAreaChoice
    ? "Singapore"
    : (discoverAreaName ?? "Near you");
  const discoverAreaPhrase = needsDiscoverAreaChoice
    ? "across Singapore"
    : discoverAreaName
      ? `in ${discoverAreaName}`
      : "near you";
  const discoverRadiusMeters = needsDiscoverAreaChoice
    ? DISCOVER_ISLAND_RADIUS_METERS
    : DISCOVER_AREA_RADIUS_METERS;
  const hasManualAreaPick = Boolean(manualLocation || manualCoordinate);
  const handleUseCurrentLocation = useCallback(async () => {
    if (locationPermission === "granted") {
      await clearManualLocation();
      return;
    }
    const granted = await grantLocation({ manualLocation });
    if (!granted) {
      showToast({
        message: "Location access is off. Turn it on in Settings to use your location.",
        tone: "info",
      });
    }
  }, [clearManualLocation, grantLocation, locationPermission, manualLocation, showToast]);
  // Inside a mall, hawker centre or food court the header names it instead of the area. A real
  // GPS fix or a searched place counts; a searched area or the default point is never "inside".
  const { place: currentPlace, isResolving: isCurrentPlaceResolving } = useCurrentPlace(
    (locationPermission === "granted" && !manualCoordinate) || (manualCoordinate && manualPlaceName)
      ? { latitude: discoverLocationLatitude, longitude: discoverLocationLongitude }
      : null,
  );
  const currentPlaceId = currentPlace?.id;
  const discoverFeedKey = [
    discoverAreaRequest ?? "",
    discoverGeoCellLatitude,
    discoverGeoCellLongitude,
    discoverRadiusMeters ?? "",
    currentPlaceId ?? "",
  ].join("|");
  // The area follows the phone: a mall or hawker centre when inside one, else the nearest area,
  // and "Singapore" while location is off.
  const discoverHeaderLabel =
    currentPlace?.name ??
    manualPlaceName ??
    discoverAreaName ??
    (needsDiscoverAreaChoice
      ? "Singapore"
      : getNearestSingaporeArea(discoverLocationLatitude, discoverLocationLongitude));

  useEffect(() => {
    setVisibleAreaStallCount(DISCOVER_STALL_INITIAL_VISIBLE_COUNT);
  }, [discoverLocationLabel, activeDiscoverChipSignature]);

  useEffect(() => {
    if (!isSupabaseDataSource) {
      setSupabaseDiscoverAreaCount(null);
      setSupabaseDiscoveryFeed(null);
      setIsSupabaseDiscoveryFeedLoading(false);
      return;
    }

    let isActive = true;
    // Keep the current feed on screen while a new area or GPS fix loads.
    setIsSupabaseDiscoveryFeedLoading(true);
    setDiscoverLoadError(false);
    // The feed asks for the place's stalls first, so it waits for the place lookup (3 s at most).
    if (isCurrentPlaceResolving) {
      return () => {
        isActive = false;
      };
    }
    const discoveryService = getHungryService().discovery;
    void Promise.allSettled([
      discoveryService.countVenuesInArea(
        discoverGeoCellLatitude,
        discoverGeoCellLongitude,
        discoverRadiusMeters,
        discoverAreaRequest,
      ),
      discoveryService.listDiscoveryFeedByLocation({
        areaName: discoverAreaRequest,
        lat: discoverGeoCellLatitude,
        lng: discoverGeoCellLongitude,
        radiusMeters: discoverRadiusMeters,
        limit: DISCOVER_FEED_LIMIT,
        buildingId: currentPlaceId,
      }),
    ]).then(([venueCountResult, discoveryFeedResult]) => {
      if (!isActive) return;
      // A failed count never throws away a good feed.
      setSupabaseDiscoverAreaCount(
        venueCountResult.status === "fulfilled" && typeof venueCountResult.value === "number"
          ? venueCountResult.value
          : null,
      );
      if (discoveryFeedResult.status === "fulfilled") {
        setSupabaseDiscoveryFeed(discoveryFeedResult.value ?? null);
        setLoadedDiscoverFeedKey(discoverFeedKey);
      } else {
        reportError(discoveryFeedResult.reason, { surface: "discover_home_feed" });
        setDiscoverLoadError(true);
      }
      setIsSupabaseDiscoveryFeedLoading(false);
      setIsDiscoverRefreshing(false);
    });

    return () => {
      isActive = false;
    };
  }, [
    discoverAreaRequest,
    discoverFeedKey,
    discoverRadiusMeters,
    discoverGeoCellLatitude,
    discoverGeoCellLongitude,
    discoverReloadKey,
    isSupabaseDataSource,
    isCurrentPlaceResolving,
    currentPlaceId,
  ]);

  const reloadDiscover = useCallback(async () => {
    setIsDiscoverRefreshing(true);
    setDiscoverReloadKey((key) => key + 1);
    if (!isSupabaseDataSource) {
      setIsDiscoverRefreshing(false);
    }
  }, [isSupabaseDataSource]);

  const themeTints = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      bg: palette.bg,
      text: palette.text,
      cardBg: palette.surface,
      secondaryText: palette.textSecondary,
      isDark,
    };
  }, [palette, colorScheme]);

  // One Singapore-time hour for the chip order and the late-night rail, refreshed on focus.
  const [currentHour, setCurrentHour] = useState(() => getSingaporeHour());
  useFocusEffect(
    useCallback(() => {
      setCurrentHour(getSingaporeHour());
    }, []),
  );
  const sortedChips = useMemo(() => {
    // The first chip names the diner's saved needs; a saved halal need already is the Halal chip.
    const intentChips = profile.dietaryPreferences.includes("halal")
      ? INTENT_CHIPS.filter((chip) => chip.id !== "halal")
      : INTENT_CHIPS;
    const baseChips = [
      { id: "dietary" as const, label: getDietaryChipLabel(profile.dietaryPreferences) },
      ...intentChips,
    ];
    // "Late night" only shows from 21:00 to 03:59, and then leads the row.
    if (isLateNightHour(currentHour)) {
      return baseChips.sort((a, b) => (a.id === "late" ? -1 : b.id === "late" ? 1 : 0));
    }
    return baseChips.filter((chip) => chip.id !== "late");
  }, [currentHour, profile.dietaryPreferences]);

  const areaVenues = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueVenues = new Map(supabaseFeedVenues.map((venue) => [venue.id, venue]));
      return Array.from(uniqueVenues.values());
    }
    const scopedVenues = areaBuildings.flatMap((building) =>
      repositoryLookup.listVenuesByBuilding(building.id),
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return Array.from(uniqueVenues.values());
  }, [areaBuildings, isSupabaseDataSource, repositoryLookup, supabaseFeedVenues]);
  const areaDishes = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueDishes = new Map(
        supabaseFeedResults.map((result) => [result.dish.id, result.dish]),
      );
      return Array.from(uniqueDishes.values());
    }
    return areaVenues.flatMap((venue) => repositoryLookup.listDishesByVenue(venue.id));
  }, [areaVenues, isSupabaseDataSource, repositoryLookup, supabaseFeedResults]);
  const allDiscoverVenues = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueVenues = new Map(supabaseFeedVenues.map((venue) => [venue.id, venue]));
      return Array.from(uniqueVenues.values());
    }
    const discoveredVenues = repository
      .listBuildings()
      .flatMap((building) => repositoryLookup.listVenuesByBuilding(building.id));
    const uniqueVenues = new Map(discoveredVenues.map((venue) => [venue.id, venue]));
    return Array.from(uniqueVenues.values());
  }, [isSupabaseDataSource, repository, repositoryLookup, supabaseFeedVenues]);
  const allDiscoverDishes = useMemo(() => {
    if (isSupabaseDataSource) {
      const uniqueDishes = new Map(
        supabaseFeedResults.map((result) => [result.dish.id, result.dish]),
      );
      return Array.from(uniqueDishes.values());
    }
    return allDiscoverVenues.flatMap((venue) => repositoryLookup.listDishesByVenue(venue.id));
  }, [allDiscoverVenues, isSupabaseDataSource, repositoryLookup, supabaseFeedResults]);
  const areaDishPool = areaDishes.length ? areaDishes : allDiscoverDishes;
  const isLateNightMakanVisible = isLateNightHour(currentHour);
  const toggleDiscoverChip = useCallback(
    (chipId: DiscoverChipId) => {
      if (chipId === "dietary" && profile.dietaryPreferences.length === 0) {
        // Nothing to filter by yet: the chip is the way to set dietary needs.
        trackAnalyticsEvent("discover_chip_tapped", {
          surface: "home",
          chip: chipId,
          selected: false,
          opened_settings: true,
        });
        navigation.navigate("OnboardingStack", {
          screen: "TasteQuiz",
          params: { mode: "profile", initialPhase: "dietary", source: "home" },
        });
        return;
      }
      const wasActive = activeDiscoverChipIds.includes(chipId);
      const nextChipIds = wasActive
        ? activeDiscoverChipIds.filter((value) => value !== chipId)
        : [...activeDiscoverChipIds, chipId];

      trackAnalyticsEvent("discover_chip_tapped", {
        surface: "home",
        chip: chipId,
        selected: !wasActive,
      });

      if (!wasActive && chipId !== "dietary") {
        scheduleIdleWork(
          () => {
            recordTasteInteraction({
              type: "search_query",
              surface: "discover",
              query: chipId,
              chipId,
            });
          },
          { timeout: 500, fallbackDelayMs: 80 },
        );
      }

      setActiveDiscoverChipIds(nextChipIds);
    },
    [activeDiscoverChipIds, navigation, profile.dietaryPreferences.length, recordTasteInteraction],
  );
  const matchesDiscoverChipSelection = useCallback(
    (dish?: DishDetail, textParts: string[] = []) => {
      if (!deferredDiscoverChipSet.size) {
        return true;
      }
      let cachedHaystack: string | null = null;
      const getLateNightHaystack = () => {
        if (cachedHaystack !== null) {
          return cachedHaystack;
        }

        cachedHaystack = [
          dish?.name,
          dish?.venueName,
          dish?.tasteTags.join(" "),
          dish?.priceRange,
          ...textParts,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return cachedHaystack;
      };

      return Array.from(deferredDiscoverChipSet).every((chipId) => {
        if (chipId === "dietary") {
          if (!dish) return false;
          // Saved needs must all hold.
          return profile.dietaryPreferences.every((flag) => dish.dietaryFlags.includes(flag));
        }
        if (chipId === "halal") {
          // Structured flag only: text matching let "non-halal" through.
          return Boolean(dish?.dietaryFlags.includes("halal"));
        }
        if (chipId === "spicy") {
          return (
            Boolean(dish && dish.tasteVector.spicy >= 6) || getLateNightHaystack().includes("spicy")
          );
        }
        if (chipId === "late") {
          // Same rule as the late-night rail: the stall's hours run past 22:00.
          return isLateNightDish(dish, getVenueHours(dish?.venueId));
        }
        if (chipId === "cheap") {
          return Boolean(dish && dish.price > 0 && dish.price < HOME_CHEAP_PRICE_LIMIT);
        }
        return true;
      });
    },
    [deferredDiscoverChipSet, getVenueHours, profile.dietaryPreferences],
  );
  const areaVenueIds = useMemo(() => new Set(areaVenues.map((venue) => venue.id)), [areaVenues]);
  const discoverBaseBites = useMemo(() => {
    if (isSupabaseDataSource) {
      return supabaseDiscoverBites.filter(
        (bite) => !areaVenueIds.size || areaVenueIds.has(bite.venueId),
      );
    }

    return getDiscoverBites(repository).filter(
      (bite) => !areaVenueIds.size || areaVenueIds.has(bite.venueId),
    );
  }, [areaVenueIds, isSupabaseDataSource, repository, supabaseDiscoverBites]);
  const biteDishLookup = isSupabaseDataSource ? repositoryLookup : repository;
  const discoverBiteCollections = useMemo(
    () =>
      getDiscoverBiteCollections(discoverBaseBites, biteDishLookup, getVenueHours, {
        preferBuildingId: currentPlaceId,
      }),
    [biteDishLookup, currentPlaceId, discoverBaseBites, getVenueHours],
  );
  const discoverDishById = useMemo(() => {
    const dishById = new Map<string, DishDetail>();
    supabaseFeedResults.forEach((result) => {
      dishById.set(result.dish.id, result.dish);
    });
    discoverBaseBites.forEach((bite) => {
      const dish = repositoryLookup.getDishById(bite.dishId);
      if (dish) {
        dishById.set(bite.dishId, dish);
      }
    });
    return dishById;
  }, [discoverBaseBites, repositoryLookup, supabaseFeedResults]);
  const getBiteDish = useCallback(
    (bite: Bite) => discoverDishById.get(bite.dishId),
    [discoverDishById],
  );
  const unfilteredQuickBiteCards = useMemo(
    () => discoverBiteCollections.quickBites.slice(0, 6),
    [discoverBiteCollections.quickBites],
  );
  const unfilteredTrendingCards = useMemo(
    () => discoverBiteCollections.trending.slice(0, 6),
    [discoverBiteCollections.trending],
  );
  // Top rated only shows dishes that really are 4.4+; no fallback to trending,
  // so the rail hides instead of labelling lower-rated dishes as 4.4+.
  const unfilteredEditorChoiceCards = useMemo(
    () => discoverBiteCollections.editorChoice.slice(0, 6),
    [discoverBiteCollections.editorChoice],
  );
  const unfilteredBudgetCards = useMemo(
    () => discoverBiteCollections.budget.slice(0, 6),
    [discoverBiteCollections.budget],
  );
  const unfilteredLateNightCards = useMemo(
    () => discoverBiteCollections.lateNight.slice(0, 5),
    [discoverBiteCollections.lateNight],
  );
  const filterDiscoverBites = useCallback(
    (bites: Bite[]) =>
      bites.filter((bite) =>
        matchesDiscoverChipSelection(getBiteDish(bite), [
          bite.dishName,
          bite.venueName,
          bite.caption,
        ]),
      ),
    [getBiteDish, matchesDiscoverChipSelection],
  );
  // "Dishes near you" follows the diner's palate once they have one (home_taste_rank_v1);
  // the control arm keeps photo and feed order. The experiment is read only while Home is on
  // screen, the rail has enough dishes to reorder and there is a palate to rank by.
  const skippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const tasteInteractionEvents = useProfileStore((state) => state.tasteInteractionEvents);
  const hasTasteProfile = useMemo(
    () =>
      hasTrustedTasteProfile(profile.tasteVector, {
        skippedTasteQuiz,
        signalCount: profile.recommendationSignals?.signalCount,
        negativeSignalCount: countNegativeTasteSignals(tasteInteractionEvents),
      }),
    [
      profile.recommendationSignals?.signalCount,
      profile.tasteVector,
      skippedTasteQuiz,
      tasteInteractionEvents,
    ],
  );
  const tasteRankVariant = useExperimentVariant("home_taste_rank_v1", {
    enabled: isFocused && hasTasteProfile && discoverBiteCollections.quickBites.length >= 6,
  });
  const rankByTaste = tasteRankVariant === "taste" && hasTasteProfile;
  // A chip filters the whole nearby pool first; only then do the cards get cut to the rail size.
  const quickBitePool = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(discoverBiteCollections.quickBites)
        : discoverBiteCollections.quickBites,
    [discoverBiteCollections.quickBites, filterDiscoverBites, isDiscoverFiltering],
  );
  const tasteOrdered = useMemo(
    () =>
      rankByTaste
        ? tasteOrderBites(quickBitePool, discoverDishById, {
            tasteVector: profile.tasteVector,
            preferBuildingId: currentPlaceId,
          })
        : { bites: quickBitePool, reasons: NO_BITE_REASONS },
    [currentPlaceId, discoverDishById, profile.tasteVector, quickBitePool, rankByTaste],
  );
  // A dish shows in the first rail (top to bottom) it qualifies for, not in all of them.
  const [trendingCards, quickBiteCards, editorChoiceCards, budgetCards, lateNightCards] = useMemo(
    () =>
      pickRailsWithoutRepeats(
        [
          {
            bites: isDiscoverFiltering
              ? filterDiscoverBites(discoverBiteCollections.trending)
              : discoverBiteCollections.trending,
            max: TRENDING_LIST_ROWS,
          },
          { bites: tasteOrdered.bites, max: 6, keepWhenThin: true },
          {
            bites: isDiscoverFiltering
              ? filterDiscoverBites(discoverBiteCollections.editorChoice)
              : discoverBiteCollections.editorChoice,
            max: 6,
          },
          {
            bites: isDiscoverFiltering
              ? filterDiscoverBites(discoverBiteCollections.budget)
              : discoverBiteCollections.budget,
            max: 6,
          },
          {
            bites: isDiscoverFiltering
              ? filterDiscoverBites(discoverBiteCollections.lateNight)
              : discoverBiteCollections.lateNight,
            max: 5,
          },
        ],
        isDiscoverFiltering ? 1 : MIN_DISCOVER_RAIL_ITEMS,
      ),
    [discoverBiteCollections, filterDiscoverBites, isDiscoverFiltering, tasteOrdered.bites],
  );
  // Live builds read the names of saved and reviewed dishes in one batched call (at most 200).
  const familiarDishIdsKey = [
    ...new Set([...profile.favouriteDishIds, ...profile.reviewedDishIds]),
  ].join("\u001f");
  const [liveFamiliarDishNames, setLiveFamiliarDishNames] = useState<readonly string[]>([]);
  useEffect(() => {
    const dishIds = familiarDishIdsKey ? familiarDishIdsKey.split("\u001f").slice(0, 200) : [];
    if (!isSupabaseDataSource || dishIds.length === 0) {
      setLiveFamiliarDishNames([]);
      return;
    }
    let isActive = true;
    void getHungryService()
      .discovery.getItemDetails({ dishIds, stallIds: [] })
      .then((rows) => {
        if (!isActive) return;
        setLiveFamiliarDishNames(
          rows.flatMap((row) => (row.dishId && row.name ? [row.name.toLowerCase()] : [])),
        );
      })
      .catch((error) => {
        // Only the order of Hawker classics depends on it.
        reportError(error, { surface: "discover_home_familiar_dishes" });
      });
    return () => {
      isActive = false;
    };
  }, [familiarDishIdsKey, isSupabaseDataSource]);
  const familiarDishNames = useMemo(
    () =>
      isSupabaseDataSource
        ? liveFamiliarDishNames
        : [...profile.favouriteDishIds, ...profile.reviewedDishIds].flatMap((dishId) => {
            const name = repositoryLookup.getDishById(dishId)?.name;
            return name ? [name.toLowerCase()] : [];
          }),
    [
      isSupabaseDataSource,
      liveFamiliarDishNames,
      profile.favouriteDishIds,
      profile.reviewedDishIds,
      repositoryLookup,
    ],
  );
  const foodOpenness = profile.tasteProfile?.foodOpenness;
  const unfilteredPopularFoodStyleItems = useMemo(
    () =>
      orderHawkerClassics(POPULAR_FOOD_STYLES, {
        openness: foodOpenness,
        isFamiliar: (style) =>
          familiarDishNames.some((name) => name.includes(style.query.toLowerCase())),
      })
        .map((style) => {
          const normalizedQuery = style.query.toLowerCase();
          const dish =
            areaDishPool.find((candidate) =>
              candidate.name.toLowerCase().includes(normalizedQuery),
            ) ?? (style.dishId ? repositoryLookup.getDishById(style.dishId) : undefined);
          const image = getDiscoverCardImage(dish ? getDishImageCandidates(dish) : []);
          return {
            ...style,
            imageSource: image.imageUrl ? { uri: image.imageUrl } : style.imageSource,
            imageUrl: image.imageUrl || undefined,
            dish,
          };
        })
        .filter((style): style is PopularFoodStyleItemData => Boolean(style.imageSource)),
    [areaDishPool, familiarDishNames, foodOpenness, repositoryLookup],
  );
  const popularFoodStyleItems = useMemo(
    () =>
      isDiscoverFiltering
        ? unfilteredPopularFoodStyleItems.filter((style) => {
            // A classic stays when any dish of that kind nearby passes the filters.
            const query = style.query.toLowerCase();
            const candidates = areaDishPool.filter((dish) =>
              dish.name.toLowerCase().includes(query),
            );
            return (candidates.length ? candidates : [style.dish]).some((dish) =>
              matchesDiscoverChipSelection(dish, [style.label, style.query]),
            );
          })
        : unfilteredPopularFoodStyleItems,
    [
      areaDishPool,
      isDiscoverFiltering,
      matchesDiscoverChipSelection,
      unfilteredPopularFoodStyleItems,
    ],
  );
  const isWaitingForPopularFoodStyles = !isDiscoverFiltering && popularFoodStyleItems.length === 0;
  const showPopularFoodSkeleton = useDelayedLoadingSkeleton(isWaitingForPopularFoodStyles);
  const showPopularFoodFilterSkeleton = isPopularFoodFilterPending;
  // Skeletons cover the first read and a new area. A pull-to-refresh of the same area keeps the
  // cards on screen until the new ones land.
  const showInitialDiscoverSkeleton =
    isSupabaseDataSource &&
    isSupabaseDiscoveryFeedLoading &&
    (supabaseDiscoveryFeed === null || loadedDiscoverFeedKey !== discoverFeedKey);
  const shouldShowPopularFoodSkeleton =
    showPopularFoodSkeleton || showPopularFoodFilterSkeleton || showInitialDiscoverSkeleton;
  const showDiscoverFilterRailSkeleton =
    showPopularFoodFilterSkeleton || showInitialDiscoverSkeleton;
  // Empty rails collapse instead of each showing its own "nothing found" block; a filter that
  // matches nothing shows one page-level empty state instead. Horizontal rails need a few
  // dishes to look like a rail, so they wait for MIN_DISCOVER_RAIL_ITEMS (one dish is enough
  // once a filter has narrowed them).
  const shouldRenderDiscoverRail = (count: number, minItems = 1) =>
    showDiscoverFilterRailSkeleton || count >= (isDiscoverFiltering ? 1 : minItems);
  const unfilteredAreaStallCards = useMemo(() => {
    if (isSupabaseDataSource) {
      const dishesByVenueId = new Map(
        supabaseFeedResults.map((result) => [result.dish.venueId, result.dish]),
      );
      return supabaseFeedVenues.map((venue) => {
        const building =
          areaBuildings.find((item) => item.id === venue.buildingId) ??
          ({
            id: venue.buildingId || `area-${discoverLocationLabel}`,
            name: discoverLocationLabel,
            type: "hawker_centre",
            coordinate: {
              latitude: discoverLocationLatitude,
              longitude: discoverLocationLongitude,
            },
            floors: [],
            venueCount: supabaseFeedVenues.length,
            isClosedToday: false,
            heroDishId: venue.topDishId,
          } satisfies BuildingSummary);
        return { building, venue, topDish: dishesByVenueId.get(venue.id) };
      });
    }

    return areaBuildings
      .map((building) => {
        const venues = repositoryLookup.listVenuesByBuilding(building.id);
        const venue = venues[0];
        const topDish = venue ? repositoryLookup.getDishById(venue.topDishId) : undefined;
        return venue ? { building, venue, topDish } : null;
      })
      .filter(Boolean) as {
      building: BuildingSummary;
      venue: VenueSummary;
      topDish: DishDetail | undefined;
    }[];
  }, [
    areaBuildings,
    discoverLocationLabel,
    discoverLocationLatitude,
    discoverLocationLongitude,
    isSupabaseDataSource,
    repositoryLookup,
    supabaseFeedResults,
    supabaseFeedVenues,
  ]);
  const allAreaStallCards = useMemo(() => {
    const filteredCards = isDiscoverFiltering
      ? unfilteredAreaStallCards.filter(({ venue, topDish }) =>
          matchesDiscoverChipSelection(topDish, [venue.name]),
        )
      : unfilteredAreaStallCards;

    const nearestChainCards = dedupeNearestVenueCandidates(
      filteredCards,
      (card) => card.venue,
      (card) => card.venue.distanceMeters ?? card.topDish?.distanceMeters,
    );

    // Stalls in the viewer's own building lead; the rest of the area follows once they run out.
    const isInCurrentPlace = (card: (typeof nearestChainCards)[number]) =>
      Boolean(currentPlaceId) && card.venue.buildingId === currentPlaceId;
    return [...nearestChainCards].sort((a, b) => {
      const placeOrder = Number(isInCurrentPlace(b)) - Number(isInCurrentPlace(a));
      if (placeOrder !== 0) return placeOrder;
      // Open first, then nearest; late at night the closed stalls follow the open ones.
      return compareHomeStalls(a, b);
    });
    // currentHour re-sorts when Home comes back into focus: open stalls change with the clock.
  }, [
    currentHour,
    currentPlaceId,
    isDiscoverFiltering,
    matchesDiscoverChipSelection,
    unfilteredAreaStallCards,
  ]);
  // Stalls whose menus are not in yet (no top dish): with some menus nearby they fold into one
  // row under the stalls that have them; with none, the list stays flat under a single note
  // (home_cold_start_v1; the control arm says "Menu coming soon" on every row).
  const menuLessStallCount = allAreaStallCards.filter((card) => !card.topDish).length;
  const coldStartVariant = useExperimentVariant("home_cold_start_v1", {
    enabled: isFocused && menuLessStallCount > 0,
  });
  const isColdStartGrouped = coldStartVariant === "grouped" && menuLessStallCount > 0;
  const foldMenuLessStalls = isColdStartGrouped && menuLessStallCount < allAreaStallCards.length;
  const listedAreaStallCards = useMemo(
    () =>
      foldMenuLessStalls ? allAreaStallCards.filter((card) => card.topDish) : allAreaStallCards,
    [allAreaStallCards, foldMenuLessStalls],
  );
  const foldedStallCards = useMemo(
    () => (foldMenuLessStalls ? allAreaStallCards.filter((card) => !card.topDish) : []),
    [allAreaStallCards, foldMenuLessStalls],
  );
  // With fewer than a rail's worth of dishes nearby, the classics stand in for the empty
  // rails: they open search for that dish across Singapore.
  const popularFoodTitle =
    coldStartVariant === "grouped" &&
    !isDiscoverFiltering &&
    !showInitialDiscoverSkeleton &&
    quickBiteCards.length < MIN_DISCOVER_RAIL_ITEMS
      ? "Popular dishes in Singapore"
      : "Hawker classics";
  const [isMenuLessGroupOpen, setIsMenuLessGroupOpen] = useState(false);
  const areaStallCards = useMemo(
    () => listedAreaStallCards.slice(0, visibleAreaStallCount),
    [listedAreaStallCards, visibleAreaStallCount],
  );
  const hasMoreAreaStalls = areaStallCards.length < listedAreaStallCards.length;
  const nextAreaStallRevealCount = Math.min(
    DISCOVER_STALL_SHOW_MORE_COUNT,
    Math.max(0, listedAreaStallCards.length - areaStallCards.length),
  );
  const handleShowMoreAreaStalls = useCallback(() => {
    setVisibleAreaStallCount((count) =>
      Math.min(count + DISCOVER_STALL_SHOW_MORE_COUNT, listedAreaStallCards.length),
    );
  }, [listedAreaStallCards.length]);
  const handleToggleMenuLessGroup = useCallback(() => {
    if (!isMenuLessGroupOpen) {
      trackAnalyticsEvent("home_cold_start_group_opened", {
        surface: "home",
        count: foldedStallCards.length,
      });
    }
    setIsMenuLessGroupOpen((open) => !open);
  }, [foldedStallCards.length, isMenuLessGroupOpen]);
  // "More from" never repeats "Stalls in": stalls already in that list are left out.
  const listedStallIds = useMemo(
    () => new Set(unfilteredAreaStallCards.map((card) => card.venue.id)),
    [unfilteredAreaStallCards],
  );
  const unfilteredStallShowcaseCards = useMemo(() => {
    // Live builds have one feed page, and every stall in it is already under "Stalls in", so
    // "More from" would always be empty: it is not built there (HOME-X6).
    if (isSupabaseDataSource) return [];
    const showcaseVenuePool = [...areaVenues, ...allDiscoverVenues].filter(
      (venue) => !listedStallIds.has(venue.id),
    );
    return buildStallShowcaseCardsFromVenues(showcaseVenuePool, repositoryLookup);
  }, [allDiscoverVenues, areaVenues, isSupabaseDataSource, listedStallIds, repositoryLookup]);
  const stallShowcaseCards = useMemo(() => {
    const filteredCards = isDiscoverFiltering
      ? unfilteredStallShowcaseCards.filter(({ venue, heroDish, products }) =>
          products.some((product) =>
            matchesDiscoverChipSelection(product, [
              venue.name,
              heroDish.name,
              ...product.tasteTags,
            ]),
          ),
        )
      : unfilteredStallShowcaseCards;

    return filteredCards.slice(0, STALL_SHOWCASE_CARD_LIMIT);
  }, [isDiscoverFiltering, matchesDiscoverChipSelection, unfilteredStallShowcaseCards]);
  // The live read failed and the saved cache is empty too: that is an error, not "0 places".
  const isFeedFallbackEmpty =
    Boolean(supabaseDiscoveryFeed?.isFallback) && supabaseFeedVenues.length === 0;
  // A failed live read (or one only the saved cache answered) hands Home to the offline
  // surface when the entry provides one; the saved cache is the mock-era synchronous copy.
  const isLiveFeedUnavailable =
    isSupabaseDataSource && (discoverLoadError || Boolean(supabaseDiscoveryFeed?.isFallback));
  useEffect(() => {
    if (isLiveFeedUnavailable) onLiveFeedUnavailable?.();
  }, [isLiveFeedUnavailable, onLiveFeedUnavailable]);
  // Content a diner can act on is on screen (not the first skeleton or an error).
  const hasDiscoverContent = isSupabaseDataSource
    ? !showInitialDiscoverSkeleton &&
      supabaseDiscoveryFeed !== null &&
      !isLiveFeedUnavailable &&
      supabaseFeedVenues.length > 0
    : true;
  // "See all" opens QuickBites, which release-01 core-only builds do not register.
  const canOpenDiscoverCollection = !FEATURE_FLAGS.release01CoreOnly;
  // Distances measured from the built-in default point would be made up.
  const trendingListBites = useMemo(
    () =>
      needsDiscoverAreaChoice
        ? trendingCards.map((bite) => ({ ...bite, distanceMeters: undefined }))
        : trendingCards,
    [needsDiscoverAreaChoice, trendingCards],
  );
  // One home_viewed per visit, once there is content to look at: the denominator the Home
  // experiments divide by.
  const homeViewedSentRef = useRef(false);
  const hasAnyDish = trendingCards.length + quickBiteCards.length > 0;
  useEffect(() => {
    if (!isFocused) {
      homeViewedSentRef.current = false;
      return;
    }
    if (!hasDiscoverContent || showDiscoverFilterRailSkeleton || homeViewedSentRef.current) return;
    homeViewedSentRef.current = true;
    trackAnalyticsEvent("home_viewed", {
      surface: "home",
      has_dishes: hasAnyDish,
      stalls: areaStallCards.length,
    });
    // areaStallCards.length is the first-paint count; later reveals do not start a new visit.
  }, [hasAnyDish, hasDiscoverContent, isFocused, showDiscoverFilterRailSkeleton]);
  const areaStallImpressionSentRef = useRef(false);
  const areaStallCount = areaStallCards.length;
  useEffect(() => {
    if (!isFocused) {
      areaStallImpressionSentRef.current = false;
      return;
    }
    if (
      showDiscoverFilterRailSkeleton ||
      areaStallCount === 0 ||
      areaStallImpressionSentRef.current
    ) {
      return;
    }
    areaStallImpressionSentRef.current = true;
    trackAnalyticsEvent("discover_rail_impression", {
      surface: "home",
      rail: "area_stalls",
      count: areaStallCount,
    });
  }, [areaStallCount, isFocused, showDiscoverFilterRailSkeleton]);
  const discoverAreaCountLabel = isSupabaseDataSource
    ? getDiscoverAreaCountLabel({
        isFallback: Boolean(supabaseDiscoveryFeed?.isFallback),
        isFeedLoaded: supabaseDiscoveryFeed !== null,
        feedVenueCount: supabaseFeedVenues.length,
        feedLimit: DISCOVER_FEED_LIMIT,
        rpcCount: supabaseDiscoverAreaCount,
      })
    : String(areaVenues.length);
  // Cards of the current place sort first, so they are the leading run of the list.
  const placeStallCardCount = currentPlaceId
    ? areaStallCards.filter(({ venue }) => venue.buildingId === currentPlaceId).length
    : 0;
  const trendingAreaPhrase =
    currentPlace && trendingCards.some((bite) => bite.buildingId === currentPlace.id)
      ? `in ${currentPlace.name}`
      : discoverAreaPhrase;
  // Inside a mall: "For you" ranks its dishes by the diner's palate, "What's here" lists its stalls.
  const inMallMode = isUserMode && Boolean(currentPlace);
  const forYouPicks = useMemo(() => {
    if (!inMallMode || discoverMode !== "forYou") return [];
    const picks = rankForYou(areaDishPool, {
      tasteVector: profile.tasteVector,
      dietaryFlags: profile.dietaryPreferences,
      maxDishBudget: profile.maxDishBudget,
      preferBuildingId: currentPlaceId,
    });
    return isDiscoverFiltering
      ? picks.filter((pick) => matchesDiscoverChipSelection(pick.dish))
      : picks;
  }, [
    areaDishPool,
    currentPlaceId,
    discoverMode,
    inMallMode,
    isDiscoverFiltering,
    matchesDiscoverChipSelection,
    profile.dietaryPreferences,
    profile.maxDishBudget,
    profile.tasteVector,
  ]);
  const hereStalls = useMemo<HereStall[]>(() => {
    if (!inMallMode || discoverMode !== "here") return [];
    const dishesByVenueId = new Map<string, DishDetail[]>();
    for (const dish of areaDishPool) {
      const list = dishesByVenueId.get(dish.venueId);
      if (list) list.push(dish);
      else dishesByVenueId.set(dish.venueId, [dish]);
    }
    return unfilteredAreaStallCards
      .filter((card) => card.venue.buildingId === currentPlaceId)
      .map((card) => ({
        venue: card.venue,
        topDish: card.topDish,
        dishes: dishesByVenueId.get(card.venue.id) ?? (card.topDish ? [card.topDish] : []),
      }))
      .flatMap((stall) => {
        if (!isDiscoverFiltering) return [stall];
        // A stall stays when one of its dishes passes the chips, and lists only those.
        const dishes = stall.dishes.filter((dish) =>
          matchesDiscoverChipSelection(dish, [stall.venue.name]),
        );
        return dishes.length ? [{ ...stall, dishes }] : [];
      });
  }, [
    areaDishPool,
    currentPlaceId,
    discoverMode,
    inMallMode,
    isDiscoverFiltering,
    matchesDiscoverChipSelection,
    unfilteredAreaStallCards,
  ]);
  // One row of the stall list; `position` is its place in the list, for the card-opened event.
  // One row of the stall list; `position` is its place in the list, for the card-opened event.
  const renderAreaStallRow = (
    { building, venue, topDish }: (typeof areaStallCards)[number],
    position: number,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${venue.name} ${isUserMode ? "details" : "in map zoomed view"}`}
      onPressIn={() => {
        prefetchStallDetail(venue.id, repository);
        if (topDish?.id) {
          prefetchDishDetail(topDish.id, repository);
        }
      }}
      onPress={() => {
        trackAnalyticsEvent("discover_card_opened", {
          surface: "home",
          rail: "area_stalls",
          kind: "stall",
          position,
        });
        if (isUserMode) {
          navigation.navigate("StallDetail", { venueId: venue.id });
          return;
        }

        navigation.navigate("MapZoomedIn", {
          buildingId: venue.buildingId,
        });
      }}
      style={[
        shadows.card,
        {
          backgroundColor: themeTints.cardBg,
          borderRadius: componentRadii.card,
          padding: spacing[3],
          flexDirection: "row",
          gap: spacing[3],
          alignItems: "center",
          borderWidth: themeTints.isDark ? 0 : 1,
          borderColor: palette.border,
          // Closed stalls are dimmed, not hidden: they still open.
          opacity: isStallClosed(venue) ? 0.7 : 1,
        },
      ]}
    >
      <DiscoverStallThumbnail venue={venue} />
      <View style={{ flex: 1, gap: 2 }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing[2],
          }}
        >
          <AppText
            variant="bodySmall"
            style={{ fontWeight: "800", color: themeTints.text, flexShrink: 1 }}
            numberOfLines={1}
          >
            {venue.name}
          </AppText>
          {topDish && topDish.reviewCount > 0 ? (
            <View
              accessibilityLabel={`Rated ${topDish.rating.toFixed(1)}`}
              style={{
                alignItems: "center",
                backgroundColor: palette.bgSoft,
                borderRadius: radii.pill,
                flexDirection: "row",
                flexShrink: 0,
                gap: 2,
                paddingHorizontal: spacing[2],
                paddingVertical: 2,
              }}
            >
              <Star color={palette.starStroke} size={11} fill={palette.starFill} />
              <AppText variant="micro" style={{ color: themeTints.text }}>
                {topDish.rating.toFixed(1)}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="micro" style={{ color: themeTints.secondaryText }} numberOfLines={1}>
          {[getStallRowOpenLabel(venue)].filter(Boolean).join(" · ")}
        </AppText>
        {/* Where to walk to: the building and unit get a line of their own so
            the building is never the part that is cut off. */}
        <AppText variant="micro" style={{ color: themeTints.secondaryText }} numberOfLines={1}>
          {[stallBuildingLabel(venue, building), venue.unitNumber].filter(Boolean).join(" · ")}
        </AppText>
        {topDish ? (
          topDish.reviewCount === 0 ? (
            <AppText variant="micro" tone="accent" numberOfLines={1}>
              Be the first to review
            </AppText>
          ) : null
        ) : isColdStartGrouped ? null : (
          <AppText variant="micro" style={{ color: themeTints.secondaryText }} numberOfLines={1}>
            Menu coming soon
          </AppText>
        )}
      </View>
      <ChevronRight color={palette.textMuted} size={20} />
    </Pressable>
  );
  const clearDiscoverFilters = useCallback(() => {
    trackAnalyticsEvent("home_filters_cleared", {
      surface: "home",
      chips: activeDiscoverChipIds.join(","),
    });
    setActiveDiscoverChipIds([]);
  }, [activeDiscoverChipIds]);
  // Filters that leave nothing anywhere on the page get one explanation and one way out,
  // not an empty block per section.
  const isDietaryOnlyFilter =
    deferredDiscoverChipIds.length === 1 && deferredDiscoverChipIds[0] === "dietary";
  const filteredEmptyBody = isDietaryOnlyFilter
    ? `Nothing nearby is confirmed ${getDietaryChipLabel(profile.dietaryPreferences)} yet. More menus are on the way.`
    : "Try removing a filter.";
  const filteredEmptyCtaLabel = isDietaryOnlyFilter ? "Show all dishes" : "Clear filters";
  const isFilteredPageEmpty =
    isDiscoverFiltering &&
    !inMallMode &&
    !showDiscoverFilterRailSkeleton &&
    popularFoodStyleItems.length === 0 &&
    trendingCards.length === 0 &&
    quickBiteCards.length === 0 &&
    editorChoiceCards.length === 0 &&
    budgetCards.length === 0 &&
    (!isLateNightMakanVisible || lateNightCards.length === 0) &&
    areaStallCards.length === 0 &&
    stallShowcaseCards.length === 0;
  const handleDecideForMe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    trackAnalyticsEvent("decide_for_me_triggered", {
      surface: "discover",
      location_granted: locationPermission === "granted",
      radius_m: decideInitialRadiusMeters(),
    });
    // The quiz asks a few questions (each can be left to the app), then the result screen
    // picks the dish with the same effective location as this feed.
    setDecideForMe(undefined);
    navigation.navigate("DecideForMeQuiz");
  };

  const handleFoodStylePress = useCallback(
    (item: PopularFoodStyleItemData) => {
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        initialQuery: item.query,
        // Discover records the taste signal below; the results grid must not repeat it or
        // save a chip tap as a recent search.
        source: "discover_chip",
      });

      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "search_query",
            surface: "discover",
            dish: item.dish,
            dishId: item.dishId,
            query: item.query,
            chipId: item.id,
            buttonId: "popular_right_now",
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    },
    [navigation, recordTasteInteraction],
  );

  const prefetchFoodStyle = useCallback(
    (item: PopularFoodStyleItemData) => {
      prefetchImages([item.imageUrl], 1);
      prefetchBrowseResults(item.query, navigation, { browseMode: "stalls" });
      if (item.dish?.id) {
        prefetchDishDetail(item.dish.id, repository);
        prefetchStallDetail(item.dish.venueId, repository);
      }
    },
    [navigation, repository],
  );

  useEffect(() => {
    const cancelPrefetch = scheduleIdleWork(
      () => {
        unfilteredPopularFoodStyleItems.slice(0, 4).forEach(prefetchFoodStyle);
      },
      { timeout: 700, fallbackDelayMs: 160 },
    );

    return () => {
      cancelPrefetch();
    };
  }, [prefetchFoodStyle, unfilteredPopularFoodStyleItems]);

  const prefetchBiteCard = useCallback(
    (bite: Bite) => {
      prefetchDishDetail(bite.dishId, repository);
      prefetchStallDetail(bite.venueId, repository);
      preloadRoute(navigation, "DishDetail", { dishId: bite.dishId });
    },
    [navigation, repository],
  );

  const openBiteDish = useCallback(
    (bite: Bite, buttonId: string) => {
      navigation.navigate("DishDetail", { dishId: bite.dishId, source: "home" });
      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "dish_result_click",
            surface: "discover",
            dish: getBiteDish(bite),
            dishId: bite.dishId,
            buttonId,
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    },
    [getBiteDish, navigation, recordTasteInteraction],
  );

  const openDiscoverCollection = useCallback(
    (collection: keyof typeof discoverBiteCollections) => {
      trackAnalyticsEvent("discover_see_all_tapped", { surface: "home", collection });
      // Same area as the rail the viewer was looking at, not a fresh GPS read.
      navigation.navigate("QuickBites", {
        collection,
        latitude: discoverLocationLatitude,
        longitude: discoverLocationLongitude,
      });
    },
    [discoverLocationLatitude, discoverLocationLongitude, navigation],
  );

  const prefetchBiteCollectionRoute = useCallback(
    (collection: keyof typeof discoverBiteCollections) => {
      prefetchImages(
        discoverBiteCollections[collection].map((bite) => bite.photoUrl),
        5,
      );
    },
    [discoverBiteCollections],
  );

  useEffect(() => {
    const leadingBites = [
      ...unfilteredQuickBiteCards.slice(0, 3),
      ...unfilteredTrendingCards.slice(0, 3),
      ...unfilteredEditorChoiceCards.slice(0, 2),
    ];
    prefetchImages(
      leadingBites.map((bite) => bite.photoUrl),
      8,
    );
  }, [unfilteredEditorChoiceCards, unfilteredQuickBiteCards, unfilteredTrendingCards]);

  const prefetchStallShowcaseCard = useCallback(
    (card: DiscoverStallShowcaseCard) => {
      prefetchStallDetail(card.venue.id, repository);
      prefetchDishDetail(card.heroDish.id, repository);
      prefetchImages(
        card.products.flatMap(
          (product) => getDiscoverCardImage(getDishImageCandidates(product)).candidateUrls,
        ),
        4,
      );
      if (isUserMode) {
        preloadRoute(navigation, "StallDetail", { venueId: card.venue.id });
      }
    },
    [isUserMode, navigation, repository],
  );

  const openStallShowcaseCard = useCallback(
    (card: DiscoverStallShowcaseCard) => {
      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "dish_result_click",
            surface: "discover",
            dish: card.heroDish,
            dishId: card.heroDish.id,
            buttonId: "vertical_stall_showcase_card",
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );

      if (isUserMode) {
        navigation.navigate("StallDetail", { venueId: card.venue.id });
        return;
      }

      navigation.navigate("MapZoomedIn", { buildingId: card.venue.buildingId });
    },
    [isUserMode, navigation, recordTasteInteraction],
  );

  useEffect(() => {
    const cancelPrefetch = scheduleIdleWork(
      () => {
        stallShowcaseCards.slice(0, 2).forEach(prefetchStallShowcaseCard);
      },
      { timeout: 700, fallbackDelayMs: 160 },
    );

    return () => {
      cancelPrefetch();
    };
  }, [prefetchStallShowcaseCard, stallShowcaseCards]);

  const discoverRailLayout = useMemo<DiscoverRailLayout>(
    () => ({
      cardWidth: discoverRailCardWidth,
      contentGap: discoverContentGap,
      imageHeight: discoverRailImageHeight,
      screenWidth,
    }),
    [discoverContentGap, discoverRailCardWidth, discoverRailImageHeight, screenWidth],
  );
  // Distances measured from the built-in default point would be made up, so they stay unspoken.
  const getBiteLabel = useCallback(
    (bite: Bite) =>
      buildBiteLabel(needsDiscoverAreaChoice ? { ...bite, distanceMeters: undefined } : bite),
    [needsDiscoverAreaChoice],
  );
  const discoverRailProps = {
    canSeeAll: canOpenDiscoverCollection,
    isLoading: showDiscoverFilterRailSkeleton,
    isVisible: isFocused,
    layout: discoverRailLayout,
    onOpenBite: openBiteDish,
    onPrefetchBite: prefetchBiteCard,
    onPrefetchCollection: prefetchBiteCollectionRoute,
    onSeeAll: openDiscoverCollection,
  };

  // Popular food style buttons. With dishes to show, the compact layout moves them below the
  // first dish section so food is on the first screen (home_above_fold_v1).
  const hasFirstDishSection =
    !inMallMode &&
    (trendingCards.length > 0 ||
      quickBiteCards.length >= (isDiscoverFiltering ? 1 : MIN_DISCOVER_RAIL_ITEMS));
  const aboveFoldVariant = useExperimentVariant("home_above_fold_v1", {
    enabled: isFocused && hasDiscoverContent && hasFirstDishSection,
  });
  const classicsSlot =
    aboveFoldVariant === "compact" && hasFirstDishSection
      ? trendingCards.length > 0
        ? "afterTrending"
        : "afterNearYou"
      : "top";
  const classicsSection = inMallMode ? null : (
    <View style={{ gap: discoverContentGap }}>
      <AppText variant="h2" style={{ color: themeTints.text }}>
        {popularFoodTitle}
      </AppText>
      {shouldShowPopularFoodSkeleton ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={edgeToEdgeHorizontalScrollStyle}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          <PopularFoodStyleSkeleton />
        </ScrollView>
      ) : popularFoodStyleItems.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={edgeToEdgeHorizontalScrollStyle}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {popularFoodStyleItems.map((item) => (
            <PopularFoodStyleItem
              key={item.id}
              item={item}
              onPrefetch={prefetchFoodStyle}
              onPress={handleFoodStylePress}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: themeTints.bg }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onLayout={handleDiscoverViewportLayout}
        contentContainerStyle={{
          gap: discoverSectionGap,
          paddingHorizontal: semanticSpacing.screenEdge,
        }}
        refreshControl={
          <RefreshControl
            colors={[palette.orange]}
            onRefresh={() => {
              Haptics.selectionAsync();
              void reloadDiscover();
            }}
            refreshing={isDiscoverRefreshing}
            tintColor={palette.orange}
          />
        }
      >
        {/* Where the diner is: it follows the phone's location, so there is no area to pick. */}
        <View style={{ paddingTop: spacing[1] }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing[2],
            }}
          >
            <View
              accessible
              accessibilityLabel={`You are at ${discoverHeaderLabel}`}
              style={{ flex: 1 }}
            >
              <AppText variant="bodySmall" style={{ color: themeTints.secondaryText }}>
                You are at
              </AppText>
              <AppText variant="h2" style={{ color: themeTints.text }} numberOfLines={1}>
                {discoverHeaderLabel}
              </AppText>
            </View>
            {/* Every signed-in diner can switch Discover to the map (when the map ships). */}
            {FEATURE_FLAGS.mapEnabled ? (
              <DiscoverViewToggle
                value="list"
                onPressInMap={() => preloadRoute(navigation, "DiscoverMap")}
                onChange={() => navigation.navigate("DiscoverMap")}
              />
            ) : null}
          </View>
          {needsDiscoverAreaChoice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Turn on location"
              accessibilityHint="Shows stalls near you instead of picks across Singapore"
              hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
              onPress={() => void handleUseCurrentLocation()}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: spacing[1] })}
            >
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                Location is off, so these are picks across Singapore.{" "}
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  Turn on location
                </AppText>
              </AppText>
            </Pressable>
          ) : null}
          {
            needsDiscoverAreaChoice ? null : isFeedFallbackEmpty ||
              discoverAreaCountLabel === null ? (
              isSupabaseDiscoveryFeedLoading ? (
                <Skeleton width={150} height={14} borderRadius={radii.sm} />
              ) : null
            ) : discoverAreaCountLabel !== "0" ? (
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                {`${discoverAreaCountLabel} stalls ${discoverAreaName ? "in this area" : "near you"}`}
              </AppText>
            ) : null /* 0 in-area venues: the page shows city-wide fallbacks, so "0 places" misleads. */
          }
          {hasManualAreaPick ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use current location"
              hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
              onPress={() => void handleUseCurrentLocation()}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                Use current location
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {/* Search Bar Entry */}
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search dishes, stalls, or hawker centres"
            onPressIn={() => preloadRoute(navigation, "SearchHome")}
            onPress={openSearchHome}
            style={{
              alignSelf: "stretch",
              borderRadius: componentRadii.search,
              backgroundColor: themeTints.cardBg,
              borderWidth: themeTints.isDark ? 0 : 1,
              borderColor: palette.border,
              height: 48,
              paddingHorizontal: spacing[3],
              flexDirection: "row",
              alignItems: "center",
              ...shadows.card,
            }}
          >
            <View style={{ flex: 1 }}>
              <DiscoverSearchPlaceholder
                isActive={isFocused}
                isNarrow={screenWidth < NARROW_SEARCH_WIDTH}
              />
            </View>
            <View
              style={{
                width: searchIconSize,
                alignItems: "center",
                justifyContent: "center",
                height: 48,
              }}
            >
              <Search color={themeTints.isDark ? palette.white : palette.textMuted} size={19} />
            </View>
          </Pressable>
        </View>

        {discoverLoadError || isFeedFallbackEmpty ? (
          <EmptyState
            title="Couldn't load Discover"
            body="Check your connection and try again."
            icon={<SearchX color={palette.textSecondary} size={28} />}
            ctaLabel="Try again"
            onPress={() => {
              void reloadDiscover();
            }}
          />
        ) : supabaseDiscoveryFeed?.isFallback ? (
          // The live read failed and the feed came from the saved cache: say so.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Showing saved results. Tap to retry."
            onPress={() => {
              void reloadDiscover();
            }}
            style={{
              backgroundColor: palette.warningSoft,
              borderRadius: componentRadii.card,
              minHeight: 44,
              justifyContent: "center",
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[2],
            }}
          >
            <AppText variant="bodySmall" style={{ color: palette.warningText }}>
              Showing saved results. Tap to retry.
            </AppText>
          </Pressable>
        ) : null}

        {/* Intent Chips with Icons */}
        <FilterChipRail
          options={sortedChips}
          selectedIds={activeDiscoverChipIds}
          onSelect={toggleDiscoverChip}
          onSwipeLockChange={setTabSwipeLocked}
          renderLeftIcon={(chip, isActive) =>
            chip.id === "dietary" ? (
              <Salad size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : chip.id === "spicy" ? (
              <Flame size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : chip.id === "halal" ? (
              // A neutral icon until the MUIS display decision: the Arabic mark read as a certificate.
              <Drumstick size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : chip.id === "late" ? (
              <Moon size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            ) : (
              <Tag size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
            )
          }
        />

        {/* welcome_back_v2: mounted only once Home shows content, and exposed only while the
            tab is on screen (tab warm-up mounts Home off-screen). */}
        {hasDiscoverContent ? (
          <WelcomeBackCard
            horizontalPadding={0}
            visible={isFocused}
            onOpenDish={(dishId) =>
              navigation.navigate("DishDetail", { dishId, source: "welcome_back" })
            }
            onOpenSaved={() => navigation.navigate("Favourites")}
          />
        ) : null}

        {isFilteredPageEmpty ? (
          <EmptyState
            title="No matching results"
            body={filteredEmptyBody}
            icon={<SearchX color={palette.textSecondary} size={28} />}
            ctaLabel={filteredEmptyCtaLabel}
            onPress={clearDiscoverFilters}
          />
        ) : null}

        {inMallMode ? <DiscoverModeTabs value={discoverMode} onChange={setDiscoverMode} /> : null}

        {classicsSlot === "top" ? classicsSection : null}

        {/* Decision action chips */}
        <View style={{ flexDirection: "row", gap: decisionCardGap }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decide for me"
            onPress={handleDecideForMe}
            style={({ pressed }) => [
              shadows.card,
              {
                borderRadius: componentRadii.button,
                minHeight: 56,
                opacity: pressed ? 0.92 : 1,
                overflow: "hidden",
                width: decisionCardWidth,
              },
            ]}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: palette.orange,
                borderRadius: componentRadii.button,
                flexDirection: "row",
                gap: decisionCardInnerGap,
                minHeight: 56,
                justifyContent: "center",
                padding: decisionCardPadding,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.inverseSurfaceSubtle,
                  borderRadius: radii.pill,
                  height: decisionCardIconSize,
                  justifyContent: "center",
                  width: decisionCardIconSize,
                }}
              >
                <Dices color={palette.textOnOrange} size={decisionCardIconGraphicSize} />
              </View>
              <AppText
                variant="bodyBold"
                numberOfLines={2}
                style={{
                  color: palette.textOnOrange,
                  includeFontPadding: false,
                  flexShrink: 1,
                  fontSize: decisionCardLabelFontSize,
                  lineHeight: decisionCardLabelLineHeight,
                  maxWidth: decisionCardLabelMaxWidth,
                  minWidth: 0,
                  textAlign: "center",
                  textAlignVertical: "center",
                }}
              >
                Decide for me
              </AppText>
            </View>
          </Pressable>

          {/* WheelStack is registered only when the wheel ships; party mode is non-production. */}
          {FEATURE_FLAGS.hungryWheelEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={wheelCtaLabel}
              accessibilityHint={
                FEATURE_FLAGS.wheelPartyEnabled
                  ? "Opens the Hungry Wheel to spin together with your group"
                  : "Opens the Hungry Wheel to pick between a few options"
              }
              onPressIn={() => preloadRoute(navigation, "WheelStack", { screen: "WheelHome" })}
              onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
              style={({ pressed }) => [
                {
                  alignItems: "center",
                  backgroundColor: "transparent",
                  borderColor: palette.border,
                  borderRadius: componentRadii.button,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: decisionCardInnerGap,
                  minHeight: 56,
                  justifyContent: "center",
                  opacity: pressed ? 0.92 : 1,
                  padding: decisionCardPadding,
                  width: decisionCardWidth,
                },
              ]}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: palette.bgSoft,
                  borderRadius: radii.pill,
                  height: decisionCardIconSize,
                  justifyContent: "center",
                  width: decisionCardIconSize,
                }}
              >
                <Users color={themeTints.text} size={decisionCardIconGraphicSize} />
              </View>
              <AppText
                variant="bodyBold"
                numberOfLines={2}
                style={{
                  color: themeTints.text,
                  includeFontPadding: false,
                  flexShrink: 1,
                  fontSize: decisionCardLabelFontSize,
                  lineHeight: decisionCardLabelLineHeight,
                  maxWidth: decisionCardLabelMaxWidth,
                  minWidth: 0,
                  textAlign: "center",
                  textAlignVertical: "center",
                }}
              >
                {wheelCtaLabel}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {inMallMode && currentPlace ? (
          discoverMode === "forYou" ? (
            <View style={{ gap: discoverContentGap }} testID="for-you-list">
              <AppText variant="h2" style={{ color: themeTints.text }}>
                {`For you at ${currentPlace.name}`}
              </AppText>
              {forYouPicks.length ? (
                forYouPicks.map((pick) => (
                  <ForYouCard
                    key={pick.dish.id}
                    pick={pick}
                    onPressIn={() => prefetchDishDetail(pick.dish.id, repository)}
                    onPress={() => navigation.navigate("DishDetail", { dishId: pick.dish.id })}
                  />
                ))
              ) : (
                <EmptyState
                  title="Nothing to suggest yet"
                  body="Try What's here, or adjust your dietary needs."
                  {...(isDiscoverFiltering
                    ? { ctaLabel: "Clear filters", onPress: clearDiscoverFilters }
                    : {})}
                />
              )}
            </View>
          ) : isDiscoverFiltering && hereStalls.length === 0 ? (
            <EmptyState
              title="No matching results"
              body="No stalls here match your filters."
              icon={<SearchX color={palette.textSecondary} size={28} />}
              ctaLabel="Clear filters"
              onPress={clearDiscoverFilters}
            />
          ) : (
            <WhatsHerePanel
              placeName={currentPlace.name}
              stalls={hereStalls}
              getStallMeta={({ venue, topDish }) =>
                [
                  getStallRowOpenLabel(venue),
                  topDish && topDish.reviewCount > 0 ? `★ ${topDish.rating.toFixed(1)}` : undefined,
                  venue.unitNumber,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
              onOpenStall={(venueId) => navigation.navigate("StallDetail", { venueId })}
              onPrefetchStall={({ venue, topDish }) => {
                prefetchStallDetail(venue.id, repository);
                if (topDish?.id) prefetchDishDetail(topDish.id, repository);
              }}
            />
          )
        ) : (
          <>
            <TrendingList
              title={`Most reviewed ${trendingAreaPhrase}`}
              bites={showInitialDiscoverSkeleton ? [] : trendingListBites}
              onOpen={(bite) => {
                trackAnalyticsEvent("discover_card_opened", {
                  surface: "home",
                  rail: "trending",
                  kind: "dish",
                  position: Math.max(
                    0,
                    trendingListBites.findIndex((item) => item.id === bite.id),
                  ),
                });
                openBiteDish(bite, "trending_bite_card");
              }}
              onPrefetch={(bite) => prefetchBiteCard(bite)}
              onSeeAll={
                canOpenDiscoverCollection ? () => openDiscoverCollection("trending") : undefined
              }
            />
            {classicsSlot === "afterTrending" ? classicsSection : null}
          </>
        )}

        {inMallMode ? null : (
          <>
            {/* Proactive Selection */}
            <View style={{ gap: discoverContentGap }}>
              {/* Daily Crave */}
              {!isUserMode && FEATURE_FLAGS.craveEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open daily crave"
                  onPressIn={() => preloadRoute(navigation, "Crave")}
                  onPress={() => navigation.navigate("Crave")}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.isDark
                        ? palette.inverseSurfaceBarely
                        : palette.bgSoft,
                      borderRadius: componentRadii.button,
                      padding: spacing[4],
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing[4],
                      borderWidth: 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.pill,
                      backgroundColor: palette.orange,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Flame color={palette.textOnOrange} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                      Daily crave
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      Swipe to build your taste profile
                    </AppText>
                  </View>
                  <ChevronRight
                    color={themeTints.isDark ? palette.white : palette.textMuted}
                    size={20}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* Rails: each is the same memoised rail over its own collection. */}
            {shouldRenderDiscoverRail(quickBiteCards.length, MIN_DISCOVER_RAIL_ITEMS) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                rail="quickBites"
                title="Dishes near you"
                seeAllLabel="See all dishes near you"
                cards={quickBiteCards}
                reasons={tasteOrdered.reasons}
                variant="rating"
                buttonId="quick_bite_card"
                getCardLabel={getBiteLabel}
              />
            ) : null}
            {classicsSlot === "afterNearYou" ? classicsSection : null}

            {shouldRenderDiscoverRail(editorChoiceCards.length, MIN_DISCOVER_RAIL_ITEMS) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                rail="editorChoice"
                title="Top rated"
                titleBadge={<DiscoverRailBadge label="★ 4.4+" tone="accent" />}
                seeAllLabel="See all top rated dishes"
                cards={editorChoiceCards}
                variant="topRated"
                buttonId="editor_choice_bite_card"
                getCardLabel={getBiteLabel}
              />
            ) : null}

            {shouldRenderDiscoverRail(budgetCards.length, MIN_DISCOVER_RAIL_ITEMS) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                rail="budget"
                title="Budget < S$8"
                titleBadge={<DiscoverRailBadge label="Value" tone="success" />}
                seeAllLabel="See all budget dishes under 8 dollars"
                cards={budgetCards}
                variant="price"
                buttonId="budget_bite_card"
                getCardLabel={getBiteLabel}
              />
            ) : null}

            {isLateNightMakanVisible &&
            shouldRenderDiscoverRail(lateNightCards.length, MIN_DISCOVER_RAIL_ITEMS) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                rail="lateNight"
                title="Late night eats"
                seeAllLabel="See all late night eats"
                cards={lateNightCards}
                variant="price"
                buttonId="late_night_bite_card"
                getCardLabel={getBiteLabel}
              />
            ) : null}

            {/* Hawker Centres Near You (Horizontal Selection) */}
            {shouldRenderDiscoverRail(areaStallCards.length) ? (
              <View style={{ gap: discoverContentGap }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      isUserMode && currentPlace
                        ? `See all stalls at ${currentPlace.name}`
                        : "View stalls on map"
                    }
                    hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
                    onPress={() =>
                      isUserMode && currentPlace
                        ? navigation.navigate("SearchResults", {
                            browseMode: "stalls",
                            placeId: currentPlace.id,
                            placeName: currentPlace.name,
                          })
                        : navigation.navigate("DiscoverMap")
                    }
                    style={{
                      alignItems: "center",
                      flex: 1,
                      flexDirection: "row",
                      gap: spacing[2],
                      minHeight: 44,
                    }}
                  >
                    <AppText variant="h2" style={{ color: themeTints.text, flexShrink: 1 }}>
                      {placeStallCardCount > 0 && currentPlace
                        ? `Stalls at ${currentPlace.name}`
                        : `Stalls ${discoverAreaPhrase}`}
                    </AppText>
                    <ChevronRight
                      color={themeTints.isDark ? palette.white : palette.textMuted}
                      size={20}
                    />
                  </Pressable>
                </View>
                <View style={{ gap: discoverContentGap }}>
                  {isColdStartGrouped && !foldMenuLessStalls && !showDiscoverFilterRailSkeleton ? (
                    <AppText variant="bodySmall" tone="secondary">
                      Menus are coming to these stalls.
                    </AppText>
                  ) : null}
                  {showDiscoverFilterRailSkeleton ? (
                    <DiscoverStallListLoadingSkeleton />
                  ) : areaStallCards.length ? (
                    areaStallCards.map((card, stallIndex) => (
                      <Fragment key={card.venue.id}>
                        {currentPlace &&
                        placeStallCardCount > 0 &&
                        stallIndex === placeStallCardCount ? (
                          <AppText
                            variant="bodySmall"
                            tone="secondary"
                            style={{ fontWeight: "700" }}
                          >
                            {`More near ${currentPlace.name}`}
                          </AppText>
                        ) : null}
                        {renderAreaStallRow(card, stallIndex)}
                      </Fragment>
                    ))
                  ) : null}
                  {hasMoreAreaStalls ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${nextAreaStallRevealCount} more stalls ${discoverAreaPhrase}`}
                      onPress={handleShowMoreAreaStalls}
                      style={[
                        shadows.card,
                        {
                          alignItems: "center",
                          alignSelf: "stretch",
                          backgroundColor: themeTints.cardBg,
                          borderColor: palette.border,
                          borderRadius: componentRadii.button,
                          borderWidth: themeTints.isDark ? 0 : 1,
                          flexDirection: "row",
                          gap: spacing[2],
                          justifyContent: "center",
                          paddingVertical: spacing[3],
                        },
                      ]}
                    >
                      <AppText variant="bodySmall" tone="accent" style={{ fontWeight: "800" }}>
                        Show {nextAreaStallRevealCount} more
                      </AppText>
                      <ChevronRight color={palette.orange} size={18} />
                    </Pressable>
                  ) : null}
                  {foldedStallCards.length && !showDiscoverFilterRailSkeleton ? (
                    <>
                      <MenuLessStallGroup
                        stalls={foldedStallCards.map(({ venue }) => ({
                          id: venue.id,
                          name: venue.name,
                          logoUrl: venue.logoUrl,
                        }))}
                        expanded={isMenuLessGroupOpen}
                        onToggle={handleToggleMenuLessGroup}
                      />
                      {isMenuLessGroupOpen
                        ? foldedStallCards.map((card) => (
                            <Fragment key={card.venue.id}>
                              {renderAreaStallRow(card, listedAreaStallCards.length)}
                            </Fragment>
                          ))
                        : null}
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            {stallShowcaseCards.length ? (
              <VerticalStallShowcaseSection
                cards={stallShowcaseCards}
                areaPhrase={discoverAreaPhrase}
                pageHeight={stallShowcasePageHeight}
                cardWidth={stallShowcaseCardWidth}
                onOpenCard={openStallShowcaseCard}
                onPrefetchCard={prefetchStallShowcaseCard}
              />
            ) : null}
            {/* The full lists stay one tap away, at the end of the page rather than between sections. */}
            <View style={{ flexDirection: "row", gap: discoverContentGap }}>
              {(
                [
                  {
                    label: "All stalls",
                    a11y: "Browse stalls and restaurants",
                    route: "BrowseStalls",
                  },
                  { label: "All dishes", a11y: "Browse dishes", route: "BrowseDishes" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.route}
                  accessibilityRole="button"
                  accessibilityLabel={item.a11y}
                  onPressIn={() => {
                    if (item.route === "BrowseStalls") {
                      areaVenues
                        .slice(0, 5)
                        .forEach((venue) => prefetchStallDetail(venue.id, repository));
                      preloadRoute(navigation, "BrowseStalls");
                    } else {
                      areaDishPool
                        .slice(0, 6)
                        .forEach((dish) => prefetchDishDetail(dish.id, repository));
                    }
                  }}
                  onPress={() => {
                    if (item.route === "BrowseStalls") navigation.navigate("BrowseStalls");
                    else navigation.navigate("BrowseDishes");
                  }}
                  style={{
                    alignItems: "center",
                    borderColor: palette.border,
                    borderRadius: componentRadii.button,
                    borderWidth: 1,
                    flex: 1,
                    justifyContent: "center",
                    minHeight: 48,
                  }}
                >
                  <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                    {item.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
