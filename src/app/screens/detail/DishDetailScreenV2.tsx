import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  Text,
} from "react-native";
import type { ColorValue } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  Circle,
  Heart,
  FolderPlus,
  CheckCircle,
  MapPin,
  PenLine,
  Send,
  Star,
  Utensils,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useDetailSaveActions } from "@/features/checklistPortfolio/DetailSaveActions";
import { resolveStallOpenInfo } from "@/features/detail/stallOpenState";
import {
  perceivedTasteAxes,
  perceivedTasteRows,
  perceivedTasteSentence,
} from "@/features/detail/perceivedTaste";
import {
  formatAwayLabel,
  similarDishQuery,
  useSimilarDishesNearby,
} from "@/features/detail/similarDishes";
import { isSoldOut } from "@/features/merchant/menuSections";
import { DeliveryButtonRow } from "@/components/dish/DeliveryPlatformButton";
import { DetailActionBar, type DetailAction } from "@/components/detail/DetailActionBar";
import { FloatingBackButton } from "@/components/detail/FloatingBackButton";
import { TasteRadarChart } from "@/components/taste/TasteRadarChart";
import { PhotoPager } from "@/components/dish/PhotoPager";
import { ReportProblemLink } from "@/components/stall/ReportProblemLink";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { DietaryFlagChips } from "@/components/dish/DietaryFlagChips";
import {
  CaptionPreview,
  OwnReviewActions,
  ReviewPhotoStrip,
  ReviewReaderActions,
  StarRating,
} from "@/components/review";
import { isOwnReview } from "@/features/review/reviewEdit";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useAchievementTallyStore, triedDishFacts } from "@/store/useAchievementTallyStore";
import { useDishLikeStore } from "@/store/useDishLikeStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { saveDishAfterSignIn } from "@/features/auth/finishGuestAction";
import { rememberPendingDishSave } from "@/features/auth/pendingDishSave";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useUIStore } from "@/store/useUIStore";
import { useSocialStore } from "@/store/useSocialStore";
import {
  AccessibleImage,
  AppText,
  Avatar,
  Button,
  ChipGroup,
  EmptyState,
  FeedErrorBoundary,
} from "@/components/ui";
import { REVIEW_EDITOR_TAGS, REVIEW_VALUE_TAGS } from "@/constants/taste";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import type { DishDetail, OpeningSchedule, PublicMerchantProfile, Review } from "@/types/domain";
import { hasDishTasteSignal, isNeutralTasteVector } from "@/lib/ai/tasteEngine";
import { tapHaptic } from "@/lib/haptics";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { openStallFromDish } from "./stallNavigation";
import {
  formatHoursRows,
  getHoursForDay,
  getSingaporeDay,
  getVenueOpenState,
  parseOperatingHours,
} from "@/utils/operatingHours";
import { webShareUrl } from "@/constants/links";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { firstDishTimingProps } from "@/lib/analytics/firstDishTiming";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { formatFullStallAddress, getStallPin } from "@/features/detail/stallLocation";

/** Reviews shown before "See all". */
const DISH_REVIEW_PREVIEW_COUNT = 3;
/** Taste words offered in the "you tried it" popup (value tags belong in the full review). */
const TRIED_PROMPT_TASTE_TAGS = REVIEW_EDITOR_TAGS.filter(
  (tag) => !REVIEW_VALUE_TAGS.includes(tag),
);
/** One page of a dish's reviews, newest first. */
const DISH_REVIEW_PAGE_SIZE = 50;
/** Below this confidence a dish's taste vector is too weak to show as fact. */
const MIN_DISPLAY_TASTE_CONFIDENCE = 0.3;
/** Other dishes from the same stall shown under "More from {stall}". */
const MORE_FROM_STALL_COUNT = 4;

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">;

/** Other dishes from the same stall; never the dish being viewed. */
function getMoreFromStall(currentDish: DishDetail, venueDishes: DishDetail[]) {
  const byId = new Map<string, DishDetail>();
  venueDishes.forEach((dish) => {
    if (dish.id !== currentDish.id) byId.set(dish.id, dish);
  });
  return Array.from(byId.values()).slice(0, MORE_FROM_STALL_COUNT);
}

export function DishDetailScreenV2({ navigation, route }: Props) {
  const repository = getDataRepository();
  const dishId = route.params?.dishId ?? route.params?.id ?? "";
  const cachedDish = repository.getDishById(dishId);
  const [hydratedDish, setHydratedDish] = useState<DishDetail | undefined>();
  const [hasLoadedDishDetail, setHasLoadedDishDetail] = useState(Boolean(cachedDish));
  const [dishLoadFailed, setDishLoadFailed] = useState(false);
  const [dishReloadKey, setDishReloadKey] = useState(0);
  const dish = hydratedDish ?? cachedDish;
  const { componentRadii, palette, radii, spacing, shadows } = useHungryTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const likedDishIdsByUser = useDishLikeStore((state) => state.likedDishIdsByUser);
  const toggleDishLike = useDishLikeStore((state) => state.toggleLike);
  const recordTriedDish = useAchievementTallyStore((state) => state.recordTriedDish);
  const forgetTriedDish = useAchievementTallyStore((state) => state.forgetTriedDish);
  const setDishTried = useProfileStore((state) => state.setDishTried);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const markTried = useStallInteractionStore((state) => state.markTried);
  const loadStallInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const lastRecordedDishViewId = useRef<string | null>(null);
  const [isTryingFood, setIsTryingFood] = useState(false);
  // After marking a dish tried: an optional popup to rate it and say how it tasted.
  const [triedPromptOpen, setTriedPromptOpen] = useState(false);
  const [triedRating, setTriedRating] = useState(0);
  const [triedTags, setTriedTags] = useState<string[]>([]);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const selectReviewDish = useReviewDraftStore((state) => state.selectDish);
  const setReviewRating = useReviewDraftStore((state) => state.setRating);
  const toggleReviewTag = useReviewDraftStore((state) => state.toggleTag);
  const resetReviewDraft = useReviewDraftStore((state) => state.resetDraft);
  const [openingSchedule, setOpeningSchedule] = useState<OpeningSchedule>();
  const [merchantProfile, setMerchantProfile] = useState<PublicMerchantProfile>();
  const [dishReviews, setDishReviews] = useState<Review[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const {
    addToPortfolio,
    collectionOptions,
    collectionsLoading,
    isAddingToPortfolio,
    loadCollections,
    saveToListSheet,
    togglePortfolio,
  } = useDetailSaveActions({
    navigation,
    target: {
      itemType: "dish",
      id: dishId,
      label: dish?.name ?? "This dish",
      venueId: dish?.venueId,
    },
  });

  const cachedVenue = useMemo(
    () => (dish ? repository.getVenueById(dish.venueId) : undefined),
    [dish, repository],
  );
  const [hydratedVenue, setHydratedVenue] = useState<typeof cachedVenue>();
  // A failed stall read shows a retry row instead of silently dropping the stall sections.
  const [venueLoadFailed, setVenueLoadFailed] = useState(false);
  const [venueReloadKey, setVenueReloadKey] = useState(0);
  const venue = hydratedVenue ?? cachedVenue;

  const gallery = useMemo(
    () =>
      dish
        ? buildDishGallery(dish)
            .map((imageUrl) => sanitizeCatalogImageUrl(imageUrl))
            .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
        : [],
    [dish],
  );
  const heroImage = gallery[0] ?? sanitizeCatalogImageUrl(dish?.imageUrl);
  // "Photos from reviews" rail: newest reviews first, at most 12 photos.
  const reviewPhotos = useMemo(
    () =>
      dishReviews
        .flatMap((review) => review.photos ?? [])
        .map((photo) => sanitizeCatalogImageUrl(photo))
        .filter((photo): photo is string => Boolean(photo))
        .slice(0, 12),
    [dishReviews],
  );
  const cachedVenueDishes = useMemo(
    () => (dish ? repository.listDishesByVenue(dish.venueId) : []),
    [dish, repository],
  );
  const [fetchedVenueDishes, setFetchedVenueDishes] = useState<DishDetail[] | undefined>();
  const venueDishes = fetchedVenueDishes ?? cachedVenueDishes;
  const moreFromStall = useMemo(
    () => (dish ? getMoreFromStall(dish, venueDishes) : []),
    [dish, venueDishes],
  );
  // "Similar <dish> nearby": the same kind of dish at other stalls around this one.
  const similarSearchPoint = useMemo(() => {
    if (!venue) return undefined;
    const buildingPoint = getBuildingById(venue.buildingId)?.coordinate;
    return getStallPin(venue, buildingPoint) ?? buildingPoint;
  }, [venue]);
  const similarNearby = useSimilarDishesNearby(dish, similarSearchPoint);
  const similarDishHeading = dish ? similarDishQuery(dish.name) || dish.name : "dishes";

  // One shared helper decides open/closed for both pages: the owner's temporary closure,
  // then the weekly schedule with special hours, then the listed hours text.
  const openInfo = useMemo(
    () =>
      venue
        ? resolveStallOpenInfo({
            venue,
            schedule: openingSchedule,
            temporaryClosure: merchantProfile?.temporaryClosure,
          })
        : undefined,
    [merchantProfile?.temporaryClosure, openingSchedule, venue],
  );

  useEffect(() => {
    let active = true;
    setHydratedDish(undefined);
    setDishLoadFailed(false);
    setHasLoadedDishDetail(Boolean(cachedDish));
    if (!dishId || cachedDish) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getDish(dishId)
      .then((nextDish) => {
        if (!active) return;
        setHydratedDish(nextDish);
        setHasLoadedDishDetail(true);
      })
      .catch(() => {
        if (!active) return;
        setDishLoadFailed(true);
        setHasLoadedDishDetail(true);
      });

    return () => {
      active = false;
    };
  }, [cachedDish, dishId, dishReloadKey]);

  // A cold cache holds only this dish: read the stall's menu for "More from {stall}".
  const venueIdForMenu = dish?.venueId;
  const needsVenueMenu = cachedVenueDishes.filter((item) => item.id !== dish?.id).length === 0;
  useEffect(() => {
    let active = true;
    setFetchedVenueDishes(undefined);
    if (!venueIdForMenu || !needsVenueMenu) {
      return () => {
        active = false;
      };
    }
    void getHungryService()
      .discovery.listDishesByVenue(venueIdForMenu)
      .then((nextDishes) => {
        if (active) setFetchedVenueDishes(nextDishes);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [needsVenueMenu, venueIdForMenu]);

  useEffect(() => {
    let active = true;
    setHydratedVenue(undefined);
    setVenueLoadFailed(false);
    if (!dish?.venueId || cachedVenue) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getVenue(dish.venueId)
      .then((nextVenue) => {
        if (!active) return;
        setHydratedVenue(nextVenue);
      })
      .catch(() => {
        if (!active) return;
        setVenueLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [cachedVenue, dish?.venueId, venueReloadKey]);

  // The saved/visited map loads here too, so "Tried" never re-marks a stall already visited.
  useEffect(() => {
    if (isAuthenticated) void loadStallInteractions(profile.id).catch(() => undefined);
  }, [isAuthenticated, loadStallInteractions, profile.id]);

  // The owner's schedule (special hours) and temporary closure decide "Open now", as on the stall page.
  const hoursVenueId = dish?.venueId;
  useEffect(() => {
    let active = true;
    setOpeningSchedule(undefined);
    setMerchantProfile(undefined);
    if (!hoursVenueId) {
      return () => {
        active = false;
      };
    }
    void getHungryService()
      .discovery.getVenueOpeningSchedule(hoursVenueId)
      .then((schedule) => {
        if (active) setOpeningSchedule(schedule);
      })
      .catch(() => undefined);
    void getHungryService()
      .discovery.getPublicMerchantProfile(hoursVenueId)
      .then((nextProfile) => {
        if (active) setMerchantProfile(nextProfile);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [hoursVenueId]);

  // The cached dish carries no reviews, so always read them from the reviews service.
  const reviewDishId = dish?.id;
  const reviewDishIdRef = useRef(reviewDishId);
  useEffect(() => {
    reviewDishIdRef.current = reviewDishId;
  }, [reviewDishId]);
  useEffect(() => {
    let active = true;
    setShowAllReviews(false);
    if (!reviewDishId) {
      return () => {
        active = false;
      };
    }
    setReviewsStatus("loading");
    getHungryService()
      .reviews.listRecentReviews({ dishIds: [reviewDishId], limit: DISH_REVIEW_PAGE_SIZE })
      .then((entries) => {
        if (!active) return;
        setDishReviews(entries.map((entry) => entry.review));
        setHasMoreReviews(entries.length === DISH_REVIEW_PAGE_SIZE);
        setReviewsStatus("ready");
      })
      .catch(() => {
        if (active) setReviewsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [reviewDishId, reviewsReloadKey]);

  const loadMoreReviews = () => {
    const last = dishReviews[dishReviews.length - 1];
    if (!reviewDishId || !last?.createdAt || isLoadingMoreReviews) return;
    const requestedDishId = reviewDishId;
    setIsLoadingMoreReviews(true);
    getHungryService()
      .reviews.listRecentReviews({
        dishIds: [requestedDishId],
        limit: DISH_REVIEW_PAGE_SIZE,
        // Both cursor parts: reviews sharing the boundary timestamp are not skipped.
        before: last.createdAt,
        beforeId: last.id,
      })
      .then((entries) => {
        // The viewer moved to another dish while this page loaded.
        if (requestedDishId !== reviewDishIdRef.current) return;
        setDishReviews((current) => {
          const known = new Set(current.map((review) => review.id));
          return [
            ...current,
            ...entries.map((entry) => entry.review).filter((review) => !known.has(review.id)),
          ];
        });
        setHasMoreReviews(entries.length === DISH_REVIEW_PAGE_SIZE);
      })
      .catch(() => {
        showToast({ message: "Couldn't load more reviews. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMoreReviews(false));
  };

  useEffect(() => {
    if (!dish || lastRecordedDishViewId.current === dish.id) return;
    lastRecordedDishViewId.current = dish.id;
    trackAnalyticsEvent(
      "dish_viewed",
      { dish_id: dish.id, venue_id: dish.venueId, ...firstDishTimingProps() },
      isAuthenticated ? { userId: profile.id } : undefined,
    );
    void getHungryService().discovery.recordDishView(dish.id, {
      userId: isAuthenticated ? profile.id : undefined,
    });
  }, [dish, isAuthenticated, profile.id]);

  // Deep links can open a missing dish with no history; never leave a dead end.
  const leaveDetail = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Discover" });
  };

  // The dish renders as soon as it arrives; stall-only sections fill in when the venue read lands.
  const isDetailLoading = Boolean(dishId) && !dish && !hasLoadedDishDetail;

  if (isDetailLoading) {
    return (
      <SafeAreaView
        style={{
          alignItems: "center",
          backgroundColor: palette.bg,
          flex: 1,
          justifyContent: "center",
          padding: spacing[6],
        }}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator color={palette.orange} />
        <AppText variant="bodySmall" tone="secondary" style={{ marginTop: spacing[3] }}>
          Loading dish details...
        </AppText>
      </SafeAreaView>
    );
  }

  // A cold-start shared link opens this screen with nothing underneath it.
  const goBackOrHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  if (!dish) {
    return (
      <FeedErrorBoundary
        title="Dish details unavailable"
        body="Couldn't load this dish — try again."
      >
        <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["top"]}>
          <View style={{ paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={leaveDetail}
              style={{ alignSelf: "flex-start" }}
            >
              <ArrowLeft color={palette.text} size={24} />
            </Pressable>
          </View>
          {dishLoadFailed ? (
            <EmptyState
              title="Couldn't load this dish"
              body="Check your connection and try again."
              ctaLabel="Try again"
              onPress={() => setDishReloadKey((key) => key + 1)}
            />
          ) : (
            <EmptyState
              title="We can't find this dish"
              body="It may have been removed or renamed by the stall. Try searching for it instead."
              ctaLabel="Search dishes"
              onPress={() => navigation.navigate("MainTabs", { screen: "Discover" })}
            />
          )}
          <View style={{ paddingHorizontal: spacing[6], paddingBottom: spacing[6] }}>
            <Button
              label={navigation.canGoBack() ? "Go back" : "Go to Home"}
              variant="secondary"
              onPress={goBackOrHome}
            />
          </View>
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const isSaved = profile.favouriteDishIds.includes(dish.id);
  // The venue read can fail on its own: keep the dish page and drop venue-only sections.
  const venueName = venue?.name ?? dish.venueName ?? "This stall";
  const venueUnit = venue?.unitNumber?.trim();
  const openState = openInfo?.openState ?? { status: "unknown" as const };
  const openStatusLabel = openInfo?.statusLabel ?? "Hours not listed";
  const deliveryLinks = venue?.deliveryLinks ?? [];
  const isDishSoldOut = isSoldOut(dish.availabilityFlags);
  const building = venue ? getBuildingById(venue.buildingId) : undefined;
  const stallAddress = venue
    ? formatFullStallAddress(venue, {
        name: venue.buildingName ?? building?.name,
        address: venue.address ?? (building as { address?: string } | undefined)?.address,
        postalCode:
          venue.postalCode ?? (building as { postalCode?: string } | undefined)?.postalCode,
      })
    : "";
  // Untagged dishes carry a neutral placeholder vector: never show it as fact.
  const hasTasteSignal =
    hasDishTasteSignal(dish) && (dish.tasteConfidence ?? 1) >= MIN_DISPLAY_TASTE_CONFIDENCE;
  // A diner who has not set a taste palette still sees the standard level, never a made-up one.
  const hasPersonalPalate = !isNeutralTasteVector(profile.tasteVector);
  const perceivedRows = hasTasteSignal
    ? perceivedTasteRows(dish.tasteVector, profile.tasteVector)
    : [];
  const savedCount = dish.savedCount ?? 0;
  const savedCountLabel =
    savedCount > 0 ? `${savedCount} ${savedCount === 1 ? "person" : "people"} saved this` : null;
  // Dish photos first, then photos from reviews, swipeable in the hero.
  const heroPhotos = Array.from(
    new Set([...gallery, ...(dish.imageUrl ? [dish.imageUrl] : []), ...reviewPhotos]),
  ).slice(0, 8);
  // Short enough that the stall card and Order on show without scrolling; shorter still
  // with no photo, where the name below already says what the dish is.
  const heroHeight = heroPhotos.length > 0 ? Math.min(width * 0.62, 300) : 140;
  const signatureGridItemWidth = Math.min(width * 0.56, 220);
  const canonicalDishUrl = webShareUrl("dish", dish.id);
  const heroGradientColors: readonly [ColorValue, ColorValue, ColorValue] = [
    palette.detailHeroGradientStart,
    palette.detailHeroGradientMid,
    palette.bg,
  ];
  const dishPrice = formatDishPrice(dish);
  const shareReviewTarget: ReviewShareTarget = {
    kind: "dish",
    reviewId: `dish-${dish.id}`,
    postId: "",
    title: dish.name,
    subtitle: [venueName, venueUnit].filter(Boolean).join(" · "),
    imageUrl: heroImage ?? "",
    authorName: profile.displayName,
    message: `${dish.name} at ${venueName}.${dish.price > 0 ? ` ${dishPrice}.` : ""}`,
    link: canonicalDishUrl,
  };

  // The merchant "share" counts a completed share, not an opened sheet.
  const recordMerchantShare = () => {
    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "share",
      venueId: dish.venueId,
      dishId: dish.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
  };

  const openReviewerProfile = (review: Review) => {
    if (!review.authorId) return;
    navigation.navigate("UserProfile", {
      authorId: review.authorId,
      authorName: review.authorName,
      authorAvatarUrl: review.authorAvatarUrl,
    });
  };

  const openShareSheet = () => {
    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const handleSave = async () => {
    // Backstop (the app is sign-in only): kept on the device if a sign-in has to finish it.
    if (!isAuthenticated) rememberPendingDishSave(dish);
    if (
      !requireAccount(
        `Sign in to save ${dish.name}`,
        { name: "DishDetail", params: { dishId: dish.id } },
        () => saveDishAfterSignIn(dish),
      )
    ) {
      return;
    }

    const result = await toggleFavourite(dish);
    if (result.status === "failed") {
      // A tap while a toggle is pending changes nothing: no toast for it.
      if (result.reason !== "pending") showToast({ message: result.message, tone: "error" });
      return;
    }
    if (result.status === "saved") {
      void getHungryService().discovery.recordMerchantActionEvent({
        eventType: "save",
        venueId: dish.venueId,
        dishId: dish.id,
        userId: profile.id,
      });
    }
    showToast({
      message: result.status === "saved" ? "Saved to Want to try." : "Removed from Want to try.",
      tone: "success",
    });
  };

  const handleReview = () => {
    trackAnalyticsEvent("review_cta_tapped", {
      dish_id: dish.id,
      stall_id: dish.venueId,
      source_screen: "DishDetail",
    });
    if (!isAuthenticated) {
      setReturnRoute({
        name: "ReviewStack",
        params: {
          screen: "ReviewMain",
          params: { venueId: dish.venueId, dishId: dish.id },
        },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: dish.venueId, dishId: dish.id },
    });
  };

  const isDishTried = profile.reviewedDishIds.includes(dish.id);
  const hasReviewed = dishReviews.some((review) =>
    isOwnReview(review, isAuthenticated ? profile.id : undefined),
  );

  // From the "you tried it" popup: the review starts with the stars and taste words filled in.
  // A draft for another dish is left alone so the review screen can ask what to do with it.
  const continueTriedReview = () => {
    setTriedPromptOpen(false);
    const { draft } = useReviewDraftStore.getState();
    if (!draft.selectedDishId || draft.selectedDishId === dish.id) {
      if (draft.selectedDishId !== dish.id) resetReviewDraft();
      selectReviewDish(dish.venueId, dish.id);
      if (triedRating > 0) setReviewRating(triedRating);
      const chosen = useReviewDraftStore.getState().draft.selectedTags;
      for (const tag of triedTags) if (!chosen.includes(tag)) toggleReviewTag(tag);
    }
    handleReview();
  };
  const openTriedPrompt = () => {
    setTriedRating(0);
    setTriedTags([]);
    setTriedPromptOpen(true);
  };

  const triedToastStyle = {
    tone: "success" as const,
    backgroundColor: palette.surfaceTranslucent,
    borderColor: palette.orange,
    textColor: palette.text,
    iconColor: palette.text,
    borderWidth: 1,
    duration: 3000,
  };

  // "Tried" is per dish. Trying a dish marks the stall visited the first time;
  // un-marking a dish never clears the stall (other dishes may be tried too).
  const handleTryFood = async () => {
    if (isTryingFood) return;

    if (!isAuthenticated) {
      setReturnRoute({
        name: "DishDetail",
        params: { dishId: dish.id },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    if (isDishTried) {
      setIsTryingFood(true);
      try {
        const saved = await setDishTried(dish.id, false);
        const stillTried = useProfileStore.getState().profile.reviewedDishIds.includes(dish.id);
        if (saved && !stillTried) forgetTriedDish(profile.id, dish.id);
        showToast({
          message: !saved
            ? "Couldn't update your tried dishes. Try again."
            : stillTried
              ? "You reviewed this dish, so it stays in your tried dishes."
              : "Removed from your tried dishes.",
          ...triedToastStyle,
        });
      } finally {
        setIsTryingFood(false);
      }
      return;
    }

    setIsTryingFood(true);
    try {
      if (!(await setDishTried(dish.id, true))) {
        showToast({ message: "Couldn't mark this dish as tried. Try again.", ...triedToastStyle });
        return;
      }
      recordTriedDish(profile.id, dish.id, triedDishFacts(dish, hasTasteSignal));
      trackAnalyticsEvent("dish_marked_tried", { dish_id: dish.id, stall_id: dish.venueId });
      let pointsAwarded = 0;
      let stallMarkFailed = false;
      // Read the saved stalls first so an already-visited stall is never marked again.
      await loadStallInteractions(profile.id).catch(() => undefined);
      if (!useStallInteractionStore.getState().getInteraction(dish.venueId)?.isTried) {
        try {
          const result = await markTried(profile.id, dish.venueId, "DishDetail");
          pointsAwarded = result.pointsAwarded;
        } catch {
          // The store rolled the stall mark back; the dish itself is marked.
          stallMarkFailed = true;
        }
      }
      showToast({
        message: stallMarkFailed
          ? "Marked as tried, but couldn't mark the stall visited. Try again from the stall page."
          : FEATURE_FLAGS.gamificationEnabled && pointsAwarded > 0
            ? `Marked as tried. +${pointsAwarded} Food Cred`
            : "Marked as tried.",
        ...triedToastStyle,
      });
      // Rating only makes sense once the dish is tried; both the stars and the taste are optional.
      if (!FEATURE_FLAGS.release01CoreOnly && FEATURE_FLAGS.reviewCreationEnabled && !hasReviewed) {
        openTriedPrompt();
      }
    } finally {
      setIsTryingFood(false);
    }
  };

  // Staging and production are a read-only Release 0.1 catalog experience.
  // Keep deferred write and social controls available for local development,
  // but never render them from a released build even when an unrelated flag
  // is accidentally enabled for targeted QA.
  const showDeferredDetailControls = !FEATURE_FLAGS.release01CoreOnly;

  const isLiked = (likedDishIdsByUser[profile.id] ?? []).includes(dish.id);
  const handleLike = () => {
    if (
      !requireAccount(`Sign in to like ${dish.name}`, {
        name: "DishDetail",
        params: { dishId: dish.id },
      })
    ) {
      return;
    }
    const liked = toggleDishLike(profile.id, dish.id);
    showToast({ message: liked ? "Liked." : "Like removed.", tone: "success" });
  };

  const setTried = (tried: boolean) => {
    if (tried !== isDishTried) void handleTryFood();
  };

  // Bottom bar: Review on the left; Share, Tried, Save and Like on the right. Holding Tried
  // or Save opens its own menu (tried / not tried, collections); Share and Like are taps.
  const barActions: DetailAction[] = showDeferredDetailControls
    ? [
        {
          id: "share",
          label: "Share",
          icon: Send,
          onPress: openShareSheet,
          accessibilityLabel: `Share ${dish.name}`,
        },
        {
          id: "tried",
          label: isDishTried ? "Tried" : "Mark tried",
          // Not tried: a plain grey circle. Tried: an orange tick.
          icon: isDishTried ? CheckCircle : Circle,
          active: isDishTried,
          mutedWhenInactive: true,
          role: "checkbox" as const,
          loading: isTryingFood,
          onPress: () => void handleTryFood(),
          accessibilityLabel: "Tried",
          holdTitle: "Have you tried it?",
          holdOptions: [
            {
              id: "tried",
              label: "Tried",
              icon: CheckCircle,
              selected: isDishTried,
              onPress: () => setTried(true),
            },
            {
              id: "not-tried",
              label: "Not tried",
              icon: Circle,
              selected: !isDishTried,
              onPress: () => setTried(false),
            },
          ],
        },
        ...(FEATURE_FLAGS.favouritesEnabled
          ? [
              {
                id: "save",
                label: isSaved ? "Saved" : "Save",
                icon: Bookmark,
                active: isSaved,
                fillWhenActive: true,
                onPress: () => void handleSave(),
                accessibilityLabel: isSaved ? "Saved" : "Save",
                accessibilityHint: isSaved
                  ? "Removes this dish from Want to try. Hold to pick a collection"
                  : "Hold to pick a collection",
                ...(FEATURE_FLAGS.portfoliosEnabled
                  ? {
                      holdTitle: "Save to",
                      onHoldOpen: () => void loadCollections(),
                      holdLoading: collectionsLoading,
                      holdOptions: [
                        {
                          id: "want-to-try",
                          label: "Want to try",
                          icon: Bookmark,
                          selected: isSaved,
                          onPress: () => void handleSave(),
                        },
                        ...(collectionsLoading
                          ? []
                          : collectionOptions.map(({ option, selected }) => ({
                              id: option.key,
                              label: option.name,
                              icon: FolderPlus,
                              selected,
                              onPress: () => void togglePortfolio(option),
                            }))),
                        {
                          id: "all-lists",
                          label: isAddingToPortfolio ? "Adding..." : "New collection",
                          icon: FolderPlus,
                          onPress: () => void addToPortfolio(),
                          accessibilityLabel: "Save to a new collection",
                        },
                      ],
                    }
                  : {}),
              },
            ]
          : []),
        {
          id: "like",
          label: isLiked ? "Liked" : "Like",
          icon: Heart,
          active: isLiked,
          fillWhenActive: true,
          onPress: handleLike,
          accessibilityLabel: isLiked ? "Unlike this dish" : "Like this dish",
        },
      ]
    : [];

  return (
    <FeedErrorBoundary title="Dish details unavailable" body="Couldn't load this dish — try again.">
      <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 96,
            }}
          >
            <View style={{ height: heroHeight }}>
              {heroPhotos.length > 0 ? (
                <PhotoPager
                  photos={heroPhotos}
                  width={width}
                  height={heroHeight}
                  subject={dish.name}
                  countBottomOffset={spacing[12] + spacing[2]}
                >
                  <LinearGradient
                    colors={heroGradientColors}
                    locations={[0, 0.58, 1]}
                    style={{
                      bottom: 0,
                      height: Math.min(260, heroHeight),
                      left: 0,
                      position: "absolute",
                      right: 0,
                    }}
                  />
                </PhotoPager>
              ) : (
                <>
                  <View
                    accessibilityRole="image"
                    accessibilityLabel={`${dish.name} photo unavailable`}
                    style={{
                      alignItems: "center",
                      backgroundColor: palette.surfaceRaised,
                      flex: 1,
                      justifyContent: "center",
                      padding: spacing[6],
                    }}
                  >
                    <Utensils color={palette.orange} size={36} />
                  </View>
                  <LinearGradient
                    colors={heroGradientColors}
                    locations={[0, 0.58, 1]}
                    style={{
                      bottom: 0,
                      height: Math.min(260, heroHeight),
                      left: 0,
                      position: "absolute",
                      right: 0,
                    }}
                  />
                </>
              )}
            </View>

            <View
              style={{
                gap: spacing[5],
                marginTop: spacing[4],
                paddingHorizontal: spacing[4],
              }}
            >
              <View style={{ gap: spacing[3] }}>
                {dish.mustOrder ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: palette.amberLight,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="bodySmallBold" style={{ color: palette.warningText }}>
                      MUST ORDER
                    </AppText>
                  </View>
                ) : null}
                <View
                  style={{
                    alignItems: "flex-start",
                    flexDirection: "row",
                    gap: spacing[3],
                    justifyContent: "space-between",
                  }}
                >
                  <AppText variant="h1" style={{ flex: 1, fontSize: 28, lineHeight: 34 }}>
                    {dish.name}
                  </AppText>
                  <AppText
                    variant="price"
                    style={
                      dish.price > 0
                        ? { color: palette.orange, fontSize: 24, lineHeight: 34 }
                        : { color: palette.textSecondary, fontSize: 16, lineHeight: 34 }
                    }
                  >
                    {dishPrice}
                  </AppText>
                </View>
                {isDishSoldOut ? (
                  <View
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel="Sold out today"
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: palette.bgSoft,
                      borderColor: palette.border,
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                    }}
                  >
                    <AppText variant="bodySmallBold" tone="secondary">
                      Sold out today
                    </AppText>
                  </View>
                ) : null}
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[3],
                  }}
                >
                  {dish.reviewCount > 0 ? (
                    <View
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={`Rated ${dish.rating.toFixed(1)} out of 5 from ${
                        dish.reviewCount
                      } ${dish.reviewCount === 1 ? "review" : "reviews"}`}
                      style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                    >
                      {/* One star and the exact score: five rounded stars hid 4.4 vs 3.6. */}
                      <Star color={palette.starStroke} fill={palette.starFill} size={17} />
                      <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                        {dish.rating.toFixed(1)}
                      </AppText>
                      <AppText variant="bodySmall" tone="secondary">
                        ({dish.reviewCount} {dish.reviewCount === 1 ? "review" : "reviews"})
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="bodySmall" tone="secondary">
                      No ratings yet
                    </AppText>
                  )}
                  {savedCountLabel ? (
                    <View
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={savedCountLabel}
                      style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                    >
                      <Bookmark color={palette.textSecondary} size={15} />
                      <AppText variant="bodySmall" tone="secondary">
                        {savedCountLabel}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                {dish.dietaryFlags.length > 0 ? (
                  <View style={{ gap: spacing[1] }}>
                    <DietaryFlagChips flags={dish.dietaryFlags} />
                    <AppText variant="micro" tone="muted">
                      Labels come from the stall or our catalogue. Check with the stall if it
                      matters to you.
                    </AppText>
                  </View>
                ) : null}
                {dish.description?.trim() ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint={descriptionExpanded ? "Shows less" : "Shows the full text"}
                    onPress={() => setDescriptionExpanded((open) => !open)}
                  >
                    <AppText
                      variant="body"
                      tone="secondary"
                      numberOfLines={descriptionExpanded ? undefined : 3}
                    >
                      {dish.description}
                    </AppText>
                  </Pressable>
                ) : null}
                {formatDishUpdated(dish.updatedAt) ? (
                  <AppText variant="bodySmall" tone="muted">
                    {formatDishUpdated(dish.updatedAt)}
                  </AppText>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${venueName} stall details`}
                onPress={() => {
                  tapHaptic();
                  openStallFromDish(navigation, dish.venueId);
                }}
                style={({ pressed }) => [
                  {
                    alignItems: "center",
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderRadius: componentRadii.card,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: spacing[3],
                    opacity: pressed ? 0.85 : 1,
                    padding: spacing[3],
                  },
                  shadows.card,
                ]}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.orangeLight,
                    borderRadius: radii.pill,
                    height: 44,
                    justifyContent: "center",
                    width: 44,
                  }}
                >
                  <MapPin color={palette.orange} size={20} />
                </View>
                <View style={{ flex: 1, gap: spacing[0.5] }}>
                  <AppText variant="bodyBold" numberOfLines={1}>
                    {venueName}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                    {[venueUnit, venue?.buildingName ?? building?.name]
                      .filter(Boolean)
                      .join(" · ") || "View stall"}
                  </AppText>
                  {venue ? (
                    <AppText
                      variant="bodySmallBold"
                      tone={openState.status === "open" ? "success" : "secondary"}
                    >
                      {openStatusLabel}
                    </AppText>
                  ) : null}
                </View>
                <ChevronRight color={palette.textMuted} size={20} />
              </Pressable>

              {venue && deliveryLinks.length > 0 ? (
                <View style={{ gap: spacing[2] }}>
                  <AppText variant="bodySmallBold" tone="secondary">
                    ORDER ON
                  </AppText>
                  <DeliveryButtonRow links={deliveryLinks} dishId={dish.id} venueId={venue.id} />
                </View>
              ) : null}

              {hasTasteSignal ? (
                <View style={{ gap: spacing[3] }}>
                  <View style={{ gap: spacing[1] }}>
                    <AppText variant="h2">How it tastes to you</AppText>
                  </View>
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      gap: spacing[4],
                      padding: spacing[4],
                    }}
                  >
                    <TasteRadarChart
                      axes={perceivedTasteAxes(
                        dish.tasteVector,
                        hasPersonalPalate ? profile.tasteVector : undefined,
                      )}
                      size={Math.min(width - spacing[4] * 4, 300)}
                    />
                    {hasPersonalPalate ? (
                      perceivedRows
                        .filter((row) => row.direction !== "same")
                        .slice(0, 2)
                        .map((row) => (
                          <AppText key={row.key} variant="bodySmall" tone="secondary">
                            {perceivedTasteSentence(row)}
                          </AppText>
                        ))
                    ) : (
                      <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
                        Set your taste palette in Profile to see how it tastes to you.
                      </AppText>
                    )}
                  </View>
                </View>
              ) : null}

              {!venue && venueLoadFailed ? (
                <Pressable
                  onPress={() => setVenueReloadKey((key) => key + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Couldn't load stall details. Retry"
                  style={{ paddingVertical: spacing[3] }}
                >
                  <AppText tone="secondary">
                    Couldn&apos;t load stall details. Tap to retry.
                  </AppText>
                </Pressable>
              ) : null}

              {moreFromStall.length > 0 ? (
                <View style={{ gap: spacing[3] }}>
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      gap: spacing[2],
                      marginHorizontal: 0,
                    }}
                  >
                    <Utensils color={palette.orange} size={20} />
                    <AppText variant="h2" style={{ flex: 1 }} numberOfLines={1}>
                      More from {venueName}
                    </AppText>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{
                      marginHorizontal: -spacing[4],
                    }}
                    contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
                  >
                    {moreFromStall.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${item.name}, ${
                          isSoldOut(item.availabilityFlags)
                            ? "sold out today"
                            : formatDishPrice(item)
                        }`}
                        // push, not navigate: each dish gets its own screen, so Back returns here.
                        onPress={() => navigation.push("DishDetail", { dishId: item.id })}
                        style={{
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                          borderRadius: componentRadii.card,
                          borderWidth: 1,
                          overflow: "hidden",
                          width: signatureGridItemWidth,
                        }}
                      >
                        {sanitizeCatalogImageUrl(item.imageUrl) ? (
                          <AccessibleImage
                            source={{ uri: sanitizeCatalogImageUrl(item.imageUrl) }}
                            contentFit="cover"
                            style={{ width: "100%", height: signatureGridItemWidth * 0.62 }}
                            decorative
                          />
                        ) : (
                          <NoDishPhoto
                            dishName={item.name}
                            style={{ width: "100%", height: signatureGridItemWidth * 0.62 }}
                          />
                        )}
                        <View style={{ gap: spacing[1], padding: spacing[3] }}>
                          <AppText variant="bodyBold" numberOfLines={1}>
                            {item.name}
                          </AppText>
                          <AppText variant="price" style={{ color: palette.orange }}>
                            {formatDishPrice(item)}
                          </AppText>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {similarNearby.length > 0 ? (
                <View style={{ gap: spacing[3] }}>
                  {/* Under "More from": the same food at other stalls near this one. */}
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    <MapPin color={palette.orange} size={20} />
                    <AppText variant="h2" style={{ flex: 1 }} numberOfLines={2}>
                      {`Other ${similarDishHeading} stalls nearby`}
                    </AppText>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginHorizontal: -spacing[4] }}
                    contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
                  >
                    {similarNearby.map((item) => {
                      const imageUrl = sanitizeCatalogImageUrl(item.imageUrl);
                      const away = formatAwayLabel(item.distanceMeters);
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${item.name} at ${item.venueName}${
                            away ? `, ${away}` : ""
                          }`}
                          onPress={() => {
                            tapHaptic();
                            navigation.push("DishDetail", { dishId: item.id });
                          }}
                          style={({ pressed }) => ({
                            backgroundColor: palette.surface,
                            borderColor: palette.border,
                            borderRadius: componentRadii.card,
                            borderWidth: 1,
                            overflow: "hidden",
                            transform: [{ scale: pressed ? 0.98 : 1 }],
                            width: signatureGridItemWidth,
                          })}
                        >
                          <View>
                            {imageUrl ? (
                              <AccessibleImage
                                source={{ uri: imageUrl }}
                                contentFit="cover"
                                style={{ width: "100%", height: signatureGridItemWidth * 0.62 }}
                                decorative
                              />
                            ) : (
                              <NoDishPhoto
                                dishName={item.name}
                                style={{ width: "100%", height: signatureGridItemWidth * 0.62 }}
                              />
                            )}
                            {away ? (
                              <View
                                style={{
                                  backgroundColor: palette.surface,
                                  borderRadius: radii.pill,
                                  bottom: spacing[2],
                                  left: spacing[2],
                                  paddingHorizontal: spacing[2],
                                  paddingVertical: 2,
                                  position: "absolute",
                                }}
                              >
                                <AppText variant="micro" style={{ fontWeight: "700" }}>
                                  {away}
                                </AppText>
                              </View>
                            ) : null}
                          </View>
                          <View style={{ gap: spacing[0.5], padding: spacing[3] }}>
                            <AppText variant="bodyBold" numberOfLines={1}>
                              {item.venueName}
                            </AppText>
                            <AppText variant="micro" tone="secondary" numberOfLines={1}>
                              {[item.name, item.buildingName].filter(Boolean).join(" · ")}
                            </AppText>
                            {item.price ? (
                              <AppText variant="price" style={{ color: palette.orange }}>
                                {`S$${item.price.toFixed(2)}`}
                              </AppText>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <View style={{ gap: spacing[3] }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <AppText variant="h2">Reviews</AppText>
                  {dish.reviewCount > 0 ? (
                    <AppText variant="bodySmall" tone="secondary">
                      <Text style={{ color: palette.starFill }}>★</Text> {dish.rating.toFixed(1)} (
                      {dish.reviewCount})
                    </AppText>
                  ) : null}
                </View>
                {reviewsStatus === "loading" ? (
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    <ActivityIndicator color={palette.orange} />
                    <AppText variant="bodySmall" tone="secondary">
                      Loading reviews...
                    </AppText>
                  </View>
                ) : reviewsStatus === "error" ? (
                  <View style={{ gap: spacing[2] }}>
                    <AppText variant="bodySmall" tone="secondary">
                      Couldn&apos;t load reviews for this dish.
                    </AppText>
                    <Button
                      label="Retry"
                      variant="secondary"
                      onPress={() => setReviewsReloadKey((key) => key + 1)}
                    />
                  </View>
                ) : dishReviews.length > 0 ? (
                  <>
                    {reviewPhotos.length > 0 ? (
                      <View style={{ gap: spacing[2] }}>
                        <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                          Photos from reviews
                        </AppText>
                        <ReviewPhotoStrip
                          photos={reviewPhotos}
                          subject={`${dish.name}, from reviews`}
                          size={96}
                        />
                      </View>
                    ) : null}
                    {(showAllReviews
                      ? dishReviews
                      : dishReviews.slice(0, DISH_REVIEW_PREVIEW_COUNT)
                    ).map((review) => (
                      <View
                        key={review.id}
                        style={{
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                          borderRadius: componentRadii.card,
                          borderWidth: 1,
                          gap: spacing[2],
                          padding: spacing[4],
                        }}
                      >
                        <View
                          style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}
                        >
                          <Pressable
                            accessibilityRole={review.authorId ? "link" : undefined}
                            accessibilityLabel={`Open ${review.authorName}'s profile`}
                            disabled={!review.authorId}
                            onPress={() => openReviewerProfile(review)}
                          >
                            <Avatar
                              uri={review.authorAvatarUrl}
                              name={review.authorName}
                              size={36}
                            />
                          </Pressable>
                          <View style={{ flex: 1 }}>
                            <Pressable
                              accessibilityRole={review.authorId ? "link" : undefined}
                              accessibilityLabel={`Open ${review.authorName}'s profile`}
                              disabled={!review.authorId}
                              hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
                              onPress={() => openReviewerProfile(review)}
                            >
                              <AppText style={{ fontWeight: "900" }} numberOfLines={1}>
                                {review.authorName}
                              </AppText>
                            </Pressable>
                            <AppText variant="micro" tone="muted">
                              {formatTimeAgo(review.createdAt)}
                            </AppText>
                          </View>
                        </View>
                        <CaptionPreview text={review.text} />
                        <ReviewPhotoStrip
                          photos={review.photos}
                          subject={`${dish.name}, review by ${review.authorName}`}
                        />
                        {isOwnReview(review, isAuthenticated ? profile.id : undefined) ? (
                          <OwnReviewActions
                            review={review}
                            onUpdated={(patch) =>
                              setDishReviews((current) =>
                                current.map((entry) =>
                                  entry.id === review.id ? { ...entry, ...patch } : entry,
                                ),
                              )
                            }
                            onDeleted={() =>
                              setDishReviews((current) =>
                                current.filter((entry) => entry.id !== review.id),
                              )
                            }
                          />
                        ) : null}
                        {review.merchantReply ? (
                          <View
                            style={{
                              backgroundColor: palette.bgSoft,
                              borderRadius: componentRadii.card,
                              gap: spacing[1],
                              padding: spacing[3],
                            }}
                          >
                            <AppText variant="micro" style={{ fontWeight: "700" }}>
                              Reply from the owner
                            </AppText>
                            <AppText variant="bodySmall" tone="secondary">
                              {review.merchantReply.text}
                            </AppText>
                          </View>
                        ) : null}
                        <ReviewReaderActions
                          key={review.id}
                          rating={review.rating}
                          review={review}
                          isOwn={isOwnReview(review, isAuthenticated ? profile.id : undefined)}
                          returnRoute={{ name: "DishDetail", params: { dishId: dish.id } }}
                          onRemoved={() =>
                            setDishReviews((current) =>
                              current.filter((entry) => entry.id !== review.id),
                            )
                          }
                        />
                      </View>
                    ))}
                    {dishReviews.length > DISH_REVIEW_PREVIEW_COUNT ? (
                      <Button
                        label={
                          showAllReviews
                            ? "Show fewer reviews"
                            : hasMoreReviews
                              ? "See all reviews"
                              : `See all ${dishReviews.length} reviews`
                        }
                        variant="secondary"
                        onPress={() => setShowAllReviews((current) => !current)}
                      />
                    ) : null}
                    {showAllReviews && hasMoreReviews ? (
                      <Button
                        label="Show more reviews"
                        variant="secondary"
                        loading={isLoadingMoreReviews}
                        onPress={loadMoreReviews}
                      />
                    ) : null}
                  </>
                ) : dish.reviewCount === 0 ? (
                  <EmptyState
                    title="No reviews yet"
                    body={
                      showDeferredDetailControls
                        ? "Be the first to add one."
                        : "Reviews from diners will appear here when available."
                    }
                    icon={<Star size={36} color={palette.textMuted} />}
                    ctaLabel={
                      showDeferredDetailControls && FEATURE_FLAGS.reviewCreationEnabled
                        ? "Write a review"
                        : undefined
                    }
                    onPress={
                      showDeferredDetailControls && FEATURE_FLAGS.reviewCreationEnabled
                        ? handleReview
                        : undefined
                    }
                  />
                ) : (
                  <AppText variant="bodySmall" tone="secondary">
                    No written reviews to show yet.
                  </AppText>
                )}
              </View>

              <ReportProblemLink
                venueId={dish.venueId}
                dishId={dish.id}
                subjectName={dish.name}
                returnRoute={{ name: "DishDetail", params: { dishId: dish.id } }}
              />
            </View>
          </ScrollView>

          <DetailActionBar
            actions={barActions}
            cta={
              showDeferredDetailControls && FEATURE_FLAGS.reviewCreationEnabled
                ? {
                    label: "Review",
                    icon: PenLine,
                    onPress: handleReview,
                    accessibilityLabel: "Write a review",
                  }
                : undefined
            }
            testID="dish-action-bar"
          />

          <FloatingBackButton onPress={goBackOrHome} />

          {showDeferredDetailControls ? (
            <ReviewShareSheet
              activeReview={activeShareReview}
              innerRef={shareSheetRef}
              bottomInset={insets.bottom}
              onDismiss={() => {
                setActiveShareReview(null);
              }}
              onShared={(postId, channel) => {
                incrementShare(postId, channel);
              }}
              onShareCompleted={recordMerchantShare}
            />
          ) : null}
          {saveToListSheet}

          <Modal
            visible={triedPromptOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setTriedPromptOpen(false)}
          >
            <View
              style={{
                backgroundColor: palette.mediaScrim,
                flex: 1,
                justifyContent: "center",
                padding: spacing[4],
              }}
            >
              <View
                accessibilityViewIsModal
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: componentRadii.card,
                  gap: spacing[4],
                  padding: spacing[5],
                }}
              >
                <View style={{ alignItems: "center", gap: spacing[1] }}>
                  <AppText variant="h2" style={{ textAlign: "center" }}>
                    {`You tried ${dish.name}`}
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary" style={{ textAlign: "center" }}>
                    How was it? Both are optional.
                  </AppText>
                </View>
                <View style={{ alignItems: "center", gap: spacing[2] }}>
                  <AppText variant="bodySmallBold">Your rating</AppText>
                  <StarRating value={triedRating} editable onChange={setTriedRating} />
                </View>
                <View style={{ gap: spacing[2] }}>
                  <AppText variant="bodySmallBold" style={{ textAlign: "center" }}>
                    How did it taste?
                  </AppText>
                  <ChipGroup
                    options={TRIED_PROMPT_TASTE_TAGS.map((tag) => ({ id: tag, label: tag }))}
                    selectedIds={triedTags}
                    onSelect={(tag) =>
                      setTriedTags((current) =>
                        current.includes(tag)
                          ? current.filter((value) => value !== tag)
                          : [...current, tag],
                      )
                    }
                  />
                </View>
                <View style={{ gap: spacing[2] }}>
                  <Button label="Write a review" onPress={continueTriedReview} />
                  <Button
                    label="Not now"
                    variant="ghost"
                    onPress={() => setTriedPromptOpen(false)}
                  />
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
