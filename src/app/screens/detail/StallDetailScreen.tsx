import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronRight,
  ChevronLeft,
  CircleHelp,
  Heart,
  MapPin,
  MessageCircle,
  MessageCircleMore,
  Send,
  Star,
  Utensils,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  EmptyState,
  FeedErrorBoundary,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  Skeleton,
} from "@/components/ui";
import { deriveStallCommunityReviews } from "@/features/detail/detailTransforms";
import {
  hasPendingClaimForProfile,
  submitClaimFromStall,
} from "@/features/merchantClaim/submitClaimFromStall";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { openTrustedMapsUrl } from "@/lib/security/safeLinking";
import {
  buildMapsSearchUrl,
  formatFoodCentreLocation,
  formatFullStallAddress,
  formatWeeklyOperatingHours,
} from "@/features/detail/stallLocation";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { PopularVisitorsSection } from "@/components/stall/PopularVisitorsSection";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { isVenueOpenFromHours } from "@/utils/stallStatus";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import {
  CyclingGridImage,
  CYCLING_GRID_IMAGE_INTERVAL_MS,
} from "@/components/discover/CyclingGridImage";
import { CustomerPromotionCard } from "@/components/promotion/CustomerPromotionCard";
import type { DishDetail, MerchantPromotion } from "@/types/domain";
import {
  DetailSaveActionsCard,
  useDetailSaveActions,
} from "@/features/checklistPortfolio/DetailSaveActions";

const CommentIcon = MessageCircle ?? MessageCircleMore;
const INITIAL_MENU_ITEM_COUNT = 10;
const MENU_ITEM_BATCH_SIZE = 10;
const MENU_LOAD_THRESHOLD_PX = 280;
const ALL_MENU_CATEGORY = "All";
const MENU_CATEGORY_ORDER = [
  "Popular",
  "Rice",
  "Noodles",
  "Chicken",
  "Seafood",
  "Vegetarian",
  "Drinks",
  "Dessert",
  "Sets",
  "Sides",
];

function StallDetailSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Skeleton width="100%" height={screenWidth * 0.75} borderRadius={0} />
      <View style={{ padding: spacing[4], gap: spacing[6], marginTop: 20 }}>
        <AppText variant="bodyBold" tone="secondary">
          Loading stall
        </AppText>
        <View style={{ gap: spacing[1] }}>
          <Skeleton width={150} height={20} />
          <Skeleton width="70%" height={34} />
          <Skeleton width="40%" height={24} />
        </View>
        <Skeleton width="100%" height={80} borderRadius={radii.lg} />
        <View style={{ gap: spacing[4] }}>
          <Skeleton width={200} height={28} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
            <Skeleton width="45%" height={160} borderRadius={radii.lg} />
            <Skeleton width="45%" height={160} borderRadius={radii.lg} />
          </View>
        </View>
      </View>
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

type ReviewReply = {
  id: string;
  reviewId: string;
  authorName: string;
  text: string;
  createdAt: string;
};

const EMPTY_DISHES: DishDetail[] = [];

function formatMenuCategoryLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferDishCategory(dish: DishDetail) {
  const name = dish.name.toLowerCase();
  if (dish.mustOrder) return "Popular";
  if (/(rice|nasi|biryani|donburi|porridge|congee)/.test(name)) return "Rice";
  if (/(noodle|mee|hor fun|kway teow|ramen|pasta|spaghetti|bee hoon|udon|soba)/.test(name)) {
    return "Noodles";
  }
  if (/(chicken|ayam|wing|drumstick)/.test(name)) return "Chicken";
  if (/(fish|prawn|crab|seafood|squid|sotong|salmon)/.test(name)) return "Seafood";
  if (/(vegetarian|vegan|tofu|mushroom|salad)/.test(name)) return "Vegetarian";
  if (/(coffee|tea|milo|juice|drink|latte|smoothie|water|soda|kopi|teh)/.test(name)) {
    return "Drinks";
  }
  if (/(cake|dessert|ice cream|pudding|waffle|tart|muffin|sweet)/.test(name)) return "Dessert";
  if (/(set|combo|meal|bundle|platter|party)/.test(name)) return "Sets";
  if (/(side|fries|snack|soup|egg|toast|bread)/.test(name)) return "Sides";

  const dietaryLabels = dish.dietaryFlags ?? [];
  if (dietaryLabels.some((label) => /vegetarian|vegan/i.test(label))) return "Vegetarian";

  const availabilityCategory = (dish.availabilityFlags ?? [])
    .map(formatMenuCategoryLabel)
    .find((tag) => tag.length > 0);
  if (availabilityCategory) return availabilityCategory;

  return "Menu";
}

function getStallDishCycleSlides(dish: DishDetail, dishes: DishDetail[]) {
  return [dish, ...dishes.filter((candidate) => candidate.id !== dish.id)].slice(0, 4);
}

function StallLogoMark({ logoUrl, name }: { logoUrl?: string; name: string }) {
  const { palette, radii } = useHungryTheme();
  const [logoFailed, setLogoFailed] = useState(false);
  const normalizedLogoUrl = logoUrl?.trim();
  const shouldShowLogo = Boolean(normalizedLogoUrl) && !logoFailed;

  useEffect(() => {
    setLogoFailed(false);
  }, [normalizedLogoUrl]);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.surfaceRaised,
        borderColor: palette.orange,
        borderRadius: radii.pill,
        borderWidth: 3,
        height: 64,
        justifyContent: "center",
        overflow: "hidden",
        width: 64,
      }}
    >
      {shouldShowLogo ? (
        <AccessibleImage
          source={{ uri: normalizedLogoUrl }}
          accessibilityLabel={`${name} stall logo`}
          contentFit="contain"
          onError={() => setLogoFailed(true)}
          style={{ height: 52, width: 52 }}
        />
      ) : (
        <Utensils color={palette.orange} size={30} />
      )}
    </View>
  );
}

function StallMenuDishCard({
  dish,
  dishes,
  index,
  onPress,
  width,
}: {
  dish: DishDetail;
  dishes: DishDetail[];
  index: number;
  onPress: (dish: DishDetail) => void;
  width: number;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const slides = useMemo(() => getStallDishCycleSlides(dish, dishes), [dish, dishes]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDish = slides[activeIndex] ?? dish;
  const handleActiveIndexChange = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex);
  }, []);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, slides.length]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${activeDish.name}`}
      accessibilityHint="Opens this dish detail page"
      onPress={() => onPress(activeDish)}
      style={{ width }}
    >
      <View style={{ gap: spacing[2] }}>
        <CyclingGridImage
          images={slides.map((slide) => slide.imageUrl)}
          cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
          startDelayMs={(index % 4) * 350}
          onActiveIndexChange={handleActiveIndexChange}
          style={{
            width: "100%",
            height: 120,
            borderRadius: componentRadii.card,
          }}
        />
        <View style={{ gap: spacing[1] }}>
          <AppText variant="bodyBold" numberOfLines={1}>
            {activeDish.name}
          </AppText>
          <AppText variant="price" style={{ color: palette.orange }}>
            {activeDish.priceRange}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

export function StallDetailScreen({ navigation, route }: Props) {
  const venueId = route.params?.venueId ?? route.params?.id ?? "";
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const [isLoading, setIsLoading] = useState(true);
  const cachedVenue = repository.getVenueById(venueId);
  const [hydratedVenue, setHydratedVenue] = useState<typeof cachedVenue>();
  const [hasLoadedVenueDetail, setHasLoadedVenueDetail] = useState(Boolean(cachedVenue));
  const venue = hydratedVenue ?? cachedVenue;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [venueId]);

  useEffect(() => {
    let active = true;
    setHydratedVenue(undefined);
    setHasLoadedVenueDetail(Boolean(cachedVenue));
    if (!venueId || cachedVenue) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getVenue(venueId)
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
  }, [cachedVenue, venueId]);

  const building = venue ? getBuildingById(venue.buildingId) : undefined;
  const cachedDishes = useMemo(
    () => (venue ? repository.listDishesByVenue(venue.id) : []),
    [repository, venue],
  );
  const [hydratedDishes, setHydratedDishes] = useState<DishDetail[] | undefined>();
  const dishes =
    hydratedDishes ?? (serviceProviderMode === "supabase" ? EMPTY_DISHES : cachedDishes);
  const dishIdsKey = useMemo(() => dishes.map((dish) => dish.id).join("|"), [dishes]);
  const leadDish = dishes[0];

  const profile = useProfileStore((state) => state.profile);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [localRepliesByReviewId, setLocalRepliesByReviewId] = useState<
    Record<string, ReviewReply[]>
  >({});
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [isClaimPending, setIsClaimPending] = useState(() => hasPendingClaimForProfile(profile.id));
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [reviewsByDishId, setReviewsByDishId] = useState<Record<string, DishDetail["reviews"]>>({});
  const [activePromotions, setActivePromotions] = useState<MerchantPromotion[]>([]);
  const [activeMenuCategory, setActiveMenuCategory] = useState(ALL_MENU_CATEGORY);
  const [visibleMenuItemCount, setVisibleMenuItemCount] = useState(INITIAL_MENU_ITEM_COUNT);
  const contentBodyLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const menuSectionLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const trackedStallViewId = useRef<string | null>(null);
  const trackedPromotionEvents = useRef<Set<string>>(new Set());
  const detailSaveActions = useDetailSaveActions({
    navigation,
    target: {
      itemType: "stall",
      id: venue?.id ?? venueId,
      label: venue?.name ?? "Stall",
      venueId: venue?.id ?? venueId,
    },
  });
  const buildingLocation = {
    name: venue?.buildingName ?? building?.name,
    address: venue?.address ?? (building as { address?: string } | undefined)?.address,
    postalCode: venue?.postalCode ?? (building as { postalCode?: string } | undefined)?.postalCode,
  };
  const foodCentreLocation = formatFoodCentreLocation(buildingLocation);
  const stallAddress = venue ? formatFullStallAddress(venue, buildingLocation) : "";

  const shareReviewTarget = useMemo<ReviewShareTarget>(() => {
    return {
      reviewId: `stall-${venue?.id ?? ""}`,
      postId: "",
      title: venue?.name ?? "Stall",
      subtitle: `${buildingLocation.name ?? "Hungry"} · ${venue?.unitNumber ?? ""}`.trim(),
      imageUrl: leadDish?.imageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${venue?.name ?? "this stall"} at ${buildingLocation.name ?? "Hungry"}!`,
      link: `https://hungry.sg/stall/${venue?.id ?? ""}`,
    };
  }, [
    buildingLocation.name,
    leadDish?.imageUrl,
    profile.displayName,
    venue?.id,
    venue?.name,
    venue?.unitNumber,
  ]);

  useEffect(() => {
    let active = true;
    setHydratedDishes(undefined);
    if (!venue?.id) {
      return () => {
        active = false;
      };
    }

    if (cachedDishes.length > 0 && serviceProviderMode !== "supabase") {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.listDishesByVenue(venue.id)
      .then((nextDishes) => {
        if (active) setHydratedDishes(nextDishes);
      })
      .catch(() => {
        if (active) setHydratedDishes([]);
      });

    return () => {
      active = false;
    };
  }, [cachedDishes.length, serviceProviderMode, venue?.id]);

  useEffect(() => {
    setIsClaimPending(hasPendingClaimForProfile(profile.id));
  }, [profile.id]);

  useEffect(() => {
    if (!venue || trackedStallViewId.current === venue.id) return;
    trackedStallViewId.current = venue.id;
    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "stall_profile_view",
      venueId: venue.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
  }, [isAuthenticated, profile.id, venue]);

  useEffect(() => {
    let active = true;
    if (!venue) {
      setActivePromotions([]);
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.listActivePromotionsForTarget({ venueId: venue.id })
      .then((promotions) => {
        if (active) setActivePromotions(promotions);
      })
      .catch(() => {
        if (active) setActivePromotions([]);
      });

    return () => {
      active = false;
    };
  }, [venue]);

  useEffect(() => {
    if (!venue || activePromotions.length === 0) return;
    activePromotions.forEach((promotion) => {
      const eventKey = `${venue.id}:${promotion.id}`;
      if (trackedPromotionEvents.current.has(eventKey)) return;
      trackedPromotionEvents.current.add(eventKey);
      void getHungryService().discovery.recordMerchantActionEvent({
        eventType: "promotion_impression",
        promotionId: promotion.id,
        venueId: venue.id,
        dishId: promotion.targetDishId,
        userId: isAuthenticated ? profile.id : undefined,
      });
      void getHungryService().discovery.recordMerchantActionEvent({
        eventType: "promotion_profile_visit",
        promotionId: promotion.id,
        venueId: venue.id,
        dishId: promotion.targetDishId,
        userId: isAuthenticated ? profile.id : undefined,
      });
    });
  }, [activePromotions, isAuthenticated, profile.id, venue]);

  useEffect(() => {
    let active = true;
    if (!dishes.length) {
      setReviewsByDishId({});
      return () => {
        active = false;
      };
    }

    void Promise.all(
      dishes.map(async (dish) => {
        try {
          const reviews = await getHungryService().reviews.getReviewsForDish(dish.id);
          return [dish.id, reviews] as const;
        } catch {
          return [dish.id, serviceProviderMode === "mock" ? dish.reviews : []] as const;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setReviewsByDishId(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [dishIdsKey, dishes, serviceProviderMode]);

  const reviewHydratedDishes = useMemo(
    () =>
      dishes.map((dish) => ({
        ...dish,
        reviews: reviewsByDishId[dish.id] ?? (serviceProviderMode === "mock" ? dish.reviews : []),
      })),
    [dishes, reviewsByDishId, serviceProviderMode],
  );
  const communityReviews = useMemo(
    () => deriveStallCommunityReviews(reviewHydratedDishes),
    [reviewHydratedDishes],
  );
  const menuCategoryByDishId = useMemo(() => {
    return Object.fromEntries(dishes.map((dish) => [dish.id, inferDishCategory(dish)]));
  }, [dishes]);
  const menuCategories = useMemo(() => {
    const categorySet = new Set(Object.values(menuCategoryByDishId));
    const sortedCategories = [...categorySet].sort((left, right) => {
      const leftIndex = MENU_CATEGORY_ORDER.indexOf(left);
      const rightIndex = MENU_CATEGORY_ORDER.indexOf(right);
      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
    return [ALL_MENU_CATEGORY, ...sortedCategories];
  }, [menuCategoryByDishId]);
  const filteredMenuDishes = useMemo(() => {
    if (activeMenuCategory === ALL_MENU_CATEGORY) return dishes;
    return dishes.filter((dish) => menuCategoryByDishId[dish.id] === activeMenuCategory);
  }, [activeMenuCategory, dishes, menuCategoryByDishId]);
  const visibleMenuDishes = useMemo(
    () => filteredMenuDishes.slice(0, visibleMenuItemCount),
    [filteredMenuDishes, visibleMenuItemCount],
  );
  const hasMoreMenuItems = visibleMenuDishes.length < filteredMenuDishes.length;

  useEffect(() => {
    setVisibleMenuItemCount(INITIAL_MENU_ITEM_COUNT);
  }, [activeMenuCategory, venue?.id]);

  useEffect(() => {
    if (!menuCategories.includes(activeMenuCategory)) {
      setActiveMenuCategory(ALL_MENU_CATEGORY);
    }
  }, [activeMenuCategory, menuCategories]);

  const requireAuthForProtectedAction = (message: string) => {
    if (isAuthenticated) {
      return true;
    }

    setReturnRoute({
      name: "StallDetail",
      params: { venueId: venue?.id ?? venueId },
    });
    showToast({ message, tone: "warning" });
    navigation.navigate("AuthStack", { screen: "Login" });
    return false;
  };

  if (isLoading || (Boolean(venueId) && !venue && !hasLoadedVenueDetail)) {
    return <StallDetailSkeleton />;
  }

  if (!venue) {
    return (
      <FeedErrorBoundary
        title="Stall details unavailable"
        body="Couldn't load this dish — try again."
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: palette.bg }}
          edges={["top", "left", "right"]}
        >
          <EmptyState
            title="Stall not found"
            body="The stall you are looking for does not exist in our current directory."
            errorMessage={`Missing stall data for ID: ${venueId || "unknown"}`}
            sendErrorContext="Stall detail"
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  const distanceLabel = leadDish
    ? leadDish.distanceMeters > 1000
      ? `${(leadDish.distanceMeters / 1000).toFixed(1)}km away`
      : `${leadDish.distanceMeters}m away`
    : null;
  const isVenueOpen = isVenueOpenFromHours(venue.operatingHours, venue.isOpen);
  const operatingStatusLabel = isVenueOpen ? "Open now" : (venue.closureNotice ?? "Closed now");
  const weeklyOperatingHours = formatWeeklyOperatingHours(venue.operatingHours);

  const reviewedDishIds = profile.reviewedDishIds;
  const hasReviewedDishAtVenue = dishes.some((dish) => reviewedDishIds.includes(dish.id));
  const nextUnreviewedDish = dishes.find((dish) => !reviewedDishIds.includes(dish.id));
  const headerButtonColor = palette.surface;
  const headerButtonBorderColor = palette.border;

  const handleReviewRequiredForTried = () => {
    if (!isAuthenticated) {
      showToast({
        message: "Sign in to review this stall before marking it as visited.",
        tone: "warning",
        duration: 3000,
      });
      setReturnRoute({
        name: "StallDetail",
        params: { venueId: venue?.id ?? venueId },
      });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }

    if (!venue) {
      showToast({ message: "Sign in again and try again.", tone: "warning", duration: 3000 });
      return;
    }

    const targetDishId = nextUnreviewedDish?.id ?? dishes[0]?.id;
    if (!targetDishId) {
      showToast({
        message: "No dish available for review yet. Add a dish first.",
        tone: "warning",
        duration: 3000,
      });
      return;
    }

    showToast({
      message: "Please review this stall first before marking it as visited.",
      tone: "info",
      duration: 3000,
    });
    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: venue.id, dishId: targetDishId },
    });
  };

  const openStallMaps = () => {
    if (!stallAddress) return;
    void openTrustedMapsUrl(buildMapsSearchUrl(stallAddress));
  };

  const handleContentBodyLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    contentBodyLayoutRef.current = { y, height };
  };

  const handleMenuSectionLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    menuSectionLayoutRef.current = { y, height };
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMoreMenuItems) return;
    const contentBodyLayout = contentBodyLayoutRef.current;
    const menuSectionLayout = menuSectionLayoutRef.current;
    if (!contentBodyLayout || !menuSectionLayout) return;
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const viewportBottom = contentOffset.y + layoutMeasurement.height;
    const menuSectionBottom = contentBodyLayout.y + menuSectionLayout.y + menuSectionLayout.height;
    if (viewportBottom < menuSectionBottom - MENU_LOAD_THRESHOLD_PX) return;
    setVisibleMenuItemCount((current) =>
      current !== visibleMenuItemCount
        ? current
        : Math.min(current + MENU_ITEM_BATCH_SIZE, filteredMenuDishes.length),
    );
  };

  const submitReviewReply = (reviewId: string) => {
    if (!requireAuthForProtectedAction("Sign in to reply to this review.")) {
      return;
    }

    const draft = (replyDraftByReviewId[reviewId] ?? "").trim();
    if (!draft.length) {
      return;
    }

    const reply: ReviewReply = {
      id: `stall-review-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reviewId,
      authorName: profile.displayName,
      text: draft,
      createdAt: new Date().toISOString(),
    };

    setLocalRepliesByReviewId((prev) => ({
      ...prev,
      [reviewId]: [...(prev[reviewId] ?? []), reply],
    }));
    setReplyDraftByReviewId((prev) => ({
      ...prev,
      [reviewId]: "",
    }));
  };

  const openShareSheet = () => {
    if (!venue) {
      return;
    }

    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "share",
      venueId: venue.id,
      dishId: leadDish?.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const openMenuDish = (activeDish: DishDetail) => {
    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "menu_view",
      venueId: venue.id,
      dishId: activeDish.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
    navigation.navigate("DishDetail", { dishId: activeDish.id });
  };

  const handleClaimThisStall = async () => {
    if (isSubmittingClaim) return;
    if (!requireAuthForProtectedAction("Sign in before claiming this stall.")) {
      return;
    }

    setIsSubmittingClaim(true);
    try {
      const result = await submitClaimFromStall({
        profileId: profile.id,
        venueId: venue.id,
        buildingId: venue.buildingId,
        displayName: profile.displayName,
        email: profile.email || undefined,
        isAuthenticated,
        service: getHungryService(),
        localSingleClaimGuardEnabled: getServiceProvider().mode !== "supabase",
        devFallbackEnabled: getServiceProvider().mode !== "supabase",
      });

      if (result.status === "needs_auth") {
        showToast({
          message: "Please sign in before claiming this stall.",
          tone: "warning",
        });
      } else if (result.status === "created") {
        setIsClaimPending(true);
        showToast({
          message: "Claim interest submitted. We will follow up with verification details.",
          tone: "success",
        });
      } else if (result.status === "already_exists") {
        setIsClaimPending(true);
        showToast({
          message: "You have already submitted a claim for a stall.",
          tone: "info",
        });
      } else {
        showToast({
          message: "Unable to submit claim right now. Please try again.",
          tone: "error",
        });
      }
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  return (
    <FeedErrorBoundary
      title="Stall details unavailable"
      body="Couldn't load this dish — try again."
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.topNav,
              {
                backgroundColor: "transparent",
                height: insets.top + 56,
                paddingTop: insets.top,
                paddingHorizontal: spacing[3],
                borderBottomWidth: 0,
                zIndex: zIndex.overlay,
              },
            ]}
          >
            <IconButton
              variant="floating"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              icon={<ChevronLeft color={palette.text} size={24} />}
              style={{ backgroundColor: headerButtonColor, borderColor: headerButtonBorderColor }}
            />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <IconButton
                variant="floating"
                accessibilityLabel={
                  profile.favouriteDishIds.includes(leadDish?.id ?? "")
                    ? "Remove from favourites"
                    : "Save to favourites"
                }
                onPress={() => {
                  if (!requireAuthForProtectedAction("Sign in to save this stall.")) {
                    return;
                  }
                  if (leadDish) {
                    const wasSaved = profile.favouriteDishIds.includes(leadDish.id);
                    toggleFavourite(leadDish);
                    if (!wasSaved) {
                      void getHungryService().discovery.recordMerchantActionEvent({
                        eventType: "save",
                        venueId: venue.id,
                        dishId: leadDish.id,
                        userId: profile.id,
                      });
                    }
                  }
                }}
                icon={
                  <Heart
                    color={palette.text}
                    fill={
                      profile.favouriteDishIds.includes(leadDish?.id ?? "")
                        ? palette.text
                        : "transparent"
                    }
                    size={20}
                  />
                }
                style={{
                  backgroundColor: headerButtonColor,
                  borderColor: headerButtonBorderColor,
                }}
              />
              <IconButton
                variant="floating"
                accessibilityLabel="Share stall"
                onPress={openShareSheet}
                icon={<Send color={palette.text} size={20} />}
                style={{
                  backgroundColor: headerButtonColor,
                  borderColor: headerButtonBorderColor,
                }}
              />
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={120}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
          >
            {/* Hero image */}
            <View
              style={{
                width: screenWidth,
                height: screenWidth * 0.75,
                position: "relative",
              }}
            >
              <AccessibleImage
                source={{ uri: leadDish?.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                accessibilityLabel={`${venue.name} hero dish photo`}
              />
            </View>

            <View
              onLayout={handleContentBodyLayout}
              style={{
                gap: spacing[6],
                paddingHorizontal: spacing[3],
                paddingTop: spacing[5],
              }}
            >
              {/* Header Content */}
              <Card
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[3],
                  padding: spacing[3],
                }}
              >
                <StallLogoMark logoUrl={venue.logoUrl} name={venue.name} />
                <View style={{ flex: 1, gap: spacing[1] }}>
                  <AppText variant="h2" numberOfLines={1}>
                    {venue.name}
                  </AppText>
                  <AppText variant="bodyLarge" tone="secondary" numberOfLines={1}>
                    {[
                      foodCentreLocation || buildingLocation.name || "Food Centre",
                      venue.unitNumber,
                      distanceLabel,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                </View>
                <ChevronRight color={palette.textMuted} size={24} />
              </Card>

              {/* Save / Visited / Add-to-List */}
              {isAuthenticated && venue && (
                <StallInteractionBar
                  stallId={venue.id}
                  userId={profile.id}
                  hasReviewedDishAtVenue={hasReviewedDishAtVenue}
                  reviewPromptText="Please review a dish from this stall before marking it as visited."
                  onReviewRequired={handleReviewRequiredForTried}
                />
              )}

              {FEATURE_FLAGS.collectionsEnabled ? (
                <DetailSaveActionsCard
                  title="Save this stall"
                  body="Add this stall to your trying list or keep it in a private Hungry Portfolio."
                  onAddToChecklist={detailSaveActions.addToChecklist}
                  onAddToPortfolio={detailSaveActions.addToPortfolio}
                  isAddingToChecklist={detailSaveActions.isAddingToChecklist}
                  isAddingToPortfolio={detailSaveActions.isAddingToPortfolio}
                />
              ) : null}

              {/* Attributes */}
              <View
                style={{ flexDirection: "row", gap: spacing[3], justifyContent: "space-between" }}
              >
                <Card style={{ flex: 1, padding: spacing[4], gap: spacing[1] }}>
                  <AppText variant="micro" tone="secondary" style={{ letterSpacing: 0.5 }}>
                    OPERATING HOURS
                  </AppText>
                  <AppText variant="bodyLarge" style={{ fontWeight: "700" }}>
                    {operatingStatusLabel}
                  </AppText>
                  <View style={{ gap: spacing[0.5] }}>
                    {weeklyOperatingHours.map((line) => (
                      <AppText key={line} variant="micro" tone="secondary">
                        {line}
                      </AppText>
                    ))}
                  </View>
                </Card>
              </View>

              {/* Address */}
              <View style={{ gap: spacing[3] }}>
                <AppText variant="h2">Address</AppText>
                <Card style={{ padding: 0, gap: spacing[2] }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open maps for ${stallAddress}`}
                    onPress={openStallMaps}
                    style={({ pressed }) => [
                      {
                        padding: spacing[4],
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}
                    >
                      <MapPin color={palette.orange} size={18} />
                      <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
                        {stallAddress}
                      </AppText>
                    </View>
                  </Pressable>
                </Card>
              </View>

              <PopularVisitorsSection venueId={venue.id} horizontalPadding={0} />

              {activePromotions.length > 0 ? (
                <View style={{ gap: spacing[3] }}>
                  <AppText variant="h2">Active promotions</AppText>
                  {activePromotions.map((promotion) => (
                    <CustomerPromotionCard
                      key={promotion.id}
                      promotion={promotion}
                      ctaLabel={promotion.targetDishId ? "View dish" : undefined}
                      onPress={
                        promotion.targetDishId
                          ? () => {
                              void getHungryService().discovery.recordMerchantActionEvent({
                                eventType: "promotion_click",
                                promotionId: promotion.id,
                                venueId: venue.id,
                                dishId: promotion.targetDishId,
                                userId: isAuthenticated ? profile.id : undefined,
                              });
                              navigation.navigate("DishDetail", { dishId: promotion.targetDishId });
                            }
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}

              {/* Menu */}
              <View onLayout={handleMenuSectionLayout} style={{ gap: spacing[4] }}>
                <View style={{ gap: spacing[1] }}>
                  <AppText variant="h2">Menu</AppText>
                  {filteredMenuDishes.length > 0 ? (
                    <AppText variant="bodySmall" tone="secondary">
                      Showing {visibleMenuDishes.length} of {filteredMenuDishes.length} items
                    </AppText>
                  ) : null}
                </View>
                {dishes.length > 0 ? (
                  <View style={{ gap: spacing[4] }}>
                    {menuCategories.length > 2 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[2] }}
                      >
                        {menuCategories.map((category) => (
                          <Chip
                            key={category}
                            label={category}
                            selected={activeMenuCategory === category}
                            accessibilityLabel={`Filter menu by ${category}`}
                            onPress={() => setActiveMenuCategory(category)}
                          />
                        ))}
                      </ScrollView>
                    ) : null}
                    {visibleMenuDishes.length > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: spacing[3],
                        }}
                      >
                        {visibleMenuDishes.map((dish, index) => (
                          <StallMenuDishCard
                            key={dish.id}
                            dish={dish}
                            dishes={filteredMenuDishes}
                            index={index}
                            width={(screenWidth - spacing[5] * 2 - spacing[3]) / 2}
                            onPress={openMenuDish}
                          />
                        ))}
                      </View>
                    ) : (
                      <Card style={{ padding: spacing[4], alignItems: "center" }}>
                        <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                          No items in this category yet.
                        </AppText>
                      </Card>
                    )}
                  </View>
                ) : (
                  <Card style={{ padding: spacing[4], alignItems: "center" }}>
                    <AppText
                      variant="body"
                      tone="secondary"
                      style={{ textAlign: "center", marginBottom: spacing[2] }}
                    >
                      No menu available for this stall yet.
                    </AppText>
                    {isAuthenticated && (
                      <Button
                        label="Add a menu photo"
                        variant="secondary"
                        onPress={() =>
                          navigation.navigate("ReviewStack", {
                            screen: "ReviewMain",
                            params: { venueId: venue.id },
                          })
                        }
                      />
                    )}
                  </Card>
                )}
              </View>

              {/* Community Reviews */}
              <View style={{ gap: spacing[4] }}>
                <AppText variant="h2">Recent Reviews</AppText>
                {communityReviews.length > 0 ? (
                  communityReviews.map((review) => (
                    <View
                      key={review.id}
                      style={{
                        paddingVertical: spacing[3],
                        borderBottomWidth: 1,
                        borderBottomColor: palette.border,
                      }}
                    >
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          gap: spacing[3],
                        }}
                      >
                        <AccessibleImage
                          source={{ uri: review.avatarUrl }}
                          style={{
                            borderRadius: radii.pill,
                            height: 40,
                            width: 40,
                          }}
                          accessibilityLabel={`Avatar of ${review.authorName}`}
                        />
                        <View style={{ flex: 1 }}>
                          <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
                          <View
                            style={{
                              flexDirection: "row",
                              gap: spacing[0.5],
                            }}
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={12}
                                color={i < review.rating ? palette.amber : palette.border}
                                fill={i < review.rating ? palette.amber : "transparent"}
                              />
                            ))}
                          </View>
                        </View>
                        <AppText variant="micro" tone="muted">
                          {formatTimeAgo(review.createdAt)}
                        </AppText>
                      </View>
                      <AppText
                        variant="bodySmall"
                        tone="secondary"
                        style={{ marginTop: spacing[2] }}
                      >
                        {review.text}
                      </AppText>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: spacing[2],
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Reply to review by ${review.authorName}`}
                          onPress={() =>
                            setActiveReplyReviewId((current) =>
                              current === review.id ? null : review.id,
                            )
                          }
                        >
                          <AppText variant="micro" tone="accent">
                            Reply
                          </AppText>
                        </Pressable>
                        {(localRepliesByReviewId[review.id]?.length ?? 0) > 0 ? (
                          <AppText variant="micro" tone="muted">
                            {localRepliesByReviewId[review.id]?.length} repl
                            {(localRepliesByReviewId[review.id]?.length ?? 0) === 1 ? "y" : "ies"}
                          </AppText>
                        ) : null}
                      </View>

                      {(localRepliesByReviewId[review.id] ?? []).length > 0 ? (
                        <View
                          style={{
                            gap: spacing[2],
                            marginTop: spacing[2],
                            paddingLeft: spacing[3],
                            borderLeftWidth: 1,
                            borderLeftColor: palette.border,
                          }}
                        >
                          {(localRepliesByReviewId[review.id] ?? []).map((reply) => (
                            <View key={reply.id} style={{ gap: 2 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <AppText variant="micro">{reply.authorName}</AppText>
                                <AppText variant="micro" tone="muted">
                                  {formatTimeAgo(reply.createdAt)}
                                </AppText>
                              </View>
                              <AppText variant="bodySmall" tone="secondary">
                                {reply.text}
                              </AppText>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {activeReplyReviewId === review.id ? (
                        <View
                          style={{
                            gap: spacing[2],
                            marginTop: spacing[2],
                            paddingLeft: spacing[3],
                          }}
                        >
                          <Input
                            placeholder={`Reply to ${review.authorName}`}
                            value={replyDraftByReviewId[review.id] ?? ""}
                            onChangeText={(text) => {
                              setReplyDraftByReviewId((prev) => ({
                                ...prev,
                                [review.id]: text,
                              }));
                            }}
                            multiline
                          />
                          <Button
                            label="Post reply"
                            variant="secondary"
                            onPress={() => submitReviewReply(review.id)}
                            disabled={!(replyDraftByReviewId[review.id] ?? "").trim().length}
                          />
                        </View>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <EmptyState
                    title="No community reviews yet"
                    body="Write your first review for this stall."
                    icon={<CommentIcon size={36} color={palette.textMuted} />}
                  />
                )}
              </View>

              {FEATURE_FLAGS.merchantClaimCtaEnabled ? (
                <Card style={{ padding: spacing[4], gap: spacing[4] }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <AppText variant="h3">Own this stall?</AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View verification process"
                      onPress={() => navigation.navigate("MerchantClaimExplainer")}
                    >
                      <CircleHelp color={palette.orange} size={18} />
                    </Pressable>
                  </View>
                  <Button
                    label={
                      isSubmittingClaim
                        ? "Submitting..."
                        : isClaimPending
                          ? "Claim Pending"
                          : "Claim this stall"
                    }
                    onPress={() => {
                      void handleClaimThisStall();
                    }}
                    disabled={isSubmittingClaim || isClaimPending}
                  />
                </Card>
              ) : null}
            </View>
          </ScrollView>

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
          />
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}

const styles = StyleSheet.create({
  topNav: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
});
