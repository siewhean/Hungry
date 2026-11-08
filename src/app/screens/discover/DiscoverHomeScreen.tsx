import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "@/lib/haptics";
import {
  ChevronDown,
  ChevronRight,
  Search,
  SearchX,
  Shuffle,
  Flame,
  Dices,
  Users,
} from "lucide-react-native";
import {
  useIsFocused,
  useNavigation,
  useRoute,
  useScrollToTop,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppSymbol,
  AppText,
  EmptyState,
  FilterChipRail,
  PressableScale,
  RailScrollView,
  Screen,
  Skeleton,
  NumericText,
  SlideText,
} from "@/components/ui";
import { SavedViewSwitch } from "@/components/saved/SavedViewSwitch";
import { ForYouCard } from "@/components/discover/ForYouCard";
import { MenuLessStallGroup } from "@/components/discover/MenuLessStallGroup";
import { TrendingList } from "@/components/discover/TrendingList";
import { WhatsHerePanel } from "@/components/discover/WhatsHerePanel";
import { UsualAreaChips } from "@/components/discover/UsualAreaChips";
import { usualAreasFor } from "@/features/discover/usualAreas";
import { useOnboardingAnswersStore } from "@/store/useOnboardingAnswersStore";
import { useLocationStore } from "@/store/useLocationStore";
import { HomeFeedbackCard } from "@/components/feedback/HomeFeedbackCard";
import { WelcomeBackCard } from "@/components/home/WelcomeBackCard";
import { MealPicksCard } from "@/components/home/MealPicksCard";
import { NextStampCard } from "@/components/gamification/NextStampCard";
import {
  DISCOVER_FEED_LIMIT,
  getDiscoverBiteCollections,
  getDiscoverBites,
  getDiscoverCardImage,
  getDishImageCandidates,
  isLateNightHour,
  type DiscoverCardImageCandidate,
} from "@/features/discover/bites";
import { stallBuildingLabel } from "@/features/detail/stallLocation";
import { getDiscoverAreaCountLabel } from "@/features/discover/areaCount";
import { orderHawkerClassics } from "@/features/discover/hawkerClassics";
import { getDietaryChipLabel } from "@/features/discover/homeFilters";
import { buildBiteLabel } from "@/features/discover/biteLabel";
import {
  dropDishesShownElsewhere,
  pickRailsWithoutRepeats,
  tasteOrderBites,
} from "@/features/discover/homeRanking";
import { boostNetworkBites } from "@/features/discover/networkPicks";
import { useNetworkStallPicks } from "@/features/discover/useNetworkStallPicks";
import { NetworkPicksSection } from "@/components/discover/home/NetworkPicksSection";
import { groupNearbyPlaces, type PlaceBuilding } from "@/features/discover/homeRails";
import { buildHomeSections } from "@/features/discover/homeSections";
import { fitChipsToDiner, kindsOfNames } from "@/features/discover/homeChips";
import { cleanPlaceName } from "@/features/detail/placeNames";
import {
  compareHomeStalls,
  getStallRowOpenLabel,
  isStallClosed,
  isUnprovenStall,
  openStateOf,
} from "@/features/discover/homeStalls";
import { freshSlotsFor, reserveFreshSlots } from "@/features/discover/rankingBalance";
import { formatDistanceLabel } from "@/features/discovery/distanceLabel";
import { rankForYou, type HereStall } from "@/features/discover/mallMode";
import {
  activeMutedFoodTypes,
  applyFeedbackToBites,
  applySessionShift,
  sessionShift,
} from "@/features/discover/personalFeedback";
import {
  MEAL_RAILS,
  bitesForMealPeriod,
  bitesLikeDish,
  mealPeriodForHour,
  toTitleCase,
} from "@/features/discover/personalRails";
import { dedupeNearestVenueCandidates } from "@/features/search/venueDedupe";
import { navigateOnce } from "@/features/navigation/navigateOnce";
import {
  prefetchDishDetail,
  prefetchBrowseResults,
  prefetchImages,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { resolveFoodOpenness } from "@/lib/ai/exploration";
import { buildFoodHistory, normalizeFoodType } from "@/lib/ai/foodHistory";
import { useFeedFeedbackStore } from "@/store/useFeedFeedbackStore";
import { askChoice } from "@/store/useChoiceSheetStore";
import { useUIStore } from "@/store/useUIStore";
import { countNegativeTasteSignals, hasTrustedTasteProfile } from "@/lib/ai/tasteEngine";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDiscoverFeed } from "@/features/discover/useDiscoverFeed";
import { useDiscoverFilters } from "@/features/discover/useDiscoverFilters";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { decideInitialRadiusMeters } from "@/features/discovery/decideForMeCandidates";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useHungryTheme } from "@/theme";
import type { BuildingSummary, DietaryFlag, DishDetail, VenueSummary } from "@/types/domain";
import { dishPrefillFrom } from "@/features/detail/dishPrefill";
import { DiscoverBiteRail, DiscoverRailBadge } from "@/components/discover/home/DiscoverBiteRail";
import { DiscoverStallThumbnail } from "@/components/discover/home/DiscoverImages";
import { StallRailCard } from "@/components/discover/home/StallRailCard";
import {
  DiscoverStallListLoadingSkeleton,
  PopularFoodStyleSkeleton,
  VerticalStallShowcaseLoadingSkeleton,
} from "@/components/discover/home/DiscoverLoadingSkeletons";
import { useDiscoverCardChrome } from "@/components/discover/home/homeCardChrome";
import { DiscoverChipIcon } from "@/components/discover/home/DiscoverChipIcon";
import { HomeWaveBackground } from "@/components/discover/home/HomeWaveBackground";
import {
  DiscoverSearchPlaceholder,
  NARROW_SEARCH_WIDTH,
} from "@/components/discover/home/DiscoverSearchPlaceholder";
import {
  DISCOVER_TEXT_LINK_HIT_SLOP,
  FOOD_STYLE_RAIL_INSET,
  type DiscoverRailLayout,
} from "@/components/discover/home/homeLayout";
import {
  PopularFoodStyleItem,
  type PopularFoodStyleItemData,
} from "@/components/discover/home/PopularFoodStyleItem";
import { VerticalStallShowcaseSection } from "@/components/discover/home/VerticalStallShowcaseSection";
import { putFavouritesFirst } from "@/features/discover/favouriteOrder";
import { POPULAR_FOOD_STYLES } from "@/features/discover/popularFoodStyles";
import { tabBarBottomPadding } from "@/app/navigation/tabBarMetrics";
import {
  buildStallShowcaseCardsFromVenues,
  STALL_SHOWCASE_CARD_LIMIT,
  type DiscoverStallShowcaseCard,
} from "@/features/discover/stallShowcase";

const DISCOVER_STALL_INITIAL_VISIBLE_COUNT = 10;

/** A horizontal rail with fewer dishes than this is hidden. */
const MIN_DISCOVER_RAIL_ITEMS = 3;
/** The rows TrendingList shows. */
const TRENDING_LIST_ROWS = 5;
const NO_BITE_REASONS: ReadonlyMap<string, string> = new Map();

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
  const {
    repository,
    isSupabaseDataSource,
    locationPermission,
    supabaseFeedVenues,
    supabaseFeedResults,
    repositoryLookup,
    supabaseDiscoverBites,
    getVenueHours,
    discoverLocationLatitude,
    discoverLocationLongitude,
    needsDiscoverAreaChoice,
    areaBuildings,
    discoverAreaName,
    discoverLocationLabel,
    discoverAreaPhrase,
    hasManualAreaPick,
    handleUseCurrentLocation,
    currentPlaceId,
    discoverFeedKey,
    discoverHeaderLabel,
    reloadDiscover,
    areaVenues,
    allDiscoverVenues,
    areaDishPool,
    supabaseDiscoverAreaCount,
    supabaseDiscoveryFeed,
    isSupabaseDiscoveryFeedLoading,
    isDiscoverFeedPartial,
    discoverLoadError,
    isDiscoverRefreshing,
    loadedDiscoverFeedKey,
    currentPlace,
  } = useDiscoverFeed();
  const {
    deferredDiscoverChipIds,
    activeDiscoverChipSignature,
    isPopularFoodFilterPending,
    isDiscoverFiltering,
    sortedChips: baseChips,
    chipContext,
    toggleDiscoverChip,
    matchesDiscoverChipSelection,
    clearDiscoverFilters,
    activeDiscoverChipIds,
    currentHour,
  } = useDiscoverFilters({ getVenueHours });
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
  const discoverCardChrome = useDiscoverCardChrome();
  const insets = useSafeAreaInsets();
  // How far the page has scrolled: the wavy background at the top fades out as it grows.
  const scrollY = useSharedValue(0);
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
  const bottomTabVisibleHeight =
    componentSizes.bottomTabBar + tabBarBottomPadding(insets.bottom, spacing[2]);
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
  // A row inside the scroller, pulled back so the first bowl is flush with the page margin.
  const foodStyleRowStyle = {
    flexDirection: "row" as const,
    gap: spacing[2],
    marginLeft: -FOOD_STYLE_RAIL_INSET,
  };
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const isUserMode = !isDeveloperMode && !isMerchantMode;

  useEffect(() => {
    const cancelWarmup = scheduleIdleWork(
      () => {
        preloadRoute(navigation, "FoodStyles");
      },
      { timeout: 1_200, fallbackDelayMs: 500 },
    );

    return cancelWarmup;
  }, [navigation, repository]);

  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const searchIconSize = 52;
  const openSearchHome = useCallback(() => {
    trackAnalyticsEvent("discover_search_opened", { surface: "home" });
    navigation.navigate("SearchHome");
  }, [navigation]);

  const handleDiscoverViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight <= 0) {
      return;
    }

    setDiscoverViewportHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight,
    );
  }, []);

  const wheelCtaLabel = FEATURE_FLAGS.wheelPartyEnabled ? "With friends" : "Spin the wheel";

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

  const isLateNightMakanVisible = isLateNightHour(currentHour);
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
  const allBiteCollections = useMemo(
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
  // What the diner told Home: dishes marked "Not for me" are gone (they stay hidden for 30 days),
  // and food types they asked to see less of drop to the end of every rail.
  const foodHistoryRows = useProfileStore((state) => state.foodHistory);
  const mutedFoodTypes = useFeedFeedbackStore((state) => state.mutedFoodTypes);
  const favouriteFoodStyleIds = useFeedFeedbackStore((state) => state.favouriteFoodStyleIds);
  const sessionActions = useFeedFeedbackStore((state) => state.sessionActions);
  const showToast = useUIStore((state) => state.showToast);
  const dismissedDishIds = useMemo(
    () => buildFoodHistory(foodHistoryRows).dismissedDishIds,
    [foodHistoryRows],
  );
  const discoverBiteCollections = useMemo(() => {
    const muted = new Set(activeMutedFoodTypes(mutedFoodTypes).map((item) => item.foodType));
    if (dismissedDishIds.size === 0 && muted.size === 0) return allBiteCollections;
    const options = {
      dismissedDishIds,
      mutedFoodTypes: muted,
      foodTypeOf: (dishId: string) => normalizeFoodType(discoverDishById.get(dishId)?.foodTypeTag),
    };
    return {
      quickBites: applyFeedbackToBites(allBiteCollections.quickBites, options),
      budget: applyFeedbackToBites(allBiteCollections.budget, options),
      editorChoice: applyFeedbackToBites(allBiteCollections.editorChoice, options),
      trending: applyFeedbackToBites(allBiteCollections.trending, options),
      lateNight: applyFeedbackToBites(allBiteCollections.lateNight, options),
    };
  }, [allBiteCollections, discoverDishById, dismissedDishIds, mutedFoodTypes]);
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
  const distanceDecayVariant = useExperimentVariant("home_distance_decay_v1", {
    enabled: isFocused && rankByTaste,
  });
  const distanceDecay = rankByTaste && distanceDecayVariant === "decay";
  // A chip filters the whole nearby pool first; only then do the cards get cut to the rail size.
  const quickBitePool = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(discoverBiteCollections.quickBites)
        : discoverBiteCollections.quickBites,
    [discoverBiteCollections.quickBites, filterDiscoverBites, isDiscoverFiltering],
  );
  // The palate Home ranks by: the saved one, nudged by what the diner did in the last half hour.
  const rankingTasteVector = useMemo(
    () =>
      applySessionShift(
        profile.tasteVector,
        sessionShift(sessionActions, profile.tasteVector, (dishId) => discoverDishById.get(dishId)),
      ),
    [discoverDishById, profile.tasteVector, sessionActions],
  );
  // The dishes the diner saved, tried or reviewed well. A returning diner's rails follow these
  // tags as well as the palate; a new diner has none, so the quiz palate alone ranks.
  const likedDishes = useMemo(() => {
    const { likedDishIds } = buildFoodHistory(foodHistoryRows);
    // Saved and tried dishes count too, before the server has a history row for them.
    const ids = new Set([...likedDishIds, ...profile.favouriteDishIds, ...profile.reviewedDishIds]);
    return [...ids].flatMap((dishId) => {
      const dish = discoverDishById.get(dishId);
      return dish ? [dish] : [];
    });
  }, [discoverDishById, foodHistoryRows, profile.favouriteDishIds, profile.reviewedDishIds]);
  // "Favourites" follows liked dishes closely, "adventurous" mixes in new food (Settings > Food openness).
  const rankingOpenness = resolveFoodOpenness(profile.tasteProfile);
  const palateOrdered = useMemo(
    () =>
      rankByTaste
        ? tasteOrderBites(quickBitePool, discoverDishById, {
            tasteVector: rankingTasteVector,
            preferBuildingId: currentPlaceId,
            likedDishes,
            openness: rankingOpenness,
            distanceDecay,
          })
        : { bites: quickBitePool, reasons: NO_BITE_REASONS },
    [
      currentPlaceId,
      discoverDishById,
      distanceDecay,
      likedDishes,
      quickBitePool,
      rankByTaste,
      rankingOpenness,
      rankingTasteVector,
    ],
  );
  // Stalls the diner's follows loved lately: their own Home rail, and a capped lift (two dishes)
  // in the rail above with a reason naming who.
  const isSignedIn = useSessionStore((state) => state.isAuthenticated);
  const [networkReloadKey, setNetworkReloadKey] = useState(0);
  const networkPicks = useNetworkStallPicks(
    isUserMode && isSignedIn && FEATURE_FLAGS.followConnectionsEnabled,
    networkReloadKey,
  );
  const tasteOrdered = useMemo(
    () => boostNetworkBites(palateOrdered.bites, palateOrdered.reasons, networkPicks),
    [networkPicks, palateOrdered],
  );
  // A dish shows in the first rail (top to bottom) it qualifies for, not in all of them.
  const [pickedTrendingCards, quickBiteCards, editorChoiceCards, budgetCards, lateNightCards] =
    useMemo(
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
  // The main rail keeps its dishes when it is thin, so "Most reviewed" yields the ones both would
  // show; with fewer than a rail's worth left it is hidden rather than repeat the first rail.
  const trendingCards = useMemo(
    () =>
      quickBiteCards.length >= (isDiscoverFiltering ? 1 : MIN_DISCOVER_RAIL_ITEMS)
        ? dropDishesShownElsewhere(
            pickedTrendingCards,
            quickBiteCards,
            isDiscoverFiltering ? 1 : MIN_DISCOVER_RAIL_ITEMS,
          )
        : pickedTrendingCards,
    [isDiscoverFiltering, pickedTrendingCards, quickBiteCards],
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
  // Two rails that follow the diner: what suits this time of day, and more of a dish they saved or
  // reviewed. Both skip dishes the rails above already show, and hide when fewer than a rail's worth
  // remain.
  const personalRailMin = isDiscoverFiltering ? 1 : MIN_DISCOVER_RAIL_ITEMS;
  const mealPeriod = mealPeriodForHour(currentHour);
  const mealRailCards = useMemo(() => {
    const shown = [
      ...pickedTrendingCards,
      ...quickBiteCards,
      ...editorChoiceCards,
      ...budgetCards,
      ...lateNightCards,
    ];
    return dropDishesShownElsewhere(
      bitesForMealPeriod(tasteOrdered.bites, mealPeriod).slice(0, 12),
      shown,
      personalRailMin,
    ).slice(0, 6);
  }, [
    budgetCards,
    editorChoiceCards,
    lateNightCards,
    mealPeriod,
    personalRailMin,
    pickedTrendingCards,
    quickBiteCards,
    tasteOrdered.bites,
  ]);
  const similarRail = useMemo(() => {
    const shown = [
      ...pickedTrendingCards,
      ...quickBiteCards,
      ...editorChoiceCards,
      ...budgetCards,
      ...lateNightCards,
      ...mealRailCards,
    ];
    for (const dishName of familiarDishNames) {
      const cards = dropDishesShownElsewhere(
        bitesLikeDish(tasteOrdered.bites, dishName),
        shown,
        personalRailMin,
      ).slice(0, 6);
      if (cards.length >= personalRailMin) return { dishName, cards };
    }
    return null;
  }, [
    budgetCards,
    editorChoiceCards,
    familiarDishNames,
    lateNightCards,
    mealRailCards,
    personalRailMin,
    pickedTrendingCards,
    quickBiteCards,
    tasteOrdered.bites,
  ]);
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
      putFavouritesFirst(
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
        favouriteFoodStyleIds,
      ),
    [
      areaDishPool,
      favouriteFoodStyleIds,
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
    const sorted = [...nearestChainCards].sort((a, b) => {
      const placeOrder = Number(isInCurrentPlace(b)) - Number(isInCurrentPlace(a));
      if (placeOrder !== 0) return placeOrder;
      // Open first, then the best near-and-good stall; closed ones follow the open ones.
      return compareHomeStalls(a, b);
    });
    // New stalls (few reviews) get slots 4, 11, 18... so well-reviewed stalls do not hold the list.
    return reserveFreshSlots(
      sorted,
      (card) => isUnprovenStall(card) && !isStallClosed(card.venue),
      freshSlotsFor(rankingOpenness),
    );
    // currentHour re-sorts when Home comes back into focus: open stalls change with the clock.
  }, [
    currentHour,
    currentPlaceId,
    isDiscoverFiltering,
    matchesDiscoverChipSelection,
    rankingOpenness,
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
    () => listedAreaStallCards.slice(0, DISCOVER_STALL_INITIAL_VISIBLE_COUNT),
    [listedAreaStallCards],
  );
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
  // With no connection and no feed in hand there is nothing to wait for: show the offline page
  // at once instead of skeletons until the read times out.
  const isDeviceOffline = useUIStore((state) => state.isOffline);
  const isLiveFeedUnavailable =
    isSupabaseDataSource &&
    (discoverLoadError ||
      Boolean(supabaseDiscoveryFeed?.isFallback) ||
      (isDeviceOffline && supabaseDiscoveryFeed === null));
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
        // The first few stalls alone are not the area's count: wait for the full feed.
        isFeedLoaded: supabaseDiscoveryFeed !== null && !isDiscoverFeedPartial,
        feedVenueCount: supabaseFeedVenues.length,
        feedLimit: DISCOVER_FEED_LIMIT,
        rpcCount: supabaseDiscoverAreaCount,
      })
    : String(areaVenues.length);
  // The count never disappears while the feed reloads (a new area, a pull to refresh): the last
  // number stays on screen and rolls to the new one when it lands.
  const [heldCountLabel, setHeldCountLabel] = useState<string | null>(null);
  if (discoverAreaCountLabel !== null && discoverAreaCountLabel !== heldCountLabel) {
    setHeldCountLabel(discoverAreaCountLabel);
  }
  const shownCountLabel = discoverAreaCountLabel ?? heldCountLabel;
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
    if (!inMallMode) return [];
    const picks = rankForYou(
      areaDishPool.filter((dish) => !dismissedDishIds.has(dish.id)),
      {
        tasteVector: profile.tasteVector,
        dietaryFlags: profile.dietaryPreferences,
        maxDishBudget: profile.maxDishBudget,
        preferBuildingId: currentPlaceId,
        profileTrusted: hasTasteProfile,
        likedDishes,
        reserveFresh: true,
        openness: rankingOpenness,
      },
    );
    return isDiscoverFiltering
      ? picks.filter((pick) => matchesDiscoverChipSelection(pick.dish))
      : picks;
  }, [
    areaDishPool,
    currentPlaceId,
    dismissedDishIds,
    hasTasteProfile,
    inMallMode,
    isDiscoverFiltering,
    likedDishes,
    matchesDiscoverChipSelection,
    rankingOpenness,
    profile.dietaryPreferences,
    profile.maxDishBudget,
    profile.tasteVector,
  ]);
  const hereStalls = useMemo<HereStall[]>(() => {
    if (!inMallMode) return [];
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
    inMallMode,
    isDiscoverFiltering,
    matchesDiscoverChipSelection,
    unfilteredAreaStallCards,
  ]);
  // The mall's own menus may not be in yet; then "For you" holds dishes from around it and says so.
  const forYouTitle =
    currentPlace && forYouPicks.some((pick) => pick.dish.buildingId === currentPlaceId)
      ? `For you at ${currentPlace.name}`
      : "For you nearby";
  // Inside a mall: the nearest stalls that are not in it, so Home also shows what is around.
  const stallsAroundPlace = useMemo(
    () =>
      inMallMode
        ? unfilteredAreaStallCards
            .filter((card) => card.venue.buildingId !== currentPlaceId)
            .slice(0, 8)
        : [],
    [currentPlaceId, inMallMode, unfilteredAreaStallCards],
  );
  // More to browse than the stalls in one building: sections about the diner and the moment (Just
  // for you, this hour or Late night, Popular in the area, pinned dishes, New and worth a try),
  // never a kind of food, and the malls and hawker centres around. A stall sits in one section
  // only and never repeats the main rail.
  const usualAreaIds = useOnboardingAnswersStore((state) => state.usualAreaIds);
  const usualMealTimes = useOnboardingAnswersStore((state) => state.mealTimes);
  const setManualSelection = useLocationStore((state) => state.setManualSelection);
  const usualAreas = useMemo(() => usualAreasFor(usualAreaIds), [usualAreaIds]);
  const categorySections = useMemo(() => {
    const byId = new Map(unfilteredPopularFoodStyleItems.map((item) => [item.id, item]));
    return buildHomeSections(allAreaStallCards, {
      hour: currentHour,
      favourites: favouriteFoodStyleIds.flatMap((id) => {
        const item = byId.get(id);
        return item ? [{ id: item.id, label: item.label, query: item.query }] : [];
      }),
      familiarNames: familiarDishNames,
      // Inside a mall the stall list is not shown ("What's here" lists every stall instead), so
      // the sections may hold the mall's stalls, led by them; only "More near" is not repeated.
      excludeVenueIds: new Set(
        (inMallMode ? stallsAroundPlace : areaStallCards).map((card) => card.venue.id),
      ),
      compare: compareHomeStalls,
      isOpenNow: (card) => openStateOf(card.venue).status === "open",
      palate: rankingTasteVector,
      palateTrusted: hasTasteProfile,
      avoidSpicy: chipContext.avoidSpicy,
      preferBuildingId: inMallMode ? currentPlaceId : undefined,
      openness: rankingOpenness,
      mealTimes: usualMealTimes,
    });
  }, [
    usualMealTimes,
    allAreaStallCards,
    areaStallCards,
    chipContext.avoidSpicy,
    currentHour,
    currentPlaceId,
    familiarDishNames,
    favouriteFoodStyleIds,
    hasTasteProfile,
    inMallMode,
    rankingOpenness,
    rankingTasteVector,
    stallsAroundPlace,
    unfilteredPopularFoodStyleItems,
  ]);
  // Chips that fit this diner now, with the foods they know (had, or pinned) first.
  const sortedChips = useMemo(() => {
    const byId = new Map(unfilteredPopularFoodStyleItems.map((item) => [item.id, item]));
    const knownKinds = kindsOfNames([
      ...familiarDishNames,
      ...favouriteFoodStyleIds.flatMap((id) => {
        const item = byId.get(id);
        return item ? [`${item.label} ${item.query}`] : [];
      }),
    ]);
    return fitChipsToDiner(baseChips, { ...chipContext, knownKinds });
  }, [
    baseChips,
    chipContext,
    familiarDishNames,
    favouriteFoodStyleIds,
    unfilteredPopularFoodStyleItems,
  ]);
  // Each building is named by its stalls' own address, not the area the diner is in.
  const nearbyPlaces = useMemo(() => {
    if (isDiscoverFiltering) return [];
    // A building the area list knows has its own name; otherwise the card's building is only a
    // stand-in named after the area the diner is in, which is not where the stall is.
    const knownBuildingIds = new Set(areaBuildings.map((item) => item.id));
    return groupNearbyPlaces<PlaceBuilding>(
      unfilteredAreaStallCards.flatMap(({ building, venue, topDish }) => {
        const name =
          cleanPlaceName(venue.buildingName) ||
          (knownBuildingIds.has(building.id) ? cleanPlaceName(building.name) : "");
        return name
          ? [
              {
                building: {
                  id: building.id,
                  name,
                  imageUrl: venue.imageUrl,
                },
                venue,
                topDish,
              },
            ]
          : [];
      }),
      currentPlaceId,
    );
  }, [areaBuildings, currentPlaceId, isDiscoverFiltering, unfilteredAreaStallCards]);
  const prefetchAreaStall = (
    venue: (typeof areaStallCards)[number]["venue"],
    topDish: (typeof areaStallCards)[number]["topDish"],
  ) => {
    prefetchStallDetail(venue.id, repository);
    if (topDish?.id) {
      prefetchDishDetail(topDish.id, repository);
    }
  };
  // `position` is the stall's place in its list, for the card-opened event.
  const openAreaStall = (venue: (typeof areaStallCards)[number]["venue"], position: number) => {
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
  };
  // One row of the stall list.
  const renderAreaStallRow = (
    { building, venue, topDish }: (typeof areaStallCards)[number],
    position: number,
  ) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Open ${venue.name} ${isUserMode ? "details" : "in map zoomed view"}`}
      onPressIn={() => prefetchAreaStall(venue, topDish)}
      onPress={() => openAreaStall(venue, position)}
      style={[
        discoverCardChrome.stallRowShell,
        // Closed stalls are dimmed, not hidden: they still open.
        { opacity: isStallClosed(venue) ? 0.7 : 1 },
      ]}
    >
      <DiscoverStallThumbnail venue={venue} />
      <View style={discoverCardChrome.stallRowText}>
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
              <AppSymbol name="rating" size={11} color={palette.starFill} />
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
      <AppSymbol name="chevron.right" fallback={ChevronRight} color={palette.textMuted} size={20} />
    </PressableScale>
  );
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

  // Holding a popular dish pins it to the front of the row, or unpins it. No card: the star
  // on the button and a haptic say it happened.
  const toggleFoodStyleFavourite = useCallback((item: PopularFoodStyleItemData) => {
    const { favouriteFoodStyleIds: pinned, toggleFavouriteFoodStyle } =
      useFeedFeedbackStore.getState();
    toggleFavouriteFoodStyle(item.id);
    trackAnalyticsEvent(
      pinned.includes(item.id) ? "home_food_style_unfavourited" : "home_food_style_favourited",
      { surface: "home", food_style: item.id },
    );
  }, []);

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

  const openDishSearch = useCallback(
    (query: string) => {
      trackAnalyticsEvent("discover_see_all_tapped", { surface: "home", collection: "similar" });
      navigation.navigate("SearchResults", {
        browseMode: "dishes",
        initialQuery: query,
        source: "discover_chip",
      });
    },
    [navigation],
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
  const openBiteOptions = useCallback(
    async (bite: Bite) => {
      const dish = getBiteDish(bite);
      const foodType = normalizeFoodType(dish?.foodTypeTag);
      const choice = await askChoice({
        title: bite.dishName,
        message: "Tell Hungry what to change.",
        options: [
          { id: "hide", label: "Not for me" },
          ...(foodType ? [{ id: "less", label: `Show less ${foodType}` }] : []),
        ],
      });
      if (choice === "hide") {
        recordTasteInteraction({
          type: "dismissed",
          surface: "discover",
          dish,
          dishId: bite.dishId,
          buttonId: "home_not_for_me",
        });
        trackAnalyticsEvent("home_dish_hidden", { surface: "home", dish_id: bite.dishId });
        showToast({ message: `Hidden. You won't see ${bite.dishName} for 30 days.` });
      } else if (choice === "less" && foodType) {
        useFeedFeedbackStore.getState().muteFoodType(foodType);
        trackAnalyticsEvent("home_food_type_muted", { surface: "home", food_type: foodType });
        showToast({ message: `You'll see less ${foodType} for 30 days.` });
      }
    },
    [getBiteDish, recordTasteInteraction, showToast],
  );
  const discoverRailProps = {
    canSeeAll: canOpenDiscoverCollection,
    isLoading: showDiscoverFilterRailSkeleton,
    isVisible: isFocused,
    layout: discoverRailLayout,
    onBiteOptions: openBiteOptions,
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
  // A diner with a palate sees the palate-ranked "Dishes near you" first, then the classics, then
  // "Most reviewed"; everyone else keeps "Most reviewed" first.
  const showNearYouRail = shouldRenderDiscoverRail(quickBiteCards.length, MIN_DISCOVER_RAIL_ITEMS);
  const personalFirst = !inMallMode && rankByTaste && showNearYouRail;
  const classicsSlot =
    aboveFoldVariant === "compact" && hasFirstDishSection
      ? trendingCards.length > 0 && !personalFirst
        ? "afterTrending"
        : "afterNearYou"
      : "top";
  const nearYouRail = showNearYouRail ? (
    <DiscoverBiteRail
      {...discoverRailProps}
      rail="quickBites"
      title={needsDiscoverAreaChoice ? "Dishes across Singapore" : "Dishes near you"}
      seeAllLabel={
        needsDiscoverAreaChoice ? "See all dishes across Singapore" : "See all dishes near you"
      }
      cards={quickBiteCards}
      reasons={tasteOrdered.reasons}
      variant="rating"
      buttonId="quick_bite_card"
      getCardLabel={getBiteLabel}
    />
  ) : null;
  const classicsSection = (
    <View style={{ gap: discoverContentGap }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`See all dishes: ${popularFoodTitle}`}
        hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
        onPress={() => navigation.navigate("FoodStyles")}
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[2],
          justifyContent: "space-between",
          minHeight: 44,
        }}
      >
        <AppText variant="h2" style={{ color: themeTints.text, flexShrink: 1 }}>
          {popularFoodTitle}
        </AppText>
        <AppSymbol
          name="chevron.right"
          fallback={ChevronRight}
          color={themeTints.isDark ? palette.white : palette.textMuted}
          size={20}
        />
      </Pressable>
      {shouldShowPopularFoodSkeleton ? (
        <RailScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={edgeToEdgeHorizontalScrollStyle}
          contentContainerStyle={{ flexGrow: 0 }}
        >
          <View style={foodStyleRowStyle}>
            <PopularFoodStyleSkeleton />
          </View>
        </RailScrollView>
      ) : popularFoodStyleItems.length ? (
        <RailScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={edgeToEdgeHorizontalScrollStyle}
          contentContainerStyle={{ flexGrow: 0 }}
        >
          <View style={foodStyleRowStyle}>
            {popularFoodStyleItems.map((item) => (
              <PopularFoodStyleItem
                key={item.id}
                item={item}
                isFavourite={favouriteFoodStyleIds.includes(item.id)}
                onPrefetch={prefetchFoodStyle}
                onPress={handleFoodStylePress}
                onToggleFavourite={toggleFoodStyleFavourite}
              />
            ))}
          </View>
        </RailScrollView>
      ) : null}
    </View>
  );

  // Stall cards scroll sideways in a row, one row per section: a picture of the food (or the
  // stall's logo) over the name, rating, opening line and location.
  const mallCardWidth = Math.min(screenWidth * 0.78, 320);
  const stallRailCardWidth = Math.min(screenWidth * 0.62, 260);
  const renderStallRail = (cards: typeof areaStallCards) => (
    <RailScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={edgeToEdgeHorizontalScrollStyle}
      contentContainerStyle={{ gap: spacing[3] }}
    >
      {cards.map(({ building, venue, topDish }, stallIndex) => (
        <StallRailCard
          key={venue.id}
          name={venue.name}
          imageUrl={topDish?.imageUrl || venue.imageUrl || undefined}
          logoUrl={venue.logoUrl}
          rating={topDish && topDish.reviewCount > 0 ? topDish.rating : undefined}
          openLabel={getStallRowOpenLabel(venue)}
          reserveOpenLine
          locationLabel={
            [stallBuildingLabel(venue, building), venue.unitNumber].filter(Boolean).join(" · ") ||
            undefined
          }
          note={
            topDish
              ? topDish.reviewCount === 0
                ? { text: "Be the first to review", accent: true }
                : undefined
              : isColdStartGrouped
                ? undefined
                : { text: "Menu coming soon" }
          }
          width={stallRailCardWidth}
          dimmed={isStallClosed(venue)}
          accessibilityLabel={`Open ${venue.name} ${isUserMode ? "details" : "in map zoomed view"}`}
          onPressIn={() => prefetchAreaStall(venue, topDish)}
          onPress={() => openAreaStall(venue, stallIndex)}
        />
      ))}
    </RailScrollView>
  );

  const moreSections =
    showInitialDiscoverSkeleton ||
    (categorySections.length === 0 && nearbyPlaces.length === 0) ? null : (
      <>
        {categorySections.map((section) => (
          <View key={section.id} style={{ gap: discoverContentGap }} testID={`home-${section.id}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all: ${section.title}`}
              hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
              onPress={() =>
                navigation.navigate(
                  "SearchResults",
                  section.query
                    ? { browseMode: "stalls", initialQuery: section.query, source: "discover_chip" }
                    : { browseMode: "stalls" },
                )
              }
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing[2],
                justifyContent: "space-between",
                minHeight: 44,
              }}
            >
              <AppText
                variant="h2"
                accessibilityRole="header"
                style={{ color: themeTints.text, flexShrink: 1 }}
              >
                {section.title}
              </AppText>
              <AppSymbol
                name="chevron.right"
                fallback={ChevronRight}
                color={themeTints.isDark ? palette.white : palette.textMuted}
                size={20}
              />
            </Pressable>
            {renderStallRail(section.cards)}
          </View>
        ))}
        {nearbyPlaces.length ? (
          <View style={{ gap: discoverContentGap }} testID="nearby-places">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all stalls"
              hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
              onPress={() => navigation.navigate("SearchResults", { browseMode: "stalls" })}
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing[2],
                justifyContent: "space-between",
                minHeight: 44,
              }}
            >
              <AppText
                variant="h2"
                accessibilityRole="header"
                style={{ color: themeTints.text, flexShrink: 1 }}
              >
                Malls and hawker centres nearby
              </AppText>
              <AppSymbol
                name="chevron.right"
                fallback={ChevronRight}
                color={themeTints.isDark ? palette.white : palette.textMuted}
                size={20}
              />
            </Pressable>
            <RailScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[3] }}
            >
              {nearbyPlaces.map(({ building, stallCount, distanceMeters }) => (
                <StallRailCard
                  key={building.id}
                  name={building.name}
                  imageUrl={building.imageUrl}
                  logoUrl={building.logoUrl}
                  locationLabel={[
                    `${stallCount} ${stallCount === 1 ? "stall" : "stalls"}`,
                    formatDistanceLabel(distanceMeters),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  width={stallRailCardWidth}
                  accessibilityLabel={`See stalls at ${building.name}`}
                  onPress={() =>
                    navigation.navigate("SearchResults", {
                      browseMode: "stalls",
                      placeId: building.id,
                      placeName: building.name,
                    })
                  }
                />
              ))}
            </RailScrollView>
          </View>
        ) : null}
      </>
    );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: themeTints.bg }}>
      <HomeWaveBackground
        width={screenWidth}
        topInset={insets.top}
        scrollY={scrollY}
        active={isFocused}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onLayout={handleDiscoverViewportLayout}
        contentContainerStyle={{
          gap: discoverSectionGap,
          paddingHorizontal: semanticSpacing.screenEdge,
          paddingBottom: spacing[4],
        }}
        refreshControl={
          <RefreshControl
            colors={[palette.orange]}
            onRefresh={() => {
              Haptics.selectionAsync();
              setNetworkReloadKey((key) => key + 1);
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
            {/* The place is tappable: search any area, mall or hawker centre to see its food. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change location. ${
                needsDiscoverAreaChoice
                  ? `Picks across ${discoverHeaderLabel}`
                  : `${hasManualAreaPick ? "Showing food in" : "You are at"} ${discoverHeaderLabel}`
              }`}
              accessibilityHint="Opens a search for an area, mall or hawker centre"
              hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
              onPress={() =>
                navigation.navigate("OnboardingStack", {
                  screen: "ManualLocationPicker",
                  params: { mode: "settings" },
                })
              }
              style={{ flex: 1, minHeight: 44, justifyContent: "center" }}
            >
              {/* A small line over the place name, so the name itself fits beside List / Map:
                  "Across Singapore" as one title was cut to "Across Singap..." at 390 pt. */}
              <AppText variant="bodySmall" style={{ color: themeTints.secondaryText }}>
                {needsDiscoverAreaChoice
                  ? "Picks across"
                  : hasManualAreaPick
                    ? "Showing food in"
                    : "You are at"}
              </AppText>
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
                {/* The place slides to the new name when the diner moves or picks another area. */}
                <SlideText
                  value={discoverHeaderLabel}
                  variant="h2"
                  style={{ color: themeTints.text }}
                  numberOfLines={1}
                  containerStyle={{ flexShrink: 1 }}
                />
                <AppSymbol
                  name="chevron.down"
                  fallback={ChevronDown}
                  color={themeTints.isDark ? palette.white : palette.textMuted}
                  size={20}
                />
              </View>
            </Pressable>
            {/* Every signed-in diner can switch Discover to the map (when the map ships). */}
            {FEATURE_FLAGS.mapEnabled ? (
              <SavedViewSwitch
                accessibilityLabel="Show Home as a list or on a map"
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
              style={({ pressed }) => ({
                justifyContent: "center",
                minHeight: 44,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                Turn on location for stalls near you
              </AppText>
            </Pressable>
          ) : null}
          {needsDiscoverAreaChoice ? (
            <UsualAreaChips
              areas={usualAreas}
              onPick={(area) => {
                trackAnalyticsEvent("home_usual_area_picked", { area_id: area.id });
                setManualSelection(area.name, area.coordinate);
              }}
            />
          ) : null}
          {
            needsDiscoverAreaChoice ||
            isFeedFallbackEmpty ||
            shownCountLabel === null ? null : shownCountLabel !== "0" ? (
              <View style={{ alignItems: "baseline", flexDirection: "row" }}>
                {/* Only the number rolls when the count changes; it stays put while it reloads. */}
                <NumericText
                  value={shownCountLabel}
                  variant="micro"
                  style={{ color: themeTints.secondaryText }}
                />
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  {` stalls ${discoverAreaName ? "in this area" : "near you"}`}
                </AppText>
              </View>
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
              <AppSymbol
                name="magnifyingglass"
                fallback={Search}
                color={themeTints.isDark ? palette.white : palette.textMuted}
                size={19}
              />
            </View>
          </Pressable>
        </View>

        {discoverLoadError || isFeedFallbackEmpty ? (
          <EmptyState
            title="Couldn't load Discover"
            body="Check your connection and try again."
            icon={
              <AppSymbol
                name="exclamationmark.magnifyingglass"
                fallback={SearchX}
                color={palette.textSecondary}
                size={28}
              />
            }
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
          renderLeftIcon={(chip, isActive) => (
            <DiscoverChipIcon
              chipId={chip.id}
              color={isActive ? palette.orange : themeTints.secondaryText}
            />
          )}
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
            onPickArea={(area) => setManualSelection(area.name, area.coordinate)}
          />
        ) : null}

        {/* The meal-picks push, offered after the first save or tried (not in onboarding). */}
        {hasDiscoverContent && isFocused ? <MealPicksCard horizontalPadding={0} /> : null}

        {/* Next stamp (or weekly goal): always something within reach. Off with the
            achievements_loop_v1 kill switch. */}
        {hasDiscoverContent ? (
          <NextStampCard
            visible={isFocused}
            onOpenPassport={() => navigation.navigate("PassportScreen")}
          />
        ) : null}

        {isFilteredPageEmpty ? (
          <EmptyState
            title="No matching results"
            body={filteredEmptyBody}
            icon={
              <AppSymbol
                name="exclamationmark.magnifyingglass"
                fallback={SearchX}
                color={palette.textSecondary}
                size={28}
              />
            }
            ctaLabel={filteredEmptyCtaLabel}
            onPress={clearDiscoverFilters}
          />
        ) : null}

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
                <AppSymbol
                  name="dice"
                  fallback={Dices}
                  color={palette.textOnOrange}
                  size={decisionCardIconGraphicSize}
                />
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
              onPress={() => navigateOnce(navigation, "WheelStack", { screen: "WheelHome" })}
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
                <AppSymbol
                  name="person.2"
                  fallback={Users}
                  color={themeTints.text}
                  size={decisionCardIconGraphicSize}
                />
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
          <>
            {/* In a mall, "For you" and "What's here" are two sections of the page, not two buttons. */}
            <View style={{ gap: discoverContentGap }} testID="for-you-list">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`See all dishes at ${currentPlace.name}`}
                hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
                onPress={() =>
                  navigation.navigate("SearchResults", {
                    browseMode: "dishes",
                    placeId: currentPlace.id,
                    placeName: currentPlace.name,
                  })
                }
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: spacing[2],
                  minHeight: 44,
                }}
              >
                <AppText variant="h2" style={{ color: themeTints.text, flexShrink: 1 }}>
                  {forYouTitle}
                </AppText>
                <AppSymbol
                  name="chevron.right"
                  fallback={ChevronRight}
                  color={themeTints.isDark ? palette.white : palette.textMuted}
                  size={20}
                />
              </Pressable>
              {forYouPicks.length ? (
                <RailScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={edgeToEdgeHorizontalScrollStyle}
                  contentContainerStyle={{ gap: spacing[3] }}
                >
                  {forYouPicks.map((pick) => (
                    <ForYouCard
                      key={pick.dish.id}
                      pick={pick}
                      width={mallCardWidth}
                      onPressIn={() => prefetchDishDetail(pick.dish.id, repository)}
                      onPress={() =>
                        navigation.navigate("DishDetail", {
                          dishId: pick.dish.id,
                          source: "home_pick",
                          prefill: dishPrefillFrom(pick.dish),
                        })
                      }
                    />
                  ))}
                </RailScrollView>
              ) : (
                <EmptyState
                  title="Nothing to suggest yet"
                  body="Adjust your dietary needs to see more."
                  {...(isDiscoverFiltering
                    ? { ctaLabel: "Clear filters", onPress: clearDiscoverFilters }
                    : {})}
                />
              )}
            </View>
            {isDiscoverFiltering && hereStalls.length === 0 ? (
              <EmptyState
                title="No matching results"
                body="No stalls here match your filters."
                icon={
                  <AppSymbol
                    name="exclamationmark.magnifyingglass"
                    fallback={SearchX}
                    color={palette.textSecondary}
                    size={28}
                  />
                }
                ctaLabel="Clear filters"
                onPress={clearDiscoverFilters}
              />
            ) : (
              <WhatsHerePanel
                placeName={currentPlace.name}
                stalls={hereStalls}
                onSeeAll={() =>
                  navigation.navigate("SearchResults", {
                    browseMode: "stalls",
                    placeId: currentPlace.id,
                    placeName: currentPlace.name,
                  })
                }
                renderStalls={(visibleStalls) => {
                  const visibleIds = new Set(visibleStalls.map((stall) => stall.venue.id));
                  return renderStallRail(
                    unfilteredAreaStallCards.filter((card) => visibleIds.has(card.venue.id)),
                  );
                }}
              />
            )}
          </>
        ) : (
          <>
            {personalFirst ? nearYouRail : null}
            {personalFirst && classicsSlot === "afterNearYou" ? classicsSection : null}
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

        {inMallMode && currentPlace ? (
          // The food around the mall too, so being inside one never limits Home to its stalls.
          <>
            <TrendingList
              title={`Most reviewed ${discoverAreaPhrase}`}
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
            {stallsAroundPlace.length ? (
              <View style={{ gap: discoverContentGap }} testID="stalls-around-place">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`See more stalls near ${currentPlace.name}`}
                  hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
                  onPress={() => navigation.navigate("BrowseStalls")}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing[2],
                    minHeight: 44,
                  }}
                >
                  <AppText variant="h2" style={{ color: themeTints.text, flexShrink: 1 }}>
                    {`More near ${currentPlace.name}`}
                  </AppText>
                  <AppSymbol
                    name="chevron.right"
                    fallback={ChevronRight}
                    color={themeTints.isDark ? palette.white : palette.textMuted}
                    size={20}
                  />
                </Pressable>
                {renderStallRail(stallsAroundPlace)}
              </View>
            ) : null}
          </>
        ) : null}

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
                    <AppSymbol
                      name="flame.fill"
                      fallback={Flame}
                      color={palette.textOnOrange}
                      size={22}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                      Daily crave
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      Swipe to build your taste profile
                    </AppText>
                  </View>
                  <AppSymbol
                    name="chevron.right"
                    fallback={ChevronRight}
                    color={themeTints.isDark ? palette.white : palette.textMuted}
                    size={20}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* Rails: each is the same memoised rail over its own collection. */}
            {personalFirst ? null : nearYouRail}
            {!personalFirst && classicsSlot === "afterNearYou" ? classicsSection : null}

            {networkPicks.length > 0 && !isDiscoverFiltering ? (
              <NetworkPicksSection
                picks={networkPicks}
                cardWidth={stallRailCardWidth}
                gap={discoverContentGap}
                scrollStyle={edgeToEdgeHorizontalScrollStyle}
                onOpen={(pick, position) => {
                  trackAnalyticsEvent("network_pick_opened", { source: pick.source, position });
                  navigation.navigate("StallDetail", { venueId: pick.venueId });
                }}
              />
            ) : null}

            {shouldRenderDiscoverRail(editorChoiceCards.length, MIN_DISCOVER_RAIL_ITEMS) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                rail="editorChoice"
                title="Top rated"
                titleBadge={<DiscoverRailBadge label="4.4+" showStar tone="accent" />}
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

            {mealPeriod !== "lateNight" &&
            shouldRenderDiscoverRail(mealRailCards.length, personalRailMin) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                canSeeAll={false}
                rail="quickBites"
                title={MEAL_RAILS[mealPeriod].title}
                seeAllLabel={MEAL_RAILS[mealPeriod].seeAllLabel}
                cards={mealRailCards}
                variant="rating"
                buttonId="meal_time_bite_card"
                getCardLabel={getBiteLabel}
              />
            ) : null}

            {similarRail && shouldRenderDiscoverRail(similarRail.cards.length, personalRailMin) ? (
              <DiscoverBiteRail
                {...discoverRailProps}
                onPrefetchCollection={() => undefined}
                onSeeAll={() => openDishSearch(similarRail.dishName)}
                rail="quickBites"
                title={`More like ${toTitleCase(similarRail.dishName)}`}
                seeAllLabel={`See dishes like ${similarRail.dishName}`}
                cards={similarRail.cards}
                variant="rating"
                buttonId="similar_dish_bite_card"
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
                        : "See all stalls"
                    }
                    hitSlop={DISCOVER_TEXT_LINK_HIT_SLOP}
                    onPress={() =>
                      navigation.navigate(
                        "SearchResults",
                        isUserMode && currentPlace
                          ? {
                              browseMode: "stalls",
                              placeId: currentPlace.id,
                              placeName: currentPlace.name,
                            }
                          : { browseMode: "stalls" },
                      )
                    }
                    style={{
                      alignItems: "center",
                      flex: 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: spacing[2],
                      minHeight: 44,
                    }}
                  >
                    <AppText variant="h2" style={{ color: themeTints.text, flexShrink: 1 }}>
                      {placeStallCardCount > 0 && currentPlace
                        ? `Stalls at ${currentPlace.name}`
                        : `Stalls ${discoverAreaPhrase}`}
                    </AppText>
                    <AppSymbol
                      name="chevron.right"
                      fallback={ChevronRight}
                      color={themeTints.isDark ? palette.white : palette.textMuted}
                      size={20}
                    />
                  </Pressable>
                </View>
                <View style={{ gap: discoverContentGap }}>
                  {showDiscoverFilterRailSkeleton ? (
                    <DiscoverStallListLoadingSkeleton />
                  ) : areaStallCards.length ? (
                    renderStallRail(areaStallCards)
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

            {showDiscoverFilterRailSkeleton ? (
              <VerticalStallShowcaseLoadingSkeleton
                areaPhrase={discoverAreaPhrase}
                cardWidth={stallShowcaseCardWidth}
                pageHeight={stallShowcasePageHeight}
              />
            ) : stallShowcaseCards.length ? (
              <VerticalStallShowcaseSection
                cards={stallShowcaseCards}
                areaPhrase={discoverAreaPhrase}
                pageHeight={stallShowcasePageHeight}
                cardWidth={stallShowcaseCardWidth}
                onOpenCard={openStallShowcaseCard}
                onPrefetchCard={prefetchStallShowcaseCard}
              />
            ) : null}
          </>
        )}
        {moreSections}
        {/* The feedback ask comes after the food, so the first screen is all food (round six). */}
        <HomeFeedbackCard />
      </ScrollView>
    </Screen>
  );
}
