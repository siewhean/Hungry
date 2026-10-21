import {
  Alert,
  Platform,
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
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bookmark,
  ChevronLeft,
  CircleHelp,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  MessageCircleMore,
  Navigation,
  Send,
  Star,
  Utensils,
} from "lucide-react-native";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppText,
  Avatar,
  EmptyState,
  FeedErrorBoundary,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  Skeleton,
} from "@/components/ui";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { DietaryFlagChips } from "@/components/dish/DietaryFlagChips";
import { OwnReviewActions, ReviewPhotoStrip } from "@/components/review";
import { summarizeStallDietaryFlags } from "@/features/detail/dietaryLabels";
import { isOwnReview } from "@/features/review/reviewEdit";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import {
  deriveStallCommunityReviews,
  STALL_COMMUNITY_REVIEW_LIMIT,
} from "@/features/detail/detailTransforms";
import {
  hasPendingClaimForVenue,
  submitClaimFromStall,
} from "@/features/merchantClaim/submitClaimFromStall";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openMerchantProfileLink, openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { getDishSection, isSectionFlag, isSoldOut } from "@/features/merchant/menuSections";
import {
  buildMapsSearchUrl,
  formatDistanceFromUser,
  formatFullStallAddress,
  formatStallPriceBand,
  summarizeStallRating,
} from "@/features/detail/stallLocation";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { PopularVisitorsSection } from "@/components/stall/PopularVisitorsSection";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { FollowStallButton } from "@/components/stall/FollowStallButton";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { followStallAfterSignIn } from "@/features/auth/finishGuestAction";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { formatHoursRows, getVenueOpenState, parseOperatingHours } from "@/utils/operatingHours";
import {
  formatScheduleRows,
  getScheduleOpenState,
  getUpcomingSpecialHours,
  hasWeeklyHours,
} from "@/utils/openingSchedule";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
import {
  CyclingGridImage,
  CYCLING_GRID_IMAGE_INTERVAL_MS,
} from "@/components/discover/CyclingGridImage";
import { CustomerPromotionCard } from "@/components/promotion/CustomerPromotionCard";
import type {
  DishDetail,
  MerchantPromotion,
  OpeningSchedule,
  PublicMerchantProfile,
} from "@/types/domain";
import {
  DetailSaveActionsCard,
  useDetailSaveActions,
} from "@/features/checklistPortfolio/DetailSaveActions";
import { webShareUrl } from "@/constants/links";

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

const STATUS_AVAILABILITY_FLAGS = new Set(["sold_out", "featured"]);

function inferDishCategory(dish: DishDetail) {
  // A section the stall owner picked wins over name-based guesses.
  const merchantSection = getDishSection(dish.availabilityFlags);
  if (merchantSection) return merchantSection;
  const name = dish.name.toLowerCase();
  if (dish.mustOrder) return "Popular";
  // Whole words only: "Steak" is not tea, "Watercress soup" is not water.
  if (/\b(rice|nasi|biryani|donburi|porridge|congee)\b/.test(name)) return "Rice";
  if (/\b(noodles?|mee|hor fun|kway teow|ramen|pasta|spaghetti|bee hoon|udon|soba)\b/.test(name)) {
    return "Noodles";
  }
  if (/\b(chicken|ayam|wings?|drumsticks?)\b/.test(name)) return "Chicken";
  if (/\b(fish|prawns?|crabs?|seafood|squid|sotong|salmon)\b/.test(name)) return "Seafood";
  if (/\b(vegetarian|vegan|tofu|mushrooms?|salad)\b/.test(name)) return "Vegetarian";
  if (/\b(coffee|tea|milo|juice|drinks?|latte|smoothie|water|soda|kopi|teh)\b/.test(name)) {
    return "Drinks";
  }
  if (/\b(cakes?|dessert|ice cream|pudding|waffles?|tarts?|muffins?)\b/.test(name)) {
    return "Dessert";
  }
  if (/\b(set|combo|meal|bundle|platter)\b/.test(name)) return "Sets";
  if (/\b(sides?|fries|snacks?|toast|bread)\b/.test(name)) return "Sides";

  const dietaryLabels = dish.dietaryFlags ?? [];
  if (dietaryLabels.some((label) => /vegetarian|vegan/i.test(label))) return "Vegetarian";

  const availabilityCategory = (dish.availabilityFlags ?? [])
    .filter(
      (flag) =>
        !isSectionFlag(flag) &&
        !STATUS_AVAILABILITY_FLAGS.has(flag.toLowerCase().replace(/[\s-]+/g, "_")),
    )
    .map(formatMenuCategoryLabel)
    .find((tag) => tag.length > 0);
  if (availabilityCategory) return availabilityCategory;

  return "Menu";
}

function getStallDishPhotos(dish: DishDetail) {
  // A menu tile only ever cycles the dish's own photos, so the image, name,
  // price and tap target always describe the same dish. URLs go through the
  // shared catalog sanitizer so unsafe or placeholder hosts fall back to NoDishPhoto.
  return Array.from(
    new Set(
      [dish.imageUrl, ...(dish.gallery ?? [])]
        .map((url) => sanitizeCatalogImageUrl(url))
        .filter((url): url is string => Boolean(url?.trim())),
    ),
  );
}

function StallMenuDishCard({
  dish,
  index,
  onPress,
  width,
}: {
  dish: DishDetail;
  index: number;
  onPress: (dish: DishDetail) => void;
  width: number;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const photos = useMemo(() => getStallDishPhotos(dish), [dish]);
  const imageStyle = {
    width: "100%" as const,
    height: 120,
    borderRadius: componentRadii.card,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${dish.name}`}
      accessibilityHint="Opens this dish detail page"
      onPress={() => onPress(dish)}
      style={{ width }}
    >
      <View style={{ gap: spacing[2] }}>
        {photos.length > 1 ? (
          <CyclingGridImage
            images={photos}
            cycleMs={CYCLING_GRID_IMAGE_INTERVAL_MS}
            startDelayMs={(index % 4) * 350}
            accessibilityLabel={`${dish.name} photo`}
            style={imageStyle}
          />
        ) : photos[0] ? (
          <AccessibleImage
            source={{ uri: photos[0] }}
            accessibilityLabel={`${dish.name} photo`}
            style={imageStyle}
            contentFit="cover"
            placeholder={dish.blurhash}
            transition={180}
          />
        ) : (
          <NoDishPhoto dishName={dish.name} style={imageStyle} />
        )}
        <View style={{ gap: spacing[1] }}>
          <AppText variant="bodyBold" numberOfLines={1}>
            {dish.name}
          </AppText>
          {isSoldOut(dish.availabilityFlags) ? (
            <AppText variant="bodySmallBold" style={{ color: palette.error }}>
              Sold out today
            </AppText>
          ) : (
            <AppText variant="price" style={{ color: palette.orange }}>
              {dish.priceRange}
            </AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function StallDetailScreen({ navigation, route }: Props) {
  const venueId = route.params?.venueId ?? route.params?.id ?? "";
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const cachedVenue = repository.getVenueById(venueId);
  const [hydratedVenue, setHydratedVenue] = useState<typeof cachedVenue>();
  const [hasLoadedVenueDetail, setHasLoadedVenueDetail] = useState(Boolean(cachedVenue));
  // A failed venue read (offline, timeout) is not "Stall not found".
  const [venueLoadFailed, setVenueLoadFailed] = useState(false);
  const [venueReloadKey, setVenueReloadKey] = useState(0);
  const venue = hydratedVenue ?? cachedVenue;

  useEffect(() => {
    let active = true;
    setHydratedVenue(undefined);
    setVenueLoadFailed(false);
    setHasLoadedVenueDetail(Boolean(cachedVenue));
    // Supabase list caches carry no delivery links, so still read the venue detail
    // in the background while the cached venue renders.
    if (!venueId || (cachedVenue && serviceProviderMode !== "supabase")) {
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getVenue(venueId)
      .then((nextVenue) => {
        if (!active) return;
        if (nextVenue) setHydratedVenue(nextVenue);
        setHasLoadedVenueDetail(true);
      })
      .catch(() => {
        if (!active) return;
        setVenueLoadFailed(true);
        setHasLoadedVenueDetail(true);
      });

    return () => {
      active = false;
    };
  }, [cachedVenue, serviceProviderMode, venueId, venueReloadKey]);

  const building = venue ? getBuildingById(venue.buildingId) : undefined;
  const cachedDishes = useMemo(
    () => (venue ? repository.listDishesByVenue(venue.id) : []),
    [repository, venue],
  );
  const [hydratedDishes, setHydratedDishes] = useState<DishDetail[] | undefined>();
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);
  const [menuReloadKey, setMenuReloadKey] = useState(0);
  const dishes =
    hydratedDishes ?? (serviceProviderMode === "supabase" ? EMPTY_DISHES : cachedDishes);
  // Supabase mode has no menu until listDishesByVenue resolves; an error is not an empty menu.
  const menuStatus: "loading" | "error" | "ready" = menuLoadFailed
    ? "error"
    : hydratedDishes === undefined && serviceProviderMode === "supabase"
      ? "loading"
      : "ready";
  const dishIdsKey = useMemo(() => dishes.map((dish) => dish.id).join("|"), [dishes]);
  const leadDish = dishes[0];
  const leadDishImageUrl = sanitizeCatalogImageUrl(leadDish?.imageUrl);
  // Release 0.1 details are read-only in staging and production. Development
  // keeps the deferred write surfaces for their individual implementation gates.
  const showDeferredDetailControls = !FEATURE_FLAGS.release01CoreOnly;

  const profile = useProfileStore((state) => state.profile);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  // Review replies are local-only (no backend), so keep them out of production builds.
  const reviewRepliesEnabled = FEATURE_FLAGS.prototypeRoutesEnabled;
  const [isSubmittingMenuPhoto, setIsSubmittingMenuPhoto] = useState(false);
  // Menu photos upload from a device file (supply.submitMenuPhoto), so not on web.
  const canSubmitMenuPhoto = isAuthenticated && Platform.OS !== "web";

  const submitMenuPhotoFrom = useCallback(
    async (source: "camera" | "library") => {
      if (!venue) return;
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast({
          message:
            source === "camera"
              ? "Camera permission is needed to snap a menu photo."
              : "Photo library permission is needed to pick a menu photo.",
          tone: "warning",
        });
        return;
      }
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
        exif: false,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setIsSubmittingMenuPhoto(true);
      try {
        await getHungryService().supply.submitMenuPhoto({
          venueId: venue.id,
          photoUri: asset.uri,
          photoMimeType: asset.mimeType ?? undefined,
          photoFileSizeBytes: asset.fileSize ?? undefined,
        });
        showToast({ message: "Thanks, we'll add the menu soon.", tone: "success" });
      } catch (error) {
        showToast({
          message:
            error instanceof Error && error.message
              ? error.message
              : "Couldn't upload the menu photo. Please try again.",
          tone: "error",
        });
      } finally {
        setIsSubmittingMenuPhoto(false);
      }
    },
    [showToast, venue],
  );

  const promptMenuPhoto = useCallback(() => {
    Alert.alert("Add a menu photo", "Snap or pick a photo of this stall's menu.", [
      { text: "Take photo", onPress: () => void submitMenuPhotoFrom("camera") },
      { text: "Choose from library", onPress: () => void submitMenuPhotoFrom("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [submitMenuPhotoFrom]);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(null);
  const [replyDraftByReviewId, setReplyDraftByReviewId] = useState<Record<string, string>>({});
  const [localRepliesByReviewId, setLocalRepliesByReviewId] = useState<
    Record<string, ReviewReply[]>
  >({});
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  // Once the hero scrolls away, the absolute top nav gets a solid background so
  // content never renders under the status bar / floating buttons.
  const [isTopNavSolid, setIsTopNavSolid] = useState(false);
  const [isClaimPending, setIsClaimPending] = useState(() =>
    hasPendingClaimForVenue(profile.id, venueId),
  );
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [reviewEntries, setReviewEntries] = useState<RecentReviewFeedEntry[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  const [activePromotions, setActivePromotions] = useState<MerchantPromotion[]>([]);
  const [merchantProfile, setMerchantProfile] = useState<PublicMerchantProfile>();
  const [openingSchedule, setOpeningSchedule] = useState<OpeningSchedule>();
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
  const stallAddress = venue ? formatFullStallAddress(venue, buildingLocation) : "";

  const shareReviewTarget = useMemo<ReviewShareTarget>(() => {
    return {
      kind: "stall",
      reviewId: `stall-${venue?.id ?? ""}`,
      postId: "",
      title: venue?.name ?? "Stall",
      subtitle: [buildingLocation.name, venue?.unitNumber?.trim()].filter(Boolean).join(" · "),
      imageUrl: leadDishImageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${venue?.name ?? "this stall"} at ${buildingLocation.name ?? "Hungry"}!`,
      link: webShareUrl("stall", venue?.id ?? ""),
    };
  }, [
    buildingLocation.name,
    leadDishImageUrl,
    profile.displayName,
    venue?.id,
    venue?.name,
    venue?.unitNumber,
  ]);

  useEffect(() => {
    let active = true;
    setHydratedDishes(undefined);
    setMenuLoadFailed(false);
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
        if (active) setMenuLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [cachedDishes.length, menuReloadKey, serviceProviderMode, venue?.id]);

  useEffect(() => {
    setIsClaimPending(hasPendingClaimForVenue(profile.id, venueId));
  }, [profile.id, venueId]);

  useEffect(() => {
    if (!venue || trackedStallViewId.current === venue.id) return;
    trackedStallViewId.current = venue.id;
    trackAnalyticsEvent(
      "stall_viewed",
      { stall_id: venue.id, building_id: venue.buildingId },
      isAuthenticated ? { userId: profile.id } : undefined,
    );
    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "stall_profile_view",
      venueId: venue.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
  }, [isAuthenticated, profile.id, venue]);

  useEffect(() => {
    let active = true;
    if (!showDeferredDetailControls) {
      setActivePromotions([]);
      return () => {
        active = false;
      };
    }
    if (!venue) {
      setActivePromotions([]);
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getPublicMerchantProfile(venue.id)
      .then((profile) => {
        if (active) setMerchantProfile(profile);
      })
      .catch(() => {
        if (active) setMerchantProfile(undefined);
      });

    void getHungryService()
      .discovery.getVenueOpeningSchedule(venue.id)
      .then((schedule) => {
        if (active) setOpeningSchedule(schedule);
      })
      .catch(() => {
        if (active) setOpeningSchedule(undefined);
      });

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
  }, [showDeferredDetailControls, venue]);

  useEffect(() => {
    if (!showDeferredDetailControls || !venue || activePromotions.length === 0) return;
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
  }, [activePromotions, isAuthenticated, profile.id, showDeferredDetailControls, venue]);

  // One query for the stall's newest reviews (not one per dish), scoped to its menu.
  useEffect(() => {
    let active = true;
    if (menuStatus !== "ready") {
      setReviewsStatus(menuStatus === "error" ? "error" : "loading");
      return () => {
        active = false;
      };
    }
    if (!dishIdsKey) {
      setReviewEntries([]);
      setReviewsStatus("ready");
      return () => {
        active = false;
      };
    }

    setReviewsStatus("loading");
    getHungryService()
      .reviews.listRecentReviews({
        dishIds: dishIdsKey.split("|"),
        limit: STALL_COMMUNITY_REVIEW_LIMIT,
      })
      .then((entries) => {
        if (!active) return;
        setReviewEntries(entries);
        setReviewsStatus("ready");
      })
      .catch(() => {
        if (active) setReviewsStatus("error");
      });

    return () => {
      active = false;
    };
  }, [dishIdsKey, menuStatus, reviewsReloadKey]);

  const communityReviews = useMemo(
    () => deriveStallCommunityReviews(reviewEntries),
    [reviewEntries],
  );
  // "Photos from reviews" rail: newest reviews first, at most 12 photos.
  const stallReviewPhotos = useMemo(
    () => communityReviews.flatMap((review) => review.photos).slice(0, 12),
    [communityReviews],
  );
  const stallDietarySummary = useMemo(() => summarizeStallDietaryFlags(dishes), [dishes]);
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

  const requireAuthForProtectedAction = (message: string, onSignedIn?: () => void) =>
    requireAccount(
      message,
      { name: "StallDetail", params: { venueId: venue?.id ?? venueId } },
      onSignedIn,
    );

  // A cold-start shared link opens this screen with nothing underneath it.
  const goBackOrHome = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("MainTabs", { screen: "Home" });
  };

  if (Boolean(venueId) && !venue && !hasLoadedVenueDetail) {
    return <StallDetailSkeleton />;
  }

  if (!venue && venueLoadFailed) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: palette.bg }}
        edges={["top", "left", "right"]}
      >
        <EmptyState
          title="Couldn't load this stall"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onPress={() => setVenueReloadKey((key) => key + 1)}
        />
      </SafeAreaView>
    );
  }

  if (!venue) {
    return (
      <FeedErrorBoundary
        title="Stall details unavailable"
        body="Couldn't load this stall — try again."
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: palette.bg }}
          edges={["top", "left", "right"]}
        >
          <EmptyState
            title="Stall not found"
            body="The stall you are looking for does not exist in our current directory."
            ctaLabel={navigation.canGoBack() ? "Go back" : "Go to Home"}
            onPress={goBackOrHome}
            errorMessage={`Missing stall data for ID: ${venueId || "unknown"}`}
            sendErrorContext="Stall detail"
          />
        </SafeAreaView>
      </FeedErrorBoundary>
    );
  }

  // Distance from the user to the stall's building; hidden when either is unknown.
  const userOrigin = locationPermission === "granted" ? currentLocation : manualCoordinate;
  const buildingCoordinate =
    building?.coordinate ??
    repository.listBuildings().find((candidate) => candidate.id === venue.buildingId)?.coordinate;
  const distanceLabel = formatDistanceFromUser(userOrigin, buildingCoordinate);
  const ratingSummary = summarizeStallRating(dishes);
  const priceBand = formatStallPriceBand(dishes);
  const deliveryLinks = venue.deliveryLinks ?? [];
  const heroImageUrl =
    sanitizeCatalogImageUrl(merchantProfile?.coverPhotoUrl || venue.imageUrl) ??
    dishes.map((dish) => getStallDishPhotos(dish)[0]).find(Boolean);
  // A verified merchant's weekly schedule (with special hours) wins over listed text hours.
  const schedule = openingSchedule ?? venue.openingSchedule;
  const openState = hasWeeklyHours(schedule)
    ? getScheduleOpenState(schedule, venue.isOpen)
    : getVenueOpenState(venue.operatingHours, venue.isOpen);
  const closureNotice = merchantProfile?.temporaryClosure ?? venue.closureNotice;
  const operatingStatusLabel = merchantProfile?.temporaryClosure
    ? merchantProfile.temporaryClosure
    : openState.status === "open"
      ? ["Open now", openState.detail].filter(Boolean).join(" · ")
      : openState.status === "unknown"
        ? venue.operatingHours?.trim()
          ? "Check listed hours"
          : "Hours not listed"
        : (closureNotice ?? ["Closed now", openState.detail].filter(Boolean).join(" · "));
  const merchantWebLinks = (merchantProfile?.socialLinks ?? []).slice(0, 5);
  const parsedHoursRows = hasWeeklyHours(schedule)
    ? [
        ...formatScheduleRows(schedule),
        ...getUpcomingSpecialHours(schedule).map((row) => ({
          label: `${row.label} (special)`,
          text: row.text,
        })),
      ]
    : formatHoursRows(parseOperatingHours(venue.operatingHours));
  // Unreadable text is still shown as written rather than dropped.
  const weeklyOperatingHours =
    parsedHoursRows.length > 0
      ? parsedHoursRows.map((row) => `${row.label}: ${row.text}`)
      : venue.operatingHours?.trim()
        ? [venue.operatingHours.trim()]
        : [];
  const headerSummary = [
    ratingSummary
      ? `${ratingSummary.rating.toFixed(1)} rating (${ratingSummary.reviewCount} ${
          ratingSummary.reviewCount === 1 ? "review" : "reviews"
        })`
      : undefined,
    priceBand,
    operatingStatusLabel,
  ]
    .filter(Boolean)
    .join(" · ");

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

    // Without a clear next dish, let the reviewer pick one instead of guessing.
    const targetDishId = nextUnreviewedDish?.id;
    if (!dishes.length) {
      showToast({
        message: "No dish available for review yet. Add a dish first.",
        tone: "warning",
        duration: 3000,
      });
      return;
    }

    showToast({
      message: "Try or review a dish here first, then mark this stall visited.",
      tone: "info",
      duration: 3000,
    });
    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: targetDishId ? { venueId: venue.id, dishId: targetDishId } : { venueId: venue.id },
    });
  };

  const openWriteReview = () => {
    // The composer sends review_started once a dish is picked; this is the entry tap.
    trackAnalyticsEvent("review_cta_tapped", { stall_id: venue.id, source_screen: "StallDetail" });
    if (!requireAuthForProtectedAction("Sign in to review this stall.")) {
      return;
    }
    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: venue.id },
    });
  };

  const openStallMaps = () => {
    if (!stallAddress) return;
    trackAnalyticsEvent("directions_opened", { stall_id: venue?.id, source: "stall_detail" });
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
    const shouldSolidifyTopNav =
      event.nativeEvent.contentOffset.y > screenWidth * 0.75 - (insets.top + 56);
    if (shouldSolidifyTopNav !== isTopNavSolid) setIsTopNavSolid(shouldSolidifyTopNav);
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

  // The merchant "share" counts a completed share, not an opened sheet.
  const recordMerchantShare = () => {
    void getHungryService().discovery.recordMerchantActionEvent({
      eventType: "share",
      venueId: venue.id,
      dishId: leadDish?.id,
      userId: isAuthenticated ? profile.id : undefined,
    });
  };

  const openShareSheet = () => {
    if (!venue) {
      return;
    }

    setActiveShareReview(shareReviewTarget);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  };

  const openMenuDish = (activeDish: DishDetail) => {
    trackAnalyticsEvent("stall_menu_dish_opened", {
      stall_id: venue.id,
      dish_id: activeDish.id,
      menu_category: activeMenuCategory,
    });
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
      body="Couldn't load this stall — try again."
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["left", "right"]}>
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.topNav,
              {
                backgroundColor: isTopNavSolid ? palette.bg : "transparent",
                borderBottomColor: palette.border,
                height: insets.top + 56,
                paddingTop: insets.top,
                paddingHorizontal: spacing[3],
                borderBottomWidth: isTopNavSolid ? StyleSheet.hairlineWidth : 0,
                zIndex: zIndex.overlay,
              },
            ]}
          >
            <IconButton
              variant="floating"
              accessibilityLabel="Go back"
              onPress={goBackOrHome}
              icon={<ChevronLeft color={palette.text} size={24} />}
              style={{ backgroundColor: headerButtonColor, borderColor: headerButtonBorderColor }}
            />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              {showDeferredDetailControls ? (
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
              ) : null}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[8] }}
          >
            {/* Hero: owner cover, then stall photo, then a dish photo, else a short branded header */}
            {heroImageUrl ? (
              <View
                style={{
                  width: screenWidth,
                  height: screenWidth * 0.75,
                  position: "relative",
                }}
              >
                <AccessibleImage
                  source={{ uri: heroImageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessibilityLabel={`${venue.name} photo`}
                />
              </View>
            ) : (
              <View
                accessibilityRole="image"
                accessibilityLabel={`${venue.name} photo unavailable`}
                style={{
                  alignItems: "center",
                  backgroundColor: palette.surfaceRaised,
                  height: insets.top + 56 + spacing[16],
                  justifyContent: "flex-end",
                  paddingBottom: spacing[4],
                  width: screenWidth,
                }}
              >
                <Utensils color={palette.orange} size={32} />
              </View>
            )}

            <View
              onLayout={handleContentBodyLayout}
              style={{
                gap: spacing[6],
                paddingHorizontal: spacing[3],
                paddingTop: spacing[5],
              }}
            >
              {/* Header Content */}
              <Card style={{ gap: spacing[3], padding: spacing[3] }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                  <StallLogoMark
                    logoUrl={sanitizeCatalogImageUrl(venue.logoUrl)}
                    name={venue.name}
                  />
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <AppText variant="h2" numberOfLines={1}>
                      {venue.name}
                    </AppText>
                    <AppText variant="bodyLarge" tone="secondary" numberOfLines={1}>
                      {/* Centre · unit · distance; the full address lives in the Address card. */}
                      {[buildingLocation.name, venue.unitNumber?.trim(), distanceLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  </View>
                </View>
                <AppText variant="bodySmall" tone="secondary">
                  {headerSummary}
                </AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                  {stallAddress ? (
                    <Chip
                      label="Directions"
                      accessibilityLabel={`Directions to ${venue.name}`}
                      leftIcon={<Navigation color={palette.orange} size={14} />}
                      onPress={openStallMaps}
                    />
                  ) : null}
                  {merchantProfile?.contactPhone ? (
                    <Chip
                      label="Call"
                      accessibilityLabel={`Call ${venue.name}`}
                      leftIcon={<Phone color={palette.orange} size={14} />}
                      onPress={() =>
                        void openMerchantProfileLink("phone", merchantProfile.contactPhone ?? "")
                      }
                    />
                  ) : null}
                  {!isAuthenticated ? (
                    <Chip
                      label="Save"
                      accessibilityLabel={`Save ${venue.name}`}
                      leftIcon={<Bookmark color={palette.orange} size={14} />}
                      onPress={() => requireAuthForProtectedAction("Sign in to save this stall.")}
                    />
                  ) : null}
                  <Chip
                    label="Share"
                    accessibilityLabel="Share stall"
                    leftIcon={<Send color={palette.orange} size={14} />}
                    onPress={openShareSheet}
                  />
                </View>
                {deliveryLinks.length > 0 ? (
                  <View style={{ gap: spacing[2] }}>
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
              </Card>

              {/* Save / Visited / Add-to-List */}
              {showDeferredDetailControls && isAuthenticated && venue ? (
                <StallInteractionBar
                  stallId={venue.id}
                  userId={profile.id}
                  hasReviewedDishAtVenue={hasReviewedDishAtVenue}
                  reviewPromptText="Try or review a dish here first, then mark this stall visited."
                  onReviewRequired={handleReviewRequiredForTried}
                  onSaved={() =>
                    void getHungryService().discovery.recordMerchantActionEvent({
                      eventType: "save",
                      venueId: venue.id,
                      userId: profile.id,
                    })
                  }
                  onAddToList={
                    FEATURE_FLAGS.portfoliosEnabled
                      ? () => void detailSaveActions.addToPortfolio()
                      : undefined
                  }
                  isAddingToList={detailSaveActions.isAddingToPortfolio}
                />
              ) : null}
              {showDeferredDetailControls && venue ? (
                <FollowStallButton
                  stallId={venue.id}
                  stallName={venue.name}
                  isAuthenticated={isAuthenticated}
                  onRequireAuth={() =>
                    requireAuthForProtectedAction(
                      `Sign in to follow ${venue.name}`,
                      () => void followStallAfterSignIn(venue.id),
                    )
                  }
                  onOpenAppSettings={() => navigation.navigate("Settings")}
                />
              ) : null}

              {showDeferredDetailControls && FEATURE_FLAGS.collectionsEnabled ? (
                <DetailSaveActionsCard
                  title="Save this stall"
                  body="Add this stall to your trying list."
                  onAddToChecklist={detailSaveActions.addToChecklist}
                  isAddingToChecklist={detailSaveActions.isAddingToChecklist}
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

              {merchantProfile &&
              (merchantProfile.description ||
                merchantProfile.contactPhone ||
                merchantProfile.contactEmail ||
                merchantWebLinks.length > 0) ? (
                <View style={{ gap: spacing[3] }}>
                  <AppText variant="h2">From the owner</AppText>
                  <Card style={{ padding: spacing[4], gap: spacing[3] }}>
                    {merchantProfile.isVerified ? (
                      <AppText variant="micro" style={{ color: palette.success }}>
                        ✓ Verified by Hungry
                      </AppText>
                    ) : null}
                    {merchantProfile.description ? (
                      <AppText variant="body" tone="secondary">
                        {merchantProfile.description}
                      </AppText>
                    ) : null}
                    {merchantProfile.cuisineCategories.length > 0 ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                        {merchantProfile.cuisineCategories.map((category) => (
                          <Chip key={category} label={category} />
                        ))}
                      </View>
                    ) : null}
                    {merchantProfile.contactPhone ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Call ${venue.name}`}
                        onPress={() =>
                          void openMerchantProfileLink("phone", merchantProfile.contactPhone ?? "")
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[2],
                          minHeight: 44,
                        }}
                      >
                        <Phone color={palette.orange} size={16} />
                        <AppText variant="body">{merchantProfile.contactPhone}</AppText>
                      </Pressable>
                    ) : null}
                    {merchantProfile.contactEmail ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Email ${venue.name}`}
                        onPress={() =>
                          void openMerchantProfileLink("email", merchantProfile.contactEmail ?? "")
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[2],
                          minHeight: 44,
                        }}
                      >
                        <Mail color={palette.orange} size={16} />
                        <AppText variant="body">{merchantProfile.contactEmail}</AppText>
                      </Pressable>
                    ) : null}
                    {merchantWebLinks.map((link) => (
                      <Pressable
                        key={`${link.platform}:${link.url}`}
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${venue.name} ${link.platform}`}
                        onPress={() => void openMerchantProfileLink("web", link.url)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[2],
                          minHeight: 44,
                        }}
                      >
                        <Globe color={palette.orange} size={16} />
                        <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                          {formatMenuCategoryLabel(link.platform)}
                        </AppText>
                      </Pressable>
                    ))}
                  </Card>
                </View>
              ) : null}

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

              {showDeferredDetailControls && FEATURE_FLAGS.socialFeedEnabled ? (
                <PopularVisitorsSection venueId={venue.id} horizontalPadding={0} />
              ) : null}

              {showDeferredDetailControls && activePromotions.length > 0 ? (
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
                {stallDietarySummary.length > 0 ? (
                  <View style={{ gap: spacing[1] }}>
                    <DietaryFlagChips
                      flags={stallDietarySummary.map((item) => item.flag)}
                      detailByFlag={Object.fromEntries(
                        stallDietarySummary.map((item) => [
                          item.flag,
                          item.allDishes
                            ? "all dishes"
                            : `${item.dishCount} ${item.dishCount === 1 ? "dish" : "dishes"}`,
                        ]),
                      )}
                    />
                    <AppText variant="micro" tone="muted">
                      Labels come from the stall or our catalogue. Check with the stall if it
                      matters to you.
                    </AppText>
                  </View>
                ) : null}
                {menuStatus === "loading" ? (
                  <View
                    accessibilityLabel="Loading menu"
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}
                  >
                    <Skeleton width="45%" height={160} borderRadius={radii.lg} />
                    <Skeleton width="45%" height={160} borderRadius={radii.lg} />
                  </View>
                ) : menuStatus === "error" ? (
                  <Card style={{ padding: spacing[4], alignItems: "center", gap: spacing[2] }}>
                    <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                      Couldn&apos;t load this stall&apos;s menu.
                    </AppText>
                    <Button
                      label="Retry"
                      variant="secondary"
                      onPress={() => setMenuReloadKey((key) => key + 1)}
                    />
                  </Card>
                ) : dishes.length > 0 ? (
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
                            index={index}
                            // Two columns inside the body's spacing[3] padding and gap.
                            width={(screenWidth - spacing[3] * 3) / 2}
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
                    {/* Uploads a menu photo for the team to add the menu from. */}
                    {showDeferredDetailControls && canSubmitMenuPhoto ? (
                      <Button
                        label={isSubmittingMenuPhoto ? "Uploading..." : "Add a menu photo"}
                        variant="secondary"
                        disabled={isSubmittingMenuPhoto}
                        onPress={promptMenuPhoto}
                      />
                    ) : null}
                  </Card>
                )}
              </View>

              {/* Community Reviews */}
              {showDeferredDetailControls && FEATURE_FLAGS.reviewCreationEnabled ? (
                <View style={{ gap: spacing[4] }}>
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <AppText variant="h2">Recent Reviews</AppText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Write a review for ${venue.name}`}
                      onPress={openWriteReview}
                      hitSlop={8}
                    >
                      <AppText variant="bodySmallBold" tone="accent">
                        Write a review
                      </AppText>
                    </Pressable>
                  </View>
                  {reviewsStatus === "loading" ? (
                    <Skeleton width="100%" height={72} borderRadius={radii.lg} />
                  ) : reviewsStatus === "error" ? (
                    <Card style={{ padding: spacing[4], alignItems: "center", gap: spacing[2] }}>
                      <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                        Couldn&apos;t load reviews for this stall.
                      </AppText>
                      <Button
                        label="Retry"
                        variant="secondary"
                        onPress={() => {
                          if (menuStatus === "error") {
                            setMenuReloadKey((key) => key + 1);
                            return;
                          }
                          setReviewsReloadKey((key) => key + 1);
                        }}
                      />
                    </Card>
                  ) : communityReviews.length > 0 ? (
                    <>
                      {stallReviewPhotos.length > 0 ? (
                        <View style={{ gap: spacing[2] }}>
                          <AppText variant="bodySmall" style={{ fontWeight: "800" }}>
                            Photos from reviews
                          </AppText>
                          <ReviewPhotoStrip
                            photos={stallReviewPhotos}
                            subject={`${venue.name}, from reviews`}
                            size={96}
                          />
                        </View>
                      ) : null}
                      {communityReviews.map((review) => (
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
                            <Avatar uri={review.avatarUrl} name={review.authorName} size={40} />
                            <View style={{ flex: 1 }}>
                              <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
                              <Pressable
                                accessibilityRole="link"
                                accessibilityLabel={`Open ${review.dishName}`}
                                onPress={() =>
                                  navigation.navigate("DishDetail", { dishId: review.dishId })
                                }
                              >
                                <AppText variant="micro" tone="accent" numberOfLines={1}>
                                  on {review.dishName}
                                </AppText>
                              </Pressable>
                              <View
                                accessible
                                accessibilityRole="text"
                                accessibilityLabel={`Rated ${review.rating} out of 5`}
                                style={{
                                  flexDirection: "row",
                                  gap: spacing[0.5],
                                }}
                              >
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    size={12}
                                    color={i < review.rating ? palette.ratingStar : palette.border}
                                    fill={i < review.rating ? palette.ratingStar : "transparent"}
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

                          {review.photos.length > 0 ? (
                            <View style={{ marginTop: spacing[2] }}>
                              <ReviewPhotoStrip
                                photos={review.photos}
                                subject={`${review.dishName}, review by ${review.authorName}`}
                              />
                            </View>
                          ) : null}

                          {isOwnReview(review, isAuthenticated ? profile.id : undefined) ? (
                            <View style={{ marginTop: spacing[2] }}>
                              <OwnReviewActions
                                review={{
                                  id: review.reviewId,
                                  rating: review.rating,
                                  text: review.text,
                                }}
                                onUpdated={(patch) =>
                                  setReviewEntries((current) =>
                                    current.map((entry) =>
                                      entry.review.id === review.reviewId
                                        ? { ...entry, review: { ...entry.review, ...patch } }
                                        : entry,
                                    ),
                                  )
                                }
                                onDeleted={() =>
                                  setReviewEntries((current) =>
                                    current.filter((entry) => entry.review.id !== review.reviewId),
                                  )
                                }
                              />
                            </View>
                          ) : null}

                          {review.merchantReply ? (
                            <View
                              style={{
                                marginTop: spacing[2],
                                padding: spacing[3],
                                borderRadius: componentRadii.card,
                                backgroundColor: palette.bgSoft,
                                gap: spacing[1],
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

                          {reviewRepliesEnabled ? (
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
                                hitSlop={14}
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
                                  {(localRepliesByReviewId[review.id]?.length ?? 0) === 1
                                    ? "y"
                                    : "ies"}
                                </AppText>
                              ) : null}
                            </View>
                          ) : null}

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

                          {reviewRepliesEnabled && activeReplyReviewId === review.id ? (
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
                      ))}
                    </>
                  ) : (
                    <EmptyState
                      title="No community reviews yet"
                      body="Write your first review for this stall."
                      icon={<CommentIcon size={36} color={palette.textMuted} />}
                      ctaLabel="Write a review"
                      onPress={openWriteReview}
                    />
                  )}
                </View>
              ) : null}

              {showDeferredDetailControls && FEATURE_FLAGS.merchantClaimCtaEnabled ? (
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
                      hitSlop={13}
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
          {detailSaveActions.saveToListSheet}
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
