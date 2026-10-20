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
import { buildDishGallery } from "@/features/detail/detailTransforms";
import { formatDishUpdated } from "@/features/detail/dishFreshness";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getDataTrustDisclosure } from "@/lib/services/dataTrustDisclosure";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore, getTasteSimilarityWithDish } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useSessionStore } from "@/store/useSessionStore";
import { saveDishAfterSignIn } from "@/features/auth/finishGuestAction";
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
import type { DishDetail, Review } from "@/types/domain";
import { hasDishTasteSignal, isNeutralTasteVector } from "@/lib/ai/tasteEngine";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
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
import { buildMapsSearchUrl, formatFullStallAddress } from "@/features/detail/stallLocation";

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

function formatWaitTime(liveCrowd?: "low" | "medium" | "high") {
  if (liveCrowd === "high") return "25-40 min";
  if (liveCrowd === "medium") return "15-25 min";
  if (liveCrowd === "low") return "< 15 min";
  return null;
}

/** A missing price maps to 0: show the listed range or "Price not listed", never "S$0.00". */
function formatDishPrice(dish: Pick<DishDetail, "price" | "priceRange">) {
  if (dish.price > 0) return `S$${dish.price.toFixed(2)}`;
  const range = dish.priceRange?.trim();
  return range && !/^S?\$?\s*0(?:\.0+)?$/.test(range) ? range : "Price not listed";
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
  const waitEstimateDisclosure = getDataTrustDisclosure("waitEstimate");
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const addReviewedDish = useProfileStore((state) => state.addReviewedDish);
  const removeReviewedDish = useProfileStore((state) => state.removeReviewedDish);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const stallInteraction = dish?.venueId ? stallInteractions[dish.venueId] : undefined;
  const markTried = useStallInteractionStore((state) => state.markTried);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [tasteProfileOpen, setTasteProfileOpen] = useState(false);
  const [operatingHoursOpen, setOperatingHoursOpen] = useState(false);
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const lastRecordedDishViewId = useRef<string | null>(null);
  const [isTryingFood, setIsTryingFood] = useState(false);
  const [dishReviews, setDishReviews] = useState<Review[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const { addToPortfolio, isAddingToPortfolio } = useDetailSaveActions({
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
  const [hasLoadedVenueDetail, setHasLoadedVenueDetail] = useState(Boolean(cachedVenue));
  const venue = hydratedVenue ?? cachedVenue;

  const gallery = useMemo(() => (dish ? buildDishGallery(dish) : []), [dish]);
  const heroImage = gallery[0] ?? dish?.imageUrl;
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
  const hoursRows = useMemo(() => parseOperatingHours(venue?.operatingHours), [venue]);
  const rawHours = venue?.operatingHours?.trim() ?? "";
  // Unreadable text is still shown as written rather than dropped.
  const listedHours = useMemo(
    () =>
      hoursRows.length > 0
        ? formatHoursRows(hoursRows)
        : rawHours
          ? [{ label: "Hours", text: rawHours }]
          : [],
    [hoursRows, rawHours],
  );
  const today = getSingaporeDay();
  const currentDayRows = useMemo(() => {
    if (hoursRows.length === 0) return listedHours;
    const todayRow = getHoursForDay(hoursRows, today);
    // No row for today (a weekday-only listing on a Sunday) means closed today.
    return [
      { label: "Today", text: todayRow && !todayRow.closed ? todayRow.text : "Closed today" },
    ];
  }, [hoursRows, listedHours, today]);

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
    setHasLoadedVenueDetail(Boolean(cachedVenue));
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
        setHasLoadedVenueDetail(true);
      })
      .catch(() => {
        if (active) setHasLoadedVenueDetail(true);
      });

    return () => {
      active = false;
    };
  }, [cachedVenue, dish?.venueId]);

  // The cached dish carries no reviews, so always read them from the reviews service.
  const reviewDishId = dish?.id;
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
    const before = dishReviews[dishReviews.length - 1]?.createdAt;
    if (!reviewDishId || !before || isLoadingMoreReviews) return;
    setIsLoadingMoreReviews(true);
    getHungryService()
      .reviews.listRecentReviews({
        dishIds: [reviewDishId],
        limit: DISH_REVIEW_PAGE_SIZE,
        before,
      })
      .then((entries) => {
        setDishReviews((current) => [...current, ...entries.map((entry) => entry.review)]);
        setHasMoreReviews(entries.length === DISH_REVIEW_PAGE_SIZE);
      })
      .catch(() => undefined)
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

  const isDetailLoading =
    (Boolean(dishId) && !dish && !hasLoadedDishDetail) ||
    (Boolean(dish?.venueId) && !venue && !hasLoadedVenueDetail);

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
  const waitTime = formatWaitTime(venue?.liveCrowd ?? dish.liveCrowd);
  const openState = venue
    ? getVenueOpenState(venue.operatingHours, venue.isOpen)
    : { status: "unknown" as const };
  const isVenueOpen = openState.status === "open";
  const openStatusLabel =
    openState.status === "open"
      ? ["Open now", openState.detail].filter(Boolean).join(" · ")
      : openState.status === "closed"
        ? ["Closed", openState.detail].filter(Boolean).join(" · ")
        : rawHours
          ? "Check listed hours"
          : "Hours not listed";
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
            value: `${tasteMatch}% match`,
            helper: "Compared with your taste profile",
          },
        ]
      : []),
    ...(waitTime
      ? [
          {
            label: "Estimated Wait",
            value: waitTime,
            helper: isVenueOpen
              ? `${waitEstimateDisclosure} · based on listed crowd level`
              : "Stall closed now",
          },
        ]
      : []),
  ];
  const heroHeight = Math.min(Math.max(width * 1.12, 420), 530);
  const cardWidth = (width - spacing[4] * 2 - spacing[3]) / 2;
  const signatureGridItemWidth = width / 2;
  const signatureGridItemHeight = signatureGridItemWidth * 1.5;
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
    imageUrl: gallery[0] ?? dish.imageUrl,
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
    void openTrustedMapsUrl(buildMapsSearchUrl(stallAddress));
  };

  const openShareSheet = () => {
    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const handleSave = () => {
    if (
      !requireAccount(
        `Sign in to save ${dish.name}`,
        { name: "DishDetail", params: { dishId: dish.id } },
        () => saveDishAfterSignIn(dish),
      )
    ) {
      return;
    }

    toggleFavourite(dish);
    if (!isSaved) {
      void getHungryService().discovery.recordMerchantActionEvent({
        eventType: "save",
        venueId: dish.venueId,
        dishId: dish.id,
        userId: profile.id,
      });
    }
    showToast({
      message: isSaved ? "Removed from Want to try." : "Saved to Want to try.",
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
  const isVenueVisited = stallInteraction?.isTried ?? false;

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
      removeReviewedDish(dish.id);
      showToast({ message: "Removed from your tried dishes.", ...triedToastStyle });
      return;
    }

    setIsTryingFood(true);
    try {
      addReviewedDish(dish.id);
      trackAnalyticsEvent("dish_marked_tried", { dish_id: dish.id, stall_id: dish.venueId });
      let pointsAwarded = 0;
      if (!isVenueVisited) {
        const result = await markTried(profile.id, dish.venueId, "DishDetail");
        pointsAwarded = result.pointsAwarded;
      }
      showToast({
        message:
          FEATURE_FLAGS.gamificationEnabled && pointsAwarded > 0
            ? `Marked as tried. +${pointsAwarded} Food Cred`
            : "Marked as tried.",
        ...triedToastStyle,
      });
    } finally {
      setIsTryingFood(false);
    }
  };

  return (
    <FeedErrorBoundary title="Dish details unavailable" body="Couldn't load this dish — try again.">
      <SafeAreaView style={{ backgroundColor: palette.bg, flex: 1 }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
          >
            <View style={{ height: heroHeight }}>
              {heroImage ? (
                <AccessibleImage
                  source={{ uri: heroImage }}
                  contentFit="cover"
                  style={{ flex: 1 }}
                  accessibilityLabel={`${dish.name} photo`}
                />
              ) : (
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
                  <AppText tone="secondary" style={{ marginTop: spacing[1], textAlign: "center" }}>
                    {venueName}
                  </AppText>
                </View>
              )}
              <LinearGradient
                colors={heroGradientColors}
                locations={[0, 0.58, 1]}
                style={{ bottom: 0, height: 260, left: 0, position: "absolute", right: 0 }}
              />
            </View>

            <View
              style={{
                gap: spacing[5],
                marginTop: -spacing[12],
                paddingHorizontal: spacing[4],
              }}
            >
              <View style={{ gap: spacing[4] }}>
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
                    onPress={() => navigation.navigate("StallDetail", { venueId: dish.venueId })}
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
                    {dish.reviewCount > 0 ? (
                      <View
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={`Rated ${dish.rating.toFixed(1)} out of 5 from ${
                          dish.reviewCount
                        } ${dish.reviewCount === 1 ? "review" : "reviews"}`}
                        style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}
                      >
                        {[0, 1, 2, 3, 4].map((index) => (
                          <Star
                            key={index}
                            color={palette.ratingStar}
                            fill={
                              index < Math.round(dish.rating) ? palette.ratingStar : "transparent"
                            }
                            size={17}
                          />
                        ))}
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
                      Opening Hours
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
                    {venue.closureNotice ? (
                      <AppText tone="secondary">{venue.closureNotice}</AppText>
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
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      marginHorizontal: -spacing[4],
                    }}
                  >
                    {moreFromStall.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${item.name}`}
                        // push, not navigate: each dish gets its own screen, so Back returns here.
                        onPress={() => navigation.push("DishDetail", { dishId: item.id })}
                        style={{
                          height: signatureGridItemHeight,
                          overflow: "hidden",
                          width: signatureGridItemWidth,
                        }}
                      >
                        {item.imageUrl ? (
                          <AccessibleImage
                            source={{ uri: item.imageUrl }}
                            contentFit="cover"
                            style={{ flex: 1 }}
                            decorative
                          />
                        ) : (
                          <NoDishPhoto dishName={item.name} style={{ flex: 1 }} />
                        )}
                        <LinearGradient
                          colors={["transparent", palette.detailImageOverlay]}
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
                              backgroundColor: palette.detailImageBadgeSurface,
                              borderColor: palette.detailImageBadgeBorder,
                              borderRadius: radii.md,
                              borderWidth: 1,
                              paddingHorizontal: spacing[2],
                              paddingVertical: spacing[1],
                              shadowColor: palette.navy,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.24,
                              shadowRadius: 12,
                            }}
                          >
                            <AppText
                              style={{
                                color: palette.white,
                                fontWeight: "900",
                                textShadowColor: palette.detailImageTextShadow,
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 3,
                              }}
                            >
                              {item.name}
                            </AppText>
                            <AppText
                              variant="price"
                              style={{
                                color: palette.white,
                                textShadowColor: palette.detailImageTextShadow,
                                textShadowOffset: { width: 0, height: 1 },
                                textShadowRadius: 3,
                              }}
                            >
                              {formatDishPrice(item)}
                            </AppText>
                          </View>
                        </LinearGradient>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: spacing[3] }}>
                <AppText variant="h2">From the Community</AppText>
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
                          <Avatar uri={review.authorAvatarUrl} name={review.authorName} size={36} />
                          <View style={{ flex: 1 }}>
                            <AppText style={{ fontWeight: "900" }} numberOfLines={1}>
                              {review.authorName}
                            </AppText>
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
                    body="Be the first to add one."
                    icon={<Star size={36} color={palette.textMuted} />}
                    ctaLabel="Write a review"
                    onPress={handleReview}
                  />
                ) : (
                  <AppText variant="bodySmall" tone="secondary">
                    No written reviews to show yet.
                  </AppText>
                )}
              </View>
            </View>
          </ScrollView>

          <View
            style={{
              backgroundColor: palette.bg,
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSaved ? "Saved" : "Save"}
              accessibilityHint={isSaved ? "Removes this dish from Want to try" : undefined}
              accessibilityState={{ selected: isSaved }}
              onPress={handleSave}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Write a review"
              onPress={handleReview}
              style={{
                alignItems: "center",
                backgroundColor: palette.orange,
                borderRadius: componentRadii.button,
                flexDirection: "row",
                gap: spacing[1.5],
                height: dockTargetSize,
                justifyContent: "center",
                paddingHorizontal: spacing[4],
              }}
            >
              {/* Dark ink on orange: white on brand orange fails AA in both themes. */}
              <CommentIcon color={palette.textOnOrange} size={reviewIconSize} />
              <AppText variant="bodyBold" style={{ color: palette.textOnOrange }}>
                Review
              </AppText>
            </Pressable>
          </View>

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
              left: 0,
              paddingHorizontal: spacing[4],
              position: "absolute",
              right: 0,
              top: insets.top + spacing[2],
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
          </View>

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
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
