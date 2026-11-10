import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  View,
  type LayoutChangeEvent,
  type ScrollView,
} from "react-native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  AccessibleImage,
  AppSymbol,
  AppText,
  Button,
  Card,
  EdgeSwipeZones,
  Input,
  Screen,
  Badge,
  ChipGroup,
  FeedErrorBoundary,
  Skeleton,
} from "@/components/ui";
import {
  MediaPicker,
  StarRating,
  TasteRatingInput,
  nearestTasteRatingLevel,
} from "@/components/review";
import {
  ReviewPortfolioSection,
  portfolioBlockedReason,
} from "@/components/foodPortfolio/ReviewPortfolioSection";
import {
  hasRatedAllTastes,
  loadRankedScores,
  portfolioScore,
  reviewPalateMatch,
  suggestRankedPlace,
  type PortfolioRank,
} from "@/features/foodPortfolio/reviewPortfolioRank";
import { TRENDING_MUSIC } from "@/features/review/musicData";
import {
  NEUTRAL_TASTE_VECTOR,
  REVIEW_EDITOR_TAGS,
  REVIEW_MAX_TAGS,
  TASTE_DIMENSIONS,
} from "@/constants/taste";
import { perceivedTasteLevel, standardTasteRating } from "@/features/detail/perceivedTaste";
import { reportError } from "@/lib/monitoring/reportError";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { selectHaptic, tapHaptic } from "@/lib/haptics";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { adjacentTabKey, mainTabOrder } from "@/features/navigation/swipeIntent";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useChoiceSheetStore } from "@/store/useChoiceSheetStore";
import { useReviewDraftHydrated, useReviewDraftStore } from "@/store/useReviewDraftStore";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { describePublishError, isExpectedPublishError } from "@/features/review/publishErrorCopy";
import { normalizeReviewTags } from "@/features/review/reviewEdit";
import {
  buildDishPickerRows,
  groupPickerRows,
  pickerRowSubtitle,
  type PickerRow,
} from "@/features/review/dishPicker";
import {
  PICKER_MIN_QUERY_LENGTH,
  PICKER_SEARCH_DEBOUNCE_MS,
  searchServerPickerRows,
} from "@/features/review/dishPickerSearch";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { REVIEW_TEXT_MAX_LENGTH, sanitizeFreeText } from "@/lib/security/inputSanitization";
import {
  REVIEW_PHOTOS_NOT_ATTACHED,
  firstMissingReviewField,
  resolveWouldRecommend,
  type ReviewRequiredField,
  reviewDraftHasContent,
} from "@/features/review/reviewDraft";
import type { ReviewStackParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import type { DishDetail, TasteKey } from "@/types/domain";

/** The optional fold opens and closes in 200ms: the chevron turns and the content fades in. */
const FOLD_MS = 200;
function FoldChevron({ open, color }: { open: boolean; color: string }) {
  const reduceMotion = useReduceMotion();
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    turn.value = reduceMotion
      ? open
        ? 1
        : 0
      : withTiming(open ? 1 : 0, { duration: FOLD_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }, [open, reduceMotion, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <AppSymbol name="chevronDown" size={20} color={color} />
    </Animated.View>
  );
}

type Props = NativeStackScreenProps<ReviewStackParamList, "ReviewMain">;

const POST_TAB_ORDER = mainTabOrder({
  socialFeedEnabled: FEATURE_FLAGS.socialFeedEnabled,
  reviewCreationEnabled: FEATURE_FLAGS.reviewCreationEnabled,
});

type PickerListItem = { type: "header"; title: string } | { type: "row"; row: PickerRow };

// Music is never saved and video is never uploaded with a review, so the editor hides both
// (Reels and Music) in every build until they ship.
const reviewMusicEnabled = false;
const reviewVideoEnabled = false;

export function ReviewScreen({ navigation, route }: Props) {
  const reduceMotion = useReduceMotion();
  const repository = getDataRepository();
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  // The editor is mounted under the root stack and under the Profile stack;
  // navigate() bubbles up to whichever navigator owns AuthStack.
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Store state
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const draft = useReviewDraftStore((state) => state.draft);
  const isSubmitting = useReviewDraftStore((state) => state.isSubmitting);
  const selectDish = useReviewDraftStore((state) => state.selectDish);
  const setRating = useReviewDraftStore((state) => state.setRating);
  const toggleTag = useReviewDraftStore((state) => state.toggleTag);
  const setRecommend = useReviewDraftStore((state) => state.setRecommend);
  const setText = useReviewDraftStore((state) => state.setText);
  const addPhoto = useReviewDraftStore((state) => state.addPhoto);
  const removePhoto = useReviewDraftStore((state) => state.removePhoto);
  const setVideoUri = useReviewDraftStore((state) => state.setVideoUri);
  const setSubmitting = useReviewDraftStore((state) => state.setSubmitting);
  const resetDraft = useReviewDraftStore((state) => state.resetDraft);
  const ensurePendingReviewId = useReviewDraftStore((state) => state.ensurePendingReviewId);
  // The saved draft loads asynchronously; acting on the route before it has would let the
  // old draft land on top of the dish the person just chose.
  const draftHydrated = useReviewDraftHydrated();

  // Local state
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pickerVenueId, setPickerVenueId] = useState<string | null>(null);
  const [remoteDish, setRemoteDish] = useState<DishDetail | undefined>(undefined);
  // The routed stall's menu from the service: a live build's sync catalog may not hold it.
  const [venueMenu, setVenueMenu] = useState<{
    venueId: string;
    dishes: DishDetail[];
    venueName?: string;
  } | null>(null);
  // Set when the review was opened for a stall: a stall with one dish needs no picking.
  const autoPickVenueRef = useRef<string | null>(null);
  // Server results for the query that has stopped changing; null = use the cached catalog.
  const [serverRows, setServerRows] = useState<{ query: string; rows: PickerRow[] } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const completedFieldsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null) as RefObject<ScrollView>;
  const sectionYRef = useRef<Partial<Record<ReviewRequiredField, number>>>({});

  // Derived data
  const routeDishId = route.params?.dishId || undefined;
  const routeVenueId = route.params?.venueId || undefined;
  const selectedDishId = draft.selectedDishId || routeDishId;
  const selectedDish = useMemo(() => {
    if (!selectedDishId) return undefined;
    return (
      repository.getDishById(selectedDishId) ??
      (remoteDish?.id === selectedDishId ? remoteDish : undefined)
    );
  }, [repository, selectedDishId, remoteDish]);
  // Each main field is reported once, the first time it is filled, so drop-off can be placed.
  const filledFields = {
    dish: Boolean(selectedDish),
    photo: draft.photos.length > 0,
    rating: draft.rating > 0,
    text: draft.text.trim().length > 0,
    tags: draft.selectedTags.length > 0,
  };
  const filledKey = Object.entries(filledFields)
    .filter(([, done]) => done)
    .map(([field]) => field)
    .join(",");
  useEffect(() => {
    if (!draftHydrated || !filledKey) return;
    for (const field of filledKey.split(",") as (keyof typeof filledFields)[]) {
      if (completedFieldsRef.current.has(field)) continue;
      completedFieldsRef.current.add(field);
      trackAnalyticsEvent("review_editor_field_completed", {
        field,
        dish_id: selectedDishId,
        variant: "compact",
      });
    }
  }, [draftHydrated, filledKey, selectedDishId]);

  // Optional "How did it taste?": what the reviewer felt, per taste, on the 0-10 scale.
  // Saved with the draft and kept per dish, so picking another dish starts blank.
  const feltTasteState = useReviewDraftStore((state) => state.feltTaste);
  const setFeltTaste = useReviewDraftStore((state) => state.setFeltTaste);
  const clearFeltTaste = useReviewDraftStore((state) => state.clearFeltTaste);
  const feltTaste = useMemo<Partial<Record<TasteKey, number>>>(
    () => (feltTasteState.dishId === selectedDishId ? feltTasteState.values : {}),
    [feltTasteState, selectedDishId],
  );
  const userTasteVector = useProfileStore((state) => state.profile.tasteVector);
  // Our guess: the dish's standard level as this reviewer is likely to feel it.
  const tasteSuggestions = useMemo(() => {
    const dishVector = selectedDish?.tasteVector;
    if (!dishVector) return undefined;
    return Object.fromEntries(
      TASTE_DIMENSIONS.map(({ key }) => [
        key,
        perceivedTasteLevel(dishVector[key] ?? 0, userTasteVector?.[key]),
      ]),
    ) as Partial<Record<TasteKey, number>>;
  }, [selectedDish?.tasteVector, userTasteVector]);
  // "Add to my Food Portfolio": the dish is posted too and, for a place, ranked in the portfolio.
  const [addToPortfolio, setAddToPortfolio] = useState(false);
  // undefined follows our suggestion; the reviewer's own pick (even "unranked") overrides it.
  const [pickedRank, setPickedRank] = useState<PortfolioRank | undefined>(undefined);
  // Scores of the dishes already ranked, best first (null: could not be scored).
  const [rankedScores, setRankedScores] = useState<(number | null)[]>([]);
  const portfolioOn = FEATURE_FLAGS.foodPortfolioEnabled && addToPortfolio;
  const profileId = useProfileStore((state) => state.profile.id);
  useEffect(() => {
    if (!portfolioOn) return undefined;
    let cancelled = false;
    void loadRankedScores(profileId, userTasteVector ?? NEUTRAL_TASTE_VECTOR).then((scores) => {
      if (!cancelled) setRankedScores(scores);
    });
    return () => {
      cancelled = true;
    };
  }, [portfolioOn, profileId, userTasteVector]);
  const portfolioRated = hasRatedAllTastes(feltTaste);
  const portfolioMatch =
    portfolioOn && portfolioRated && selectedDish?.tasteVector
      ? reviewPalateMatch(
          selectedDish.tasteVector,
          feltTaste,
          userTasteVector ?? NEUTRAL_TASTE_VECTOR,
        )
      : undefined;
  const suggestedRank: PortfolioRank | undefined =
    portfolioMatch !== undefined && draft.rating > 0
      ? suggestRankedPlace(portfolioScore(draft.rating, portfolioMatch), rankedScores)
      : undefined;
  const portfolioRank: PortfolioRank =
    pickedRank !== undefined ? pickedRank : (suggestedRank ?? null);
  const portfolioBlocked = portfolioOn
    ? portfolioBlockedReason(feltTaste, draft.photos.length > 0)
    : null;
  const selectedVenue = useMemo(
    () => repository.getVenueById(draft.selectedVenueId || selectedDish?.venueId || ""),
    [repository, draft.selectedVenueId, selectedDish?.venueId],
  );

  const buildingCoordinates = useMemo(
    () => new Map(repository.listBuildings().map((building) => [building.id, building.coordinate])),
    [repository],
  );
  const buildingNames = useMemo(
    () => new Map(repository.listBuildings().map((building) => [building.id, building.name])),
    [repository],
  );
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const pickerOrigin = useMemo(() => {
    const { coordinate, isApproximate } = getEffectiveLocation({
      permission,
      currentLocation,
      manualCoordinate,
    });
    // The built-in default is not "you": no nearby ordering from it.
    return isApproximate ? undefined : coordinate;
  }, [permission, currentLocation, manualCoordinate]);
  // The cached catalog is flattened only while the picker is open, and is the fallback when the
  // server search fails or the search is too short to send.
  const localPickerRows = useMemo(() => {
    if (!isSearching) return [];
    const venues = repository.listBuildings().flatMap((building) =>
      repository.listVenuesByBuilding(building.id).map((venue) => ({
        id: venue.id,
        name: venue.name,
        unitNumber: venue.unitNumber,
        buildingId: venue.buildingId,
        buildingName: building.name,
        imageUrl: venue.logoUrl ?? venue.imageUrl,
      })),
    );
    const dishes = venues.flatMap((venue) =>
      repository.listDishesByVenue(venue.id).map((dish) => ({
        id: dish.id,
        name: dish.name,
        venueId: venue.id,
        venueName: venue.name,
        buildingName: venue.buildingName,
        imageUrl: dish.imageUrl,
      })),
    );
    return buildDishPickerRows({
      venues,
      dishes,
      query,
      origin: pickerOrigin,
      buildingCoordinates,
    });
  }, [isSearching, repository, query, pickerOrigin, buildingCoordinates]);
  const trimmedQuery = query.trim();
  const pickerRows =
    serverRows && serverRows.query === trimmedQuery ? serverRows.rows : localPickerRows;
  const pickerSections = useMemo(
    () => groupPickerRows(pickerRows, trimmedQuery),
    [pickerRows, trimmedQuery],
  );

  const pickerListItems = useMemo<PickerListItem[]>(
    () =>
      pickerSections.flatMap((section) => [
        ...(section.title ? [{ type: "header" as const, title: section.title }] : []),
        ...section.rows.map((row) => ({ type: "row" as const, row })),
      ]),
    [pickerSections],
  );

  // Debounced server search: the catalog has tens of thousands of stalls, so only a paused,
  // long-enough query is sent and only one request is ever kept.
  useEffect(() => {
    // Rows for an older query are ignored (pickerRows checks the query), so nothing to clear.
    if (!isSearching || pickerVenueId || trimmedQuery.length < PICKER_MIN_QUERY_LENGTH) return;
    let active = true;
    const timer = setTimeout(() => {
      searchServerPickerRows({
        query: trimmedQuery,
        origin: pickerOrigin,
        buildingCoordinates,
        buildingNames,
      })
        .then((rows) => {
          if (active) setServerRows({ query: trimmedQuery, rows });
        })
        .catch((error: unknown) => {
          // The cached catalog still answers; the failure is still tracked.
          reportError(error, { screen: "ReviewScreen", action: "picker_search" });
          if (active) setServerRows(null);
        });
    }, PICKER_SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isSearching, pickerVenueId, trimmedQuery, pickerOrigin, buildingCoordinates, buildingNames]);

  // The route says what to review. A saved draft for something else never
  // silently wins (or is silently wiped): ask when it has content.
  const handledRouteKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draftHydrated) return;
    if (!routeDishId && !routeVenueId) return;
    const routeKey = `${routeVenueId ?? ""}|${routeDishId ?? ""}`;
    if (handledRouteKeyRef.current === routeKey) return;
    handledRouteKeyRef.current = routeKey;

    const routeVenueForDish =
      routeVenueId ?? (routeDishId ? repository.getDishById(routeDishId)?.venueId : undefined);
    // Read after hydration: the render-time draft may still be the empty initial one.
    const draft = useReviewDraftStore.getState().draft;
    const draftMatchesRoute = routeDishId
      ? draft.selectedDishId === routeDishId
      : draft.selectedVenueId === routeVenueId;
    if (draftMatchesRoute) return;

    const startFromRoute = () => {
      // Start from an empty draft (selectDish keeps content when no dish was
      // picked yet, so reset first).
      resetDraft();
      if (routeDishId && routeVenueForDish) {
        selectDish(routeVenueForDish, routeDishId);
        return;
      }
      // Opened for a stall without a dish: ask which dish instead of guessing.
      if (routeVenueId) {
        autoPickVenueRef.current = routeVenueId;
        setPickerVenueId(routeVenueId);
        setIsSearching(true);
      }
    };

    if (!reviewDraftHasContent(draft)) {
      startFromRoute();
      return;
    }
    const previousDishName = draft.selectedDishId
      ? (repository.getDishById(draft.selectedDishId)?.name ?? "your last dish")
      : undefined;
    Alert.alert(
      "Unfinished review",
      previousDishName
        ? `You started a review of ${previousDishName}. Continue it, or start a new one here?`
        : "You have an unfinished review. Continue it, or start a new one here?",
      [
        {
          text: previousDishName ? `Continue ${previousDishName}` : "Continue",
          style: "cancel",
        },
        { text: "Start new", onPress: startFromRoute },
      ],
    );
    // Only when the route changes (or once the saved draft has loaded).
  }, [routeVenueId, routeDishId, draftHydrated]);

  // Cold legacy cache: the sync repository may not have the routed dish yet.
  useEffect(() => {
    if (!selectedDishId || repository.getDishById(selectedDishId)) return;
    let active = true;
    getHungryService()
      .discovery.getDish(selectedDishId)
      .then((dish) => {
        if (active && dish) setRemoteDish(dish);
      })
      .catch((error: unknown) =>
        reportError(error, { screen: "ReviewScreen", action: "load_selected_dish" }),
      );
    return () => {
      active = false;
    };
  }, [repository, selectedDishId]);

  // A swipe down on the card while a sheet or the picker is on top of it would dismiss the card
  // under that modal and leave the screen frozen: the card stays put until they are closed.
  const choiceSheetOpen = useChoiceSheetStore((state) => state.sheetOpen);
  const blockCardDismiss = isSearching || choiceSheetOpen;
  useEffect(() => {
    const cardNavigation = navigation.getParent();
    // While the card is first mounting, React Navigation refuses options from here ("Options
    // cannot be set from a placeholder screen"); the lock only matters later, so skip then.
    const setCardGesture = (enabled: boolean) => {
      try {
        cardNavigation?.setOptions({ gestureEnabled: enabled });
      } catch {
        // Not ready yet, or already gone.
      }
    };
    setCardGesture(!blockCardDismiss);
    return () => setCardGesture(true);
  }, [blockCardDismiss, navigation]);

  // Leaving with an unpublished draft (it is kept, but the user walked away).
  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        const { draft: currentDraft, isSubmitting: submitting } = useReviewDraftStore.getState();
        if (submitting || !reviewDraftHasContent(currentDraft)) return;
        trackAnalyticsEvent("review_abandoned", {
          dish_id: currentDraft.selectedDishId || undefined,
          has_rating: currentDraft.rating > 0,
          media_count: currentDraft.photos.length,
        });
      }),
    [navigation],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setReturnRoute("ReviewStack");
      rootNavigation.navigate("AuthStack", { screen: "Login" });
    }
  }, [isAuthenticated, rootNavigation, setReturnRoute]);

  useEffect(() => {
    if (!pickerVenueId) return;
    let active = true;
    const discovery = getHungryService().discovery;
    Promise.all([discovery.listDishesByVenue(pickerVenueId), discovery.getVenue(pickerVenueId)])
      .then(([dishes, venue]) => {
        if (active) setVenueMenu({ venueId: pickerVenueId, dishes, venueName: venue?.name });
      })
      .catch((error: unknown) =>
        reportError(error, { screen: "ReviewScreen", action: "load_venue_menu" }),
      );
    return () => {
      active = false;
    };
  }, [pickerVenueId]);

  const localPickerDishes = pickerVenueId ? repository.listDishesByVenue(pickerVenueId) : [];
  const pickerDishes =
    localPickerDishes.length > 0
      ? localPickerDishes
      : venueMenu && venueMenu.venueId === pickerVenueId
        ? venueMenu.dishes
        : [];
  const pickerVenue = pickerVenueId
    ? (repository.getVenueById(pickerVenueId) ?? {
        id: pickerVenueId,
        name:
          (venueMenu?.venueId === pickerVenueId ? venueMenu.venueName : undefined) ??
          pickerDishes[0]?.venueName ??
          "This stall",
      })
    : undefined;

  // A stall with a single dish: pick it, so the diner goes straight to writing.
  useEffect(() => {
    if (!pickerVenueId || autoPickVenueRef.current !== pickerVenueId) return;
    if (pickerDishes.length === 0) return;
    autoPickVenueRef.current = null;
    if (pickerDishes.length !== 1) return;
    selectDish(pickerVenueId, pickerDishes[0].id);
    setPickerVenueId(null);
    setIsSearching(false);
  }, [pickerVenueId, pickerDishes, selectDish]);

  const openPicker = () => {
    setPickerVenueId(null);
    setIsSearching(true);
  };

  const closePicker = () => {
    setPickerVenueId(null);
    setIsSearching(false);
  };

  const chooseDish = (venueId: string, dishId: string) => {
    const switchingDish = Boolean(draft.selectedDishId) && draft.selectedDishId !== dishId;
    const hasContent = reviewDraftHasContent(draft) || Object.keys(feltTaste).length > 0;
    if (!switchingDish || !hasContent) {
      selectDish(venueId, dishId);
      closePicker();
      return;
    }
    Alert.alert(
      "Change dish?",
      "Switching dish clears the rating, text, photos, tags and taste answers you added.",
      [
        { text: "Keep current dish", style: "cancel" },
        {
          text: "Change dish",
          style: "destructive",
          onPress: () => {
            selectDish(venueId, dishId);
            closePicker();
          },
        },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!selectedDish) {
      useUIStore.getState().showToast({ message: "Please select a dish first.", tone: "warning" });
      return;
    }

    const hasVideo = reviewVideoEnabled && Boolean(draft.videoUri);
    // Points exist only where gamification is on; the success modal hides them otherwise.
    const reviewScore = FEATURE_FLAGS.gamificationEnabled
      ? 25 + draft.selectedTags.length * 5 + draft.photos.length * 10 + (hasVideo ? 20 : 0)
      : 0;
    // What the server keeps (allowed list, at most REVIEW_MAX_TAGS), so the device matches it.
    const reviewTags = normalizeReviewTags(draft.selectedTags);
    // Fixed before the submit so the success modal can offer to share this exact review.
    const reviewId = ensurePendingReviewId();
    const successPayload = {
      reviewId,
      dishId: selectedDish.id,
      dishName: selectedDish.name,
      venueName: selectedVenue?.name ?? selectedDish.venueName ?? "",
      pointsEarned: reviewScore,
      xpEarned: reviewScore,
      tagCount: reviewTags.length,
      rating: draft.rating,
    };

    const reviewText = sanitizeFreeText(draft.text, REVIEW_TEXT_MAX_LENGTH);
    const withPortfolioEntry = portfolioOn && Boolean(draft.photos[0]);
    setSubmitting(true);
    try {
      const profile = useProfileStore.getState().profile;
      const submitted = await getHungryService().reviews.submitReview({
        dishId: selectedDish.id,
        venueId: selectedDish.venueId,
        rating: draft.rating,
        text: reviewText,
        tags: reviewTags,
        photos: draft.photos,
        wouldRecommend: resolveWouldRecommend(draft.recommend, draft.rating),
        // Reused on retry so a failed photo step never creates a second review.
        clientReviewId: reviewId,
        // The review and its portfolio entry are one server write: both land or neither does,
        // and a retry finds the entry the first attempt made.
        portfolio: withPortfolioEntry
          ? {
              caption: reviewText || selectedDish.name,
              tasteStamp: selectedDish.tasteVector ?? NEUTRAL_TASTE_VECTOR,
              rank: portfolioRank,
              author: {
                id: profile.id,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl,
              },
            }
          : undefined,
      });
      if (withPortfolioEntry && submitted?.portfolioPostId) {
        trackAnalyticsEvent("review_added_to_portfolio", {
          dish_id: selectedDish.id,
          rank: portfolioRank ?? 0,
          ranked: portfolioRank !== null,
        });
      }

      // The felt levels go in as the dish's standard levels, undoing this reviewer's palate.
      if (Object.keys(feltTaste).length > 0) {
        void getHungryService()
          .ai.adjustCommunityTasteVector(
            selectedDish.id,
            standardTasteRating(feltTaste, userTasteVector),
            reviewId,
          )
          .catch((error: unknown) =>
            reportError(error, { screen: "ReviewScreen", action: "adjust_taste_vector" }),
          );
        clearFeltTaste();
      }

      useProfileStore.getState().addReviewedDish(selectedDish.id);
      // A stall marked visited before this review earns its visit points now.
      void useStallInteractionStore
        .getState()
        .awardVisitAfterReview(useProfileStore.getState().profile.id, selectedDish.venueId);
      useProfileStore.getState().addReview(selectedDish);
      useProfileStore.getState().recordReviewEntry(selectedDish.id, {
        rating: draft.rating,
        text: reviewText,
        tags: reviewTags,
      });

      trackAnalyticsEvent("review_submitted", {
        dish_id: selectedDish.id,
        venue_id: selectedDish.venueId,
        media_count: draft.photos.length + (hasVideo ? 1 : 0),
        has_music: reviewMusicEnabled && !!draft.musicId,
      });

      // One confirmation: the success modal.
      useUIStore.getState().showReviewSuccess({
        ...successPayload,
        // For the share card on the confirmation.
        text: reviewText,
        tags: reviewTags,
        photoUrl: draft.photos[0],
        authorName: useProfileStore.getState().profile.displayName,
      });
      resetDraft();
      // The editor is the only screen in its stack: leave the stack so the user
      // lands back where they started (usually the dish they reviewed).
      const parentNavigation = navigation.getParent();
      if (parentNavigation?.canGoBack()) {
        parentNavigation.goBack();
      } else {
        rootNavigation.navigate("MainTabs", { screen: "Review" });
      }
    } catch (error) {
      const photosOnly = (error as { code?: string } | null)?.code === REVIEW_PHOTOS_NOT_ATTACHED;
      trackAnalyticsEvent("review_submit_failed", {
        dish_id: selectedDish.id,
        venue_id: selectedDish.venueId,
        media_count: draft.photos.length,
        reason: photosOnly ? "photos_not_attached" : "submit_failed",
      });
      // Refusals written for the person (text filter, own stall, rate limit) are expected;
      // every other failure of the app's main write reaches error tracking.
      if (!isExpectedPublishError(error)) {
        reportError(error, { screen: "ReviewScreen", action: "submit_review", photosOnly });
      }
      useUIStore.getState().showToast({
        message: photosOnly
          ? "Your review is posted, but the photos didn't upload. Tap Publish again to add them."
          : describePublishError(error, "review"),
        tone: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Where each required section sits, so the "Add a star rating…" line can scroll to it.
  const rememberSectionY = (field: ReviewRequiredField) => (event: LayoutChangeEvent) => {
    sectionYRef.current[field] = event.nativeEvent.layout.y;
  };
  const scrollToSection = (field: ReviewRequiredField) => {
    if (field === "dish" && !selectedDish) {
      openPicker();
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, (sectionYRef.current[field] ?? 0) - 16) });
  };

  if (!isAuthenticated) return null;

  // The Post card sits between two pages of the tab bar: a swipe in from either edge goes there.
  const goToTab = (direction: "previous" | "next") => {
    const target = adjacentTabKey(POST_TAB_ORDER, "Create", direction);
    if (!target || target === "Create") return undefined;
    // popTo returns to the tab bar that sits under the card and picks the page; navigate would
    // push a second tab bar on top of it.
    return () => rootNavigation.popTo("MainTabs", { screen: target } as never);
  };
  const cardEdgeSwipes = {
    onSwipeFromLeft: goToTab("previous"),
    onSwipeFromRight: goToTab("next"),
  };

  if (!draftHydrated) {
    return (
      <Screen title="Write a review">
        <View accessibilityLabel="Loading your draft" style={{ gap: spacing[4] }}>
          <Skeleton width="100%" height={88} />
          <Skeleton width="60%" height={32} />
          <Skeleton width="100%" height={120} />
        </View>
      </Screen>
    );
  }

  const missingField = firstMissingReviewField(draft, Boolean(selectedDish));
  const publishBlockedReason = missingField?.message ?? portfolioBlocked;
  const optionalCount =
    draft.selectedTags.length +
    (typeof draft.recommend === "boolean" ? 1 : 0) +
    Object.keys(feltTaste).length;

  // Leaves the editor stack (the draft is kept), as Publish does after a success.
  const cancelEditor = () => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation?.canGoBack()) {
      parentNavigation.goBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      rootNavigation.navigate("MainTabs", { screen: "Review" });
    }
  };

  const dishSection = (
    <View style={{ gap: spacing[3] }} onLayout={rememberSectionY("dish")}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <AppSymbol name="dish" size={18} color={palette.orange} />
        <AppText variant="h3">What did you eat?</AppText>
      </View>

      {selectedDish ? (
        <Card
          style={{
            padding: spacing[3],
            backgroundColor: palette.bgSoft,
            borderColor: palette.orange,
          }}
        >
          <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "center" }}>
            {selectedDish.imageUrl ? (
              <AccessibleImage
                source={{ uri: selectedDish.imageUrl }}
                style={{ width: 60, height: 60, borderRadius: radii.md }}
                accessibilityLabel={`${selectedDish.name} photo`}
              />
            ) : (
              // Most dishes have no photo yet: a tile, not a blank gap.
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: radii.md,
                  backgroundColor: palette.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppSymbol name="dish" size={22} color={palette.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: "700" }}>{selectedDish.name}</AppText>
              <AppText variant="bodySmall" tone="secondary">
                {selectedVenue?.name ?? selectedDish.venueName}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change dish"
              onPress={openPicker}
              style={{
                minHeight: 44,
                minWidth: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText variant="bodySmallBold" style={{ color: palette.orange }}>
                Change
              </AppText>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Button
          label="Select stall & dish"
          variant="secondary"
          onPress={openPicker}
          leftIcon={<AppSymbol name="search" size={18} color={palette.text} />}
        />
      )}
    </View>
  );

  // Photo: optional (sh, 2026-11-04; it was required since STITCH-BUILD-03). It comes after the
  // rating, which is required, and before the words.
  const photoSection = (
    <View>
      <MediaPicker
        title="Photo (optional)"
        photos={draft.photos}
        videoUri={reviewVideoEnabled ? draft.videoUri : undefined}
        onAddPhoto={(uri) => {
          tapHaptic();
          addPhoto(uri);
        }}
        onRemovePhoto={removePhoto}
        onSetVideo={reviewVideoEnabled ? setVideoUri : undefined}
      />
    </View>
  );

  const ratingSection = (
    <View style={{ gap: spacing[2] }} onLayout={rememberSectionY("rating")}>
      <AppText variant="h3">Overall rating</AppText>
      <StarRating value={draft.rating} onChange={setRating} editable showDescriptor centered />
    </View>
  );

  const textSection = (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="h3">Your review</AppText>
        <AppText variant="micro" tone="muted">
          {draft.text.length}/{REVIEW_TEXT_MAX_LENGTH}
        </AppText>
      </View>
      <Input
        placeholder="What made this dish special?"
        accessibilityLabel="Your review"
        multiline
        numberOfLines={4}
        maxLength={REVIEW_TEXT_MAX_LENGTH}
        value={draft.text}
        onChangeText={setText}
        style={{ minHeight: 100 }}
      />
    </View>
  );

  // Music Picker (Navigation Button)
  const musicSection = reviewMusicEnabled ? (
    <View style={{ gap: spacing[3] }}>
      <AppText variant="h3">Music</AppText>

      {draft.musicId ? (
        <Card
          style={{
            padding: spacing[3],
            backgroundColor: palette.orangeLight,
            borderColor: palette.orange,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyBold">
                {TRENDING_MUSIC.find((m) => m.id === draft.musicId)?.title ?? "Selected Track"}
              </AppText>
              <AppText variant="micro" tone="secondary">
                {TRENDING_MUSIC.find((m) => m.id === draft.musicId)?.artist ?? "Artist"}
              </AppText>
            </View>
            <Button
              label="Change"
              variant="ghost"
              size="sm"
              onPress={() => navigation.navigate("MusicSelection" as any)}
            />
          </View>
        </Card>
      ) : (
        <Button
          label="Add music"
          variant="secondary"
          onPress={() => navigation.navigate("MusicSelection" as any)}
        />
      )}
    </View>
  ) : null;

  // Every reviewer can tag taste; the tags feed dish taste profiles.
  const tagsSection = (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <AppText variant="h3">Taste tags</AppText>
        <AppText variant="micro" tone="muted">
          Up to {REVIEW_MAX_TAGS} · {draft.selectedTags.length}/{REVIEW_MAX_TAGS}
        </AppText>
      </View>
      <ChipGroup
        options={REVIEW_EDITOR_TAGS.map((tag) => ({ id: tag, label: tag }))}
        selectedIds={draft.selectedTags}
        onSelect={toggleTag}
      />
    </View>
  );

  // Optional: how strong each taste felt. Saved as the dish's standard levels.
  const tasteSection = selectedDish ? (
    <View style={{ gap: spacing[2] }}>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h3">How did it taste?</AppText>
        <AppText variant="bodySmall" tone="secondary">
          Optional. Dashed rings are our guess for your palate; tap what you tasted.
        </AppText>
      </View>
      <TasteRatingInput
        values={feltTaste}
        suggestions={tasteSuggestions}
        onChange={(key, value) => {
          if (!selectedDishId) return;
          selectHaptic();
          setFeltTaste(selectedDishId, key, value);
        }}
      />
    </View>
  ) : null;

  // Recommend: unanswered until the reviewer picks one.
  const recommendSection = (
    <View style={{ gap: spacing[3] }}>
      <AppText variant="h3">Would you recommend it?</AppText>
      <View style={{ flexDirection: "row", gap: spacing[3] }}>
        <Button
          label="Yes"
          variant={draft.recommend === true ? "primary" : "secondary"}
          accessibilityState={{ selected: draft.recommend === true }}
          onPress={() => setRecommend(true)}
          style={{ flex: 1 }}
        />
        <Button
          label="No"
          variant={draft.recommend === false ? "primary" : "secondary"}
          accessibilityState={{ selected: draft.recommend === false }}
          onPress={() => setRecommend(false)}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );

  // The header Publish is the only one; the footer says why it is off and scrolls to the gap.
  const publishBlockedHint =
    portfolioBlocked && !missingField ? (
      <AppText
        variant="bodySmall"
        tone="secondary"
        accessibilityLiveRegion="polite"
        style={{ textAlign: "center" }}
      >
        {portfolioBlocked}
      </AppText>
    ) : missingField ? (
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Scrolls to the missing field"
        onPress={() => scrollToSection(missingField.field)}
        style={{ alignItems: "center", justifyContent: "center", minHeight: 44 }}
      >
        <AppText
          variant="bodySmall"
          tone="secondary"
          accessibilityLiveRegion="polite"
          // Plain secondary text: an underline read as a web link (Apple design pass).
          style={{ textAlign: "center" }}
        >
          {missingField.message}
        </AppText>
      </Pressable>
    ) : null;

  return (
    <EdgeSwipeZones {...cardEdgeSwipes}>
      <Screen
        keyboardAvoiding
        title="Write a review"
        scroll
        scrollRef={scrollRef}
        headerLeft={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityHint="Closes the editor and keeps your draft"
            onPress={cancelEditor}
            style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}
          >
            <AppSymbol name="back" size={22} color={palette.text} />
          </Pressable>
        }
        headerRight={
          <Button
            label="Publish"
            size="sm"
            fullWidth={false}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={Boolean(publishBlockedReason)}
            accessibilityHint={publishBlockedReason ?? "Posts your review"}
          />
        }
        footer={publishBlockedHint ?? undefined}
      >
        <FeedErrorBoundary
          title="Review editor failed"
          body="We hit a snag loading the editor. Please try again."
        >
          <View style={{ gap: spacing[6] }}>
            {dishSection}
            {ratingSection}
            {photoSection}
            {textSection}
            {musicSection}
            {FEATURE_FLAGS.foodPortfolioEnabled && selectedDish ? (
              <ReviewPortfolioSection
                enabled={addToPortfolio}
                onToggle={setAddToPortfolio}
                hasPhoto={draft.photos.length > 0}
                felt={feltTaste}
                suggestions={tasteSuggestions}
                onFeltChange={(key, value) => {
                  if (!selectedDishId) return;
                  selectHaptic();
                  setFeltTaste(selectedDishId, key, value);
                }}
                onUseGuess={() => {
                  if (!selectedDishId || !tasteSuggestions) return;
                  selectHaptic();
                  for (const { key } of TASTE_DIMENSIONS) {
                    const guess = tasteSuggestions[key];
                    if (typeof feltTaste[key] !== "number" && typeof guess === "number") {
                      setFeltTaste(selectedDishId, key, nearestTasteRatingLevel(guess));
                    }
                  }
                }}
                placeCount={rankedScores.length + 1}
                suggestedRank={suggestedRank}
                matchPercent={portfolioMatch}
                rank={portfolioRank}
                onRankChange={setPickedRank}
              />
            ) : null}
            <View style={{ gap: spacing[4] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: detailOpen }}
                accessibilityLabel="Add more detail (optional)"
                onPress={() => setDetailOpen((open) => !open)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  minHeight: 44,
                }}
              >
                <AppText variant="h3">
                  Add more detail (optional){optionalCount > 0 ? ` · ${optionalCount}` : ""}
                </AppText>
                <FoldChevron open={detailOpen} color={palette.textMuted} />
              </Pressable>
              {detailOpen ? (
                <Animated.View
                  entering={reduceMotion ? undefined : FadeIn.duration(FOLD_MS)}
                  style={{ gap: spacing[6] }}
                >
                  {tagsSection}
                  {portfolioOn ? null : tasteSection}
                  {recommendSection}
                </Animated.View>
              ) : null}
            </View>
          </View>
        </FeedErrorBoundary>

        {/* Dish picker: a real modal (viewport-sized, Android back closes it) instead
          of an overlay inside the scroll content. */}
        <Modal
          visible={isSearching}
          animationType="slide"
          onRequestClose={() => (pickerVenue ? setPickerVenueId(null) : closePicker())}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: palette.bg,
              paddingHorizontal: spacing[4],
              paddingTop: insets.top + spacing[4],
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[3],
                marginBottom: spacing[4],
              }}
            >
              {/* One chevron leaves the picker: back to the stall list from a stall, closed from the list. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pickerVenue ? "Back" : "Close"}
                hitSlop={8}
                onPress={() => (pickerVenue ? setPickerVenueId(null) : closePicker())}
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 44,
                  minWidth: 44,
                }}
              >
                <AppSymbol name="back" size={22} color={palette.text} />
              </Pressable>
              {pickerVenue ? (
                <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {pickerVenue.name}
                </AppText>
              ) : (
                // Input's outer wrapper sizes to its content, so this flex:1 slot lets the field
                // fill the rest of the row.
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Input
                    placeholder="Search dishes or stalls..."
                    accessibilityLabel="Search dishes or stalls"
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                  />
                </View>
              )}
            </View>

            {pickerVenue ? (
              <FlatList
                data={pickerDishes}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <View style={{ gap: spacing[3] }}>
                    <AppText tone="secondary">No dishes listed for this stall yet.</AppText>
                    <Button
                      label="Suggest a dish"
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => {
                        // A short form that sends the dish to the team to add to the menu.
                        closePicker();
                        rootNavigation.navigate("SuggestDish", {
                          venueId: pickerVenue.id,
                          subjectName: pickerVenue.name,
                        });
                      }}
                    />
                  </View>
                }
                ListFooterComponent={
                  pickerDishes.length > 0 ? (
                    <Button
                      label="Don't see it? Suggest a dish"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => {
                        closePicker();
                        rootNavigation.navigate("SuggestDish", {
                          venueId: pickerVenue.id,
                          subjectName: pickerVenue.name,
                        });
                      }}
                    />
                  ) : null
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${item.name}`}
                    onPress={() => chooseDish(pickerVenue.id, item.id)}
                    style={{
                      paddingVertical: spacing[3],
                      borderBottomWidth: 1,
                      borderBottomColor: palette.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <AppText style={{ fontWeight: "600", flex: 1 }}>{item.name}</AppText>
                      {draft.selectedDishId === item.id ? (
                        <AppSymbol name="selected" size={18} color={palette.orange} />
                      ) : null}
                    </View>
                  </Pressable>
                )}
              />
            ) : (
              <FlatList
                data={pickerListItems}
                keyExtractor={(item) =>
                  item.type === "header" ? `header:${item.title}` : item.row.key
                }
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                ListEmptyComponent={
                  <AppText tone="secondary">
                    {trimmedQuery
                      ? `No dishes or stalls match "${trimmedQuery}".`
                      : "No stalls to show yet."}
                  </AppText>
                }
                renderItem={({ item: entry }: { item: PickerListItem }) => {
                  if (entry.type === "header") {
                    return (
                      <AppText
                        variant="bodySmallBold"
                        tone="secondary"
                        accessibilityRole="header"
                        style={{ paddingTop: spacing[3], paddingBottom: spacing[1] }}
                      >
                        {entry.title}
                      </AppText>
                    );
                  }
                  const item = entry.row;
                  const isDish = item.kind === "dish";
                  const title = isDish ? item.dish.name : item.venue.name;
                  const subtitle = pickerRowSubtitle(item);
                  const thumbnail = isDish ? item.dish.imageUrl : item.venue.imageUrl;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isDish
                          ? `Review ${title} at ${item.dish.venueName}`
                          : `Choose a dish at ${title}`
                      }
                      onPress={() =>
                        isDish
                          ? chooseDish(item.dish.venueId, item.dish.id)
                          : setPickerVenueId(item.venue.id)
                      }
                      style={{
                        paddingVertical: spacing[3],
                        borderBottomWidth: 1,
                        borderBottomColor: palette.border,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[3],
                        }}
                      >
                        {thumbnail ? (
                          <AccessibleImage
                            decorative
                            source={{ uri: thumbnail }}
                            style={{ width: 40, height: 40, borderRadius: radii.md }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: radii.md,
                              backgroundColor: palette.bgSoft,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <AppSymbol name="dish" size={18} color={palette.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <AppText style={{ fontWeight: "600" }}>{title}</AppText>
                          {subtitle ? (
                            <AppText variant="bodySmall" tone="secondary">
                              {subtitle}
                            </AppText>
                          ) : null}
                        </View>
                        {isDish ? null : (
                          <AppSymbol name="chevronRight" size={18} color={palette.textMuted} />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </Modal>
      </Screen>
    </EdgeSwipeZones>
  );
}
