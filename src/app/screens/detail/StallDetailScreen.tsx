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
import { PhotoPager } from "@/components/dish/PhotoPager";
import { DeliveryPlatformButton } from "@/components/dish/DeliveryPlatformButton";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import { DietaryFlagChips } from "@/components/dish/DietaryFlagChips";
import { OwnReviewActions, ReviewPhotoStrip, ReviewReaderActions } from "@/components/review";
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
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { formatDishPrice } from "@/features/detail/dishPrice";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openMerchantProfileLink, openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { getDishSection, isSectionFlag, isSoldOut } from "@/features/merchant/menuSections";
import {
  buildMapsSearchUrl,
  formatDistanceFromUser,
  formatFullStallAddress,
  formatStallPriceBand,
  getStallPin,
  summarizeStallRating,
} from "@/features/detail/stallLocation";
import { ReportProblemLink } from "@/components/stall/ReportProblemLink";
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
import { resolveStallOpenInfo } from "@/features/detail/stallOpenState";
import { ReviewShareSheet, type ReviewShareTarget } from "@/app/screens/review/ReviewShareSheet";
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
/** Menus longer than this get a search box. */
const MENU_SEARCH_MIN_ITEMS = 20;
/** Reviews loaded per "See more reviews" tap. */
const STALL_REVIEW_PAGE_SIZE = 10;
/** Photos in the hero pager: owner cover, stall photo, dish photos, then review photos. */
const HERO_PHOTO_LIMIT = 8;
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

/** The first photo of the dish's own: a menu tile shows one still image, never the stall's. */
function getStallDishPhotos(dish: DishDetail) {
  return Array.from(
    new Set(
      [dish.imageUrl, ...(dish.gallery ?? [])].filter((url): url is string => Boolean(url?.trim())),
    ),
  );
}

/** Screen-reader label for a menu tile: name, price or sold out. */
function menuDishAccessibilityLabel(dish: DishDetail) {
  return isSoldOut(dish.availabilityFlags)
    ? `${dish.name}, sold out today`
    : `${dish.name}, ${formatDishPrice(dish)}`;
}

function StallMenuDishCard({
  dish,
  onPress,
  width,
}: {
  dish: DishDetail;
  onPress: (dish: DishDetail) => void;
  width: number;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  // One still photo per tile: no per-tile timers or measuring, and a swipe never fights the tap.
  const photo = useMemo(() => getStallDishPhotos(dish)[0], [dish]);
  const imageStyle = {
    width: "100%" as const,
    height: 120,
    borderRadius: componentRadii.card,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={menuDishAccessibilityLabel(dish)}
      accessibilityHint="Opens this dish detail page"
      onPress={() => onPress(dish)}
      style={{ width }}
    >
      <View style={{ gap: spacing[2] }}>
        {photo ? (
          <AccessibleImage
            source={{ uri: photo }}
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
              {formatDishPrice(dish)}
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
  const leadDish = dishes[0];

  const profile = useProfileStore((state) => state.profile);
  const locationPermission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const requireAccount = useRequireAccount();
  const showToast = useUIStore((state) => state.showToast);
  const { componentRadii, palette, radii, spacing, zIndex } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
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
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [isClaimPending, setIsClaimPending] = useState(() =>
    hasPendingClaimForVenue(profile.id, venueId),
  );
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [reviewEntries, setReviewEntries] = useState<RecentReviewFeedEntry[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const [activePromotions, setActivePromotions] = useState<MerchantPromotion[]>([]);
  const [merchantProfile, setMerchantProfile] = useState<PublicMerchantProfile>();
  const [openingSchedule, setOpeningSchedule] = useState<OpeningSchedule>();
  const [activeMenuCategory, setActiveMenuCategory] = useState(ALL_MENU_CATEGORY);
  const [menuQuery, setMenuQuery] = useState("");
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
      imageUrl: leadDish?.imageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${venue?.name ?? "this stall"} at ${buildingLocation.name ?? "Hungry"}!`,
      link: webShareUrl("stall", venue?.id ?? ""),
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

  // Keyed on the id: the cached venue renders first and the hydrated one replaces it,
  // which must not re-run these three reads.
  const sideLoadVenueId = venue?.id;
  useEffect(() => {
    let active = true;
    if (!sideLoadVenueId) {
      setActivePromotions([]);
      return () => {
        active = false;
      };
    }

    void getHungryService()
      .discovery.getPublicMerchantProfile(sideLoadVenueId)
      .then((profile) => {
        if (active) setMerchantProfile(profile);
      })
      .catch(() => {
        if (active) setMerchantProfile(undefined);
      });

    void getHungryService()
      .discovery.getVenueOpeningSchedule(sideLoadVenueId)
      .then((schedule) => {
        if (active) setOpeningSchedule(schedule);
      })
      .catch(() => {
        if (active) setOpeningSchedule(undefined);
      });

    void getHungryService()
      .discovery.listActivePromotionsForTarget({ venueId: sideLoadVenueId })
      .then((promotions) => {
        if (active) setActivePromotions(promotions);
      })
      .catch(() => {
        if (active) setActivePromotions([]);
      });

    return () => {
      active = false;
    };
  }, [sideLoadVenueId]);

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
      // promotion_profile_visit is not sent here: promotions only show on this page, so it
      // would always equal promotion_impression. It belongs to a surface that links a
      // promotion to this stall.
    });
  }, [activePromotions, isAuthenticated, profile.id, venue]);

  // One query for the stall's newest reviews, read by the stall's indexed venue column
  // (a menu of up to 500 dishes would put every dish id in the request URL).
  useEffect(() => {
    let active = true;
    if (!sideLoadVenueId) {
      setReviewEntries([]);
      setReviewsStatus("ready");
      return () => {
        active = false;
      };
    }

    setReviewsStatus("loading");
    getHungryService()
      .reviews.listRecentReviews({
        venueId: sideLoadVenueId,
        limit: STALL_COMMUNITY_REVIEW_LIMIT,
      })
      .then((entries) => {
        if (!active) return;
        setReviewEntries(entries);
        setHasMoreReviews(entries.length === STALL_COMMUNITY_REVIEW_LIMIT);
        setReviewsStatus("ready");
      })
      .catch(() => {
        if (active) setReviewsStatus("error");
      });

    return () => {
      active = false;
    };
  }, [sideLoadVenueId, reviewsReloadKey]);

  const loadMoreReviews = () => {
    const sorted = [...reviewEntries].sort(
      (left, right) =>
        new Date(left.review.createdAt).getTime() - new Date(right.review.createdAt).getTime() ||
        (left.review.id < right.review.id ? -1 : 1),
    );
    const last = sorted[0];
    if (!sideLoadVenueId || !last || isLoadingMoreReviews) return;
    setIsLoadingMoreReviews(true);
    getHungryService()
      .reviews.listRecentReviews({
        venueId: sideLoadVenueId,
        limit: STALL_REVIEW_PAGE_SIZE,
        before: last.review.createdAt,
        beforeId: last.review.id,
      })
      .then((entries) => {
        setReviewEntries((current) => {
          const known = new Set(current.map((entry) => entry.review.id));
          return [...current, ...entries.filter((entry) => !known.has(entry.review.id))];
        });
        setHasMoreReviews(entries.length === STALL_REVIEW_PAGE_SIZE);
      })
      .catch(() => {
        showToast({ message: "Couldn't load more reviews. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMoreReviews(false));
  };

  const communityReviews = useMemo(
    () => deriveStallCommunityReviews(reviewEntries, reviewEntries.length),
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
  // The server returns the menu in search-rank order, which reads as random on a menu:
  // group by category (the chip order), then A-Z within it.
  const orderedMenuDishes = useMemo(() => {
    const categoryRank = (dish: DishDetail) => {
      const index = MENU_CATEGORY_ORDER.indexOf(menuCategoryByDishId[dish.id] ?? "");
      return index === -1 ? MENU_CATEGORY_ORDER.length : index;
    };
    return [...dishes].sort(
      (left, right) =>
        categoryRank(left) - categoryRank(right) ||
        (menuCategoryByDishId[left.id] ?? "").localeCompare(menuCategoryByDishId[right.id] ?? "") ||
        left.name.localeCompare(right.name),
    );
  }, [dishes, menuCategoryByDishId]);
  const trimmedMenuQuery = menuQuery.trim().toLowerCase();
  const filteredMenuDishes = useMemo(() => {
    const inCategory =
      activeMenuCategory === ALL_MENU_CATEGORY
        ? orderedMenuDishes
        : orderedMenuDishes.filter((dish) => menuCategoryByDishId[dish.id] === activeMenuCategory);
    return trimmedMenuQuery
      ? inCategory.filter((dish) => dish.name.toLowerCase().includes(trimmedMenuQuery))
      : inCategory;
  }, [activeMenuCategory, menuCategoryByDishId, orderedMenuDishes, trimmedMenuQuery]);
  const visibleMenuDishes = useMemo(
    () => filteredMenuDishes.slice(0, visibleMenuItemCount),
    [filteredMenuDishes, visibleMenuItemCount],
  );
  const hasMoreMenuItems = visibleMenuDishes.length < filteredMenuDishes.length;

  useEffect(() => {
    setVisibleMenuItemCount(INITIAL_MENU_ITEM_COUNT);
  }, [activeMenuCategory, trimmedMenuQuery, venue?.id]);

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

  // Distance from the user to the stall (its own pin when it has one, else its building);
  // hidden when either is unknown.
  const userOrigin = locationPermission === "granted" ? currentLocation : manualCoordinate;
  const buildingCoordinate =
    building?.coordinate ??
    repository.listBuildings().find((candidate) => candidate.id === venue.buildingId)?.coordinate;
  const stallPin = getStallPin(venue, buildingCoordinate);
  const distanceLabel = formatDistanceFromUser(userOrigin, stallPin ?? buildingCoordinate);
  const ratingSummary = summarizeStallRating(dishes);
  const priceBand = formatStallPriceBand(dishes);
  const deliveryLinks = venue.deliveryLinks ?? [];
  // Owner cover, then the stall photo, then each dish's photo, then review photos.
  const heroPhotos = Array.from(
    new Set(
      [
        merchantProfile?.coverPhotoUrl,
        venue.imageUrl,
        ...dishes.map((dish) => getStallDishPhotos(dish)[0]),
        ...stallReviewPhotos,
      ].filter((url): url is string => Boolean(url?.trim())),
    ),
  ).slice(0, HERO_PHOTO_LIMIT);
  // One shared helper so the stall page and the dish page always agree: the owner's
  // temporary closure, then the weekly schedule with special hours, then the listed text.
  const openInfo = resolveStallOpenInfo({
    venue,
    schedule: openingSchedule,
    temporaryClosure: merchantProfile?.temporaryClosure,
  });
  const operatingStatusLabel = openInfo.statusLabel;
  const merchantWebLinks = (merchantProfile?.socialLinks ?? []).slice(0, 5);
  const hoursRows = openInfo.weekRows;
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

  // Only the signed-in bar calls this: guests are sent to sign in before they get here.
  const handleReviewRequiredForTried = () => {
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

  const recordTap = (
    eventType: "direction_tap" | "contact_tap" | "social_link_tap",
    metadata?: Record<string, string>,
  ) => {
    void getHungryService().discovery.recordMerchantActionEvent({
      eventType,
      venueId: venue.id,
      userId: isAuthenticated ? profile.id : undefined,
      metadata,
    });
  };

  const openStallMaps = () => {
    if (!stallAddress && !stallPin) return;
    trackAnalyticsEvent("directions_opened", { stall_id: venue?.id, source: "stall_detail" });
    recordTap("direction_tap");
    void openTrustedMapsUrl(buildMapsSearchUrl(stallAddress, stallPin));
  };

  const openMerchantContact = (kind: "phone" | "email", value: string) => {
    recordTap("contact_tap", { channel: kind });
    void openMerchantProfileLink(kind, value);
  };

  const openMerchantWebLink = (platform: string, url: string) => {
    recordTap("social_link_tap", { platform });
    void openMerchantProfileLink("web", url);
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
          message: `You have already submitted a claim for ${venue.name}.`,
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
              onPress={goBackOrHome}
              icon={<ChevronLeft color={palette.text} size={24} />}
              style={{ backgroundColor: headerButtonColor, borderColor: headerButtonBorderColor }}
            />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
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
            {/* Hero: swipeable photos (owner cover, stall, dishes, reviews), else a short branded header */}
            {heroPhotos.length > 0 ? (
              <PhotoPager
                photos={heroPhotos}
                width={screenWidth}
                height={screenWidth * 0.75}
                subject={venue.name}
              />
            ) : (
              <View
                accessibilityRole="image"
                accessibilityLabel={`${venue.name} has no photos yet`}
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
                  <StallLogoMark logoUrl={venue.logoUrl} name={venue.name} />
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
                  {stallAddress || stallPin ? (
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
                        openMerchantContact("phone", merchantProfile.contactPhone ?? "")
                      }
                    />
                  ) : null}
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

              {/* Save / Visited / Add-to-List: the same row for guests and signed-in users */}
              <StallInteractionBar
                stallId={venue.id}
                userId={profile.id}
                isAuthenticated={isAuthenticated}
                onRequireAuth={(message) => requireAuthForProtectedAction(message)}
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
              {/* Follow: a guest's tap goes through sign-in. */}
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

              {FEATURE_FLAGS.collectionsEnabled ? (
                <DetailSaveActionsCard
                  title="Save this stall"
                  body="Add this stall to your trying list."
                  onAddToChecklist={detailSaveActions.addToChecklist}
                  isAddingToChecklist={detailSaveActions.isAddingToChecklist}
                />
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
                    {dishes.length > MENU_SEARCH_MIN_ITEMS ? (
                      <Input
                        placeholder="Search this menu"
                        value={menuQuery}
                        onChangeText={setMenuQuery}
                        accessibilityLabel="Search this menu"
                        returnKeyType="search"
                        autoCorrect={false}
                      />
                    ) : null}
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
                        {visibleMenuDishes.map((dish) => (
                          <StallMenuDishCard
                            key={dish.id}
                            dish={dish}
                            // Two columns inside the body's spacing[3] padding and gap.
                            width={(screenWidth - spacing[3] * 3) / 2}
                            onPress={openMenuDish}
                          />
                        ))}
                      </View>
                    ) : (
                      <Card style={{ padding: spacing[4], alignItems: "center" }}>
                        <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                          {trimmedMenuQuery
                            ? `No dishes match "${menuQuery.trim()}".`
                            : "No items in this category yet."}
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
                    {canSubmitMenuPhoto && (
                      <Button
                        label={isSubmittingMenuPhoto ? "Uploading..." : "Add a menu photo"}
                        variant="secondary"
                        disabled={isSubmittingMenuPhoto}
                        onPress={promptMenuPhoto}
                      />
                    )}
                  </Card>
                )}
              </View>

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

              {/* Info: hours, address and the owner's words in one compact card */}
              <Card style={{ gap: spacing[4], padding: spacing[4] }}>
                <View style={{ gap: spacing[1.5] }}>
                  <AppText variant="bodyBold">Hours</AppText>
                  <AppText variant="bodyBold" tone={openInfo.isOpen ? "success" : "default"}>
                    {operatingStatusLabel}
                  </AppText>
                  {openInfo.todayRows.length > 0 && openInfo.todayRows !== hoursRows ? (
                    <AppText variant="bodySmallBold">
                      {openInfo.todayRows[0].label}: {openInfo.todayRows[0].text}
                    </AppText>
                  ) : null}
                  {hoursRows.map((row) => (
                    <AppText key={`${row.label}-${row.text}`} variant="bodySmall" tone="secondary">
                      {row.label}: {row.text}
                    </AppText>
                  ))}
                </View>

                <View
                  style={{
                    borderTopColor: palette.border,
                    borderTopWidth: 1,
                    gap: spacing[1.5],
                    paddingTop: spacing[3],
                  }}
                >
                  <AppText variant="bodyBold">Address</AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open maps for ${stallAddress}`}
                    onPress={openStallMaps}
                    style={({ pressed }) => [{ minHeight: 44, opacity: pressed ? 0.8 : 1 }]}
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
                </View>

                {merchantProfile &&
                (merchantProfile.description ||
                  merchantProfile.contactEmail ||
                  merchantProfile.cuisineCategories.length > 0 ||
                  merchantWebLinks.length > 0) ? (
                  <View
                    style={{
                      borderTopColor: palette.border,
                      borderTopWidth: 1,
                      gap: spacing[2],
                      paddingTop: spacing[3],
                    }}
                  >
                    <AppText variant="bodyBold">From the owner</AppText>
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
                    {merchantProfile.contactEmail ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Email ${venue.name}`}
                        onPress={() =>
                          openMerchantContact("email", merchantProfile.contactEmail ?? "")
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
                        onPress={() => openMerchantWebLink(link.platform, link.url)}
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
                  </View>
                ) : null}
              </Card>

              <PopularVisitorsSection venueId={venue.id} horizontalPadding={0} />

              {/* Reviews */}
              <View style={{ gap: spacing[4] }}>
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <AppText variant="h2">Reviews</AppText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Write a review for ${venue.name}`}
                    onPress={openWriteReview}
                    hitSlop={8}
                    style={{ justifyContent: "center", minHeight: 44 }}
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
                      onPress={() => setReviewsReloadKey((key) => key + 1)}
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
                          <Pressable
                            accessibilityRole={review.authorId ? "link" : undefined}
                            accessibilityLabel={`Open ${review.authorName}'s profile`}
                            disabled={!review.authorId}
                            onPress={() =>
                              navigation.navigate("UserProfile", {
                                authorId: review.authorId,
                                authorName: review.authorName,
                                authorAvatarUrl: review.avatarUrl,
                              })
                            }
                          >
                            <Avatar uri={review.avatarUrl} name={review.authorName} size={40} />
                          </Pressable>
                          <View style={{ flex: 1 }}>
                            <Pressable
                              accessibilityRole={review.authorId ? "link" : undefined}
                              accessibilityLabel={`Open ${review.authorName}'s profile`}
                              disabled={!review.authorId}
                              hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
                              onPress={() =>
                                navigation.navigate("UserProfile", {
                                  authorId: review.authorId,
                                  authorName: review.authorName,
                                  authorAvatarUrl: review.avatarUrl,
                                })
                              }
                            >
                              <AppText style={{ fontWeight: "700" }}>{review.authorName}</AppText>
                            </Pressable>
                            <Pressable
                              accessibilityRole="link"
                              accessibilityLabel={`Open ${review.dishName}`}
                              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                              onPress={() =>
                                navigation.navigate("DishDetail", { dishId: review.dishId })
                              }
                            >
                              <AppText variant="bodySmall" tone="accent" numberOfLines={1}>
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

                        <ReviewReaderActions
                          key={review.reviewId}
                          review={{
                            id: review.reviewId,
                            authorId: review.authorId,
                            authorName: review.authorName,
                            helpfulCount: review.helpfulCount,
                            viewerFoundHelpful: review.viewerFoundHelpful,
                          }}
                          isOwn={isOwnReview(review, isAuthenticated ? profile.id : undefined)}
                          returnRoute={{ name: "StallDetail", params: { venueId: venue.id } }}
                          onRemoved={() =>
                            setReviewEntries((current) =>
                              current.filter((entry) => entry.review.id !== review.reviewId),
                            )
                          }
                        />
                      </View>
                    ))}
                    {hasMoreReviews ? (
                      <Button
                        label="See more reviews"
                        variant="secondary"
                        loading={isLoadingMoreReviews}
                        onPress={loadMoreReviews}
                      />
                    ) : null}
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

              <ReportProblemLink
                venueId={venue.id}
                returnRoute={{ name: "StallDetail", params: { venueId: venue.id } }}
              />
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
            onShareCompleted={recordMerchantShare}
          />
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
