import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import type { ColorValue } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Clock3,
  CheckCircle,
  ListPlus,
  MapPin,
  MessageCircleMore,
  MessageCircle,
  Navigation,
  Send,
  Star,
  Utensils,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { useDetailSaveActions } from "@/features/checklistPortfolio/DetailSaveActions";
import { resolveStallOpenInfo } from "@/features/detail/stallOpenState";
import { tasteMatchLabel } from "@/features/detail/tasteMatch";
import { isSoldOut } from "@/features/merchant/menuSections";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { PhotoPager } from "@/components/dish/PhotoPager";
import { ReportProblemLink } from "@/components/stall/ReportProblemLink";
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { DietaryFlagChips } from "@/components/dish/DietaryFlagChips";
import { OwnReviewActions, ReviewPhotoStrip, ReviewReaderActions } from "@/components/review";
import { isOwnReview } from "@/features/review/reviewEdit";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { saveDishAfterSignIn } from "@/features/auth/finishGuestAction";
import { rememberPendingDishSave } from "@/features/auth/pendingDishSave";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { useUIStore } from "@/store/useUIStore";
import { useSocialStore } from "@/store/useSocialStore";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import {
  AccessibleImage,
  AppText,
  Avatar,
  Button,
  EmptyState,
  FeedErrorBoundary,
} from "@/components/ui";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useHungryTheme } from "@/theme";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import type { DishDetail, OpeningSchedule, PublicMerchantProfile, Review } from "@/types/domain";
import { hasDishTasteSignal, isNeutralTasteVector } from "@/lib/ai/tasteEngine";
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
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import {
  buildMapsSearchUrl,
  formatFullStallAddress,
  getStallPin,
} from "@/features/detail/stallLocation";

const CommentIcon = MessageCircle ?? MessageCircleMore;
/** Reviews shown before "See all". */
const DISH_REVIEW_PREVIEW_COUNT = 3;
/** One page of a dish's reviews, newest first. */
const DISH_REVIEW_PAGE_SIZE = 50;
/** Below this confidence a dish's taste vector is too weak to show as fact. */
const MIN_DISPLAY_TASTE_CONFIDENCE = 0.3;
/** Other dishes from the same stall shown under "More from {stall}". */
const MORE_FROM_STALL_COUNT = 4;

type Props = NativeStackScreenProps<RootStackParamList, "DishDetail">;

type Attribute = {
  label: string;
  value: string;
  helper: string;
};

function getDominantTaste(dish: DishDetail) {
  return TASTE_DIMENSIONS.reduce(
    (best, dimension) => {
      const score = dish.tasteVector[dimension.key] ?? 0;
      return score > best.score ? { label: dimension.label, score } : best;
    },
    { label: TASTE_DIMENSIONS[0]?.label ?? "Taste", score: 0 },
  );
}

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
  const setDishTried = useProfileStore((state) => state.setDishTried);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const markTried = useStallInteractionStore((state) => state.markTried);
  const loadStallInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [tasteProfileOpen, setTasteProfileOpen] = useState(false);
  const [operatingHoursOpen, setOperatingHoursOpen] = useState(false);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const lastRecordedDishViewId = useRef<string | null>(null);
  const [isTryingFood, setIsTryingFood] = useState(false);
  const [openingSchedule, setOpeningSchedule] = useState<OpeningSchedule>();
  const [merchantProfile, setMerchantProfile] = useState<PublicMerchantProfile>();
  const [dishReviews, setDishReviews] = useState<Review[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const { addToPortfolio, isAddingToPortfolio, saveToListSheet } = useDetailSaveActions({
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
  const tasteMatch = useMemo(
    () => (dish ? getTasteSimilarityWithDish(profile, dish) : 0),
    [dish, profile],
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
  const listedHours = openInfo?.weekRows ?? [];
  const currentDayRows = openInfo?.todayRows ?? [];

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

  const dominantTaste = getDominantTaste(dish);
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
  const showTasteMatch = hasTasteSignal && !isNeutralTasteVector(profile.tasteVector);
  const attributes: Attribute[] = [
    ...(hasTasteSignal
      ? [
          {
            label: "Taste Intensity",
            value: `${dominantTaste.score}/10`,
            helper: dominantTaste.label,
          },
        ]
      : []),
    ...(dish.tasteTags.length > 0
      ? [
          {
            label: "Taste Notes",
            value: dish.tasteTags[0],
            helper: dish.tasteTags.slice(1, 3).join(" · "),
          },
        ]
      : []),
    ...(showTasteMatch
      ? [
          {
            label: "Your Taste",
            // Words, not a percentage: the match is an estimate from a few taste tags.
            value: tasteMatchLabel(tasteMatch),
            helper: "Compared with your taste profile",
          },
        ]
      : []),
  ];
  // Dish photos first, then photos from reviews, swipeable in the hero.
  const heroPhotos = Array.from(
    new Set([...gallery, ...(dish.imageUrl ? [dish.imageUrl] : []), ...reviewPhotos]),
  ).slice(0, 8);
  const heroHeight = Math.min(Math.max(width * 0.8, 280), 380);
  const cardWidth = (width - spacing[4] * 2 - spacing[3]) / 2;
  const signatureGridItemWidth = Math.min(width * 0.56, 220);
  const reviewIconSize = 22;
  /** Minimum touch target for the action dock and header buttons. */
  const dockTargetSize = 44;
  const canonicalDishUrl = webShareUrl("dish", dish.id);
  const heroGradientColors: readonly [ColorValue, ColorValue, ColorValue] = [
    palette.detailHeroGradientStart,
    palette.detailHeroGradientMid,
    palette.bg,
  ];
  const headerButtonBackground = palette.detailHeaderSurface;
  const headerButtonBorder = palette.detailHeaderBorder;
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

  const openStallMaps = () => {
    if (!stallAddress) return;
    trackAnalyticsEvent("directions_opened", { stall_id: dish.venueId, source: "dish_detail" });
    void openTrustedMapsUrl(
      buildMapsSearchUrl(
        stallAddress,
        venue ? getStallPin(venue, building?.coordinate) : undefined,
      ),
    );
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
    } finally {
      setIsTryingFood(false);
    }
  };

  // Staging and production are a read-only Release 0.1 catalog experience.
  // Keep deferred write and social controls available for local development,
  // but never render them from a released build even when an unrelated flag
  // is accidentally enabled for targeted QA.
  const showDeferredDetailControls = !FEATURE_FLAGS.release01CoreOnly;

  return (
    <FeedErrorBoundary title="Dish details unavailable" body="Couldn't load this dish — try again.">
      <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: insets.top + 56,
              paddingBottom: insets.bottom + (showDeferredDetailControls ? 104 : spacing[6]),
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
                    style={{ bottom: 0, height: 260, left: 0, position: "absolute", right: 0 }}
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
                    <Utensils color={palette.orange} size={44} />
                    <AppText variant="h2" style={{ marginTop: spacing[3], textAlign: "center" }}>
                      {dish.name}
                    </AppText>
                    <AppText
                      tone="secondary"
                      style={{ marginTop: spacing[1], textAlign: "center" }}
                    >
                      {venueName}
                    </AppText>
                  </View>
                  <LinearGradient
                    colors={heroGradientColors}
                    locations={[0, 0.58, 1]}
                    style={{ bottom: 0, height: 260, left: 0, position: "absolute", right: 0 }}
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
              <View style={{ gap: spacing[4] }}>
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
                    alignItems: "center",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: spacing[2],
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${venueName} stall details`}
                    onPress={() => openStallFromDish(navigation, dish.venueId)}
                    hitSlop={8}
                    style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                  >
                    <View
                      style={[
                        {
                          alignItems: "center",
                          alignSelf: "flex-start",
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          flexDirection: "row",
                          gap: spacing[1],
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[1.5],
                        },
                        shadows.card,
                      ]}
                    >
                      <MapPin color={palette.orange} size={16} />
                      <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                        {[venueName, venueUnit].filter(Boolean).join(" · ")}
                      </AppText>
                    </View>
                  </Pressable>
                  {stallAddress ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Directions to ${venueName}`}
                      onPress={openStallMaps}
                      hitSlop={8}
                      style={({ pressed }) => [
                        {
                          alignItems: "center",
                          backgroundColor: palette.surface,
                          borderColor: palette.border,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          flexDirection: "row",
                          gap: spacing[1],
                          opacity: pressed ? 0.8 : 1,
                          paddingHorizontal: spacing[3],
                          paddingVertical: spacing[1.5],
                        },
                        shadows.card,
                      ]}
                    >
                      <Navigation color={palette.orange} size={14} />
                      <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                        Directions
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
                {venue ? (
                  <AppText
                    variant="bodySmallBold"
                    tone={openState.status === "open" ? "success" : "secondary"}
                  >
                    {openStatusLabel}
                  </AppText>
                ) : null}
                {venue && deliveryLinks.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                    {deliveryLinks.map((link) => (
                      <DeliveryPlatformButton
                        key={`${link.platform}:${link.webUrl}`}
                        link={link}
                        compact
                        venueId={venue.id}
                      />
                    ))}
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
                  <View style={{ flex: 1, gap: spacing[2] }}>
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
                            ? { color: palette.orange, fontSize: 22, lineHeight: 34 }
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
                    {dish.dietaryFlags.length > 0 ? (
                      <View style={{ gap: spacing[1] }}>
                        <DietaryFlagChips flags={dish.dietaryFlags} />
                        <AppText variant="micro" tone="muted">
                          Labels come from the stall or our catalogue. Check with the stall if it
                          matters to you.
                        </AppText>
                      </View>
                    ) : null}
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
                        <Star color={palette.ratingStar} fill={palette.ratingStar} size={17} />
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
                    {formatDishUpdated(dish.updatedAt) ? (
                      <AppText variant="bodySmall" tone="muted">
                        {formatDishUpdated(dish.updatedAt)}
                      </AppText>
                    ) : null}
                  </View>
                </View>

                {dish.description?.trim() ? (
                  <AppText variant="bodyLarge" tone="secondary" style={{ lineHeight: 26 }}>
                    {dish.description}
                  </AppText>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                {attributes.map((attribute) => (
                  <View
                    key={attribute.label}
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      gap: spacing[1],
                      padding: spacing[3],
                      width: cardWidth,
                    }}
                  >
                    <AppText variant="micro" tone="secondary">
                      {attribute.label}
                    </AppText>
                    <AppText variant="h3" style={{ fontSize: 18 }}>
                      {attribute.value}
                    </AppText>
                    {attribute.helper ? (
                      <AppText variant="bodySmall" tone="secondary">
                        {attribute.helper}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </View>

              {hasTasteSignal ? (
                <View style={{ gap: spacing[3] }}>
                  <Button
                    variant="secondary"
                    label={tasteProfileOpen ? "Hide Taste Profile" : "View Taste Profile"}
                    onPress={() => setTasteProfileOpen((current) => !current)}
                  />
                  {tasteProfileOpen ? (
                    <View
                      style={{
                        backgroundColor: palette.surface,
                        borderColor: palette.border,
                        borderRadius: componentRadii.card,
                        borderWidth: 1,
                        gap: spacing[3],
                        padding: spacing[4],
                      }}
                    >
                      <AppText variant="h3">Taste Matrix &amp; Palate Profile</AppText>
                      <AppText variant="micro" tone="secondary">
                        Taste profile from available dish data
                      </AppText>
                      {TASTE_DIMENSIONS.map((dimension) => {
                        const score = dish.tasteVector[dimension.key] ?? 0;
                        const progressWidth =
                          `${Math.max(0, Math.min(100, Math.round((score / 10) * 100)))}%` as const;

                        return (
                          <View key={dimension.key} style={{ gap: spacing[1] }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                                {dimension.label}
                              </AppText>
                              <AppText variant="micro" tone="secondary">
                                {score}/10
                              </AppText>
                            </View>
                            <View
                              style={{
                                backgroundColor: palette.border,
                                borderRadius: radii.pill,
                                height: 8,
                                overflow: "hidden",
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor: palette.orange,
                                  borderRadius: radii.pill,
                                  height: "100%",
                                  width: progressWidth,
                                }}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
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

              {venue ? (
                <Pressable
                  onPress={() => setOperatingHoursOpen((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel="Opening hours"
                  accessibilityHint={
                    operatingHoursOpen ? "Shows today's hours only" : "Shows the full week"
                  }
                  accessibilityState={{ expanded: operatingHoursOpen }}
                  style={({ pressed }) => [
                    {
                      gap: spacing[3],
                      opacity: pressed ? 0.95 : 1,
                    },
                  ]}
                >
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    <Clock3 color={palette.orange} size={20} />
                    <AppText variant="h2" style={{ flex: 1 }}>
                      Opening hours
                    </AppText>
                    {operatingHoursOpen ? (
                      <ChevronUp color={palette.textSecondary} size={22} />
                    ) : (
                      <ChevronDown color={palette.textSecondary} size={22} />
                    )}
                  </View>
                  <View
                    style={{
                      backgroundColor: palette.surface,
                      borderColor: palette.border,
                      borderRadius: componentRadii.card,
                      borderWidth: 1,
                      gap: spacing[3],
                      padding: spacing[4],
                    }}
                  >
                    {listedHours.length ? (
                      <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                        {(operatingHoursOpen ? listedHours : currentDayRows).map((row) => (
                          <View
                            key={`${row.label}-${row.text}`}
                            style={{
                              flexDirection: "row",
                              gap: spacing[2],
                              justifyContent: "space-between",
                            }}
                          >
                            <AppText tone="secondary" style={{ width: 104 }}>
                              {row.label}
                            </AppText>
                            <AppText tone="secondary" style={{ flex: 1, textAlign: "right" }}>
                              {row.text}
                            </AppText>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <AppText tone="secondary">Hours not listed.</AppText>
                    )}
                    {openInfo?.closureNotice ? (
                      <AppText tone="secondary">{openInfo.closureNotice}</AppText>
                    ) : null}
                  </View>
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

              <View style={{ gap: spacing[3] }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <AppText variant="h2">Community Palate Feedback</AppText>
                  {dish.reviewCount > 0 ? (
                    <AppText variant="bodySmall" tone="secondary">
                      ★ {dish.rating.toFixed(1)} ({dish.reviewCount})
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
                          <View
                            accessible
                            accessibilityRole="text"
                            accessibilityLabel={`Rated ${review.rating} out of 5`}
                            style={{ alignItems: "center", flexDirection: "row", gap: 2 }}
                          >
                            <Star color={palette.ratingStar} fill={palette.ratingStar} size={13} />
                            <AppText variant="micro" style={{ fontWeight: "800" }}>
                              {review.rating}
                            </AppText>
                          </View>
                        </View>
                        <AppText variant="bodySmall" tone="secondary">
                          {review.text}
                        </AppText>
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
                returnRoute={{ name: "DishDetail", params: { dishId: dish.id } }}
              />
            </View>
          </ScrollView>

          {showDeferredDetailControls ? (
            <View
              style={{
                backgroundColor: palette.surface,
                borderTopColor: palette.border,
                borderTopWidth: 1,
                bottom: 0,
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: spacing[3],
                left: 0,
                paddingBottom: Math.max(insets.bottom, spacing[4]),
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                position: "absolute",
                right: 0,
              }}
            >
              {stallAddress ? (
                // The one filled control in the dock: the next real-world step for a nearby dish.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Directions to ${venueName}`}
                  onPress={openStallMaps}
                  style={{
                    alignItems: "center",
                    backgroundColor: palette.orange,
                    borderRadius: componentRadii.button,
                    flex: 1,
                    flexDirection: "row",
                    gap: spacing[1.5],
                    height: dockTargetSize,
                    justifyContent: "center",
                    paddingHorizontal: spacing[3],
                  }}
                >
                  <Navigation color={palette.textOnOrange} size={reviewIconSize} />
                  <AppText variant="bodyBold" style={{ color: palette.textOnOrange }}>
                    Directions
                  </AppText>
                </Pressable>
              ) : null}
              {FEATURE_FLAGS.portfoliosEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add this dish to a list"
                  accessibilityState={{ disabled: isAddingToPortfolio }}
                  onPress={() => void addToPortfolio()}
                  disabled={isAddingToPortfolio}
                  style={{
                    alignItems: "center",
                    height: dockTargetSize,
                    justifyContent: "center",
                    minWidth: dockTargetSize,
                  }}
                >
                  <ListPlus color={palette.text} size={reviewIconSize} />
                </Pressable>
              ) : null}
              {FEATURE_FLAGS.favouritesEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isSaved ? "Saved" : "Save"}
                  accessibilityHint={isSaved ? "Removes this dish from Want to try" : undefined}
                  accessibilityState={{ selected: isSaved }}
                  onPress={() => void handleSave()}
                  style={{
                    alignItems: "center",
                    height: dockTargetSize,
                    justifyContent: "center",
                    minWidth: dockTargetSize,
                  }}
                >
                  <Bookmark
                    color={isSaved ? palette.orange : palette.text}
                    size={reviewIconSize}
                    fill={isSaved ? palette.orange : "none"}
                  />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Tried"
                accessibilityState={{ checked: isDishTried, disabled: isTryingFood }}
                onPress={handleTryFood}
                disabled={isTryingFood}
                style={({ pressed }) => {
                  const backgroundColor = isDishTried
                    ? palette.surface
                    : pressed
                      ? palette.bg
                      : palette.bgSoft;
                  const normalizedBackgroundColor = backgroundColor.toLowerCase().replace("#", "");
                  const isWhiteOrBlackBackground =
                    !isDishTried &&
                    (normalizedBackgroundColor === "ffffff" ||
                      normalizedBackgroundColor === "000000");
                  return {
                    alignItems: "center",
                    backgroundColor,
                    borderColor: isWhiteOrBlackBackground ? palette.orange : "transparent",
                    borderWidth: isWhiteOrBlackBackground ? 1 : 0,
                    borderRadius: componentRadii.iconButton,
                    height: dockTargetSize,
                    justifyContent: "center",
                    minWidth: dockTargetSize,
                  };
                }}
              >
                <CheckCircle
                  color={isDishTried ? palette.orange : palette.text}
                  fill="none"
                  size={reviewIconSize}
                />
              </Pressable>
              {FEATURE_FLAGS.reviewCreationEnabled ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Write a review"
                  onPress={handleReview}
                  style={
                    stallAddress
                      ? {
                          alignItems: "center",
                          borderColor: palette.border,
                          borderRadius: componentRadii.iconButton,
                          borderWidth: 1,
                          height: dockTargetSize,
                          justifyContent: "center",
                          minWidth: dockTargetSize,
                        }
                      : {
                          alignItems: "center",
                          backgroundColor: palette.orange,
                          borderRadius: componentRadii.button,
                          flexDirection: "row",
                          gap: spacing[1.5],
                          height: dockTargetSize,
                          justifyContent: "center",
                          paddingHorizontal: spacing[4],
                        }
                  }
                >
                  {stallAddress ? (
                    <CommentIcon color={palette.text} size={reviewIconSize} />
                  ) : (
                    <>
                      {/* Dark ink on orange: white on brand orange fails AA in both themes. */}
                      <CommentIcon color={palette.textOnOrange} size={reviewIconSize} />
                      <AppText variant="bodyBold" style={{ color: palette.textOnOrange }}>
                        Review
                      </AppText>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.surface,
              borderBottomColor: palette.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              height: insets.top + 56,
              left: 0,
              paddingHorizontal: spacing[4],
              paddingTop: insets.top,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={goBackOrHome}
              style={{
                alignItems: "center",
                backgroundColor: headerButtonBackground,
                borderColor: headerButtonBorder,
                borderRadius: componentRadii.iconButton,
                borderWidth: 1,
                height: dockTargetSize,
                justifyContent: "center",
                width: dockTargetSize,
              }}
            >
              <ArrowLeft color={palette.text} size={22} />
            </Pressable>
            <AppText variant="h3" style={{ flex: 1, marginLeft: spacing[3] }}>
              Dish Details
            </AppText>
            {showDeferredDetailControls ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Share ${dish.name}`}
                onPress={openShareSheet}
                style={{
                  alignItems: "center",
                  backgroundColor: headerButtonBackground,
                  borderColor: headerButtonBorder,
                  borderRadius: componentRadii.iconButton,
                  borderWidth: 1,
                  height: dockTargetSize,
                  justifyContent: "center",
                  width: dockTargetSize,
                }}
              >
                <Send color={palette.text} size={21} />
              </Pressable>
            ) : null}
          </View>

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
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
