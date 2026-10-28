import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  View,
  StyleSheet,
  PanResponder,
  Pressable,
  type ScrollView,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Heart, Share2 } from "lucide-react-native";
import * as Haptics from "@/lib/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { firstDishTimingProps } from "@/lib/analytics/firstDishTiming";
import { reportError } from "@/lib/monitoring/reportError";
import { LocationGate } from "@/components/discover/LocationGate";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import {
  AccessibleImage,
  AppText,
  Badge,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Screen,
} from "@/components/ui";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import { formatDishPrice } from "@/features/detail/dishPrice";
import {
  applyDecideAnswers,
  decideServerFilters,
  describeDecideAnswers,
  givenServerAnswers,
  type DecideAnswers,
} from "@/features/discovery/decideQuiz";
import { findBuildingById } from "@/features/discovery/discovery";
import {
  DECIDE_INITIAL_RADIUS_METERS,
  DECIDE_RADIUS_STEPS_METERS,
  formatOpenLabel,
  keepScoreOrder,
  preferOpenStalls,
  rankDecideCandidates,
  type OpenAwareCandidates,
} from "@/features/discovery/decideForMeCandidates";
import { buildStallMapsUrl } from "@/features/detail/stallLocation";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { shareLink } from "@/features/share/messagingShare";
import { webShareUrl } from "@/constants/links";
import {
  countNegativeTasteSignals,
  hasTrustedTasteProfile,
  TASTE_LABELS,
  tasteAxisMatchPercent,
  tasteMatchPercent,
} from "@/lib/ai/tasteEngine";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useFoodHistory } from "@/hooks/useFoodHistory";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { mixByFoodHistory } from "@/lib/ai/exploration";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { saveDishAfterSignIn } from "@/features/auth/finishGuestAction";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import type {
  Coordinate,
  DietaryFlag,
  DishDetail,
  TasteVector,
  VenueSummary,
} from "@/types/domain";

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
  const match = tasteAxisMatchPercent(userVal, dishVal);

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
      {/* accentText, not orange: 19 px semibold orange on the tint is under 4.5:1 in light mode. */}
      <AppText variant="h3" style={{ color: palette.accentText }}>
        {displayValue}% taste match
      </AppText>
    </View>
  );
}

const HERO_HEIGHT_RATIO = 0.75;
/** A swipe left on the photo this far (or faster) asks for another pick. */
const SWIPE_ANOTHER_PICK_DX = -60;
const RADIUS_STEPS_METERS = DECIDE_RADIUS_STEPS_METERS;
const INITIAL_RADIUS_METERS = DECIDE_INITIAL_RADIUS_METERS;
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

/** react-native-web drops aria-selected on buttons, so the label says which radius is on. */
const radiusOptions = (selectedMeters: number) =>
  RADIUS_STEPS_METERS.map((meters) => ({
    id: String(meters),
    label: `${meters / 1000} km`,
    accessibilityLabel: `Search within ${meters / 1000} kilometres${meters === selectedMeters ? ", selected" : ""}`,
  }));

function nextRadius(currentRadius: number) {
  return RADIUS_STEPS_METERS.find((value) => value > currentRadius);
}

/** Dishes asked for per search: the server's maximum, so the quiz answers have a pool to narrow. */
const DECIDE_POOL_SIZE = 50;
/** Stalls whose hours are read for the open-now check: one get_venue_summaries call (max 50). */
const MAX_OPEN_STATE_VENUES = 50;

/** The pool the screen shows, and the radius it was found within (wider than asked if needed). */
type LoadedCandidates = OpenAwareCandidates & { radius: number };

/**
 * Picks come from the server search (search_dishes in Supabase mode), not the capped local
 * cache, then are ranked by taste and checked against opening hours. The quiz's cuisine, staple
 * and price answers are sent to the server. When nothing fits them all, the search widens the
 * radius first and only then drops answers (staple, cuisine, price), so an answer is not "left
 * out" while a match sits one step further away; the screen lists whatever was dropped.
 */
async function loadCandidates(
  tasteVector: TasteVector,
  hasTasteProfile: boolean,
  dietaryFlags: DietaryFlag[],
  radius: number,
  location: Coordinate,
  maxDishBudget?: number,
  answers?: DecideAnswers,
): Promise<LoadedCandidates> {
  const service = getHungryService();
  // Pass the user's location so the radius is measured from them, matching the radius chip.
  const search = async (
    searchRadius: number,
    dropped: Parameters<typeof decideServerFilters>[1],
  ) => {
    const { maxPrice, ...keywords } = answers ? decideServerFilters(answers, dropped) : {};
    const results = await service.discovery.searchDishes(
      {
        query: "",
        categories: [],
        dietaryFlags,
        tasteValues: tasteVector,
        radius: searchRadius,
        latitude: location.latitude,
        longitude: location.longitude,
        maxPrice,
        limit: DECIDE_POOL_SIZE,
        ...keywords,
      },
      tasteVector,
    );
    return rankDecideCandidates(
      results.map((result) => result.dish),
      { tasteVector, hasTasteProfile, dietaryFlags, radiusMeters: searchRadius, maxDishBudget },
    );
  };
  let usedRadius = radius;
  let ranked = await search(radius, []);
  const given = answers ? givenServerAnswers(answers) : [];
  if (!ranked.length && given.length) {
    for (const wider of RADIUS_STEPS_METERS.filter((step) => step > radius)) {
      // n-plus-one-ok: each pass searches a wider ring and stops at the first that has a match
      ranked = await search(wider, []);
      if (ranked.length) {
        usedRadius = wider;
        break;
      }
    }
    for (let count = 1; !ranked.length && count <= given.length; count += 1) {
      // n-plus-one-ok: one more answer is dropped on each pass, at most three searches
      ranked = await search(radius, given.slice(0, count));
    }
  }
  const venueIds = [...new Set(ranked.map((dish) => dish.venueId))].slice(0, MAX_OPEN_STATE_VENUES);
  const venues = await service.discovery.getVenuesByIds(venueIds).catch(() => []);
  return {
    ...preferOpenStalls(ranked, new Map(venues.map((venue) => [venue.id, venue]))),
    radius: usedRadius,
  };
}

/** "Malay", "Malay and Under S$5", "Malay, Noodles and Spicy". */
function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
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

function buildPickReason(
  userVector: TasteVector,
  dish: DishDetail,
  match: number,
  hasProfile: boolean,
) {
  // A guest who skipped the quiz has no profile to be "dialled in" to.
  if (!hasProfile) return "Popular nearby. Take the taste quiz to get picks tuned to you.";
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

/** Why a backup beats (or differs from) the current pick, in the signals the diner can check. */
function buildAlternativeReason(pick: DishDetail, current: DishDetail, matchPercent?: number) {
  const reasons: string[] = [];
  if (matchPercent !== undefined) reasons.push(`${matchPercent}% match`);
  if (pick.distanceMeters > 0 && pick.distanceMeters < current.distanceMeters - 50) {
    reasons.push("Closer");
  }
  if (pick.price > 0 && current.price > 0 && pick.price < current.price) reasons.push("Cheaper");
  if (pick.reviewCount > 0 && pick.rating >= current.rating + 0.2) reasons.push("Higher rated");
  return reasons.length ? reasons.join(" · ") : "Another good option nearby";
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

export function DecideForMeResultScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { palette, spacing, radii } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const skippedTasteQuiz = useSessionStore((state) => state.hasSkippedTasteQuiz);
  const storedPick = useDiscoveryStore((state) => state.decideForMe);
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const showToast = useUIStore((state) => state.showToast);
  const requireAccount = useRequireAccount();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const locationPermission = useLocationStore((state) => state.permission);
  // Same effective location as the Discover feed: a manual pick wins over GPS.
  const { coordinate: effectiveLocation, isApproximate: isLocationApproximate } =
    getEffectiveLocation({ permission: locationPermission, currentLocation, manualCoordinate });
  const [searchRadius, setSearchRadius] = useState(INITIAL_RADIUS_METERS);
  const [resultIndex, setResultIndex] = useState(0);
  const route = useRoute<RouteProp<RootStackParamList, "DecideForMeResult">>();
  // Where Decide-for-me was opened from. Discover tracks `decide_for_me_triggered`
  // before navigating; every other entry point is tracked here, once per open.
  const entrySurface = route.params?.surface ?? "direct";
  const answers = route.params?.answers;

  // The taste vector as it was when the screen opened. Every tap here records a taste signal
  // that moves the stored vector; reading it live would refetch the pool, restart the match
  // counter and reorder "Other picks" under the person's finger.
  const [tasteVector] = useState(() => profile.tasteVector);
  const [hasTasteProfile] = useState(() =>
    hasTrustedTasteProfile(profile.tasteVector, {
      skippedTasteQuiz,
      signalCount: profile.recommendationSignals?.signalCount,
      negativeSignalCount: countNegativeTasteSignals(
        useProfileStore.getState().tasteInteractionEvents,
      ),
    }),
  );

  useEffect(() => {
    if (entrySurface === "discover") return; // Discover tracks the trigger itself.
    trackAnalyticsEvent("decide_for_me_triggered", {
      surface: entrySurface,
      radius_m: INITIAL_RADIUS_METERS,
    });
  }, [entrySurface]);

  // A pick left in the store by an earlier visit (a push or Home open does not clear it) must
  // not be shown, logged or kept: this screen picks afresh every time it opens.
  useEffect(() => {
    setDecideForMe(undefined);
  }, [setDecideForMe]);

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  // The swipe handler is built once; it calls whatever "Another pick" does on the latest render.
  const anotherPickRef = useRef<() => void>(() => undefined);
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx <= SWIPE_ANOTHER_PICK_DX) anotherPickRef.current();
      },
    }),
  ).current;

  const { history: foodHistory, openness } = useFoodHistory();
  // The last finished load stays on screen while a wider radius loads.
  const [candidatePool, setCandidatePool] = useState<LoadedCandidates>();
  // The radius the shown picks were found within: wider than asked when the answers needed it.
  const shownRadius = candidatePool?.radius ?? searchRadius;
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  // Dishes the person turned down with "Not for me" are not offered again on this visit.
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(() => new Set());
  const locationLatitude = effectiveLocation.latitude;
  const locationLongitude = effectiveLocation.longitude;
  useEffect(() => {
    // No GPS fix and no area picked: the coordinate is only the Maxwell default, so
    // nothing is picked until the person chooses an area (see the prompt below).
    if (isLocationApproximate) {
      setIsLoadingCandidates(false);
      return;
    }
    let active = true;
    setIsLoadingCandidates(true);
    setLoadFailed(false);
    loadCandidates(
      tasteVector,
      hasTasteProfile,
      profile.dietaryPreferences,
      searchRadius,
      { latitude: locationLatitude, longitude: locationLongitude },
      profile.maxDishBudget,
      answers,
    ).then(
      (pool) => {
        if (!active) return;
        setCandidatePool(pool);
        setIsLoadingCandidates(false);
      },
      (error: unknown) => {
        if (!active) return;
        // An error is not "no dish nearby": say so and offer a retry.
        reportError(error, { screen: "DecideForMeResult", action: "loadCandidates" });
        setLoadFailed(true);
        setIsLoadingCandidates(false);
      },
    );
    return () => {
      active = false;
    };
  }, [
    isLocationApproximate,
    locationLatitude,
    locationLongitude,
    answers,
    profile.dietaryPreferences,
    profile.maxDishBudget,
    hasTasteProfile,
    reloadCount,
    searchRadius,
    tasteVector,
  ]);
  const answerResult = useMemo(
    () =>
      // The quiz answers narrow the taste-ranked pool; an answer that would empty it is dropped
      // and listed in `relaxed`, so the screen can say so.
      answers
        ? applyDecideAnswers(candidatePool?.candidates ?? [], answers)
        : { dishes: candidatePool?.candidates ?? [], relaxed: [] },
    [answers, candidatePool],
  );
  const matchingCandidates = useMemo(
    () =>
      // Openness sets how often a pick is a dish they know versus something new, but a dish never
      // moves above one that matches more than a few points better: the order follows the match.
      keepScoreOrder(
        mixByFoodHistory(answerResult.dishes, {
          history: foodHistory,
          openness,
          lookup: (dishId) => repository.getDishById(dishId),
        }),
        (candidate) =>
          hasTasteProfile ? tasteMatchPercent(tasteVector, candidate.tasteVector) : 0,
      ),
    [answerResult, foodHistory, hasTasteProfile, openness, repository, tasteVector],
  );
  const candidates = useMemo(
    () => matchingCandidates.filter((candidate) => !dismissedIds.has(candidate.id)),
    [dismissedIds, matchingCandidates],
  );
  // The stored pick only counts once this visit's pool has loaded (see the clear above).
  const selectedDish = candidatePool ? storedPick : undefined;

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

  const dish =
    isLocationApproximate || loadFailed ? undefined : (candidates[resultIndex] ?? selectedDish);
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

  // The app's own pick is an impression, not a click: logging it as a click trained the taste
  // profile toward whatever the ranking chose. Clicks are Directions, Save, View stall and
  // Other picks below.
  useEffect(() => {
    if (!dish) return;
    void getHungryService()
      .recommendations.recordImpression("decide", [dish.id])
      .catch(() => undefined);
  }, [dish?.id]);
  const shownDishId = dish?.id;

  useEffect(() => {
    if (!shownDishId) return;
    trackAnalyticsEvent("decide_for_me_result_shown", {
      dish_id: shownDishId,
      ...firstDishTimingProps(),
    });
  }, [shownDishId]);
  const match = dish ? tasteMatchPercent(tasteVector, dish.tasteVector) : 0;

  // Short enough that the dish name, price and stall sit above the fold on a 390 x 844 screen.
  const HERO_HEIGHT = screenWidth * HERO_HEIGHT_RATIO;

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

  // Every match was turned down with "Not for me", on this visit or before (food history hides
  // dismissed dishes too): not the same as nothing nearby.
  const hasSeenEveryMatch = answerResult.dishes.length > 0 && candidates.length === 0;
  // A cold open (such as the meal-time push) waits for the server instead of saying "no match".
  const hasNoMatch =
    !isLocationApproximate &&
    !isLoadingCandidates &&
    !loadFailed &&
    answerResult.dishes.length === 0 &&
    !selectedDish;
  useEffect(() => {
    if (!hasNoMatch) return;
    trackAnalyticsEvent("decide_for_me_no_match", {
      surface: entrySurface,
      radius_m: shownRadius,
    });
  }, [entrySurface, hasNoMatch, shownRadius]);

  const pickRadius = (id: string) => {
    const target = Number(id);
    trackAnalyticsEvent("decide_for_me_radius_picked", {
      surface: entrySurface,
      from_radius_m: shownRadius,
      to_radius_m: target,
    });
    if (target === searchRadius) setReloadCount((count) => count + 1);
    setSearchRadius(target);
  };

  const widenRadius = (target: number) => {
    trackAnalyticsEvent("decide_for_me_radius_expanded", {
      surface: entrySurface,
      from_radius_m: shownRadius,
      to_radius_m: target,
    });
    setSearchRadius(target);
  };

  const expandRadius = () => {
    const target = nextRadius(shownRadius);
    if (!target) {
      showToast({ message: "Already searching the widest radius.", tone: "info" });
      return;
    }
    widenRadius(target);
  };

  const radiusKm = (shownRadius / 1000).toFixed(1);

  // A new pick starts at the top of the screen and is read out, so the change is not silent.
  const showNewPick = (nextDish: DishDetail | undefined) => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (nextDish) {
      AccessibilityInfo.announceForAccessibility(
        `New pick: ${nextDish.name} at ${nextDish.venueName}`,
      );
    }
  };

  const handleTryAnother = () => {
    if (!dish) return;
    recordTasteInteraction({
      type: "dismissed",
      surface: "decide",
      dish,
      buttonId: "try_another_pick",
    });
    setDismissedIds((current) => new Set(current).add(dish.id));
    const remaining = candidates.filter((candidate) => candidate.id !== dish.id);
    if (!remaining.length) {
      // Every match here has been seen: look further out, or say that is everything.
      const upcomingRadius = nextRadius(shownRadius);
      if (upcomingRadius) {
        widenRadius(upcomingRadius);
        showToast({
          message: `You've seen every match within ${radiusKm} km. Looking within ${(upcomingRadius / 1000).toFixed(1)} km.`,
          tone: "info",
        });
      } else {
        showToast({ message: `You've seen every match within ${radiusKm} km.`, tone: "info" });
      }
      setDecideForMe(undefined);
      return;
    }
    // The dish after the current one moves into its place once the current one is removed.
    const nextIndex = Math.min(resultIndex, remaining.length - 1);
    setResultIndex(nextIndex);
    setDecideForMe(remaining[nextIndex]);
    showNewPick(remaining[nextIndex]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  anotherPickRef.current = handleTryAnother;

  // The quiz again from question 1; dismissed dishes stay hidden (food history keeps them 30 days).
  const startOver = () => {
    navigation.replace("DecideForMeQuiz", {});
  };

  const changeAnswers = () => {
    navigation.replace("DecideForMeQuiz", { answers });
  };

  if (isLocationApproximate) {
    return (
      <Screen title="Recommended for you">
        <LocationGate
          source="decide"
          title="Where are you eating?"
          body="Decide for me picks a dish near you, so it needs to know where you are."
        />
        <Button
          label="Back to Discover"
          variant="ghost"
          onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
        />
      </Screen>
    );
  }

  if (loadFailed) {
    return (
      <Screen title="Recommended for you" subtitle="Couldn't load picks.">
        <EmptyState title="Couldn't load picks" body="Check your connection and try again." />
        <Button label="Try again" onPress={() => setReloadCount((count) => count + 1)} />
        <Button
          label="Back to Discover"
          variant="secondary"
          onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
        />
      </Screen>
    );
  }

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
    const upcomingRadius = nextRadius(shownRadius);
    return (
      <Screen
        title="Recommended for you"
        subtitle={
          hasSeenEveryMatch
            ? "That's every match nearby."
            : "No matching dish for current filters yet."
        }
      >
        <EmptyState
          title={hasSeenEveryMatch ? "That's everything nearby" : "No match found"}
          body={
            hasSeenEveryMatch
              ? `You've seen every match within ${radiusKm} km.`
              : `No dish fits your current filters within ${radiusKm} km.`
          }
        />
        {upcomingRadius ? (
          <Button
            label={`Expand radius to ${(upcomingRadius / 1000).toFixed(1)} km`}
            onPress={expandRadius}
          />
        ) : null}
        {answers ? (
          <Button
            label={
              describeDecideAnswers(answers).length ? "Change answers" : "Answer a few questions"
            }
            variant="secondary"
            onPress={changeAnswers}
          />
        ) : null}
        {hasSeenEveryMatch ? (
          <Button label="Start over" variant="ghost" onPress={startOver} />
        ) : null}
        <Button
          label="Back to Discover"
          variant={upcomingRadius ? "secondary" : "primary"}
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
  // Directions never wait on the stall read: the dish row and its building are enough.
  const directionsUrl = buildStallMapsUrl({
    name: venue?.name || dish.venueName,
    buildingName: venue?.buildingName ?? building?.name,
    address: venue?.address,
    postalCode: venue?.postalCode,
  });
  // Distance from the built-in default point is not distance from the user.
  const distanceLabel = isLocationApproximate ? undefined : formatDistance(dish.distanceMeters);
  const isSaved = profile.favouriteDishIds.includes(dish.id);
  // Open now in Singapore time; a closed pick says when it opens.
  const openState = candidatePool?.openStateByVenueId.get(dish.venueId);
  const openLabel = formatOpenLabel(openState);

  const handleDirections = () => {
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
    void openTrustedMapsUrl(directionsUrl);
  };

  const handleSave = () => {
    // The shared sign-in sheet finishes the save once the guest is signed in.
    if (
      !requireAccount(`Sign in to save ${dish.name}`, { name: "DecideForMeResult" }, () =>
        saveDishAfterSignIn(dish),
      )
    ) {
      return;
    }
    toggleFavourite(dish);
  };

  const handleShare = () => {
    void shareLink(
      {
        kind: "dish",
        id: dish.id,
        message: `${dish.name}${venue?.name ? ` at ${venue.name}` : ""}${dish.price > 0 ? `, ${formatDishPrice(dish)}` : ""}`,
        url: webShareUrl("dish", dish.id),
      },
      "system_share",
    );
  };
  const explanation = buildPickReason(tasteVector, dish, match, hasTasteProfile);
  const updatedLabel = formatDishUpdated(dish.updatedAt);
  const otherPicks = getOtherPicks(candidates, resultIndex);
  const answerChips = answers ? describeDecideAnswers(answers) : [];
  const relaxedLabels = answerChips
    .filter((chip) => answerResult.relaxed.includes(chip.questionId))
    .map((chip) => chip.label);

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
    showNewPick(pick);
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
        ref={scrollRef as never}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Parallax Hero */}
        <Animated.View
          {...swipeResponder.panHandlers}
          style={[styles.heroContainer, { height: HERO_HEIGHT }, heroStyle]}
        >
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
          {/* What and where come first: the name, price and stall sit above the fold. */}
          <View style={{ gap: spacing[2] }}>
            <AppText variant="displayBold">{dish.name}</AppText>
            <AppText variant="h2" tone="secondary" style={{ color: palette.accentText }}>
              {formatDishPrice(dish)}
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
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing[2],
              }}
            >
              {openLabel ? (
                <Badge
                  label={openLabel}
                  tone={openState?.status === "open" ? "success" : "warning"}
                />
              ) : null}
              {dish.mustOrder && <Badge label="Must order" tone="amber" />}
            </View>
          </View>

          {candidatePool?.onlyClosed ? (
            <Card
              accessibilityRole="alert"
              style={{ backgroundColor: palette.bgSoft, padding: spacing[4] }}
              testID="decide-all-closed"
            >
              <AppText variant="body" style={{ fontWeight: "800" }}>
                {`Everything within ${radiusKm} km is closed right now`}
              </AppText>
              <AppText variant="bodySmall" tone="secondary">
                Here are the picks that open soonest.
              </AppText>
            </Card>
          ) : null}

          {hasTasteProfile ? (
            <AnimatedMatchBadge percent={match} />
          ) : (
            <Badge label="Popular nearby" tone="neutral" />
          )}

          {answers ? (
            <View style={{ gap: spacing[2] }} testID="decide-answers">
              {answerChips.length ? (
                <View
                  accessible
                  accessibilityLabel={`Your answers: ${answerChips.map((chip) => chip.label).join(", ")}`}
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}
                >
                  {answerChips.map((chip) => (
                    <Badge
                      key={chip.questionId}
                      label={
                        answerResult.relaxed.includes(chip.questionId)
                          ? `${chip.label} (left out)`
                          : chip.label
                      }
                      tone="neutral"
                    />
                  ))}
                </View>
              ) : null}
              {relaxedLabels.length ? (
                <AppText variant="bodySmall" tone="secondary">
                  {`Nothing within ${radiusKm} km fits ${joinLabels(relaxedLabels)} as well as your other answers, so ${relaxedLabels.length === 1 ? "that answer was" : "those answers were"} left out.`}
                </AppText>
              ) : null}
              <Button
                label={answerChips.length ? "Change answers" : "Answer a few questions"}
                variant="ghost"
                fullWidth={false}
                style={{ alignSelf: "flex-start" }}
                onPress={changeAnswers}
              />
            </View>
          ) : null}

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[2],
            }}
          >
            <AppText variant="bodySmall" tone="secondary">
              Within
            </AppText>
            <ChipGroup
              options={radiusOptions(shownRadius)}
              selectedId={String(shownRadius)}
              onSelect={pickRadius}
              style={{ flexShrink: 1, gap: spacing[1] }}
            />
            {isLoadingCandidates ? (
              // A wider radius is loading; the current pick stays until it arrives.
              <View
                accessible
                accessibilityLabel={`Looking within ${radiusKm} km`}
                accessibilityLiveRegion="polite"
                testID="decide-radius-loading"
              >
                <ActivityIndicator color={palette.orange} size="small" />
              </View>
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
              style={{ color: palette.accentText, fontWeight: "800", marginBottom: 4 }}
            >
              Why this dish?
            </AppText>
            <AppText variant="body" style={{ lineHeight: 22 }}>
              {explanation}
            </AppText>
          </Card>

          {/* Taste Breakdown: only meaningful against a real taste profile. */}
          {hasTasteProfile ? (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3">Palate match</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                {PICK_REASON_DIMS.map((dimension) => (
                  <TasteMiniBar
                    key={dimension.key}
                    label={TASTE_LABELS[dimension.key]}
                    userVal={tasteVector[dimension.key]}
                    dishVal={dish.tasteVector[dimension.key]}
                    accentColor={palette.orange}
                  />
                ))}
              </View>
            </View>
          ) : null}

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
          </View>

          {otherPicks.length ? (
            <View style={{ gap: spacing[3] }}>
              <AppText variant="h3">Other picks</AppText>
              {otherPicks.map((pick) => {
                const pickMatch = hasTasteProfile
                  ? tasteMatchPercent(tasteVector, pick.tasteVector)
                  : undefined;
                // Same rule as the main pick: no distance from the default point.
                const pickDistance = isLocationApproximate
                  ? undefined
                  : formatDistance(pick.distanceMeters);
                return (
                  <Pressable
                    key={pick.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Pick ${pick.name} at ${pick.venueName}, ${formatDishPrice(pick)}`}
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
                        {[pick.venueName, formatDishPrice(pick), pickDistance]
                          .filter(Boolean)
                          .join(" · ")}
                      </AppText>
                      <AppText variant="bodySmall" tone="muted" numberOfLines={2}>
                        {buildAlternativeReason(pick, dish, pickMatch)}
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
        {/* No ordering exists yet: the main actions are getting there or asking for another pick. */}
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Button
            label="Directions"
            fullWidth={false}
            style={{ flex: 1, paddingHorizontal: spacing[2] }}
            labelNumberOfLines={1}
            labelColor={palette.white}
            onPress={handleDirections}
          />
          <Button
            label="Another pick"
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1, paddingHorizontal: spacing[2] }}
            labelNumberOfLines={1}
            accessibilityLabel={`Another pick instead of ${dish.name}`}
            onPress={handleTryAnother}
          />
          {/* Icon only, so the two actions above keep their full labels on a 390 pt screen. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? `Remove ${dish.name} from saved` : `Save ${dish.name}`}
            accessibilityState={{ selected: isSaved }}
            onPress={handleSave}
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.md,
              borderWidth: 1,
              height: 52,
              justifyContent: "center",
              width: 52,
            }}
          >
            <Heart
              size={22}
              color={isSaved ? palette.orange : palette.text}
              fill={isSaved ? palette.orange : "transparent"}
            />
          </Pressable>
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
