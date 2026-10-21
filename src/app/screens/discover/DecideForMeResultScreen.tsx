import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Shuffle, MapPin, Star, Heart, Navigation, Share2 } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { firstDishTimingProps } from "@/lib/analytics/firstDishTiming";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { AccessibleImage, AppText, Badge, Button, Card, EmptyState, Screen } from "@/components/ui";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import { findBuildingById } from "@/features/discovery/discovery";
import {
  preferOpenStalls,
  rankDecideCandidates,
  type OpenAwareCandidates,
} from "@/features/discovery/decideForMeCandidates";
import { buildMapsSearchUrl, formatFullStallAddress } from "@/features/detail/stallLocation";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { shareLink } from "@/features/share/messagingShare";
import { webShareUrl } from "@/constants/links";
import { blendedMatchScore, TASTE_LABELS } from "@/lib/ai/tasteEngine";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import { useFoodHistory } from "@/hooks/useFoodHistory";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { mixByFoodHistory } from "@/lib/ai/exploration";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type {
  Coordinate,
  DietaryFlag,
  DishDetail,
  TasteVector,
  VenueSummary,
} from "@/types/domain";
import { TASTE_DIMENSIONS } from "@/constants/taste";

function TasteMiniBar({
  label,
  userVal,
  dishVal,
  accentColor,
}: {
  label: string;
  userVal: number;
  dishVal: number;
  accentColor: string;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  const diff = Math.abs(userVal - dishVal);
  const match = Math.round((1 - diff / 10) * 100);

  return (
    <View style={{ flex: 1, gap: spacing[1], minWidth: "30%" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="micro">{label}</AppText>
        <AppText variant="micro" tone="muted">
          {match}%
        </AppText>
      </View>
      <View
        style={{
          backgroundColor: palette.border,
          borderRadius: radii.pill,
          height: 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            backgroundColor: match >= 70 ? accentColor : palette.textMuted,
            borderRadius: radii.pill,
            height: "100%",
            width: `${match}%`,
          }}
        />
      </View>
    </View>
  );
}

function AnimatedMatchBadge({ percent }: { percent: number }) {
  const { palette, radii, spacing, motion } = useHungryTheme();
  const counter = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      // Reduce Motion: show the final number without counting up.
      setDisplayValue(percent);
      return;
    }
    counter.setValue(0);
    const listenerId = counter.addListener(({ value }) => {
      setDisplayValue(Math.round(value));
    });

    Animated.timing(counter, {
      toValue: percent,
      duration: motion.decideForMeCounter,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      counter.removeListener(listenerId);
    };
  }, [counter, motion.decideForMeCounter, percent, reduceMotion]);

  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: `${palette.orange}22`,
        borderRadius: radii.pill,
        flexDirection: "row",
        gap: spacing[2],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[4],
      }}
    >
      <AppText variant="h3" style={{ color: palette.orange }}>
        {displayValue}% taste match
      </AppText>
    </View>
  );
}

const RADIUS_STEPS_METERS = [500, 1000, 2000, 4000];
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

function nextRadius(currentRadius: number) {
  return RADIUS_STEPS_METERS.find((value) => value > currentRadius);
}

/** Stalls whose hours are read for the open-now check (one read each when not cached). */
const MAX_OPEN_STATE_VENUES = 12;

/**
 * Picks come from the server search (search_dishes in Supabase mode), not the
 * capped local cache, then are ranked by taste and checked against opening hours.
 */
async function loadCandidates(
  repository: DataRepository,
  tasteVector: TasteVector,
  dietaryFlags: DietaryFlag[],
  radius: number,
  location: Coordinate,
  maxDishBudget?: number,
): Promise<OpenAwareCandidates> {
  const service = getHungryService();
  // Pass the user's location so the radius is measured from them, matching the radius chip.
  const results = await service.discovery.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags,
      tasteValues: tasteVector,
      radius,
      latitude: location.latitude,
      longitude: location.longitude,
    },
    tasteVector,
  );
  const ranked = rankDecideCandidates(
    results.map((result) => result.dish),
    { tasteVector, dietaryFlags, radiusMeters: radius, maxDishBudget },
  );
  const venueIds = [...new Set(ranked.map((dish) => dish.venueId))].slice(0, MAX_OPEN_STATE_VENUES);
  const venues = await Promise.all(
    venueIds.map(async (venueId) => {
      const venue =
        repository.getVenueById(venueId) ??
        (await service.discovery.getVenue(venueId).catch(() => undefined));
      return [venueId, venue] as const;
    }),
  );
  return preferOpenStalls(ranked, new Map(venues));
}

function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return undefined;
  }
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)} m away`
    : `${(distanceMeters / 1000).toFixed(1)} km away`;
}

const PICK_REASON_DIMS: { key: keyof TasteVector; label: string }[] = [
  { key: "sweet", label: "Sweet" },
  { key: "spicy", label: "Spicy" },
  { key: "sour", label: "Sour" },
  { key: "salty", label: "Salty" },
  { key: "rich", label: "Rich" },
  { key: "aromatic", label: "Aroma" },
];

function buildPickReason(userVector: TasteVector, dish: DishDetail, match: number) {
  const sortedDims = PICK_REASON_DIMS.map((dimension) => ({
    ...dimension,
    diff: Math.abs(userVector[dimension.key] - dish.tasteVector[dimension.key]),
  })).sort((left, right) => left.diff - right.diff);
  const topMatch = sortedDims[0];
  return match >= 80
    ? `This dish is dialled in to your taste profile — especially the ${topMatch.label.toLowerCase()}.`
    : match >= 60
      ? `A strong pick based on your ${topMatch.label.toLowerCase()} and ${sortedDims[1].label.toLowerCase()} preferences.`
      : `A nearby pick that still aligns with your strongest taste dimensions.`;
}

/** The next two distinct candidates after the current pick, shown as backups. */
function getOtherPicks(candidates: DishDetail[], currentIndex: number) {
  const current = candidates[currentIndex];
  const picks: DishDetail[] = [];
  for (let offset = 1; offset < candidates.length && picks.length < 2; offset += 1) {
    const candidate = candidates[(currentIndex + offset) % candidates.length];
    if (
      candidate &&
      candidate.id !== current?.id &&
      !picks.some((pick) => pick.id === candidate.id)
    ) {
      picks.push(candidate);
    }
  }
  return picks;
}

function getNextDistinctDish(candidates: DishDetail[], currentDishId?: string, currentIndex = 0) {
  if (!candidates.length) {
    return undefined;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  let nextIndex = (currentIndex + 1) % candidates.length;
  let guard = 0;
  while (guard < candidates.length && candidates[nextIndex]?.id === currentDishId) {
    nextIndex = (nextIndex + 1) % candidates.length;
    guard += 1;
  }

  return candidates[nextIndex];
}

export function DecideForMeResultScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const selectedDish = useDiscoveryStore((state) => state.decideForMe);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const showToast = useUIStore((state) => state.showToast);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const locationPermission = useLocationStore((state) => state.permission);
  // Same effective location as the Discover feed: a manual pick wins over GPS.
  const { coordinate: effectiveLocation, isApproximate: isLocationApproximate } =
    getEffectiveLocation({ permission: locationPermission, currentLocation, manualCoordinate });
  const [searchRadius, setSearchRadius] = useState(500);
  const [resultIndex, setResultIndex] = useState(0);
  const route = useRoute<RouteProp<RootStackParamList, "DecideForMeResult">>();
  // Where Decide-for-me was opened from. Discover tracks `decide_for_me_triggered`
  // before navigating; every other entry point is tracked here, once per open.
  const entrySurface = route.params?.surface ?? "direct";

  useEffect(() => {
    if (entrySurface === "discover") return; // Discover tracks the trigger itself.
    trackAnalyticsEvent("decide_for_me_triggered", {
      surface: entrySurface,
      radius_m: 500,
    });
  }, [entrySurface]);

  const scrollY = useRef(new Animated.Value(0)).current;

  const { history: foodHistory, openness } = useFoodHistory();
  // The last finished load stays on screen while a wider radius loads.
  const [candidatePool, setCandidatePool] = useState<OpenAwareCandidates>();
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const locationLatitude = effectiveLocation.latitude;
  const locationLongitude = effectiveLocation.longitude;
  useEffect(() => {
    let active = true;
    setIsLoadingCandidates(true);
    loadCandidates(
      repository,
      profile.tasteVector,
      profile.dietaryPreferences,
      searchRadius,
      { latitude: locationLatitude, longitude: locationLongitude },
      profile.maxDishBudget,
    )
      .catch(
        (): OpenAwareCandidates => ({
          candidates: [],
          onlyClosed: false,
          openStateByVenueId: new Map(),
        }),
      )
      .then((pool) => {
        if (!active) return;
        setCandidatePool(pool);
        setIsLoadingCandidates(false);
      });
    return () => {
      active = false;
    };
  }, [
    locationLatitude,
    locationLongitude,
    profile.dietaryPreferences,
    profile.maxDishBudget,
    profile.tasteVector,
    repository,
    searchRadius,
  ]);
  const candidates = useMemo(
    () =>
      // Openness sets how often a pick is a dish they know versus something new.
      mixByFoodHistory(candidatePool?.candidates ?? [], {
        history: foodHistory,
        openness,
        lookup: (dishId) => repository.getDishById(dishId),
      }),
    [candidatePool, foodHistory, openness, repository],
  );

  useEffect(() => {
    // Nothing is decided until the first load finishes.
    if (!candidatePool) return;
    if (!candidates.length) {
      setResultIndex(0);
      if (selectedDish) {
        setDecideForMe(undefined);
      }
      return;
    }

    if (selectedDish) {
      const selectedIndex = candidates.findIndex((dish) => dish.id === selectedDish.id);
      if (selectedIndex >= 0) {
        setResultIndex(selectedIndex);
        return;
      }
    }

    setResultIndex((current) => Math.min(current, candidates.length - 1));
    const nextDish = candidates[Math.min(resultIndex, candidates.length - 1)];
    if (nextDish && nextDish.id !== selectedDish?.id) {
      setDecideForMe(nextDish);
    }
  }, [candidatePool, candidates, resultIndex, selectedDish, setDecideForMe]);

  const dish = candidates[resultIndex] ?? selectedDish;
  const dishVenueId = dish?.venueId;
  // The Supabase venue cache is partial, so fetch the stall when it is not cached.
  const cachedVenue = dishVenueId ? repository.getVenueById(dishVenueId) : undefined;
  const [fetchedVenue, setFetchedVenue] = useState<VenueSummary>();

  useEffect(() => {
    if (!dishVenueId || cachedVenue) return;
    let active = true;
    void getHungryService()
      .discovery.getVenue(dishVenueId)
      .then((nextVenue) => {
        if (active) setFetchedVenue(nextVenue);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cachedVenue, dishVenueId]);

  useEffect(() => {
    if (!dish) return;
    void getHungryService()
      .recommendations.recordImpression("decide", [dish.id])
      .catch(() => undefined);
  }, [dish?.id]);
  const shownDishId = dish?.id;

  // This screen is the single place that picks the dish, so the first pick shown is
  // the one logged to the taste profile (Discover used to log a different dish).
  const loggedFirstPickRef = useRef(false);
  useEffect(() => {
    if (!dish || loggedFirstPickRef.current) return;
    loggedFirstPickRef.current = true;
    recordTasteInteraction({
      type: "food_button_click",
      surface: "decide",
      dish,
      buttonId: "decide_for_me",
    });
  }, [dish, recordTasteInteraction]);

  useEffect(() => {
    if (!shownDishId) return;
    trackAnalyticsEvent("decide_for_me_result_shown", {
      dish_id: shownDishId,
      ...firstDishTimingProps(),
    });
  }, [shownDishId]);
  const match = dish
    ? Math.round(blendedMatchScore(profile.tasteVector, dish.tasteVector) * 100)
    : 0;

  const HERO_HEIGHT = screenWidth * 1.1;

  const heroStyle = {
    transform: [
      {
        scale: scrollY.interpolate({
          inputRange: [-100, 0],
          outputRange: [1.2, 1],
          extrapolate: "clamp",
        }),
      },
      {
        translateY: scrollY.interpolate({
          inputRange: [0, HERO_HEIGHT],
          outputRange: [0, HERO_HEIGHT / 2],
          extrapolate: "clamp",
        }),
      },
    ],
  };

  // A cold open (such as the meal-time push) waits for the server instead of saying "no match".
  const hasNoMatch = !isLoadingCandidates && candidates.length === 0 && !selectedDish;
  useEffect(() => {
    if (!hasNoMatch) return;
    trackAnalyticsEvent("decide_for_me_no_match", {
      surface: entrySurface,
      radius_m: searchRadius,
    });
  }, [entrySurface, hasNoMatch, searchRadius]);

  const widenRadius = (target: number) => {
    trackAnalyticsEvent("decide_for_me_radius_expanded", {
      surface: entrySurface,
      from_radius_m: searchRadius,
      to_radius_m: target,
    });
    setSearchRadius(target);
  };

  const expandRadius = () => {
    const target = nextRadius(searchRadius);
    if (!target) {
      showToast({ message: "Already searching the widest radius.", tone: "info" });
      return;
    }
    widenRadius(target);
  };

  const handleTryAnother = () => {
    if (dish) {
      recordTasteInteraction({
        type: "dismissed",
        surface: "decide",
        dish,
        buttonId: "try_another_pick",
      });
    }
    const nextDish = getNextDistinctDish(candidates, dish?.id, resultIndex);
    if (!nextDish || nextDish.id === dish?.id) {
      const upcomingRadius = nextRadius(searchRadius);
      if (upcomingRadius) {
        widenRadius(upcomingRadius);
        showToast({
          message: `Expanded radius to ${(upcomingRadius / 1000).toFixed(1)} km.`,
          tone: "info",
        });
      } else {
        showToast({ message: "No other matching dishes right now.", tone: "info" });
      }
      return;
    }

    const nextIndex = candidates.findIndex((candidate) => candidate.id === nextDish.id);
    if (nextIndex >= 0) {
      setResultIndex(nextIndex);
    }
    setDecideForMe(nextDish);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  if (!dish && isLoadingCandidates) {
    return (
      <Screen title="Recommended for you" subtitle="Finding a dish near you…">
        <View
          accessible
          accessibilityLabel="Finding a dish near you"
          accessibilityLiveRegion="polite"
          style={{ alignItems: "center", paddingVertical: spacing[8] }}
        >
          <ActivityIndicator color={palette.orange} size="large" />
        </View>
      </Screen>
    );
  }

  if (!dish) {
    const upcomingRadius = nextRadius(searchRadius);
    return (
      <Screen title="Recommended for you" subtitle="No matching dish for current filters yet.">
        <EmptyState
          title="No match found"
          body={`No dish fits your current filters within ${(searchRadius / 1000).toFixed(1)} km.`}
        />
        {upcomingRadius ? (
          <Button
            label={`Expand radius to ${(upcomingRadius / 1000).toFixed(1)} km`}
            onPress={expandRadius}
          />
        ) : null}
        <Button
          label="Back to Discover"
          onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
        />
      </Screen>
    );
  }

  const venue = cachedVenue ?? (fetchedVenue?.id === dish.venueId ? fetchedVenue : undefined);
  const stallLine = [venue?.name || dish.venueName, venue?.unitNumber || dish.unitNumber]
    .filter(Boolean)
    .join(" · ");
  const building = findBuildingById(dish.buildingId);
  const stallAddress = venue
    ? formatFullStallAddress(venue, {
        name: venue.buildingName ?? building?.name,
        address: venue.address,
        postalCode: venue.postalCode,
      })
    : "";
  // Distance from the built-in default point is not distance from the user.
  const distanceLabel = isLocationApproximate ? undefined : formatDistance(dish.distanceMeters);
  const isSaved = profile.favouriteDishIds.includes(dish.id);
  // Open now in Singapore time; a closed pick says when it opens.
  const openState = candidatePool?.openStateByVenueId.get(dish.venueId);
  const openLabel =
    openState?.status === "open"
      ? ["Open now", openState.detail].filter(Boolean).join(" · ")
      : openState?.status === "closed"
        ? ["Closed", openState.detail].filter(Boolean).join(" · ")
        : undefined;

  const handleDirections = () => {
    if (!stallAddress) return;
    trackAnalyticsEvent("directions_opened", {
      dish_id: dish.id,
      stall_id: dish.venueId,
      source: "decide_for_me",
    });
    recordTasteInteraction({
      type: "food_button_click",
      surface: "decide",
      dish,
      buttonId: "directions",
    });
    void openTrustedMapsUrl(buildMapsSearchUrl(stallAddress));
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      showToast({ message: "Sign in to save dishes.", tone: "info" });
      setReturnRoute({ name: "DecideForMeResult" });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    toggleFavourite(dish);
  };

  const handleShare = () => {
    void shareLink(
      {
        kind: "dish",
        id: dish.id,
        message: `${dish.name}${venue?.name ? ` at ${venue.name}` : ""}, S$${dish.price.toFixed(2)}`,
        url: webShareUrl("dish", dish.id),
      },
      "system_share",
    );
  };
  const explanation = buildPickReason(profile.tasteVector, dish, match);
  const updatedLabel = formatDishUpdated(dish.updatedAt);
  const otherPicks = getOtherPicks(candidates, resultIndex);

  const handleOtherPick = (pick: DishDetail) => {
    recordTasteInteraction({
      type: "food_button_click",
      surface: "decide",
      dish: pick,
      buttonId: "other_pick",
    });
    const pickIndex = candidates.findIndex((candidate) => candidate.id === pick.id);
    if (pickIndex >= 0) setResultIndex(pickIndex);
    setDecideForMe(pick);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Navigation Overlay */}
      <View style={[styles.navOverlay, { top: insets.top, zIndex: 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          onPress={() => navigation.goBack()}
          style={[styles.navBtn, { backgroundColor: palette.surfaceTranslucent }]}
        >
          <ChevronLeft color={palette.text} size={24} />
        </Pressable>
        <AppText variant="h3" style={{ flex: 1, textAlign: "center", marginRight: 40 }}>
          Recommended
        </AppText>
      </View>

      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Parallax Hero */}
        <Animated.View style={[styles.heroContainer, { height: HERO_HEIGHT }, heroStyle]}>
          {dish.imageUrl ? (
            <AccessibleImage
              source={{ uri: dish.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`${dish.name} photo`}
            />
          ) : (
            <NoDishPhoto dishName={dish.name} style={StyleSheet.absoluteFill} iconSize={56} />
          )}
          <LinearGradient
            colors={["transparent", palette.mediaScrimSubtle, palette.bg]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Content */}
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[6], marginTop: -40 }}>
          <AnimatedMatchBadge percent={match} />

          <View style={{ gap: spacing[2] }}>
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <Badge label={`Radius ${(searchRadius / 1000).toFixed(1)} km`} tone="neutral" />
              {openLabel ? (
                <Badge
                  label={openLabel}
                  tone={openState?.status === "open" ? "success" : "warning"}
                />
              ) : null}
              {dish.mustOrder && <Badge label="Must order" tone="amber" />}
            </View>
            <AppText variant="displayBold">{dish.name}</AppText>
            <AppText variant="h2" tone="secondary" style={{ color: palette.orange }}>
              S${dish.price.toFixed(2)}
            </AppText>
            {stallLine ? (
              <AppText variant="bodyLarge" tone="secondary">
                {stallLine}
              </AppText>
            ) : null}
            {distanceLabel || updatedLabel ? (
              <AppText variant="body" tone="muted">
                {[distanceLabel, updatedLabel].filter(Boolean).join(" · ")}
              </AppText>
            ) : null}
          </View>

          {/* Why this dish? */}
          <Card
            style={{
              backgroundColor: palette.bgSoft,
              borderLeftColor: palette.orange,
              borderLeftWidth: 4,
              padding: spacing[4],
            }}
          >
            <AppText
              variant="micro"
              style={{ color: palette.orange, fontWeight: "800", marginBottom: 4 }}
            >
              Why this dish?
            </AppText>
            <AppText variant="body" style={{ lineHeight: 22 }}>
              {explanation}
            </AppText>
          </Card>

          {/* Taste Breakdown */}
          <View style={{ gap: spacing[3] }}>
            <AppText variant="h3">Palate match</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
              {PICK_REASON_DIMS.map((dimension) => (
                <TasteMiniBar
                  key={dimension.key}
                  label={TASTE_LABELS[dimension.key]}
                  userVal={profile.tasteVector[dimension.key]}
                  dishVal={dish.tasteVector[dimension.key]}
                  accentColor={palette.orange}
                />
              ))}
            </View>
          </View>

          {dish.description?.trim() ? (
            <View style={{ gap: spacing[2] }}>
              <AppText variant="h3">Description</AppText>
              <AppText variant="body" tone="secondary" style={{ lineHeight: 24 }}>
                {dish.description}
              </AppText>
            </View>
          ) : null}

          <View style={{ gap: spacing[3] }}>
            <Button
              label="Share with friends"
              variant="secondary"
              leftIcon={<Share2 size={18} color={palette.text} />}
              onPress={handleShare}
            />
            <Button
              label="View stall details"
              variant="secondary"
              onPress={() => {
                recordTasteInteraction({
                  type: "food_button_click",
                  surface: "decide",
                  dish,
                  buttonId: "view_stall_details",
                });
                navigation.navigate("StallDetail", { venueId: dish.venueId });
              }}
            />
            <Button
              label="Not for me"
              variant="ghost"
              accessibilityLabel={`Not for me, show another pick instead of ${dish.name}`}
              leftIcon={<Shuffle size={18} color={palette.text} />}
              onPress={handleTryAnother}
            />
          </View>

          {otherPicks.length ? (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3">Other picks</AppText>
              {otherPicks.map((pick) => {
                const pickMatch = Math.round(
                  blendedMatchScore(profile.tasteVector, pick.tasteVector) * 100,
                );
                const pickDistance = formatDistance(pick.distanceMeters);
                return (
                  <Pressable
                    key={pick.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Pick ${pick.name}, S$${pick.price.toFixed(2)}`}
                    onPress={() => handleOtherPick(pick)}
                    style={({ pressed }) => [
                      {
                        alignItems: "center",
                        backgroundColor: palette.bgSoft,
                        borderRadius: radii.md,
                        flexDirection: "row",
                        gap: spacing[3],
                        opacity: pressed ? 0.85 : 1,
                        padding: spacing[3],
                      },
                    ]}
                  >
                    {pick.imageUrl ? (
                      <AccessibleImage
                        source={{ uri: pick.imageUrl }}
                        style={{ borderRadius: radii.sm, height: 56, width: 56 }}
                        contentFit="cover"
                        decorative
                      />
                    ) : (
                      <NoDishPhoto
                        dishName={pick.name}
                        style={{ borderRadius: radii.sm, height: 56, width: 56 }}
                        iconSize={20}
                      />
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="body" style={{ fontWeight: "800" }} numberOfLines={1}>
                        {pick.name}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                        {[`S$${pick.price.toFixed(2)}`, pickDistance].filter(Boolean).join(" · ")}
                      </AppText>
                      <AppText variant="bodySmall" tone="muted" numberOfLines={2}>
                        {buildPickReason(profile.tasteVector, pick, pickMatch)}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Action Dock */}
      <View
        style={[
          styles.actionDock,
          {
            backgroundColor: palette.surfaceTranslucent,
            borderTopColor: palette.inverseSurfaceBarely,
            paddingBottom: Math.max(insets.bottom, spacing[4]),
          },
        ]}
      >
        {/* No ordering exists yet: the main action is getting there, plus saving for later. */}
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          {stallAddress ? (
            <Button
              label="Directions"
              fullWidth={false}
              style={{ flex: 2 }}
              leftIcon={<Navigation size={18} color={palette.white} />}
              labelColor={palette.white}
              onPress={handleDirections}
            />
          ) : null}
          <Button
            label={isSaved ? "Saved" : "Save"}
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
            accessibilityLabel={isSaved ? `Remove ${dish.name} from saved` : `Save ${dish.name}`}
            leftIcon={
              <Heart
                size={18}
                color={isSaved ? palette.orange : palette.text}
                fill={isSaved ? palette.orange : "transparent"}
              />
            }
            onPress={handleSave}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    height: 60,
    alignItems: "center",
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  heroContainer: {
    width: "100%",
    overflow: "hidden",
  },
  actionDock: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
});
