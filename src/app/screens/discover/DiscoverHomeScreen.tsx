import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronRight,
  Compass,
  MapPinned,
  Search,
  SearchX,
  Shuffle,
  Star,
  Flame,
  Dices,
  Utensils,
  Zap,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Chip, EmptyState, IconButton, Screen, Skeleton } from "@/components/ui";
import { getDiscoverBiteCollection } from "@/features/discover/bites";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { getNearestBuildings, getNearestSingaporeArea } from "@/lib/geo/singaporeBuildings";
import { toRecommendationGeoCell } from "@/lib/geo/recommendationGeoCell";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useDelayedLoadingSkeleton } from "@/hooks/useDelayedLoadingSkeleton";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import { useHungryTheme } from "@/theme";
import type { DietaryFlag, DishDetail, SearchCategory, VenueSummary } from "@/types/domain";

type DiscoverChipId = "dietary" | "spicy" | "halal" | "late" | "cheap";

const INTENT_CHIPS: readonly {
  id: Exclude<DiscoverChipId, "dietary">;
  label: string;
  category: SearchCategory;
}[] = [
  { id: "spicy", label: "Spicy", category: "local favourites" },
  { id: "halal", label: "Halal", category: "rice" },
  { id: "late", label: "Late night", category: "late night" },
  { id: "cheap", label: "Value", category: "noodles" },
] as const;

const DISCOVER_DIETARY_FALLBACKS: readonly DietaryFlag[] = ["halal", "vegetarian", "pork_free"];

const STALLS_CARD_GRAPHIC = require("../../../assets/discover/stalls-restaurants-card-wide.png");
const DISHES_CARD_GRAPHIC = require("../../../assets/discover/dishes-card-wide.png");
const POPULAR_LAKSA_GRAPHIC = require("../../../assets/discover/popular-laksa-topdown.png");
const POPULAR_CHICKEN_RICE_GRAPHIC = require("../../../assets/discover/popular-chicken-rice-topdown.png");
const POPULAR_CHAR_KWAY_TEOW_GRAPHIC = require("../../../assets/discover/popular-char-kway-teow-topdown.png");
const POPULAR_BAK_CHOR_MEE_GRAPHIC = require("../../../assets/discover/popular-bak-chor-mee-topdown.png");

type PopularFoodStyle = {
  id: string;
  label: string;
  query: string;
  dishId?: string;
  imageSource?: number;
  fallbackImageUrl?: string;
  trending?: boolean;
};

const POPULAR_FOOD_STYLES: readonly PopularFoodStyle[] = [
  {
    id: "laksa",
    label: "Laksa",
    query: "Laksa",
    dishId: "dish-laksa",
    imageSource: POPULAR_LAKSA_GRAPHIC,
    trending: true,
  },
  {
    id: "chicken-rice",
    label: "Chicken Rice",
    query: "Chicken Rice",
    dishId: "dish-chicken-rice",
    imageSource: POPULAR_CHICKEN_RICE_GRAPHIC,
  },
  {
    id: "char-kway-teow",
    label: "Char Kway Teow",
    query: "Char Kway Teow",
    imageSource: POPULAR_CHAR_KWAY_TEOW_GRAPHIC,
    trending: true,
  },
  {
    id: "bak-chor-mee",
    label: "Bak Chor Mee",
    query: "Bak Chor Mee",
    imageSource: POPULAR_BAK_CHOR_MEE_GRAPHIC,
  },
] as const;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

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

function FoodStyleButton({
  imageSource,
  label,
  trending,
  onPress,
}: {
  imageSource: string | number;
  label: string;
  trending?: boolean;
  onPress: () => void;
}) {
  const { palette, radii, spacing, shadows, typography } = useHungryTheme();
  const bowlSize = 72;
  const labelGap = spacing[1.5];
  const buttonHeight = bowlSize + labelGap + typography.bodySmallBold.lineHeight * 2;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Search for ${label}`}
      onPress={onPress}
      style={{ alignItems: "center", height: buttonHeight, width: 88 }}
    >
      <View
        style={[
          shadows.card,
          {
            width: bowlSize,
            height: bowlSize,
            borderRadius: radii.pill,
            borderWidth: trending ? 3 : 1,
            borderColor: trending ? palette.orange : palette.border,
            backgroundColor: palette.surfaceRaised,
            overflow: "hidden",
          },
        ]}
      >
        <Image
          source={typeof imageSource === "string" ? { uri: imageSource } : imageSource}
          style={{ width: "100%", height: "100%", borderRadius: radii.pill }}
          contentFit="cover"
        />
      </View>
      <AppText
        variant="bodySmallBold"
        numberOfLines={2}
        style={{
          color: palette.text,
          marginTop: labelGap,
          minHeight: typography.bodySmallBold.lineHeight * 2,
          textAlign: "center",
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

function PopularFoodStyleSkeleton() {
  const { palette, radii, spacing, shadows, typography } = useHungryTheme();
  const bowlSize = 72;
  const labelGap = spacing[1.5];
  const buttonHeight = bowlSize + labelGap + typography.bodySmallBold.lineHeight * 2;

  return (
    <>
      {[0, 1, 2, 3].map((slot) => (
        <View
          key={`popular-food-loading-${slot}`}
          style={{ alignItems: "center", height: buttonHeight, width: 88 }}
        >
          <View
            style={[
              shadows.card,
              {
                alignItems: "center",
                backgroundColor: palette.surfaceRaised,
                borderColor: palette.border,
                borderRadius: radii.pill,
                borderWidth: 1,
                height: bowlSize,
                justifyContent: "center",
                width: bowlSize,
              },
            ]}
          >
            <Skeleton width={bowlSize - 10} height={bowlSize - 10} borderRadius={radii.pill} />
          </View>
          <View
            style={{
              gap: spacing[1],
              marginTop: labelGap,
              minHeight: typography.bodySmallBold.lineHeight * 2,
            }}
          >
            <Skeleton width={70} height={14} borderRadius={radii.sm} />
            <Skeleton width={54} height={14} borderRadius={radii.sm} />
          </View>
        </View>
      ))}
    </>
  );
}

function FilteredResultsEmptyState({
  preserveHeight,
  minHeight,
}: {
  preserveHeight?: boolean;
  minHeight?: number;
}) {
  const { palette } = useHungryTheme();
  return (
    <View
      style={
        preserveHeight && minHeight
          ? {
              alignItems: "center",
              minHeight,
              justifyContent: "center",
              paddingTop: 0,
              paddingBottom: 0,
            }
          : undefined
      }
    >
      <EmptyState
        title="No matching results"
        body="Try removing a filter or choosing a broader category."
        icon={<SearchX color={palette.textSecondary} size={28} />}
      />
    </View>
  );
}

function NoFoodSectionEmptyState({ title }: { title: string }) {
  const { palette } = useHungryTheme();
  return (
    <EmptyState
      title={title}
      body={"No food found for this section right now.\nTry again later or adjust your filters."}
      icon={<SearchX color={palette.textSecondary} size={28} />}
    />
  );
}

function HalalLogoIcon({ color }: { color: string }) {
  return (
    <AppText
      variant="micro"
      style={{
        color,
        fontWeight: "800",
        includeFontPadding: false,
      }}
    >
      حلال
    </AppText>
  );
}

export function DiscoverHomeScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing, semanticSpacing, shadows, motion, colorScheme, typography } =
    useHungryTheme();
  const discoverRailCardWidth = screenWidth * 0.55;
  const discoverRailImageHeight = 130;
  const decisionCardWidth = (screenWidth - spacing[8] - spacing[3]) / 2;
  const popularFoodButtonHeight = 72 + spacing[1.5] + typography.bodySmallBold.lineHeight * 2;
  const edgeToEdgeHorizontalScrollStyle = {
    width: screenWidth,
  };
  const profile = useProfileStore((state) => state.profile);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  const grantLocation = useLocationStore((state) => state.grantLocation);

  useEffect(() => {
    if (locationPermission !== "granted" && !manualLocation) {
      void grantLocation();
    }
  }, [locationPermission, manualLocation, grantLocation]);

  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const refreshPopularNearby = useDiscoveryStore((state) => state.refreshPopularNearby);
  const cacheRecommendationSlate = useDiscoveryStore((state) => state.cacheRecommendationSlate);
  const getCachedRecommendationSlate = useDiscoveryStore(
    (state) => state.getCachedRecommendationSlate,
  );
  const pruneExpiredRecommendations = useDiscoveryStore(
    (state) => state.pruneExpiredRecommendations,
  );

  useEffect(() => {
    void refreshPopularNearby();
  }, [refreshPopularNearby]);
  const updateSearchQuery = useSearchStore((state) => state.updateQuery);
  const rememberSearch = useSearchStore((state) => state.rememberSearch);
  const searchBarWidth = useMemo(
    () => Math.max(screenWidth - spacing[4] * 2, 240),
    [screenWidth, spacing],
  );
  const searchIconSize = 52;
  const openSearchHome = useCallback(() => {
    navigation.navigate("SearchHome");
  }, [navigation]);

  const [activeDiscoverChipIds, setActiveDiscoverChipIds] = useState<DiscoverChipId[]>([]);
  const isDiscoverFiltering = activeDiscoverChipIds.length > 0;

  const areaBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const discoverLocationLabel =
    manualLocation ?? getNearestSingaporeArea(currentLocation.latitude, currentLocation.longitude);

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

  const sortedChips = useMemo(() => {
    const baseChips = [
      { id: "dietary" as const, label: "Dietary Needs", category: "dietary" },
      ...INTENT_CHIPS,
    ];
    const hour = new Date().getHours();
    const prioritizeLateNight = hour >= 22 || hour < 4;
    if (prioritizeLateNight) {
      return baseChips.sort((a, b) => (a.id === "late" ? -1 : b.id === "late" ? 1 : 0));
    }
    return baseChips;
  }, []);

  // ─── Idle Pulse Animation (Psychological Nudge) ───────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  const startPulse = useCallback(() => {
    setIsPulsing(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: motion.idlePulse,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: motion.idlePulse,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim, motion.idlePulse]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isPulsing) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      setIsPulsing(false);
    }
    idleTimerRef.current = setTimeout(() => {
      startPulse();
    }, 7000); // 7 seconds of inactivity
  }, [isPulsing, pulseAnim, startPulse]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);
  const allDiscoverVenues = useMemo(
    () =>
      repository
        .listBuildings()
        .flatMap((building) => repository.listVenuesByBuilding(building.id)),
    [repository],
  );
  const areaVenues = useMemo(() => {
    const scopedVenues = areaBuildings.flatMap((building) =>
      repository.listVenuesByBuilding(building.id),
    );
    const uniqueVenues = new Map(scopedVenues.map((venue) => [venue.id, venue]));
    return uniqueVenues.size ? Array.from(uniqueVenues.values()) : allDiscoverVenues;
  }, [allDiscoverVenues, areaBuildings, repository]);
  const allDiscoverDishes = useMemo(
    () => allDiscoverVenues.flatMap((venue) => repository.listDishesByVenue(venue.id)),
    [allDiscoverVenues, repository],
  );
  const areaDishes = useMemo(
    () => areaVenues.flatMap((venue) => repository.listDishesByVenue(venue.id)),
    [areaVenues, repository],
  );
  const areaDishPool = areaDishes.length ? areaDishes : allDiscoverDishes;
  const currentHour = new Date().getHours();
  const isLateNightMakanVisible = currentHour >= 21 || currentHour < 4;
  const discoverDietaryFlags = useMemo(
    () =>
      profile.dietaryPreferences.length ? profile.dietaryPreferences : DISCOVER_DIETARY_FALLBACKS,
    [profile.dietaryPreferences],
  );
  const toggleDiscoverChip = useCallback((chipId: DiscoverChipId) => {
    setActiveDiscoverChipIds((current) =>
      current.includes(chipId) ? current.filter((value) => value !== chipId) : [...current, chipId],
    );
  }, []);
  const matchesDiscoverChipSelection = useCallback(
    (dish?: DishDetail, textParts: string[] = []) => {
      if (!activeDiscoverChipIds.length) {
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

      return activeDiscoverChipIds.every((chipId) => {
        if (chipId === "dietary") {
          return dish
            ? discoverDietaryFlags.some((flag) => dish.dietaryFlags.includes(flag))
            : false;
        }
        if (chipId === "halal") {
          if (dish?.dietaryFlags.includes("halal")) {
            return true;
          }
          return getLateNightHaystack().includes("halal");
        }
        if (chipId === "spicy") {
          return (
            Boolean(dish && dish.tasteVector.spicy >= 6) || getLateNightHaystack().includes("spicy")
          );
        }
        if (chipId === "late") {
          const haystack = getLateNightHaystack();
          return (
            haystack.includes("late") || haystack.includes("satay") || haystack.includes("mala")
          );
        }
        if (chipId === "cheap") {
          return Boolean(dish && dish.price < 8);
        }
        return true;
      });
    },
    [activeDiscoverChipIds, discoverDietaryFlags],
  );
  const discoverBiteCollections = useMemo(
    () => ({
      quickBites: getDiscoverBiteCollection("quickBites"),
      trending: getDiscoverBiteCollection("trending"),
      editorChoice: getDiscoverBiteCollection("editorChoice"),
      budget: getDiscoverBiteCollection("budget"),
      lateNight: getDiscoverBiteCollection("lateNight"),
    }),
    [],
  );
  const getBiteDish = useCallback(
    (bite: ReturnType<typeof getDiscoverBiteCollection>[number]) =>
      repository.getDishById(bite.dishId),
    [repository],
  );
  const unfilteredQuickBiteCards = useMemo(
    () => discoverBiteCollections.quickBites.slice(0, 6),
    [discoverBiteCollections.quickBites],
  );
  const unfilteredTrendingCards = useMemo(
    () => discoverBiteCollections.trending.slice(0, 6),
    [discoverBiteCollections.trending],
  );
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
    (bites: ReturnType<typeof getDiscoverBiteCollection>[number][]) =>
      bites.filter((bite) =>
        matchesDiscoverChipSelection(getBiteDish(bite), [
          bite.dishName,
          bite.venueName,
          bite.caption,
        ]),
      ),
    [getBiteDish, matchesDiscoverChipSelection],
  );
  const quickBiteCards = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(unfilteredQuickBiteCards)
        : unfilteredQuickBiteCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredQuickBiteCards],
  );
  const trendingCards = useMemo(
    () =>
      isDiscoverFiltering ? filterDiscoverBites(unfilteredTrendingCards) : unfilteredTrendingCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredTrendingCards],
  );
  const editorChoiceCards = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(unfilteredEditorChoiceCards)
        : unfilteredEditorChoiceCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredEditorChoiceCards],
  );
  const budgetCards = useMemo(
    () =>
      isDiscoverFiltering ? filterDiscoverBites(unfilteredBudgetCards) : unfilteredBudgetCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredBudgetCards],
  );
  const lateNightCards = useMemo(
    () =>
      isDiscoverFiltering
        ? filterDiscoverBites(unfilteredLateNightCards)
        : unfilteredLateNightCards,
    [filterDiscoverBites, isDiscoverFiltering, unfilteredLateNightCards],
  );
  const unfilteredPopularFoodStyleItems = useMemo(
    () =>
      POPULAR_FOOD_STYLES.map((style) => {
        const dish = style.dishId ? repository.getDishById(style.dishId) : undefined;
        return {
          ...style,
          imageSource: style.imageSource ?? dish?.imageUrl ?? style.fallbackImageUrl,
          imageUrl: dish?.imageUrl ?? style.fallbackImageUrl,
          dish,
        };
      }).filter(
        (
          style,
        ): style is PopularFoodStyle & {
          imageSource: string | number;
          imageUrl: string | undefined;
          dish: DishDetail | undefined;
        } => Boolean(style.imageSource),
      ),
    [repository],
  );
  const popularFoodStyleItems = useMemo(
    () =>
      isDiscoverFiltering
        ? unfilteredPopularFoodStyleItems.filter((style) =>
            matchesDiscoverChipSelection(style.dish, [style.label, style.query]),
          )
        : unfilteredPopularFoodStyleItems,
    [isDiscoverFiltering, matchesDiscoverChipSelection, unfilteredPopularFoodStyleItems],
  );
  const isWaitingForPopularFoodStyles = !isDiscoverFiltering && popularFoodStyleItems.length === 0;
  const showPopularFoodSkeleton = useDelayedLoadingSkeleton(isWaitingForPopularFoodStyles);
  const unfilteredAreaStallCards = useMemo(
    () =>
      (areaBuildings.length ? areaBuildings : repository.listBuildings())
        .map((building) => {
          const venues = repository.listVenuesByBuilding(building.id);
          const venue = venues[0];
          const topDish = venue ? repository.getDishById(venue.topDishId) : undefined;
          return venue ? { building, venue, topDish } : null;
        })
        .filter(Boolean) as {
        building: any;
        venue: VenueSummary;
        topDish: DishDetail | undefined;
      }[],
    [areaBuildings, repository],
  );
  const areaStallCards = useMemo(
    () =>
      isDiscoverFiltering
        ? unfilteredAreaStallCards.filter(({ venue, topDish }) =>
            matchesDiscoverChipSelection(topDish, [venue.name]),
          )
        : unfilteredAreaStallCards,
    [isDiscoverFiltering, matchesDiscoverChipSelection, unfilteredAreaStallCards],
  );
  const discoverAreaCount =
    areaVenues.length || areaBuildings.length || repository.listBuildings().length;
  const handleDecideForMe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const radiusMeters = 500;
    trackAnalyticsEvent("decide_for_me_triggered", {
      location_granted: locationPermission === "granted",
      radius_m: radiusMeters,
    });

    const geoCell = toRecommendationGeoCell(currentLocation.latitude, currentLocation.longitude);
    pruneExpiredRecommendations();

    const cachedDishIds = getCachedRecommendationSlate(geoCell);
    const cachedDishes = (cachedDishIds ?? [])
      .map((dishId) => repository.getDishById(dishId))
      .filter((dish): dish is DishDetail => Boolean(dish));

    let picked = repository.getDecideForMe(profile.tasteVector, {
      dietaryFlags: profile.dietaryPreferences,
      neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
      radiusMeters,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      excludeDishIds: [],
    });

    if (!picked && cachedDishes.length) {
      picked = cachedDishes[0];
    }

    if (!cachedDishes.length) {
      const liveSlate = repository
        .searchDishes(
          {
            query: "",
            categories: [],
            dietaryFlags: profile.dietaryPreferences,
            tasteValues: profile.tasteVector,
            radius: radiusMeters,
          },
          profile.tasteVector,
        )
        .slice(0, 20);

      if (liveSlate.length) {
        cacheRecommendationSlate(
          geoCell,
          liveSlate.map((dish) => dish.id),
        );
        if (!picked) {
          picked = liveSlate[0];
        }
      }
    }

    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  };

  const handleFoodStylePress = useCallback(
    (query: string) => {
      updateSearchQuery(query);
      rememberSearch(query);
      navigation.navigate("SearchResults", {
        browseMode: "stalls",
        initialQuery: query,
      });
    },
    [navigation, rememberSearch, updateSearchQuery],
  );

  return (
    <Screen scroll={false} fullWidth style={{ backgroundColor: themeTints.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: semanticSpacing.sectionGap - spacing[1],
          paddingHorizontal: semanticSpacing.screenEdge,
        }}
        onScroll={resetIdleTimer}
        scrollEventThrottle={16}
      >
        {/* Dynamic Location Header */}
        <View style={{ paddingTop: spacing[1] }}>
          <AppText
            variant="micro"
            style={{
              color: themeTints.isDark ? palette.white : palette.orange,
              letterSpacing: 1,
              marginBottom: 0,
              opacity: 0.8,
            }}
          >
            YOU ARE AT
          </AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="h1" style={{ color: themeTints.text }} numberOfLines={1}>
                {discoverLocationLabel}
              </AppText>
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                {`${discoverAreaCount} places in this area`}
              </AppText>
            </View>
            <View style={{ marginTop: -spacing[0.5] }}>
              <IconButton
                variant="ghost"
                accessibilityLabel="Open map view"
                size={spacing[8] + spacing[2.5]}
                onPress={() => navigation.navigate("DiscoverMap")}
                icon={
                  <MapPinned color={themeTints.isDark ? palette.white : palette.orange} size={20} />
                }
              />
            </View>
          </View>
        </View>

        {/* Search Bar Entry */}
        <View style={{ alignItems: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search dishes, stalls, or hawker centres"
            onPress={openSearchHome}
            style={{
              width: searchBarWidth,
              borderRadius: radii.lg,
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
              <AppText variant="bodySmall" style={{ color: themeTints.secondaryText }}>
                Dishes, stalls, or hawker centres…
              </AppText>
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

        {/* Intent Chips with Icons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={edgeToEdgeHorizontalScrollStyle}
          contentContainerStyle={{ gap: spacing[2] }}
        >
          {sortedChips.map((chip) => {
            const isActive = activeDiscoverChipIds.includes(chip.id);
            return (
              <Chip
                key={chip.id}
                label={chip.label}
                selected={isActive}
                onPress={() => toggleDiscoverChip(chip.id)}
                leftIcon={
                  chip.id === "dietary" ? (
                    <Utensils
                      size={14}
                      color={isActive ? palette.orange : themeTints.secondaryText}
                    />
                  ) : chip.id === "spicy" ? (
                    <Flame size={14} color={isActive ? palette.orange : themeTints.secondaryText} />
                  ) : chip.id === "halal" ? (
                    <HalalLogoIcon color={isActive ? palette.orange : themeTints.secondaryText} />
                  ) : chip.id === "late" ? (
                    <Compass
                      size={14}
                      color={isActive ? palette.orange : themeTints.secondaryText}
                    />
                  ) : (
                    <Utensils
                      size={14}
                      color={isActive ? palette.orange : themeTints.secondaryText}
                    />
                  )
                }
              />
            );
          })}
        </ScrollView>

        {/* Popular food style buttons */}
        <View style={{ gap: spacing[2] }}>
          <AppText variant="h2" style={{ color: themeTints.text }}>
            Popular right now
          </AppText>
          {!popularFoodStyleItems.length && showPopularFoodSkeleton ? (
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
                <FoodStyleButton
                  key={item.id}
                  imageSource={item.imageSource}
                  label={item.label}
                  trending={item.trending}
                  onPress={() => handleFoodStylePress(item.query)}
                />
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState preserveHeight minHeight={popularFoodButtonHeight} />
          ) : null}
        </View>

        {/* Decision action chips */}
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decide for me"
            onPress={() => navigation.navigate("DecideForMeResult")}
            style={({ pressed }) => [
              shadows.card,
              {
                borderRadius: radii.lg,
                height: 72,
                opacity: pressed ? 0.92 : 1,
                overflow: "hidden",
                width: decisionCardWidth,
              },
            ]}
          >
            <LinearGradient
              colors={["#E8531E", "#F59E0B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                alignItems: "center",
                borderRadius: radii.lg,
                flexDirection: "row",
                gap: spacing[2],
                height: "100%",
                padding: spacing[3],
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: radii.pill,
                  height: 36,
                  justifyContent: "center",
                  width: 36,
                }}
              >
                <Dices color={palette.white} size={20} />
              </View>
              <AppText variant="bodyBold" tone="inverse" numberOfLines={2} style={{ flex: 1 }}>
                Decide for Me
              </AppText>
            </LinearGradient>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open hungry wheel"
            onPress={() => navigation.navigate("WheelStack", { screen: "WheelHome" })}
            style={({ pressed }) => [
              shadows.card,
              {
                alignItems: "center",
                backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.08)" : palette.navy,
                borderRadius: radii.lg,
                flexDirection: "row",
                gap: spacing[2],
                height: 72,
                opacity: pressed ? 0.92 : 1,
                padding: spacing[3],
                width: decisionCardWidth,
              },
            ]}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: radii.pill,
                height: 36,
                justifyContent: "center",
                width: 36,
              }}
            >
              <Compass color={palette.white} size={20} />
            </View>
            <AppText variant="bodyBold" tone="inverse" numberOfLines={2} style={{ flex: 1 }}>
              Hungry Wheel
            </AppText>
          </Pressable>
        </View>

        {/* Discovery Targets — two large tap targets */}
        <View style={{ gap: spacing[3] }}>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse stalls and restaurants"
              onPress={() => navigation.navigate("BrowseStalls")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.08)" : palette.bgSoft,
                  borderRadius: radii.lg,
                  flex: 1,
                  overflow: "hidden",
                  borderWidth: themeTints.isDark ? 0 : 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <View>
                <Image
                  source={STALLS_CARD_GRAPHIC}
                  style={{ aspectRatio: 1.55, width: "100%" }}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={["rgba(15,23,42,0)", "rgba(15,23,42,0.68)"]}
                  style={{
                    bottom: 0,
                    left: 0,
                    padding: spacing[3],
                    position: "absolute",
                    right: 0,
                  }}
                >
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "rgba(15, 23, 42, 0.34)",
                      borderColor: "rgba(255, 255, 255, 0.16)",
                      borderRadius: radii.sm,
                      borderWidth: 1,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="bodyBold" tone="inverse" numberOfLines={2}>
                      Stalls & Restaurants
                    </AppText>
                  </View>
                </LinearGradient>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse dishes"
              onPress={() => navigation.navigate("BrowseDishes")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.08)" : palette.bgSoft,
                  borderRadius: radii.lg,
                  flex: 1,
                  overflow: "hidden",
                  borderWidth: themeTints.isDark ? 0 : 1,
                  borderColor: palette.border,
                },
              ]}
            >
              <View>
                <Image
                  source={DISHES_CARD_GRAPHIC}
                  style={{ aspectRatio: 1.55, width: "100%" }}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={["rgba(15,23,42,0)", "rgba(15,23,42,0.68)"]}
                  style={{
                    bottom: 0,
                    left: 0,
                    padding: spacing[3],
                    position: "absolute",
                    right: 0,
                  }}
                >
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "rgba(15, 23, 42, 0.34)",
                      borderColor: "rgba(255, 255, 255, 0.16)",
                      borderRadius: radii.sm,
                      borderWidth: 1,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="bodyBold" tone="inverse" numberOfLines={1}>
                      Dishes
                    </AppText>
                  </View>
                </LinearGradient>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Proactive Selection */}
        <View style={{ gap: spacing[3] }}>
          {/* Daily Crave */}
          {FEATURE_FLAGS.craveEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open daily crave"
              onPress={() => navigation.navigate("Crave")}
              style={[
                shadows.card,
                {
                  backgroundColor: themeTints.isDark ? "rgba(255,255,255,0.05)" : palette.bgSoft,
                  borderRadius: radii.lg,
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
                <Flame color={palette.white} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyBold" style={{ color: themeTints.text }}>
                  Daily Crave
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
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState />
          ) : null}
        </View>

        {/* Quick Bites */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Quick Bites
              </AppText>
              <View
                style={{
                  backgroundColor: palette.statusFast,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  borderRadius: radii.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[1],
                }}
              >
                <Zap color={palette.white} fill={palette.white} size={10} />
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                  &lt; 15 MIN
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all quick bites under 15 minutes"
              onPress={() => navigation.navigate("QuickBites", { collection: "quickBites" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {quickBiteCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {quickBiteCards.map((bite) => (
                <Pressable
                  key={`quick-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick bite: ${bite.dishName}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText
                      variant="bodyBold"
                      numberOfLines={1}
                      style={{ color: themeTints.text }}
                    >
                      {bite.dishName}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {bite.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {bite.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState />
          ) : (
            <NoFoodSectionEmptyState title="No quick bites found" />
          )}
        </View>

        {/* Recommended Dishes (Carousel) */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2">Trending in {discoverLocationLabel}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`See all trending dishes in ${discoverLocationLabel}`}
              onPress={() => navigation.navigate("QuickBites", { collection: "trending" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {trendingCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {trendingCards.map((bite) => (
                <Pressable
                  key={`trending-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${bite.dishName} at ${bite.venueName}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                      {bite.dishName}
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      {bite.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[1],
                        }}
                      >
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {bite.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState />
          ) : (
            <NoFoodSectionEmptyState title="No trending food found" />
          )}
        </View>

        {/* Editor's Choice Carousel */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Editor&apos;s Choice
              </AppText>
              <View
                style={{
                  backgroundColor: palette.orange,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  borderRadius: radii.sm,
                }}
              >
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                  ★ CURATED
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all editor's choice dishes"
              onPress={() => navigation.navigate("QuickBites", { collection: "editorChoice" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {editorChoiceCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {editorChoiceCards.map((bite) => (
                <Pressable
                  key={`ec-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Editor's choice: ${bite.dishName}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                  />
                  {/* Editor badge overlay */}
                  <View
                    style={{
                      position: "absolute",
                      top: spacing[2],
                      left: spacing[2],
                      backgroundColor: palette.orange,
                      paddingHorizontal: spacing[2],
                      paddingVertical: spacing[0.5],
                      borderRadius: radii.sm,
                    }}
                  >
                    <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                      MUST ORDER
                    </AppText>
                  </View>
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                      {bite.dishName}
                    </AppText>
                    <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                      {bite.venueName}
                    </AppText>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: spacing[1],
                      }}
                    >
                      <AppText variant="price" style={{ color: palette.orange }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
                        <Star color={palette.amber} size={12} fill={palette.amber} />
                        <AppText
                          variant="micro"
                          style={{ fontWeight: "700", color: themeTints.text }}
                        >
                          {bite.rating.toFixed(1)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState />
          ) : (
            <NoFoodSectionEmptyState title="No editor's choice food found" />
          )}
        </View>

        {/* Budget < S$8 Dish Carousel */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <AppText variant="h2" style={{ color: themeTints.text }}>
                Budget &lt; S$8
              </AppText>
              <View
                style={{
                  backgroundColor: palette.success,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[0.5],
                  borderRadius: radii.sm,
                }}
              >
                <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                  VALUE
                </AppText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See all budget dishes under $8"
              onPress={() => navigation.navigate("QuickBites", { collection: "budget" })}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                SEE ALL
              </AppText>
            </Pressable>
          </View>
          {budgetCards.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={edgeToEdgeHorizontalScrollStyle}
              contentContainerStyle={{ gap: spacing[4] }}
            >
              {budgetCards.map((bite) => (
                <Pressable
                  key={`budget-${bite.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Budget meal: ${bite.dishName} at S$${bite.price.toFixed(2)}`}
                  onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      overflow: "hidden",
                      width: discoverRailCardWidth,
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: bite.photoUrl }}
                    style={{ height: discoverRailImageHeight, width: "100%" }}
                    contentFit="cover"
                  />
                  <View style={{ padding: spacing[3], gap: spacing[1] }}>
                    <AppText
                      variant="bodyBold"
                      numberOfLines={1}
                      style={{ color: themeTints.text }}
                    >
                      {bite.dishName}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {bite.venueName}
                    </AppText>
                    <AppText
                      variant="price"
                      style={{ color: palette.orange, fontWeight: "700", marginTop: spacing[0.5] }}
                    >
                      S${bite.price.toFixed(2)}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState />
          ) : (
            <NoFoodSectionEmptyState title="No budget-friendly food found" />
          )}
        </View>

        {/* Late Night Makan */}
        {isLateNightMakanVisible ? (
          <View style={{ gap: spacing[3] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <AppText variant="h2" style={{ color: themeTints.text }}>
                  Late Night Makan
                </AppText>
                <View
                  style={{
                    backgroundColor: palette.navy,
                    paddingHorizontal: spacing[2],
                    paddingVertical: spacing[0.5],
                    borderRadius: radii.sm,
                  }}
                >
                  <AppText variant="micro" style={{ color: palette.white, fontWeight: "800" }}>
                    LATE NIGHT
                  </AppText>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all late night stalls"
                onPress={() => navigation.navigate("QuickBites", { collection: "lateNight" })}
              >
                <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                  SEE ALL
                </AppText>
              </Pressable>
            </View>
            {lateNightCards.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={edgeToEdgeHorizontalScrollStyle}
                contentContainerStyle={{ gap: spacing[4] }}
              >
                {lateNightCards.map((bite) => (
                  <Pressable
                    key={`night-${bite.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Late night option: ${bite.dishName}`}
                    onPress={() => navigation.navigate("DishDetail", { dishId: bite.dishId })}
                    style={[
                      shadows.card,
                      {
                        backgroundColor: themeTints.cardBg,
                        borderRadius: radii.lg,
                        borderWidth: themeTints.isDark ? 0 : 1,
                        borderColor: palette.border,
                        overflow: "hidden",
                        width: discoverRailCardWidth,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: bite.photoUrl }}
                      style={{ height: discoverRailImageHeight, width: "100%" }}
                      contentFit="cover"
                    />
                    <View style={{ padding: spacing[3], gap: spacing[1] }}>
                      <AppText variant="h3" numberOfLines={1} style={{ color: themeTints.text }}>
                        {bite.dishName}
                      </AppText>
                      <AppText
                        variant="micro"
                        style={{ color: themeTints.secondaryText }}
                        numberOfLines={1}
                      >
                        {bite.venueName}
                      </AppText>
                      <AppText variant="price" style={{ color: palette.orange, fontWeight: "700" }}>
                        S${bite.price.toFixed(2)}
                      </AppText>
                    </View>
                  </Pressable>
                ))}
            </ScrollView>
          ) : isDiscoverFiltering ? (
            <FilteredResultsEmptyState />
          ) : (
            <NoFoodSectionEmptyState title="No late-night food found" />
          )}
          </View>
        ) : null}

        {/* Hawker Centres Near You (Horizontal Selection) */}
        <View style={{ gap: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AppText variant="h2" style={{ color: themeTints.text }}>
              Stalls in {discoverLocationLabel}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View hawker centres on map"
              onPress={() => navigation.navigate("DiscoverMap")}
            >
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                VIEW MAP
              </AppText>
            </Pressable>
          </View>
          <View style={{ gap: spacing[3] }}>
            {areaStallCards.length ? (
              areaStallCards.map(({ venue, topDish }) => (
                <Pressable
                  key={venue.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${venue.name} in map zoomed view`}
                  onPress={() =>
                    navigation.navigate("MapZoomedIn", {
                      buildingId: venue.buildingId,
                    })
                  }
                  style={[
                    shadows.card,
                    {
                      backgroundColor: themeTints.cardBg,
                      borderRadius: radii.lg,
                      padding: spacing[3],
                      flexDirection: "row",
                      gap: spacing[3],
                      alignItems: "center",
                      borderWidth: themeTints.isDark ? 0 : 1,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      padding: 2,
                      borderRadius: radii.pill,
                      borderWidth: 2,
                      borderColor: palette.orange,
                    }}
                  >
                    <Image
                      source={{ uri: topDish?.imageUrl }}
                      style={{ borderRadius: radii.pill, height: 48, width: 48 }}
                      contentFit="cover"
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText
                      variant="bodySmall"
                      style={{ fontWeight: "800", color: themeTints.text }}
                      numberOfLines={1}
                    >
                      {venue.name}
                    </AppText>
                    <AppText
                      variant="micro"
                      style={{ color: themeTints.secondaryText }}
                      numberOfLines={1}
                    >
                      {venue.unitNumber} · {venue.operatingHours.split(" – ")[0]}
                    </AppText>
                  </View>
                  <ChevronRight color={palette.textMuted} size={20} />
                </Pressable>
              ))
            ) : isDiscoverFiltering ? (
              <FilteredResultsEmptyState />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
