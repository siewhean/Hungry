import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
  Text,
} from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock3,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  MessageCircleMore,
  Share as ShareIos,
  Share2,
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
  Input,
  Skeleton,
} from "@/components/ui";
import { PhotoPager } from "@/components/dish/PhotoPager";
import { DetailHeroFade } from "@/components/detail/DetailHeroFade";
import { DeliveryButtonRow } from "@/components/dish/DeliveryPlatformButton";
import { DetailCollapsingHeader } from "@/components/detail/DetailCollapsingHeader";
import { FloatingBackButton } from "@/components/detail/FloatingBackButton";
import { NoDishPhoto } from "@/components/dish/NoDishPhoto";
import {
  CaptionPreview,
  OwnReviewActions,
  ReviewPhotoStrip,
  ReviewReaderActions,
} from "@/components/review";
import { summarizeStallDietaryFlags } from "@/features/detail/dietaryLabels";
import { isOwnReview } from "@/features/review/reviewEdit";
import { ensureAiSearchConsent } from "@/features/privacy/consent";
import { StallReviewCard } from "@/components/stall/StallReviewCard";
import { StallHeroFallback } from "@/components/stall/StallHeroFallback";
import { StallHelpFillCard } from "@/components/stall/StallHelpFillCard";
import { StallLogoMark } from "@/components/stall/StallLogoMark";
import { StallVisitedSheet } from "@/components/stall/StallVisitedSheet";
import {
  getStallDishPhotos,
  shouldUseMenuList,
  StallMenuDishCard,
  StallMenuDishRow,
} from "@/components/stall/StallMenuDish";
import { MenuFilterDropdown } from "@/components/stall/MenuFilterDropdown";
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
import { sectionScrollOffset } from "@/features/detail/scrollToSection";
import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { formatDishPrice } from "@/features/detail/dishPrice";
import { toDisplayName } from "@/features/detail/stallDisplayName";
import { pickVisitedSheetDishes } from "@/features/detail/stallVisited";
import type {
  MerchantClaimStatus,
  RecentReviewFeedEntry,
  VenueMenuCursor,
} from "@/lib/services/types";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { openMerchantProfileLink, openTrustedMapsUrl } from "@/lib/security/safeLinking";
import { isSoldOut, isStallsPick } from "@/features/merchant/menuSections";
import {
  ALL_MENU_CATEGORY,
  compareMenuCategories,
  inferDishCategory,
} from "@/features/detail/menuCategory";
import {
  buildStallMapsUrl,
  formatDistanceFromUser,
  formatFullStallAddress,
  formatShortStallAddress,
  formatStallPriceBand,
  getStallPin,
  summarizeStallRating,
} from "@/features/detail/stallLocation";
import { ReportProblemLink } from "@/components/stall/ReportProblemLink";
import { useProfileStore } from "@/store/useProfileStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useSocialStore } from "@/store/useSocialStore";
import { PopularVisitorsSection } from "@/components/stall/PopularVisitorsSection";
import { StallInteractionBar } from "@/components/stall/StallInteractionBar";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { saveStallAfterSignIn } from "@/features/auth/finishGuestAction";
import { reportError } from "@/lib/monitoring/reportError";
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
import { useDetailSaveActions } from "@/features/checklistPortfolio/DetailSaveActions";
import { webShareUrl } from "@/constants/links";
import { dishPrefillFrom } from "@/features/detail/dishPrefill";

const CommentIcon = MessageCircle ?? MessageCircleMore;
/** The platform's own share glyph: the box-and-arrow on iOS, the three dots on Android. */
const ShareIcon = Platform.OS === "ios" ? ShareIos : Share2;
const CLAIM_STATUS_LABELS: Record<MerchantClaimStatus, string> = {
  none: "Claim this stall",
  submitted: "Claim submitted",
  in_review: "Claim in review",
  approved: "Claim approved",
  rejected: "Claim not approved",
};
const INITIAL_MENU_ITEM_COUNT = 10;
const MENU_ITEM_BATCH_SIZE = 10;
const MENU_LOAD_THRESHOLD_PX = 280;
/** Menus longer than this get a search box. */
const MENU_SEARCH_MIN_ITEMS = 20;
/** Reviews loaded per "See more reviews" tap. */
const STALL_REVIEW_PAGE_SIZE = 10;
/** Photos in the hero pager: owner cover, stall photo, dish photos, then review photos. */
const HERO_PHOTO_LIMIT = 8;
const MENU_GRID_COLUMNS = 2;

/**
 * A failed read because the diner is offline is not a defect: opening a stall offline would
 * otherwise send one Sentry event per section (venue, menu, claim, merchant, promotions,
 * hours, reviews). Everything else is reported.
 */
function isOfflineReadError(error: unknown): boolean {
  if (useUIStore.getState().isOffline) return true;
  if (!error || typeof error !== "object") return false;
  const { message, name, status } = error as {
    message?: unknown;
    name?: unknown;
    status?: unknown;
  };
  if (status === 0 || name === "AuthRetryableFetchError") return true;
  return (
    typeof message === "string" &&
    /network request failed|failed to fetch|network error|load failed/i.test(message)
  );
}

function reportStallError(error: unknown, action: string) {
  if (isOfflineReadError(error)) return;
  reportError(error, { screen: "StallDetail", action });
}

function ContactRow({
  icon,
  label,
  value,
  accessibilityLabel,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 52,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: palette.orangeLight,
          borderRadius: radii.pill,
          height: 36,
          justifyContent: "center",
          width: 36,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="micro" tone="muted">
          {label}
        </AppText>
        <AppText variant="body" numberOfLines={1}>
          {value}
        </AppText>
      </View>
      <ChevronRight color={palette.textMuted} size={18} />
    </Pressable>
  );
}

function StallDetailSkeleton({ onBack }: { onBack: () => void }) {
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
      {/* The screen has no header: a slow or offline open still needs a way out. */}
      <FloatingBackButton onPress={onBack} />
    </View>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, "StallDetail">;

const EMPTY_DISHES: DishDetail[] = [];

/** "https://www.laksa.sg/menu" -> "laksa.sg/menu". */
function formatWebsiteLabel(url: string) {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

export function StallDetailScreen({ navigation, route }: Props) {
  // Drives the photo fading out as the page scrolls.
  const [heroScrollY] = useState(() => new Animated.Value(0));
  const venueId = route.params?.venueId ?? route.params?.id ?? "";
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  // Live builds read this page through its RPCs only. The synchronous repository's first read
  // downloads whole tables (again every 45 s) and stops at 1,000 rows, so it is never asked.
  const readsLocalData = serviceProviderMode !== "supabase";
  const cachedVenue = readsLocalData ? repository.getVenueById(venueId) : undefined;
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
      .catch((error) => {
        reportStallError(error, "load_venue");
        if (!active) return;
        setVenueLoadFailed(true);
        setHasLoadedVenueDetail(true);
      });

    return () => {
      active = false;
    };
  }, [cachedVenue, serviceProviderMode, venueId, venueReloadKey]);

  const venueBuildingId = venue?.buildingId;
  // The bundled building list first; mock data's own list only when that misses. Memoised on
  // the building id: the screen re-renders on every menu page, review page and scroll batch.
  const building = useMemo(() => {
    if (!venueBuildingId) return undefined;
    const bundled = getBuildingById(venueBuildingId);
    if (bundled || !readsLocalData) return bundled;
    return repository.listBuildings().find((candidate) => candidate.id === venueBuildingId);
  }, [readsLocalData, repository, venueBuildingId]);
  const cachedDishes = useMemo(
    () => (venue && readsLocalData ? repository.listDishesByVenue(venue.id) : EMPTY_DISHES),
    [readsLocalData, repository, venue],
  );
  const [hydratedDishes, setHydratedDishes] = useState<DishDetail[] | undefined>();
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);
  const [menuReloadKey, setMenuReloadKey] = useState(0);
  // Long menus come a page at a time: the first page shows at once, the rest on demand.
  const [menuNextCursor, setMenuNextCursor] = useState<VenueMenuCursor>();
  const [menuPageStatus, setMenuPageStatus] = useState<"idle" | "loading" | "error">("idle");
  const menuVenueIdRef = useRef<string | undefined>(undefined);
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
  const openSignInPrompt = useUIStore((state) => state.openSignInPrompt);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const { componentRadii, palette, radii, spacing } = useHungryTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const incrementShare = useSocialStore((state) => state.incrementShare);
  const [isSubmittingMenuPhoto, setIsSubmittingMenuPhoto] = useState(false);
  // Menu photos upload from a device file (supply.submitMenuPhoto), so not on web.
  const canSubmitMenuPhoto = isAuthenticated && Platform.OS !== "web";
  const showDeferredDetailControls = !FEATURE_FLAGS.release01CoreOnly;

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
      // The photo is read by Google, so ask first (App Review 5.1.2(i)). Declining still saves it.
      const allowAiReading = await ensureAiSearchConsent();
      setIsSubmittingMenuPhoto(true);
      try {
        await getHungryService().supply.submitMenuPhoto({
          venueId: venue.id,
          photoUri: asset.uri,
          photoMimeType: asset.mimeType ?? undefined,
          photoFileSizeBytes: asset.fileSize ?? undefined,
          allowAiReading,
        });
        showToast({
          message: allowAiReading
            ? "Thanks, we'll add the menu soon."
            : "Thanks. Your photo is saved and was not sent to Google.",
          tone: "success",
        });
      } catch (error) {
        reportStallError(error, "submit_menu_photo");
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
  const [claimStatus, setClaimStatus] = useState<MerchantClaimStatus>(() =>
    hasPendingClaimForVenue(profile.id, venueId) ? "submitted" : "none",
  );
  const [activeShareReview, setActiveShareReview] = useState<ReviewShareTarget | null>(null);
  const [reviewEntries, setReviewEntries] = useState<RecentReviewFeedEntry[]>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "error" | "ready">("loading");
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [reviewsCursor, setReviewsCursor] = useState<{ before: string; beforeId: string }>();
  const [isLoadingMoreReviews, setIsLoadingMoreReviews] = useState(false);
  const [activePromotions, setActivePromotions] = useState<MerchantPromotion[]>([]);
  const [merchantProfile, setMerchantProfile] = useState<PublicMerchantProfile>();
  const [openingSchedule, setOpeningSchedule] = useState<OpeningSchedule>();
  const [activeMenuCategory, setActiveMenuCategory] = useState(ALL_MENU_CATEGORY);
  const [activeDietaryFlags, setActiveDietaryFlags] = useState<string[]>([]);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  // "Visited. What did you have?" opens in place after Mark visited.
  const [visitedSheetOpen, setVisitedSheetOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [visibleMenuItemCount, setVisibleMenuItemCount] = useState(INITIAL_MENU_ITEM_COUNT);
  const contentBodyLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const menuSectionLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const reviewsSectionLayoutRef = useRef<{ y: number; height: number } | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
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
    // Last resort when the building is not in the catalogue: the area, not a bare "#01-10".
    name: venue?.buildingName ?? building?.name ?? venue?.planningArea,
    address: venue?.address ?? (building as { address?: string } | undefined)?.address,
    postalCode: venue?.postalCode ?? (building as { postalCode?: string } | undefined)?.postalCode,
  };
  const stallAddress = venue ? formatFullStallAddress(venue, buildingLocation) : "";
  // ALL CAPS licence names read as shouting; display only, the stored name is what is copied.
  const displayName = toDisplayName(venue?.name ?? "Stall");
  // The card reads "#01-23, NUS UTown"; the street and postcode only go to Google Maps.
  const shortStallAddress = venue ? formatShortStallAddress(venue, buildingLocation) : "";

  const shareReviewTarget = useMemo<ReviewShareTarget>(() => {
    return {
      kind: "stall",
      reviewId: `stall-${venue?.id ?? ""}`,
      postId: "",
      title: displayName,
      subtitle: [buildingLocation.name, venue?.unitNumber?.trim()].filter(Boolean).join(" · "),
      imageUrl: leadDish?.imageUrl ?? "",
      authorName: profile.displayName,
      message: `Check out ${venue ? displayName : "this stall"} at ${buildingLocation.name ?? "Hungry"}!`,
      link: webShareUrl("stall", venue?.id ?? ""),
    };
  }, [
    buildingLocation.name,
    leadDish?.imageUrl,
    displayName,
    profile.displayName,
    venue,
    venue?.id,
    venue?.unitNumber,
  ]);

  menuVenueIdRef.current = venue?.id;
  useEffect(() => {
    let active = true;
    setHydratedDishes(undefined);
    setMenuLoadFailed(false);
    setMenuNextCursor(undefined);
    setMenuPageStatus("idle");
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

    const discovery = getHungryService().discovery;
    const firstPage = discovery.listDishesByVenuePage
      ? discovery.listDishesByVenuePage(venue.id).then((page) => {
          if (active) setMenuNextCursor(page.nextCursor);
          return page.dishes;
        })
      : discovery.listDishesByVenue(venue.id);
    void firstPage
      .then((nextDishes) => {
        if (active) setHydratedDishes(nextDishes);
      })
      .catch((error) => {
        reportStallError(error, "load_menu");
        if (active) setMenuLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [cachedDishes.length, menuReloadKey, serviceProviderMode, venue?.id]);

  useEffect(() => {
    const pendingLocally = hasPendingClaimForVenue(profile.id, venueId);
    setIsClaimPending(pendingLocally);
    setClaimStatus(pendingLocally ? "submitted" : "none");
    if (!isAuthenticated || !FEATURE_FLAGS.merchantClaimCtaEnabled) return undefined;
    // The claim may have been submitted on another device or already be in review.
    let active = true;
    void getHungryService()
      .supply.getMerchantClaimStatus(venueId)
      .then((status) => {
        if (!active || status === "none") return;
        setClaimStatus(status);
        setIsClaimPending(true);
      })
      .catch((error) => reportStallError(error, "load_claim_status"));
    return () => {
      active = false;
    };
  }, [isAuthenticated, profile.id, venueId]);

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
    if (!showDeferredDetailControls) {
      setActivePromotions([]);
      return () => {
        active = false;
      };
    }
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
      .catch((error) => {
        reportStallError(error, "load_merchant_profile");
        if (active) setMerchantProfile(undefined);
      });

    void getHungryService()
      .discovery.listActivePromotionsForTarget({ venueId: sideLoadVenueId })
      .then((promotions) => {
        if (active) setActivePromotions(promotions);
      })
      .catch((error) => {
        reportStallError(error, "load_promotions");
        if (active) setActivePromotions([]);
      });

    return () => {
      active = false;
    };
  }, [showDeferredDetailControls, sideLoadVenueId]);

  // get_venue_detail already carries the weekly schedule; read it on its own only when the
  // settled venue has none (mock data, or an older cached row).
  const venueSettled =
    serviceProviderMode !== "supabase" || hydratedVenue !== undefined || venueLoadFailed;
  const venueHasSchedule = Boolean(venue?.openingSchedule);
  useEffect(() => {
    let active = true;
    setOpeningSchedule(undefined);
    if (!showDeferredDetailControls || !sideLoadVenueId || !venueSettled || venueHasSchedule) {
      return () => {
        active = false;
      };
    }
    void getHungryService()
      .discovery.getVenueOpeningSchedule(sideLoadVenueId)
      .then((schedule) => {
        if (active) setOpeningSchedule(schedule);
      })
      .catch((error) => {
        reportStallError(error, "load_opening_schedule");
        if (active) setOpeningSchedule(undefined);
      });
    return () => {
      active = false;
    };
  }, [showDeferredDetailControls, sideLoadVenueId, venueHasSchedule, venueSettled]);

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
      .reviews.listRecentReviewsPage({
        venueId: sideLoadVenueId,
        limit: STALL_COMMUNITY_REVIEW_LIMIT,
      })
      .then((page) => {
        if (!active) return;
        setReviewEntries(page.entries);
        // From the server's raw rows: a review dropped from the entries is not the end.
        setHasMoreReviews(page.hasMore);
        setReviewsCursor(page.nextCursor);
        setReviewsStatus("ready");
      })
      .catch((error) => {
        reportStallError(error, "load_reviews");
        if (active) setReviewsStatus("error");
      });

    return () => {
      active = false;
    };
  }, [sideLoadVenueId, reviewsReloadKey]);

  const loadMoreReviews = () => {
    if (!sideLoadVenueId || !reviewsCursor || isLoadingMoreReviews) return;
    setIsLoadingMoreReviews(true);
    getHungryService()
      .reviews.listRecentReviewsPage({
        venueId: sideLoadVenueId,
        limit: STALL_REVIEW_PAGE_SIZE,
        before: reviewsCursor.before,
        beforeId: reviewsCursor.beforeId,
      })
      .then((page) => {
        setReviewEntries((current) => {
          const known = new Set(current.map((entry) => entry.review.id));
          return [...current, ...page.entries.filter((entry) => !known.has(entry.review.id))];
        });
        setHasMoreReviews(page.hasMore);
        setReviewsCursor(page.nextCursor);
      })
      .catch((error) => {
        reportStallError(error, "load_more_reviews");
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
    const sortedCategories = [...categorySet].sort(compareMenuCategories);
    return [ALL_MENU_CATEGORY, ...sortedCategories];
  }, [menuCategoryByDishId]);
  // The server returns the menu in search-rank order, which reads as random on a menu:
  // group by category (the chip order), then A-Z within it. Dishes the stall features go
  // first (R4-2) unless they are sold out, so "Stall's pick" is something the diner can order.
  const orderedMenuDishes = useMemo(() => {
    return [...dishes].sort(
      (left, right) =>
        Number(isStallsPick(right.availabilityFlags)) -
          Number(isStallsPick(left.availabilityFlags)) ||
        compareMenuCategories(
          menuCategoryByDishId[left.id] ?? "",
          menuCategoryByDishId[right.id] ?? "",
        ) ||
        left.name.localeCompare(right.name),
    );
  }, [dishes, menuCategoryByDishId]);
  const trimmedMenuQuery = menuQuery.trim().toLowerCase();
  const filteredMenuDishes = useMemo(() => {
    const inCategory =
      activeMenuCategory === ALL_MENU_CATEGORY
        ? orderedMenuDishes
        : orderedMenuDishes.filter((dish) => menuCategoryByDishId[dish.id] === activeMenuCategory);
    // Every picked dietary need must be on the dish.
    const forDiet = activeDietaryFlags.length
      ? inCategory.filter((dish) =>
          activeDietaryFlags.every((flag) =>
            (dish.dietaryFlags ?? []).some((value) => value === flag),
          ),
        )
      : inCategory;
    return trimmedMenuQuery
      ? forDiet.filter((dish) => dish.name.toLowerCase().includes(trimmedMenuQuery))
      : forDiet;
  }, [
    activeDietaryFlags,
    activeMenuCategory,
    menuCategoryByDishId,
    orderedMenuDishes,
    trimmedMenuQuery,
  ]);
  const visibleMenuDishes = useMemo(
    () => filteredMenuDishes.slice(0, visibleMenuItemCount),
    [filteredMenuDishes, visibleMenuItemCount],
  );
  const hasMoreMenuItems = visibleMenuDishes.length < filteredMenuDishes.length;
  // List rows when most of the menu has no photo, tiles when it does (R4-STALL-5).
  const menuAsList = useMemo(() => shouldUseMenuList(dishes), [dishes]);
  // The next menu page is read when the diner reaches the end of what is loaded, or filters
  // or searches (which need the whole menu).
  const menuFilterActive =
    trimmedMenuQuery.length > 0 ||
    activeDietaryFlags.length > 0 ||
    activeMenuCategory !== ALL_MENU_CATEGORY;
  const wantsMoreMenu =
    menuStatus === "ready" &&
    Boolean(menuNextCursor) &&
    menuPageStatus === "idle" &&
    (!hasMoreMenuItems || menuFilterActive);
  useEffect(() => {
    const discovery = getHungryService().discovery;
    const forVenueId = venue?.id;
    if (!wantsMoreMenu || !forVenueId || !menuNextCursor || !discovery.listDishesByVenuePage) {
      return;
    }
    const cursor = menuNextCursor;
    setMenuPageStatus("loading");
    discovery
      .listDishesByVenuePage(forVenueId, cursor)
      .then((page) => {
        if (menuVenueIdRef.current !== forVenueId) return;
        setHydratedDishes((current) => {
          const known = new Set((current ?? []).map((dish) => dish.id));
          return [...(current ?? []), ...page.dishes.filter((dish) => !known.has(dish.id))];
        });
        // A cursor that does not move would read the same page forever.
        setMenuNextCursor(page.nextCursor?.id !== cursor.id ? page.nextCursor : undefined);
        setMenuPageStatus("idle");
      })
      .catch((error) => {
        reportStallError(error, "load_menu_page");
        if (menuVenueIdRef.current === forVenueId) setMenuPageStatus("error");
      });
  }, [menuNextCursor, venue?.id, wantsMoreMenu]);

  useEffect(() => {
    setVisibleMenuItemCount(INITIAL_MENU_ITEM_COUNT);
  }, [activeDietaryFlags, activeMenuCategory, trimmedMenuQuery, venue?.id]);

  useEffect(() => {
    if (!menuCategories.includes(activeMenuCategory)) {
      setActiveMenuCategory(ALL_MENU_CATEGORY);
    }
  }, [activeMenuCategory, menuCategories]);

  // Derived once per input change, not on every scroll batch or review page.
  const ratingSummary = useMemo(() => summarizeStallRating(dishes), [dishes]);
  const priceBand = useMemo(() => formatStallPriceBand(dishes), [dishes]);
  // Owner cover, then the stall photo, then each dish's photo, then review photos.
  const heroPhotos = useMemo(
    () =>
      Array.from(
        new Set(
          [
            merchantProfile?.coverPhotoUrl,
            venue?.imageUrl,
            ...dishes.map((dish) => getStallDishPhotos(dish)[0]),
            ...stallReviewPhotos,
          ]
            .map((url) => sanitizeCatalogImageUrl(url))
            .filter((url): url is string => Boolean(url?.trim())),
        ),
      ).slice(0, HERO_PHOTO_LIMIT),
    [dishes, merchantProfile?.coverPhotoUrl, stallReviewPhotos, venue?.imageUrl],
  );
  // One shared helper so the stall page and the dish page always agree: the owner's
  // temporary closure, then the weekly schedule with special hours, then the listed text.
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
    // The Home tab is the Discover route; "Home" is a redirect placeholder now.
    navigation.navigate("MainTabs", { screen: "Discover" });
  };

  if (Boolean(venueId) && !venue && !hasLoadedVenueDetail) {
    return <StallDetailSkeleton onBack={goBackOrHome} />;
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
        <FloatingBackButton onPress={goBackOrHome} />
      </SafeAreaView>
    );
  }

  // openInfo exists whenever venue does; naming it here narrows it for the rest of the render.
  if (!venue || !openInfo) {
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
  const buildingCoordinate = building?.coordinate;
  const stallPin = getStallPin(venue, buildingCoordinate);
  const distanceLabel = formatDistanceFromUser(userOrigin, stallPin ?? buildingCoordinate);
  const stallSavedCount = venue.savedCount ?? 0;
  const savedCountLabel =
    stallSavedCount > 0
      ? `${stallSavedCount} ${stallSavedCount === 1 ? "person" : "people"} saved this`
      : null;
  const deliveryLinks = venue.deliveryLinks ?? [];
  const operatingStatusLabel = openInfo.statusLabel;
  const websiteLink = (merchantProfile?.socialLinks ?? []).find(
    (link) => link.platform === "website" && link.url.trim(),
  );
  // 4:3 when there are photos, so they show whole; a short branded header otherwise.
  const heroHeight =
    heroPhotos.length > 0 ? Math.min(screenWidth * 0.75, 420) : Math.min(screenWidth * 0.45, 190);
  const hoursRows = openInfo.weekRows;
  // A single listed "Hours" line that today's row already repeats has nothing more to expand.
  const hoursExpandable = hoursRows.some(
    (row) => !openInfo.todayRows.some((day) => day.label === row.label && day.text === row.text),
  );
  const hoursHeader = (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
      <Clock3 color={palette.orange} size={18} />
      <AppText
        variant="bodyBold"
        tone={openInfo.isOpen ? "success" : "default"}
        // A long closure message wraps instead of being cut off at large text sizes.
        numberOfLines={3}
        style={{ flex: 1 }}
      >
        {operatingStatusLabel}
      </AppText>
      {hoursExpandable ? (
        hoursExpanded ? (
          <ChevronUp color={palette.orange} size={20} />
        ) : (
          <ChevronDown color={palette.orange} size={20} />
        )
      ) : null}
    </View>
  );
  const heroFallback = (
    <StallHeroFallback
      name={displayName}
      logoUrl={sanitizeCatalogImageUrl(venue.logoUrl)}
      width={screenWidth}
      height={heroHeight}
    />
  );
  // Nothing to show yet: one card that asks for it replaces the Menu and Reviews sections.
  const hoursMissing = hoursRows.length === 0 && openInfo.openState.status === "unknown";
  const stallIsEmpty =
    showDeferredDetailControls &&
    menuStatus === "ready" &&
    dishes.length === 0 &&
    reviewsStatus === "ready" &&
    communityReviews.length === 0;
  const reviewedDishIds = profile.reviewedDishIds;
  const hasReviewedDishAtVenue = dishes.some((dish) => reviewedDishIds.includes(dish.id));

  const visitedSheetDishes = visitedSheetOpen
    ? pickVisitedSheetDishes(dishes, reviewedDishIds)
    : EMPTY_DISHES;
  const closeVisitedSheet = () => setVisitedSheetOpen(false);
  const pickVisitedDish = (dish: DishDetail) => {
    closeVisitedSheet();
    trackAnalyticsEvent("stall_visited_dish_picked", { stall_id: venue.id, dish_id: dish.id });
    navigation.navigate("ReviewStack", {
      screen: "ReviewMain",
      params: { venueId: venue.id, dishId: dish.id },
    });
  };

  const openReportHours = () => {
    const params = {
      venueId: venue.id,
      subjectName: displayName,
      initialKind: "wrong_hours" as const,
    };
    if (
      !requireAccount("Sign in to add opening hours for this stall.", {
        name: "ReportProblem",
        params,
      })
    ) {
      return;
    }
    navigation.navigate("ReportProblem", params);
  };

  const openWriteReview = () => {
    // The composer sends review_started once a dish is picked; this is the entry tap.
    trackAnalyticsEvent("review_cta_tapped", { stall_id: venue.id, source_screen: "StallDetail" });
    const composer = { screen: "ReviewMain" as const, params: { venueId: venue.id } };
    // A guest goes straight on to the composer after signing in, not back to this page.
    if (
      !requireAccount("Sign in to review this stall.", { name: "ReviewStack", params: composer })
    ) {
      return;
    }
    navigation.navigate("ReviewStack", composer);
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
    if (!venue) return;
    trackAnalyticsEvent("directions_opened", { stall_id: venue.id, source: "stall_detail" });
    recordTap("direction_tap");
    // Searches Google Maps by name + building + postcode so it lands on the stall's listing;
    // the map pin is used only when the stall has no building or address to search by.
    void openTrustedMapsUrl(
      buildStallMapsUrl(
        {
          name: venue.name,
          buildingName: buildingLocation.name,
          address: buildingLocation.address,
          postalCode: buildingLocation.postalCode,
        },
        stallPin,
      ),
    );
  };

  const copyStallName = async () => {
    if (!venue) return;
    try {
      await Clipboard.setStringAsync(venue.name);
      showToast({ message: "Copied", tone: "success", duration: 1500 });
    } catch (error) {
      reportStallError(error, "copy_stall_name");
      showToast({ message: "Couldn't copy. Try again.", tone: "error" });
    }
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

  const handleReviewsSectionLayout = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    reviewsSectionLayoutRef.current = { y, height };
  };

  const scrollToReviews = () => {
    const offset = sectionScrollOffset(
      contentBodyLayoutRef.current,
      reviewsSectionLayoutRef.current,
      insets.top + 60,
    );
    if (offset !== undefined) scrollRef.current?.scrollTo({ y: offset, animated: true });
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

    // The pager's first photo (owner cover or stall photo) beats the first dish's photo.
    setActiveShareReview({
      ...shareReviewTarget,
      imageUrl: heroPhotos[0] ?? shareReviewTarget.imageUrl,
    });
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
    navigation.navigate("DishDetail", {
      dishId: activeDish.id,
      source: "stall_menu",
      prefill: dishPrefillFrom({ ...activeDish, venueName: venue.name }),
    });
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
        // The session ended while the page was open: open sign-in and come back to this stall.
        setReturnRoute({ name: "StallDetail", params: { venueId: venue.id } });
        openSignInPrompt({ title: "Sign in before claiming this stall" });
      } else if (result.status === "created") {
        setIsClaimPending(true);
        setClaimStatus("submitted");
        showToast({
          message: "Claim interest submitted. We will follow up with verification details.",
          tone: "success",
        });
      } else if (result.status === "already_exists") {
        setIsClaimPending(true);
        // Without a known status the disabled button would still read "Claim this stall".
        setClaimStatus((current) => (current === "none" ? "submitted" : current));
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
          {/* Back and Share come first in the tree so screen readers reach them first. The
              wrapper's zIndex/elevation keeps them above the hero photo on iOS and web (a later
              sibling draws on top); box-none lets taps between the buttons reach the photo.
              Once the photo has faded, a bar with the stall name fades in behind them. */}
          <DetailCollapsingHeader
            scrollY={heroScrollY}
            heroHeight={heroHeight}
            title={displayName}
            onBack={goBackOrHome}
            onShare={showDeferredDetailControls ? openShareSheet : undefined}
            shareLabel="Share stall"
            shareIcon={ShareIcon}
            chromeTestID="stall-detail-top-chrome"
          />
          <Animated.ScrollView
            ref={scrollRef as never}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: heroScrollY } } }], {
              listener: handleScroll,
              useNativeDriver: Platform.OS !== "web",
            })}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 96,
            }}
          >
            {/* Hero: swipeable photos (owner cover, stall, dishes, reviews), else a short branded header */}
            <DetailHeroFade scrollY={heroScrollY} height={heroHeight}>
              {heroPhotos.length > 0 ? (
                <PhotoPager
                  photos={heroPhotos}
                  width={screenWidth}
                  height={heroHeight}
                  subject={displayName}
                  fallback={heroFallback}
                >
                  {/* White fade at the foot of the photo, into the page. */}
                  <LinearGradient
                    colors={[palette.detailHeroGradientStart, palette.bg]}
                    pointerEvents="none"
                    style={{
                      bottom: 0,
                      height: heroHeight * 0.45,
                      left: 0,
                      position: "absolute",
                      right: 0,
                    }}
                  />
                </PhotoPager>
              ) : (
                heroFallback
              )}
            </DetailHeroFade>

            <View
              onLayout={handleContentBodyLayout}
              style={{
                gap: spacing[5],
                paddingHorizontal: spacing[3],
                paddingTop: spacing[4],
              }}
            >
              {/* Header Content */}
              <View style={{ gap: spacing[3] }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[3] }}>
                  {/* With no photo the hero already shows the logo. */}
                  {heroPhotos.length > 0 && sanitizeCatalogImageUrl(venue.logoUrl) ? (
                    <StallLogoMark
                      logoUrl={sanitizeCatalogImageUrl(venue.logoUrl)}
                      name={displayName}
                    />
                  ) : null}
                  <View style={{ flex: 1, gap: spacing[1] }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${venue.name}, copy stall name`}
                      accessibilityHint="Copies the stall name"
                      onPress={() => void copyStallName()}
                    >
                      <AppText variant="h1">{displayName}</AppText>
                    </Pressable>
                    <AppText variant="body" tone="secondary">
                      {/* Centre · unit · distance; the full address lives in the Address card. */}
                      {[buildingLocation.name, venue.unitNumber?.trim(), distanceLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </AppText>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                  {ratingSummary ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${ratingSummary.rating.toFixed(1)} stars from ${ratingSummary.reviewCount} dish ${ratingSummary.reviewCount === 1 ? "rating" : "ratings"}`}
                      accessibilityHint={
                        showDeferredDetailControls ? "Scrolls to the reviews" : undefined
                      }
                      disabled={!showDeferredDetailControls}
                      onPress={scrollToReviews}
                      style={{
                        backgroundColor: palette.bgSoft,
                        borderRadius: radii.pill,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[1],
                      }}
                    >
                      <AppText variant="bodySmallBold">
                        <Text style={{ color: palette.starFill }}>★</Text>{" "}
                        {ratingSummary.rating.toFixed(1)}{" "}
                        <AppText variant="bodySmall" tone="secondary">
                          · {ratingSummary.reviewCount} dish{" "}
                          {ratingSummary.reviewCount === 1 ? "rating" : "ratings"}
                        </AppText>
                      </AppText>
                    </Pressable>
                  ) : null}
                  {savedCountLabel ? (
                    <View
                      accessible
                      accessibilityLabel={savedCountLabel}
                      style={{
                        alignItems: "center",
                        backgroundColor: palette.bgSoft,
                        borderRadius: radii.pill,
                        flexDirection: "row",
                        gap: spacing[1],
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[1],
                      }}
                    >
                      <Bookmark color={palette.textSecondary} size={14} />
                      <AppText variant="bodySmallBold" tone="secondary">
                        {savedCountLabel}
                      </AppText>
                    </View>
                  ) : null}
                  {/* Open now / hours sit in the card just below, not repeated here. */}
                  {priceBand ? (
                    <AppText variant="price" tone="secondary" style={{ alignSelf: "center" }}>
                      {priceBand}
                    </AppText>
                  ) : null}
                  {merchantProfile?.contactPhone ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${displayName} on ${merchantProfile.contactPhone}`}
                      onPress={() =>
                        openMerchantContact("phone", merchantProfile.contactPhone ?? "")
                      }
                      style={{
                        alignItems: "center",
                        backgroundColor: palette.bgSoft,
                        borderRadius: radii.pill,
                        flexDirection: "row",
                        gap: spacing[1],
                        minHeight: 32,
                        paddingHorizontal: spacing[3],
                      }}
                    >
                      <Phone color={palette.orange} size={14} />
                      <AppText variant="bodySmallBold">Call</AppText>
                    </Pressable>
                  ) : null}
                </View>
                {/* Only when the hours card does not already say it. */}
                {openInfo.extraNotice ? (
                  <AppText variant="bodySmall" tone="secondary">
                    {openInfo.extraNotice}
                  </AppText>
                ) : null}
              </View>
              {/* About first: the owner's words, then hours and address, above the menu. */}
              <Card style={{ gap: spacing[4], padding: spacing[4] }}>
                {merchantProfile?.description || websiteLink ? (
                  <View
                    style={{
                      borderBottomColor: palette.border,
                      borderBottomWidth: 1,
                      gap: spacing[2],
                      paddingBottom: spacing[3],
                    }}
                  >
                    {merchantProfile?.description ? (
                      <AppText variant="body" tone="secondary">
                        {merchantProfile.description}
                      </AppText>
                    ) : null}
                    {websiteLink ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${displayName} website`}
                        onPress={() => openMerchantWebLink(websiteLink.platform, websiteLink.url)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing[2],
                          minHeight: 44,
                        }}
                      >
                        <Globe color={palette.orange} size={16} />
                        <AppText variant="body" tone="accent" numberOfLines={1} style={{ flex: 1 }}>
                          {formatWebsiteLabel(websiteLink.url)}
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {/* Only the header toggles; today and the week are plain text a screen reader reads. */}
                <View style={{ gap: spacing[1.5] }}>
                  {hoursExpandable ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Opening hours, ${operatingStatusLabel}`}
                      accessibilityHint={
                        hoursExpanded ? "Hides the week" : "Shows every day's hours"
                      }
                      accessibilityState={{ expanded: hoursExpanded }}
                      onPress={() => setHoursExpanded((open) => !open)}
                      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                    >
                      {hoursHeader}
                    </Pressable>
                  ) : (
                    <View accessible accessibilityLabel={`Opening hours, ${operatingStatusLabel}`}>
                      {hoursHeader}
                    </View>
                  )}
                  {openInfo.todayRows.length > 0 ? (
                    <AppText
                      variant="bodySmall"
                      tone="secondary"
                      style={{ paddingLeft: spacing[6] }}
                    >
                      {openInfo.todayRows[0].label}: {openInfo.todayRows[0].text}
                    </AppText>
                  ) : null}
                  {hoursExpanded
                    ? hoursRows.map((row) => {
                        const isToday = openInfo.todayRows.some(
                          (today) => today.label === row.label,
                        );
                        return (
                          <View
                            key={`${row.label}-${row.text}`}
                            accessible
                            accessibilityLabel={`${row.label}, ${row.text}`}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              paddingLeft: spacing[6],
                            }}
                          >
                            <AppText
                              variant={isToday ? "bodySmallBold" : "bodySmall"}
                              tone={isToday ? "default" : "secondary"}
                            >
                              {row.label}
                            </AppText>
                            <AppText
                              variant={isToday ? "bodySmallBold" : "bodySmall"}
                              tone={isToday ? "default" : "secondary"}
                            >
                              {row.text}
                            </AppText>
                          </View>
                        );
                      })
                    : null}
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
                    accessibilityLabel={`Open maps for ${shortStallAddress || stallAddress}`}
                    accessibilityHint="Opens the stall in Google Maps"
                    onPress={openStallMaps}
                    style={({ pressed }) => [{ minHeight: 44, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <View
                      style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing[2] }}
                    >
                      <MapPin color={palette.orange} size={18} />
                      <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
                        {shortStallAddress || stallAddress}
                      </AppText>
                    </View>
                  </Pressable>
                </View>
              </Card>
              {deliveryLinks.length > 0 ? (
                <View style={{ gap: spacing[2] }}>
                  <AppText variant="bodySmallBold" tone="secondary">
                    Order on
                  </AppText>
                  <DeliveryButtonRow links={deliveryLinks} venueId={venue.id} />
                </View>
              ) : null}
              {/* Menu */}
              {stallIsEmpty ? (
                <StallHelpFillCard
                  missing={["menu", ...(hoursMissing ? (["hours"] as const) : []), "reviews"]}
                  onAddMenuPhoto={canSubmitMenuPhoto ? promptMenuPhoto : undefined}
                  isAddingMenuPhoto={isSubmittingMenuPhoto}
                  onAddHours={hoursMissing ? openReportHours : undefined}
                  onWriteReview={FEATURE_FLAGS.reviewCreationEnabled ? openWriteReview : undefined}
                />
              ) : (
                <View onLayout={handleMenuSectionLayout} style={{ gap: spacing[4] }}>
                  <View style={{ gap: spacing[1] }}>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: spacing[2],
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <AppText variant="h2">Menu</AppText>
                      {menuStatus === "ready" &&
                      dishes.length > 0 &&
                      (menuCategories.length > 2 || stallDietarySummary.length > 0) ? (
                        <MenuFilterDropdown
                          categories={
                            menuCategories.length > 2 ? menuCategories : [ALL_MENU_CATEGORY]
                          }
                          activeCategory={activeMenuCategory}
                          onCategoryChange={setActiveMenuCategory}
                          allCategory={ALL_MENU_CATEGORY}
                          dietaryOptions={stallDietarySummary}
                          activeDietaryFlags={activeDietaryFlags}
                          onDietaryFlagsChange={setActiveDietaryFlags}
                          resultCount={filteredMenuDishes.length}
                        />
                      ) : null}
                    </View>
                    {filteredMenuDishes.length > 0 ? (
                      <AppText variant="bodySmall" tone="secondary">
                        Showing {visibleMenuDishes.length} of {filteredMenuDishes.length}
                        {menuNextCursor ? "+" : ""} items
                      </AppText>
                    ) : null}
                  </View>
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
                      {visibleMenuDishes.length > 0 ? (
                        <View
                          testID={menuAsList ? "stall-menu-list" : "stall-menu-grid"}
                          style={{
                            borderColor: palette.border,
                            borderTopWidth: StyleSheet.hairlineWidth,
                            // Out to the screen edges, past the body's spacing[3] padding.
                            marginHorizontal: -spacing[3],
                            ...(menuAsList ? {} : { flexDirection: "row", flexWrap: "wrap" }),
                          }}
                        >
                          {visibleMenuDishes.map((dish, index) =>
                            menuAsList ? (
                              <StallMenuDishRow key={dish.id} dish={dish} onPress={openMenuDish} />
                            ) : (
                              <StallMenuDishCard
                                key={dish.id}
                                dish={dish}
                                // Two columns with no gap between them.
                                width={screenWidth / MENU_GRID_COLUMNS}
                                isLeftColumn={index % MENU_GRID_COLUMNS === 0}
                                onPress={openMenuDish}
                              />
                            ),
                          )}
                        </View>
                      ) : menuNextCursor && menuPageStatus !== "error" ? (
                        <Skeleton width="100%" height={72} borderRadius={radii.lg} />
                      ) : (
                        <Card style={{ padding: spacing[4], alignItems: "center" }}>
                          <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                            {trimmedMenuQuery
                              ? `No dishes match "${menuQuery.trim()}".`
                              : activeDietaryFlags.length > 0
                                ? "No dishes here match those filters."
                                : "No items in this category yet."}
                          </AppText>
                        </Card>
                      )}
                      {menuPageStatus === "error" ? (
                        <Card
                          style={{ padding: spacing[4], alignItems: "center", gap: spacing[2] }}
                        >
                          <AppText variant="body" tone="secondary" style={{ textAlign: "center" }}>
                            Couldn&apos;t load the rest of the menu.
                          </AppText>
                          <Button
                            label="Retry"
                            variant="secondary"
                            onPress={() => setMenuPageStatus("idle")}
                          />
                        </Card>
                      ) : null}
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
              )}
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
                              navigation.navigate("DishDetail", {
                                dishId: promotion.targetDishId,
                                source: "stall_promotion",
                              });
                            }
                          : undefined
                      }
                    />
                  ))}
                </View>
              ) : null}
              {merchantProfile?.contactPhone || merchantProfile?.contactEmail ? (
                <Card style={{ gap: spacing[1], padding: spacing[4] }}>
                  <AppText variant="bodyBold">Contact details</AppText>
                  {merchantProfile.contactPhone ? (
                    <ContactRow
                      icon={<Phone color={palette.orange} size={18} />}
                      label="Call"
                      value={merchantProfile.contactPhone}
                      accessibilityLabel={`Call ${displayName} on ${merchantProfile.contactPhone}`}
                      onPress={() =>
                        openMerchantContact("phone", merchantProfile.contactPhone ?? "")
                      }
                    />
                  ) : null}
                  {merchantProfile.contactEmail ? (
                    <ContactRow
                      icon={<Mail color={palette.orange} size={18} />}
                      label="Email"
                      value={merchantProfile.contactEmail}
                      accessibilityLabel={`Email ${displayName}`}
                      onPress={() =>
                        openMerchantContact("email", merchantProfile.contactEmail ?? "")
                      }
                    />
                  ) : null}
                </Card>
              ) : null}
              {showDeferredDetailControls && FEATURE_FLAGS.socialFeedEnabled ? (
                <PopularVisitorsSection venueId={venue.id} horizontalPadding={0} />
              ) : null}
              {/* Reviews */}
              {/* Reading reviews does not depend on whether writing them is switched on. */}
              {showDeferredDetailControls && !stallIsEmpty ? (
                <View onLayout={handleReviewsSectionLayout} style={{ gap: spacing[4] }}>
                  <AppText variant="h2">Reviews</AppText>
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
                            subject={`${displayName}, from reviews`}
                            size={96}
                          />
                        </View>
                      ) : null}
                      {communityReviews.map((review) => {
                        const isOwn = isOwnReview(review, isAuthenticated ? profile.id : undefined);
                        const removeReview = () =>
                          setReviewEntries((current) =>
                            current.filter((entry) => entry.review.id !== review.reviewId),
                          );
                        return (
                          <StallReviewCard
                            key={review.id}
                            review={review}
                            venueId={venue.id}
                            isOwn={isOwn}
                            onOpenAuthor={() =>
                              navigation.navigate("UserProfile", {
                                authorId: review.authorId,
                                authorName: review.authorName,
                                authorAvatarUrl: review.avatarUrl,
                              })
                            }
                            onOpenDish={() =>
                              navigation.navigate("DishDetail", {
                                dishId: review.dishId,
                                source: "stall_review",
                              })
                            }
                            onUpdated={(patch) =>
                              setReviewEntries((current) =>
                                current.map((entry) =>
                                  entry.review.id === review.reviewId
                                    ? { ...entry, review: { ...entry.review, ...patch } }
                                    : entry,
                                ),
                              )
                            }
                            onRemoved={removeReview}
                          />
                        );
                      })}
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
                      body={
                        FEATURE_FLAGS.reviewCreationEnabled
                          ? "Be the first to review this stall."
                          : "Reviews for this stall will show here."
                      }
                      icon={<CommentIcon size={36} color={palette.textMuted} />}
                      {...(FEATURE_FLAGS.reviewCreationEnabled
                        ? { ctaLabel: "Write a review", onPress: openWriteReview }
                        : {})}
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
                          ? CLAIM_STATUS_LABELS[claimStatus]
                          : "Claim this stall"
                    }
                    onPress={() => {
                      void handleClaimThisStall();
                    }}
                    disabled={isSubmittingClaim || isClaimPending}
                  />
                </Card>
              ) : null}
              <ReportProblemLink venueId={venue.id} subjectName={displayName} />
            </View>
          </Animated.ScrollView>
          {venue ? (
            <StallInteractionBar
              layout="sticky"
              stallId={venue.id}
              userId={profile.id}
              isAuthenticated={isAuthenticated}
              onRequireAuth={(message, action) =>
                requireAuthForProtectedAction(
                  message,
                  // Finish the guest's Save once they sign in (never un-saves).
                  action === "save"
                    ? () =>
                        void saveStallAfterSignIn(venue.id, () => {
                          // Counted and confirmed like a tap on Save (STALL-X1). The guest's
                          // id was swapped for the account's at sign-in, so read it now.
                          const userId = useProfileStore.getState().profile.id;
                          showToast({
                            message: "Saved. Find it in Profile, Saved, Stalls.",
                            tone: "success",
                            duration: 3000,
                          });
                          void getHungryService().discovery.recordMerchantActionEvent({
                            eventType: "save",
                            venueId: venue.id,
                            userId,
                          });
                          void useMissionStore
                            .getState()
                            .incrementProgress(userId, "save_stalls")
                            .catch((error) => reportStallError(error, "mission_save_stalls"));
                        })
                    : undefined,
                )
              }
              onSaved={() =>
                void getHungryService().discovery.recordMerchantActionEvent({
                  eventType: "save",
                  venueId: venue.id,
                  userId: profile.id,
                })
              }
              onDirections={venue ? openStallMaps : undefined}
              hasReviewedDishAtVenue={hasReviewedDishAtVenue}
              onVisited={() => setVisitedSheetOpen(true)}
              showVisited={showDeferredDetailControls && isAuthenticated}
              onAddToList={
                showDeferredDetailControls && FEATURE_FLAGS.portfoliosEnabled
                  ? () => void detailSaveActions.addToPortfolio()
                  : undefined
              }
              isAddingToList={detailSaveActions.isAddingToPortfolio}
              onReview={
                showDeferredDetailControls && FEATURE_FLAGS.reviewCreationEnabled
                  ? openWriteReview
                  : undefined
              }
            />
          ) : null}

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
          <StallVisitedSheet
            visible={visitedSheetOpen}
            stallName={displayName}
            dishes={visitedSheetDishes}
            onPickDish={pickVisitedDish}
            onWriteReview={() => {
              closeVisitedSheet();
              openWriteReview();
            }}
            onSkip={closeVisitedSheet}
          />
        </View>
      </SafeAreaView>
    </FeedErrorBoundary>
  );
}
