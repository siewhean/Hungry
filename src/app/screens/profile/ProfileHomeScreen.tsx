import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useIsFocused } from "@react-navigation/native";

import { FavouriteDishesRow } from "@/components/profile/FavouriteDishesRow";
import { ProfileReviewCard } from "@/components/profile/ProfileReviewCard";
import { ProfileStatRow, STAT_UNAVAILABLE } from "@/components/profile/ProfileStatRow";
import { TasteRadar } from "@/components/profile/TasteRadar";
import { AccessibleImage, AppSymbol, AppText, Button, EmptyState } from "@/components/ui";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { FloatingShareSendButton, InAppShareCard } from "@/components/social";
import { MissionBanner } from "@/components/gamification/MissionBanner";
import { PassportCard } from "@/components/gamification/PassportCard";
import { FoodCredBadge } from "@/components/gamification/FoodCredBadge";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { prefetchMerchantTab, preloadRoute } from "@/features/navigation/prefetch";
import { listSharedStallPosts, mergeStallPosts } from "@/features/social/sharedStallPosts";
import {
  buildTastePersonaSummary,
  buildTasteShareMessage,
  hasTasteSignal,
} from "@/features/profile/tasteFingerprint";
import { formatMemberSince } from "@/features/profile/relativeDate";
import { pluralLabel } from "@/features/profile/plural";
import { useProfileFavouriteDishes } from "@/features/profile/useProfileFavouriteDishes";
import { useReviewDishDetails } from "@/features/profile/useReviewDishDetails";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { confirmAction } from "@/lib/runtime/confirmAction";
import { OwnReviewMenuButton, useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { profileShareUrl, shareProfileLink } from "@/features/share/profileShare";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { PendingDeletionBanner } from "@/features/auth/PendingDeletionBanner";
import { useHungryTheme } from "@/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { useStoryStore } from "@/store/useStoryStore";
import { ProfileGridSkeleton, ProfileReviewsSkeleton } from "./ProfileGridSkeleton";
import { ProfileScreenShell } from "./ProfileScreenShell";
import { useMerchantStore } from "@/store/useMerchantStore";
import { palateSummary } from "@/features/detail/perceivedTaste";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useActivityStore } from "@/store/useActivityStore";
import { useFoodCredStore } from "@/store/useFoodCredStore";
import { usePassportStore } from "@/store/usePassportStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useStallSubmissionStore } from "@/store/useStallSubmissionStore";
import { useUIStore } from "@/store/useUIStore";
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Review, StallPost } from "@/types/domain";

/** Own posts per server page; matches listUserPosts' default page size. */
const OWN_POSTS_PAGE_SIZE = 60;
/** Review cards shown inline; the rest are one tap away in Review History. */
const OWN_REVIEWS_INLINE_LIMIT = 20;
/** Coming back to the tab within this window reuses the reviews already loaded. */
const OWN_REVIEWS_STALE_MS = 60_000;
/** getUserReviews' default page: a full page means the list may be cut off. */
const OWN_REVIEWS_PAGE_SIZE = 200;

function haveEqualPosts(left: StallPost[], right: StallPost[]) {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const lhs = left[i];
    const rhs = right[i];

    if (
      lhs.id !== rhs.id ||
      lhs.authorId !== rhs.authorId ||
      lhs.authorName !== rhs.authorName ||
      lhs.createdAt !== rhs.createdAt ||
      lhs.venueId !== rhs.venueId
    ) {
      return false;
    }
  }

  return true;
}

type ProfileHomeProps = {
  navigation: any;
};

/** Your own profile. Other people's profiles are UserProfileScreen / UserProfileContent. */
export function ProfileHomeScreen({ navigation }: ProfileHomeProps) {
  const { colorScheme, componentRadii, palette, spacing, radii, shadows } = useHungryTheme();
  // On a 320pt phone the title steps down a size and Share shows its icon alone.
  const compactTasteHeader = useWindowDimensions().width < 360;
  const headerActionSize = spacing[8] + spacing[2.5];
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  // A restored session can be signed in before its profile loads; the placeholder id is not a uuid.
  const hasAccountProfile = isAuthenticated && profile.id !== "guest-user";
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const signOut = useSessionStore((state) => state.signOut);
  const merchantAccount = useMerchantStore((state) => state.account);
  const setMerchantAccount = useMerchantStore((state) => state.setAccount);
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const { loadStories } = useStoryStore();
  const loadCredProfile = useFoodCredStore((s) => s.loadCredProfile);
  const loadMissions = useMissionStore((s) => s.loadMissions);
  const loadStallSubmissions = useStallSubmissionStore((s) => s.loadSubmissions);
  const stallSubmissions = useStallSubmissionStore((s) => s.submissions);
  const loadStallInteractions = useStallInteractionStore((s) => s.loadInteractions);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const computePassportProgress = usePassportStore((s) => s.computeProgress);
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((state) => state.showToast);
  // The posts feed is archived: no Posts tab and no post reads without it.
  const socialFeedEnabled = FEATURE_FLAGS.socialFeedEnabled;
  /** Your approved follower/following counts; null until loaded, "unavailable" after a failed read. */
  const [followCounts, setFollowCounts] = useState<
    | {
        followersCount: number;
        followingCount: number;
      }
    | "unavailable"
    | null
  >(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const shareSnapPoints = useMemo(() => ["45%"], []);
  /** Incoming pending follow requests; null until loaded. */
  const [followRequestCount, setFollowRequestCount] = useState<number | null>(null);
  const triedStallIds = useMemo(
    () =>
      Object.values(stallInteractions)
        .filter((interaction) => interaction.isTried)
        .map((interaction) => interaction.stallId),
    [stallInteractions],
  );

  const [selectedShareChatIds, setSelectedShareChatIds] = useState<string[]>([]);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  const directMessagesEnabled = FEATURE_FLAGS.directMessagesEnabled;
  const gamificationEnabled = FEATURE_FLAGS.gamificationEnabled;
  const storiesEnabled = FEATURE_FLAGS.storiesEnabled;
  const [isTasteShareSheetOpen, setIsTasteShareSheetOpen] = useState(false);
  // A profile photo that fails to load falls back to initials, never a blank circle.
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => setAvatarFailed(false), [profile.avatarUrl]);
  const [profilePosts, setProfilePosts] = useState<StallPost[]>([]);
  // Server rows fetched so far (offset for the next page) and whether another page may exist.
  const [loadedPostRows, setLoadedPostRows] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [postsLoadFailed, setPostsLoadFailed] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsReloadKey, setPostsReloadKey] = useState(0);
  // Bumped when the user deletes a post, so the grid drops it on return.
  const publishedPostsVersion = usePublishedPostStore((state) => state.version);
  /** Own server reviews; null until the first load finishes. */
  const [ownReviews, setOwnReviews] = useState<Review[] | null>(null);
  const [ownReviewsFailed, setOwnReviewsFailed] = useState(false);
  /** The first page was full, so Review history holds more than the list shows. */
  const [ownReviewsReloadKey, setOwnReviewsReloadKey] = useState(0);
  const ownReviewsLoadedRef = useRef<{ at: number; key: string } | null>(null);
  const ownReviewEditor = useOwnReviewEditor({
    onUpdated: (updated) =>
      setOwnReviews((current) =>
        current ? current.map((review) => (review.id === updated.id ? updated : review)) : current,
      ),
    onDeleted: (reviewId) =>
      setOwnReviews((current) =>
        current ? current.filter((review) => review.id !== reviewId) : current,
      ),
  });
  const rootNavigation = getRootNavigation(navigation as any);

  const [activeShareTab, setActiveShareTab] = useState<"posts" | "reviews">(
    FEATURE_FLAGS.reviewCreationEnabled || !FEATURE_FLAGS.socialFeedEnabled ? "reviews" : "posts",
  );
  const handleReviewsCardPress = useCallback(() => {
    preloadRoute(navigation, "ReviewHistory");
    navigation.navigate("ReviewHistory");
  }, [navigation]);
  // A/B test: signed-in people whose reviews loaded with none see a first-review card under
  // the stats. Only they are exposed (not guests, the loading skeleton or a failed load).
  const firstReviewNudgeEligible =
    hasAccountProfile &&
    FEATURE_FLAGS.reviewCreationEnabled &&
    ownReviews !== null &&
    !ownReviewsFailed &&
    ownReviews.length === 0;
  const firstReviewNudge = useExperimentVariant("profile_first_review_nudge_v1", {
    enabled: firstReviewNudgeEligible,
  });
  const openReviewComposer = useCallback(() => {
    trackAnalyticsEvent("profile_review_nudge_tapped", {});
    rootNavigation.navigate("ReviewStack", { screen: "ReviewMain" });
  }, [rootNavigation]);
  // 76 inside the 80pt ring and its 2pt border on each side.
  const avatarSize = spacing[20] - 4;
  const avatarInitials = useMemo(
    () =>
      profile.displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "HU",
    [isAuthenticated, profile.displayName],
  );

  const loadChatConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setShareRecipients([]);
      return;
    }

    try {
      const conversations = await getHungryService().chat.listConversations();
      setShareRecipients(conversations.map(toChatShareRecipient));
    } catch {
      setShareRecipients([]);
    }
  }, []);

  const prefetchMerchantDashboard = useCallback(() => {
    const outlet = merchantAccount?.outlets[0];
    prefetchMerchantTab("Dashboard", outlet?.id, merchantAccount?.id);
    preloadRoute(rootNavigation, "MerchantTabs");
  }, [merchantAccount, rootNavigation]);

  const isFocused = useIsFocused();
  // One event per visit to the tab, not per re-render.
  useEffect(() => {
    if (!isAuthenticated || !isFocused) return;
    trackAnalyticsEvent("profile_viewed", { self: true, source: "tab" });
  }, [isAuthenticated, isFocused]);

  // Load merchant membership on sign-in so the Business entry shows without a deep link.
  useEffect(() => {
    if (!isAuthenticated || !FEATURE_FLAGS.merchantCentreEnabled) {
      return;
    }

    let isMounted = true;
    getHungryService()
      .merchant.getMerchantAccount()
      .then((account) => {
        if (isMounted) setMerchantAccount(account);
      })
      .catch((error) => {
        reportError(error, { screen: "ProfileHome", action: "load_merchant_account" });
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, profile.id, setMerchantAccount]);

  // Loads run once per account; tried-stall changes only recompute progress (effect below).
  // Waits for the account profile: the "guest-user" placeholder id is not a uuid.
  useEffect(() => {
    if (!hasAccountProfile) return;
    const logLoadError = (label: string) => (error: unknown) => {
      reportError(error, { screen: "ProfileHome", action: `load_${label}` });
    };

    if (storiesEnabled) {
      void Promise.resolve(loadStories()).catch(logLoadError("stories"));
    }

    void loadStallSubmissions().catch(logLoadError("stall_submissions"));

    if (gamificationEnabled) {
      // Tried stalls feed only the Passport progress below.
      void loadStallInteractions(profile.id).catch(logLoadError("stall_interactions"));
      void loadCredProfile(profile.id).catch(logLoadError("FoodCred"));
      void loadMissions(profile.id).catch(logLoadError("missions"));
    }
  }, [
    gamificationEnabled,
    hasAccountProfile,
    loadCredProfile,
    loadMissions,
    loadStallSubmissions,
    loadStallInteractions,
    loadStories,
    storiesEnabled,
    profile.id,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !gamificationEnabled) return;
    computePassportProgress(triedStallIds);
  }, [computePassportProgress, gamificationEnabled, isAuthenticated, triedStallIds]);

  const loadOwnPostsPage = useCallback(
    (offset: number) =>
      getHungryService()
        .social.listUserPosts(profile.id, { limit: OWN_POSTS_PAGE_SIZE, offset })
        .then((bites) => ({
          rowCount: bites.length,
          nextPosts: bites.map((bite) =>
            biteToStallPost(bite, { authorAvatarUrl: bite.authorAvatar }),
          ),
        })),
    [profile.id],
  );

  useEffect(() => {
    if (!hasAccountProfile || !socialFeedEnabled) {
      setProfilePosts([]);
      setHasMorePosts(false);
      setPostsLoadFailed(false);
      return;
    }

    let isMounted = true;

    const loadProfilePosts = async () => {
      // Own posts come from a server read filtered by author id, so older posts are not
      // cut off by the feed window; matching is by id only (display names are not unique).
      // Each source fails on its own, so a failed server read keeps the locally shared posts.
      const [ownPage, sharedPosts] = await Promise.all([
        loadOwnPostsPage(0).catch((error) => {
          reportError(error, { screen: "ProfileHome", action: "load_posts" });
          return null;
        }),
        listSharedStallPosts().catch(() => [] as StallPost[]),
      ]);
      if (!isMounted) return;
      const nextPosts = mergeStallPosts(
        ownPage?.nextPosts ?? [],
        sharedPosts.filter((post) => post.authorId === profile.id),
      );
      setProfilePosts((current) => (haveEqualPosts(current, nextPosts) ? current : nextPosts));
      setPostsLoadFailed(ownPage === null);
      setPostsLoaded(true);
      setLoadedPostRows(ownPage?.rowCount ?? 0);
      setHasMorePosts(ownPage?.rowCount === OWN_POSTS_PAGE_SIZE);
    };

    void loadProfilePosts();

    return () => {
      isMounted = false;
    };
  }, [
    hasAccountProfile,
    loadOwnPostsPage,
    profile.id,
    postsReloadKey,
    publishedPostsVersion,
    socialFeedEnabled,
  ]);

  const loadMoreProfilePosts = () => {
    if (isLoadingMorePosts || !hasMorePosts) return;
    setIsLoadingMorePosts(true);
    void loadOwnPostsPage(loadedPostRows)
      .then(({ nextPosts, rowCount }) => {
        setProfilePosts((current) => mergeStallPosts(current, nextPosts));
        setLoadedPostRows((current) => current + rowCount);
        setHasMorePosts(rowCount === OWN_POSTS_PAGE_SIZE);
      })
      .catch((error) => {
        reportError(error, { screen: "ProfileHome", action: "load_more_posts" });
        showToast({ message: "Couldn't load more posts. Try again.", tone: "error" });
      })
      .finally(() => setIsLoadingMorePosts(false));
  };

  const sortedProfilePosts = useMemo(() => {
    return [...profilePosts].sort((a, b) => {
      if (a.createdAt === b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [profilePosts]);

  // Own reviews come from the reviews read, not reviewedDishIds (which also holds "tried" taps).
  // Refetched on focus only when stale, or when a review was added or removed since the last read.
  const reviewedDishKey = profile.reviewedDishIds.join(",");
  useEffect(() => {
    if (!hasAccountProfile || !isFocused) return;
    const loadKey = `${profile.id}:${reviewedDishKey}:${ownReviewsReloadKey}`;
    const loaded = ownReviewsLoadedRef.current;
    if (loaded && loaded.key === loadKey && Date.now() - loaded.at < OWN_REVIEWS_STALE_MS) return;
    let isActive = true;
    setOwnReviewsFailed(false);
    void getHungryService()
      .reviews.getUserReviews(profile.id)
      .then((rows) => {
        if (!isActive) return;
        ownReviewsLoadedRef.current = { at: Date.now(), key: loadKey };
        setOwnReviews(rows);
      })
      .catch((error) => {
        reportError(error, { screen: "ProfileHome", action: "load_own_reviews" });
        if (!isActive) return;
        setOwnReviewsFailed(true);
        setOwnReviews((current) => current ?? []);
      });
    return () => {
      isActive = false;
    };
  }, [hasAccountProfile, isFocused, profile.id, reviewedDishKey, ownReviewsReloadKey]);

  // The review cards on this page; their dish names come from one batched read.
  const inlineReviews = useMemo(
    () => (ownReviews ?? []).slice(0, OWN_REVIEWS_INLINE_LIMIT),
    [ownReviews],
  );
  const { infoFor: reviewDishInfo } = useReviewDishDetails(inlineReviews);
  const openReviewedDish = useCallback(
    (review: Review, position: number) => {
      if (!review.dishId) return;
      trackAnalyticsEvent("profile_item_opened", {
        kind: "review",
        position,
        source: "profile_reviews",
      });
      rootNavigation.navigate("DishDetail", { dishId: review.dishId, source: "profile" });
    },
    [rootNavigation],
  );
  // Counts the saved dish ids; Saved itself skips dishes that left the catalog (SAVED4-16).
  const savedCount = profile.stats.favouritesCount;
  const {
    dishIds: pinnedDishIds,
    isLoaded: pinnedDishesLoaded,
    supported: pinnedDishesSupported,
    save: savePinnedDishes,
  } = useProfileFavouriteDishes(profile.id, isAuthenticated);
  // Only dishes you saved or reviewed can be pinned.
  const pinCandidateIds = useMemo(
    () => [...new Set([...profile.favouriteDishIds, ...profile.reviewedDishIds])],
    [profile.favouriteDishIds, profile.reviewedDishIds],
  );
  // Seen by a signed-in diner who has pins, or dishes to pin, on a backend that stores pins.
  const showcaseEligible =
    isAuthenticated &&
    pinnedDishesLoaded &&
    pinnedDishesSupported &&
    (pinnedDishIds.length > 0 || pinCandidateIds.length > 0);
  const showcaseVariant = useExperimentVariant("profile_favourites_showcase_v1", {
    enabled: showcaseEligible,
  });
  const memberSince = profile.createdAt ? formatMemberSince(profile.createdAt) : "";
  // A full first page may be cut off: then the server's counter (distinct dishes reviewed).
  const ownReviewCount =
    ownReviews === null
      ? null
      : ownReviews.length >= OWN_REVIEWS_PAGE_SIZE
        ? Math.max(profile.stats.dishesReviewed, ownReviews.length)
        : ownReviews.length;

  useEffect(() => {
    // Refetched on focus so a follow or a removed follower shows on return.
    // Archived with the tiles: no point reading counts nothing shows.
    if (!hasAccountProfile || !isFocused || !FEATURE_FLAGS.followConnectionsEnabled) return;
    let isActive = true;
    void getHungryService()
      .social.getFollowCounts(profile.id)
      .then((counts) => {
        // No row is not "loading" either: the tiles must never shimmer forever.
        if (isActive) setFollowCounts(counts ?? "unavailable");
      })
      .catch((error) => {
        reportError(error, { screen: "ProfileHome", action: "load_follow_counts" });
        if (isActive) setFollowCounts("unavailable");
      });
    return () => {
      isActive = false;
    };
  }, [hasAccountProfile, isFocused, profile.id]);

  useEffect(() => {
    // Refetch on focus so approving/declining on Follow Requests updates the row.
    if (!hasAccountProfile || !isFocused) return;

    let isActive = true;

    void getHungryService()
      .social.getFollowRequestCount()
      .then((count) => {
        if (isActive) setFollowRequestCount(count);
      })
      .catch((error) => {
        reportError(error, { screen: "ProfileHome", action: "load_follow_request_count" });
      });

    return () => {
      isActive = false;
    };
  }, [hasAccountProfile, isFocused, profile.id]);

  // Pull down to re-read your counts, requests and reviews. Each read is one call, in parallel.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (!hasAccountProfile) return;
    setIsRefreshing(true);
    const service = getHungryService();
    const [counts, requests, reviews] = await Promise.allSettled([
      service.social.getFollowCounts(profile.id),
      service.social.getFollowRequestCount(),
      service.reviews.getUserReviews(profile.id),
    ]);
    if (counts.status === "fulfilled") setFollowCounts(counts.value ?? "unavailable");
    else reportError(counts.reason, { screen: "ProfileHome", action: "refresh_follow_counts" });
    if (requests.status === "fulfilled") setFollowRequestCount(requests.value);
    else reportError(requests.reason, { screen: "ProfileHome", action: "refresh_requests" });
    if (reviews.status === "fulfilled") {
      ownReviewsLoadedRef.current = {
        at: Date.now(),
        key: `${profile.id}:${reviewedDishKey}:${ownReviewsReloadKey}`,
      };
      setOwnReviews(reviews.value);
      setOwnReviewsFailed(false);
    } else {
      reportError(reviews.reason, { screen: "ProfileHome", action: "refresh_reviews" });
    }
    setIsRefreshing(false);
  }, [hasAccountProfile, ownReviewsReloadKey, profile.id, reviewedDishKey]);

  // A skipped quiz leaves every taste at neutral: that is "not built yet", not a result.
  const hasTasteFingerprint = useMemo(
    () => hasTasteSignal(profile.tasteVector),
    [profile.tasteVector],
  );

  const handleShareTaste = useCallback(async () => {
    if (!isAuthenticated || !hasTasteFingerprint) return;
    setIsTasteShareSheetOpen(true);
    await loadChatConversations();
    shareSheetRef.current?.present();
  }, [hasTasteFingerprint, isAuthenticated, loadChatConversations]);

  const tasteShareMessage = useMemo(
    () => buildTasteShareMessage(profile.tasteVector),
    [profile.tasteVector],
  );

  // Copies the summary with a link to your profile (usehungry.com/user/:id).
  const copyTasteFingerprintLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(
        `${tasteShareMessage}\n\n${profileShareUrl(profile.id, "copy_link")}`,
      );
      trackAnalyticsEvent("taste_fingerprint_shared", { channel: "copy_link" });
      AccessibilityInfo.announceForAccessibility("Taste Fingerprint link copied");
      showToast({
        message: "Your Taste Fingerprint and profile link are on the clipboard.",
        tone: "success",
      });
    } catch (error) {
      reportError(error, { screen: "ProfileHome", action: "copy_taste_fingerprint" });
      showToast({ message: "Couldn't copy. Try again, or use Share instead.", tone: "error" });
    }
  }, [profile.id, showToast, tasteShareMessage]);

  const handleShareProfile = useCallback(async () => {
    try {
      await shareProfileLink(profile.id, profile.displayName);
      trackAnalyticsEvent("profile_shared", { channel: "system_share" });
    } catch (error) {
      reportError(error, { screen: "ProfileHome", action: "share_profile" });
      showToast({ message: "Couldn't open sharing. Please try again.", tone: "error" });
    }
  }, [profile.displayName, profile.id, showToast]);

  const palate = useMemo(() => palateSummary(profile.tasteVector), [profile.tasteVector]);
  const tastePersonaSummary = useMemo(
    () => buildTastePersonaSummary(profile.tasteVector),
    [profile.tasteVector],
  );

  const shareTasteProfileOutsideApp = useCallback(async () => {
    try {
      // The link goes with the text so whoever receives it has something to tap.
      await Share.share({
        message: `${tasteShareMessage}\n\n${profileShareUrl(profile.id, "system_share")}`,
      });
      trackAnalyticsEvent("taste_fingerprint_shared", { channel: "system_share" });
    } catch (error) {
      reportError(error, { screen: "ProfileHome", action: "share_taste_fingerprint" });
      showToast({ message: "Couldn't open sharing. Please try again.", tone: "error" });
    }
  }, [profile.id, showToast, tasteShareMessage]);

  const sendTasteProfileToHungryUsers = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) return;
    if (selectedShareChatIds.length === 0) return;

    try {
      await Promise.all(
        selectedShareChatIds.map((chatId) =>
          sharePostToChat(chatId, {
            postId: `taste-fingerprint-${profile.id}`,
            title: "Taste fingerprint",
            subtitle: `${profile.displayName} · Taste profile`,
            imageUrl: profile.avatarUrl ?? "",
            authorName: profile.displayName,
          }),
        ),
      );
    } catch (error) {
      reportError(error, { screen: "ProfileHome", action: "send_taste_fingerprint" });
      showToast({ message: "Couldn't share your taste profile. Please try again.", tone: "error" });
      return;
    }

    setSelectedShareChatIds([]);
    shareSheetRef.current?.dismiss();
  }, [
    profile.avatarUrl,
    profile.displayName,
    profile.id,
    selectedShareChatIds,
    sharePostToChat,
    showToast,
  ]);

  const resetShareSheet = useCallback(() => {
    setIsTasteShareSheetOpen(false);
    setSelectedShareChatIds([]);
  }, []);

  const toggleShareChat = useCallback((chatId: string) => {
    setSelectedShareChatIds((current) =>
      current.includes(chatId)
        ? current.filter((candidate) => candidate !== chatId)
        : [...current, chatId],
    );
  }, []);

  if (!isAuthenticated) {
    // A guest keeps their place: Sign in opens Login on top, and Back or "Not now" returns here.
    return (
      <ProfileScreenShell title="Profile" showBack={false} testID="profile-signed-out">
        <EmptyState
          title="Your Hungry profile"
          body="Sign in to save dishes, follow people and build your Taste Fingerprint."
          icon={
            <AppSymbol name="person" size={36} weight="regular" color={palette.textSecondary} />
          }
          ctaLabel="Sign in"
          onPress={() => {
            setReturnRoute("Profile");
            rootNavigation.navigate("AuthStack", { screen: "Login" });
          }}
        />
      </ProfileScreenShell>
    );
  }

  const followRequestLabel =
    (followRequestCount ?? 0) > 0
      ? `${followRequestCount} follow ${followRequestCount === 1 ? "request" : "requests"}`
      : null;
  const menuItems = (
    [
      FEATURE_FLAGS.merchantCentreEnabled && merchantAccount !== null
        ? {
            id: "merchant-dashboard",
            title: "Merchant dashboard",
            symbol: "stall" as const,
            onPressIn: prefetchMerchantDashboard,
            onPress: () => rootNavigation.navigate("MerchantTabs" as any),
          }
        : null,
      FEATURE_FLAGS.merchantCentreEnabled && merchantAccount === null
        ? {
            id: "business",
            title: "Hungry for Business",
            symbol: "stall" as const,
            onPress: () => rootNavigation.navigate("MerchantClaimExplainer"),
          }
        : null,
      FEATURE_FLAGS.collectionsEnabled
        ? {
            id: "liked-content",
            title: "Liked content",
            symbol: "save" as const,
            onPressIn: () => preloadRoute(navigation, "SocialGrid", { type: "liked" }),
            onPress: () => navigation.navigate("SocialGrid", { type: "liked" }),
          }
        : null,
      (followRequestCount ?? 0) > 0 || profile.profileVisibility === "private"
        ? {
            id: "follow-requests",
            title: "Follow requests",
            subtitle: followRequestCount ? `${followRequestCount} waiting` : undefined,
            symbol: "followRequests" as const,
            onPress: () => rootNavigation.navigate("FollowRequests"),
          }
        : null,
      FEATURE_FLAGS.stallFollowEnabled
        ? {
            id: "followed-stalls",
            title: "Followed stalls",
            symbol: "stall" as const,
            onPressIn: () => preloadRoute(navigation, "FollowedStalls"),
            onPress: () => navigation.navigate("FollowedStalls"),
          }
        : null,
      {
        id: "settings",
        title: "Settings",
        symbol: "settings" as const,
        onPressIn: () => preloadRoute(navigation, "Settings"),
        onPress: () => navigation.navigate("Settings"),
      },
      {
        id: "sign-out",
        title: "Sign out",
        symbol: "signOut" as const,
        destructive: true,
        onPress: () =>
          confirmAction({
            title: "Sign out",
            message: "You will be signed out from Hungry on this device.",
            confirmLabel: "Sign out",
            destructive: true,
            onConfirm: () => {
              signOut();
              rootNavigation.reset({
                index: 0,
                routes: [{ name: "AuthStack", params: { screen: "Login" } }],
              });
            },
          }),
      },
    ] as (OverflowMenuItem | null)[]
  ).filter((item): item is OverflowMenuItem => item !== null);
  const followersValue =
    followCounts === "unavailable"
      ? STAT_UNAVAILABLE
      : followCounts
        ? followCounts.followersCount
        : null;
  const stats = [
    FEATURE_FLAGS.favouritesEnabled
      ? {
          key: "saved",
          label: "Saved",
          value: savedCount,
          accessibilityHint: "Opens your saved dishes, stalls and lists",
          onPressIn: () => preloadRoute(navigation, "Favourites"),
          onPress: () => navigation.navigate("Favourites"),
        }
      : null,
    FEATURE_FLAGS.reviewCreationEnabled
      ? {
          key: "reviews",
          label: pluralLabel(ownReviewCount, "Review"),
          value: ownReviewCount,
          accessibilityHint: "Opens your review history",
          onPressIn: () => preloadRoute(navigation, "ReviewHistory"),
          onPress: handleReviewsCardPress,
        }
      : null,
    FEATURE_FLAGS.followConnectionsEnabled
      ? {
          key: "followers",
          label: pluralLabel(followersValue, "Follower"),
          value: followersValue,
          onPressIn: () => preloadRoute(navigation, "Followers"),
          onPress: () => navigation.navigate("Followers"),
        }
      : null,
    FEATURE_FLAGS.followConnectionsEnabled
      ? {
          key: "following",
          label: "Following",
          value:
            followCounts === "unavailable"
              ? STAT_UNAVAILABLE
              : followCounts
                ? followCounts.followingCount
                : null,
          onPressIn: () => preloadRoute(navigation, "Following"),
          onPress: () => navigation.navigate("Following"),
        }
      : null,
  ].filter((stat): stat is NonNullable<typeof stat> => stat !== null);

  const tasteCard = (
    <View
      style={[
        shadows.card,
        {
          backgroundColor: palette.surface,
          borderRadius: componentRadii.card,
          gap: spacing[4],
          padding: spacing[4],
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: spacing[2],
        }}
      >
        <View
          style={{
            alignItems: "center",
            flex: 1,
            flexDirection: "row",
            gap: spacing[2],
            minWidth: 0,
          }}
        >
          <AppSymbol name="tasteFingerprint" size={20} color={palette.accentText} />
          <AppText
            variant={compactTasteHeader ? "h3" : "h2"}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            Taste Fingerprint
          </AppText>
        </View>
        {hasTasteFingerprint ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share Taste Fingerprint"
            accessibilityHint="Opens sharing options for your Taste Fingerprint"
            onPress={handleShareTaste}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: 44,
              minWidth: 44,
              justifyContent: "center",
            }}
          >
            <AppSymbol name="send" size={16} color={palette.accentText} />
            {compactTasteHeader ? null : (
              <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                Share
              </AppText>
            )}
          </Pressable>
        ) : null}
      </View>
      <AppText style={{ fontWeight: "600" }}>{tastePersonaSummary}</AppText>
      {hasTasteFingerprint ? (
        <View style={{ gap: spacing[1] }} testID="profile-palate-summary">
          {palate.mild.length > 0 ? (
            <AppText variant="bodySmall" testID="profile-palate-mild">
              You like it less {joinWithAnd(palate.mild.map((name) => name.toLowerCase()))} than
              most.
            </AppText>
          ) : null}
          <AppText variant="micro" tone="secondary">
            A dish has one standard level for everyone. Your palate decides how strong it tastes to
            you, and dish pages show that.
          </AppText>
        </View>
      ) : null}
      {hasTasteFingerprint ? (
        <View style={{ alignItems: "center", gap: spacing[3] }}>
          <TasteRadar vector={profile.tasteVector} />
          <Button
            label="Retake the taste quiz"
            variant="secondary"
            onPress={() =>
              rootNavigation.navigate("OnboardingStack", {
                screen: "TasteQuiz",
                params: { mode: "profile" },
              })
            }
          />
        </View>
      ) : (
        <Button
          label="Take the taste quiz"
          variant="secondary"
          size="sm"
          fullWidth={false}
          onPress={() =>
            rootNavigation.navigate("OnboardingStack", {
              screen: "TasteQuiz",
              params: { mode: "profile" },
            })
          }
          style={{ alignSelf: "flex-start", minHeight: 44 }}
        />
      )}
    </View>
  );

  return (
    <ProfileScreenShell
      title="Profile"
      showBack={false}
      testID="profile-home-screen"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={palette.orange}
          colors={[palette.orange]}
        />
      }
      headerRight={
        <OverflowMenu
          testID="profile-menu"
          items={menuItems}
          accessibilityLabel={
            followRequestLabel ? `Open quick access, ${followRequestLabel}` : "Open quick access"
          }
          openAccessibilityLabel="Close quick access"
          triggerStyle={{
            alignItems: "center",
            height: headerActionSize,
            justifyContent: "center",
            width: headerActionSize,
          }}
        >
          <AppSymbol name="moreActions" size={24} weight="regular" color={palette.text} />
          {followRequestCount ? (
            <View
              testID="profile-menu-badge"
              style={{
                alignItems: "center",
                // accentText on white is 5.9:1 (the orange fill was 3.7:1 under 11pt text).
                backgroundColor: colorScheme === "dark" ? palette.orange : palette.accentText,
                borderRadius: radii.pill,
                height: 18,
                justifyContent: "center",
                minWidth: 18,
                paddingHorizontal: 4,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            >
              <AppText
                variant="micro"
                style={{
                  color: palette.textOnOrange,
                  fontSize: 11,
                  fontWeight: "700",
                  lineHeight: 14,
                }}
              >
                {followRequestCount > 9 ? "9+" : followRequestCount}
              </AppText>
            </View>
          ) : null}
        </OverflowMenu>
      }
    >
      <View style={{ gap: spacing[4], paddingBottom: spacing[8], position: "relative" }}>
        <PendingDeletionBanner />
        <View
          style={[
            shadows.card,
            {
              backgroundColor: palette.surface,
              borderRadius: componentRadii.card,
              gap: spacing[4],
              padding: spacing[4],
            },
          ]}
        >
          {/* Profile Header Block */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[4],
              marginBottom: 0,
            }}
          >
            <View style={{ position: "relative" }}>
              <View
                style={[
                  shadows.card,
                  {
                    alignItems: "center",
                    backgroundColor: palette.orangeLight,
                    borderRadius: radii.pill,
                    height: spacing[20],
                    justifyContent: "center",
                    width: spacing[20],
                    borderWidth: 2,
                    borderColor: palette.surface,
                  },
                ]}
              >
                {profile.avatarUrl && !avatarFailed ? (
                  <AccessibleImage
                    source={{ uri: profile.avatarUrl }}
                    accessibilityLabel={`${profile.displayName} profile photo`}
                    style={{
                      borderRadius: radii.pill,
                      height: avatarSize,
                      width: avatarSize,
                    }}
                    contentFit="cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <AppText variant="h1" style={{ color: palette.orange }}>
                    {avatarInitials}
                  </AppText>
                )}
              </View>
            </View>

            <View style={{ flex: 1, gap: spacing[1] }}>
              {/* Two lines at full size, so large text is not shrunk back down. */}
              <AppText variant="h1" numberOfLines={2} style={{ color: palette.text }}>
                {profile.displayName}
              </AppText>
              {profile.bio ? (
                <AppText variant="bodySmall" tone="secondary" testID="profile-bio">
                  {profile.bio}
                </AppText>
              ) : null}
              {memberSince ? (
                <AppText variant="micro" tone="secondary" testID="profile-member-since">
                  Member since {memberSince}
                </AppText>
              ) : null}
              {gamificationEnabled ? <FoodCredBadge size="sm" /> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                <Button
                  label="Edit"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPressIn={() => preloadRoute(navigation, "EditProfile")}
                  onPress={() => navigation.navigate("EditProfile")}
                  style={{ alignSelf: "flex-start", minHeight: 44 }}
                />
                <Button
                  label="Share profile"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  leftIcon={<AppSymbol name="share" size={16} color={palette.text} />}
                  accessibilityHint="Shares a link to your Hungry profile"
                  onPress={() => void handleShareProfile()}
                  style={{ alignSelf: "flex-start", minHeight: 44 }}
                />
              </View>
              {profile.profileVisibility === "private" ? (
                // The shared link opens "Profile not found" for anyone who does not follow you.
                <AppText variant="micro" tone="muted" testID="profile-share-private-note">
                  Only approved followers can see your profile through the link.
                </AppText>
              ) : null}
            </View>
          </View>

          {/* One stat row: Saved opens the one place for saved dishes, stalls and lists. */}
          <ProfileStatRow stats={stats} testID="profile-follow-counts" />
          {followRequestLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${followRequestLabel}. Review them`}
              onPress={() => rootNavigation.navigate("FollowRequests")}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: pressed ? palette.bgSoft : palette.orangeLight,
                borderRadius: componentRadii.card,
                flexDirection: "row",
                gap: spacing[3],
                minHeight: 48,
                paddingHorizontal: spacing[3],
              })}
              testID="profile-follow-requests-row"
            >
              <AppSymbol name="followRequests" size={20} color={palette.accentText} />
              <AppText variant="bodyBold" style={{ flex: 1 }}>
                {followRequestLabel}
              </AppText>
              <AppSymbol name="chevronRight" size={14} color={palette.textMuted} />
            </Pressable>
          ) : null}
          {firstReviewNudgeEligible && firstReviewNudge === "test" ? (
            <View
              testID="profile-first-review-nudge"
              style={{
                backgroundColor: palette.orangeLight,
                borderRadius: componentRadii.card,
                gap: spacing[2],
                padding: spacing[4],
              }}
            >
              <AppText variant="h3">Write your first review</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Rate a dish you have eaten lately. Your reviews help other people pick what to order
                and tune your Taste Fingerprint.
              </AppText>
              <Button
                label="Write a review"
                size="sm"
                fullWidth={false}
                leftIcon={<AppSymbol name="compose" size={16} color={palette.textOnOrange} />}
                onPress={openReviewComposer}
                style={{ alignSelf: "flex-end", minHeight: 44 }}
              />
            </View>
          ) : null}
        </View>

        {showcaseEligible && showcaseVariant === "test" ? (
          <FavouriteDishesRow
            dishIds={pinnedDishIds}
            candidateDishIds={pinCandidateIds}
            onOpenDish={(dishId) =>
              rootNavigation.navigate("DishDetail", { dishId, source: "profile" })
            }
            onSave={async (ids) => {
              const saved = await savePinnedDishes(ids);
              showToast(
                saved
                  ? { message: "Favourite dishes updated.", tone: "success" }
                  : { message: "Couldn't save your favourite dishes.", tone: "error" },
              );
              return saved;
            }}
          />
        ) : null}

        {/* The palate is what this page is remembered by, so its radar sits right under the stats. */}
        {hasTasteFingerprint ? tasteCard : null}

        {/* What you ate comes first: your reviews, with the photos you posted. */}
        <View style={{ gap: spacing[4] }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <AppText variant="h2">{socialFeedEnabled ? "Recent activity" : "Your reviews"}</AppText>
            {FEATURE_FLAGS.reviewCreationEnabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all reviews"
                onPress={handleReviewsCardPress}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={{ justifyContent: "center", minHeight: 44 }}
              >
                <AppText variant="bodySmall" style={{ color: palette.accentText }}>
                  View all{ownReviewCount !== null ? ` (${ownReviewCount})` : ""}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          {socialFeedEnabled ? (
            <View
              accessibilityRole="tablist"
              style={{
                alignSelf: "stretch",
                flexDirection: "row",
                borderWidth: 1,
                borderRadius: radii.pill,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                overflow: "hidden",
              }}
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel="Show profile posts"
                accessibilityState={{ selected: activeShareTab === "posts" }}
                onPress={() => setActiveShareTab("posts")}
                style={{
                  flex: 1,
                  paddingVertical: spacing[2],
                  alignItems: "center",
                  backgroundColor: activeShareTab === "posts" ? palette.orange : "transparent",
                }}
              >
                <AppText
                  style={{
                    fontWeight: activeShareTab === "posts" ? 700 : 500,
                    color: activeShareTab === "posts" ? palette.textOnOrange : palette.text,
                  }}
                >
                  Posts
                </AppText>
              </Pressable>
              {FEATURE_FLAGS.reviewCreationEnabled ? (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel="Show profile reviews"
                  accessibilityState={{ selected: activeShareTab === "reviews" }}
                  onPress={() => setActiveShareTab("reviews")}
                  style={{
                    flex: 1,
                    paddingVertical: spacing[2],
                    alignItems: "center",
                    backgroundColor: activeShareTab === "reviews" ? palette.orange : "transparent",
                  }}
                >
                  <AppText
                    style={{
                      fontWeight: activeShareTab === "reviews" ? 700 : 500,
                      color: activeShareTab === "reviews" ? palette.textOnOrange : palette.text,
                    }}
                  >
                    Reviews
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {activeShareTab === "posts" ? (
            sortedProfilePosts.length ? (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  marginHorizontal: -spacing[4],
                }}
              >
                {sortedProfilePosts.map((post) => {
                  const image = (
                    <View style={{ flex: 1 }}>
                      <AccessibleImage
                        decorative
                        source={{ uri: post.mediaUrl }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    </View>
                  );
                  // The post detail lives in Activity; with Activity off a tile is a photo.
                  return FEATURE_FLAGS.activityEnabled ? (
                    <Pressable
                      key={post.id}
                      aria-label={`Open post ${post.caption || post.id}`}
                      accessibilityLabel={`Open post ${post.caption || post.id}`}
                      accessibilityRole="button"
                      role="button"
                      testID={`profile-post-tile-${post.id}`}
                      style={{
                        width: "33.333%",
                        aspectRatio: 1,
                      }}
                      onPress={() =>
                        rootNavigation.navigate("ActivityPostDetail", {
                          postId: post.id,
                        })
                      }
                    >
                      {image}
                    </Pressable>
                  ) : (
                    <View
                      key={post.id}
                      testID={`profile-post-tile-${post.id}`}
                      style={{ width: "33.333%", aspectRatio: 1 }}
                    >
                      {image}
                    </View>
                  );
                })}
              </View>
            ) : !postsLoaded ? (
              <ProfileGridSkeleton />
            ) : postsLoadFailed ? (
              <EmptyState
                title="Couldn't load posts"
                body="Check your connection and try again."
                icon={
                  <AppSymbol
                    name="noPosts"
                    size={36}
                    weight="regular"
                    color={palette.textSecondary}
                  />
                }
                ctaLabel="Retry"
                onPress={() => setPostsReloadKey((key) => key + 1)}
              />
            ) : (
              <EmptyState
                title="No posts yet"
                body="Published posts will appear here."
                icon={
                  <AppSymbol
                    name="noPosts"
                    size={36}
                    weight="regular"
                    color={palette.textSecondary}
                  />
                }
              />
            )
          ) : ownReviews === null ? (
            <ProfileReviewsSkeleton />
          ) : ownReviews.length ? (
            <View style={{ gap: spacing[3] }}>
              {inlineReviews.map((review, index) => (
                <ProfileReviewCard
                  key={review.id}
                  review={review}
                  dish={reviewDishInfo(review.dishId)}
                  onOpenDish={review.dishId ? () => openReviewedDish(review, index) : undefined}
                  menu={
                    ownReviewEditor.enabled ? (
                      <OwnReviewMenuButton onPress={() => ownReviewEditor.openActions(review)} />
                    ) : undefined
                  }
                />
              ))}
              {ownReviews.length > OWN_REVIEWS_INLINE_LIMIT ? (
                <Button
                  label="See all reviews"
                  variant="ghost"
                  size="sm"
                  onPress={handleReviewsCardPress}
                />
              ) : null}
              {ownReviewEditor.dialog}
            </View>
          ) : ownReviewsFailed ? (
            <EmptyState
              title="Couldn't load reviews"
              body="Check your connection and try again."
              icon={
                <AppSymbol
                  name="noPosts"
                  size={36}
                  weight="regular"
                  color={palette.textSecondary}
                />
              }
              ctaLabel="Retry"
              onPress={() => setOwnReviewsReloadKey((key) => key + 1)}
            />
          ) : (
            <EmptyState
              title="No reviews yet"
              body="Rate a dish you've eaten and it will show up here."
              icon={
                <AppSymbol
                  name="noPosts"
                  size={36}
                  weight="regular"
                  color={palette.textSecondary}
                />
              }
            />
          )}
          {activeShareTab === "posts" && hasMorePosts ? (
            <Button
              label="Load more"
              variant="ghost"
              size="sm"
              loading={isLoadingMorePosts}
              onPress={loadMoreProfilePosts}
            />
          ) : null}
        </View>

        <View style={{ gap: spacing[4] }}>
          {hasTasteFingerprint ? null : tasteCard}

          {isAuthenticated && gamificationEnabled ? (
            <PassportCard
              onPressIn={() => preloadRoute(rootNavigation, "PassportScreen")}
              onPress={() => rootNavigation.navigate("PassportScreen")}
            />
          ) : null}
          {isAuthenticated && gamificationEnabled ? (
            <MissionBanner onPress={() => navigation.navigate("MissionsScreen" as any)} />
          ) : null}
          <StallContributionRow
            submissionCount={stallSubmissions.length}
            acceptedCount={
              stallSubmissions.filter((submission) => submission.status === "accepted").length
            }
            onPressIn={() => preloadRoute(navigation, "AddStall")}
            onPress={() => navigation.navigate("AddStall")}
            onOpenSubmissions={() => navigation.navigate("StallSubmissions")}
          />
        </View>

        <BottomSheetModal
          ref={shareSheetRef}
          snapPoints={shareSnapPoints}
          index={0}
          enablePanDownToClose
          accessibilityLabel="Share taste fingerprint"
          accessibilityViewIsModal
          onDismiss={resetShareSheet}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              opacity={0.4}
              pressBehavior="close"
              accessibilityRole="button"
              accessibilityLabel="Close share sheet"
              accessibilityHint="Dismisses the taste fingerprint sharing sheet"
            />
          )}
          backgroundStyle={{ backgroundColor: palette.surface }}
          handleIndicatorStyle={{ backgroundColor: palette.border }}
          footerComponent={
            directMessagesEnabled
              ? (props) => (
                  <BottomSheetFooter {...props}>
                    <FloatingShareSendButton
                      selectedCount={selectedShareChatIds.length}
                      onPress={sendTasteProfileToHungryUsers}
                      bottomInset={insets.bottom}
                      accessibilityLabel="Send shared taste profile"
                      placement="inline"
                    />
                  </BottomSheetFooter>
                )
              : undefined
          }
        >
          <BottomSheetView style={{ flex: 1 }}>
            <BottomSheetScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                gap: spacing[3],
                padding: spacing[4],
                paddingBottom: insets.bottom + spacing[12],
              }}
            >
              <InAppShareCard
                title={
                  directMessagesEnabled ? "Share taste fingerprint" : "Share taste fingerprint link"
                }
                quickActions={[
                  {
                    key: "copy",
                    label: "Copy link",
                    accessibilityLabel: "Copy taste fingerprint with profile link",
                    icon: ({ color, size }) => <AppSymbol name="copy" color={color} size={size} />,
                    onPress: () => void copyTasteFingerprintLink(),
                  },
                  {
                    key: "share",
                    label: "Share",
                    accessibilityLabel: "Share taste fingerprint to another app",
                    icon: ({ color, size }) => <AppSymbol name="share" color={color} size={size} />,
                    onPress: () => void shareTasteProfileOutsideApp(),
                  },
                ]}
                recipients={directMessagesEnabled ? shareRecipients : []}
                selectedRecipientIds={selectedShareChatIds}
                onToggleRecipient={toggleShareChat}
                onSend={sendTasteProfileToHungryUsers}
                lastRecipientId={
                  directMessagesEnabled
                    ? shareRecipients[shareRecipients.length - 1]?.id
                    : undefined
                }
                recipientAccessibilityLabelPrefix="Share taste profile to"
              />
            </BottomSheetScrollView>
          </BottomSheetView>
        </BottomSheetModal>
      </View>
    </ProfileScreenShell>
  );
}

/** "spicy", "spicy and sour", "spicy, sour and sweet". */
function joinWithAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** A slim row, not a card of counters: the form is one tap away, what you sent is one more. */
function StallContributionRow({
  submissionCount,
  acceptedCount,
  onPressIn,
  onPress,
  onOpenSubmissions,
}: {
  submissionCount: number;
  acceptedCount: number;
  onPressIn?: () => void;
  onPress: () => void;
  onOpenSubmissions: () => void;
}) {
  const { componentRadii, palette, shadows, spacing } = useHungryTheme();
  // The Scout target belongs to the Passport and FoodCred system; without it, show what happened.
  const showScout = FEATURE_FLAGS.gamificationEnabled;
  const nextScoutTarget = submissionCount >= 5 ? 10 : 5;
  const subtitle =
    submissionCount === 0
      ? "Know a stall we're missing? Send it in for review."
      : showScout
        ? `${submissionCount} submitted · Scout ${Math.min(submissionCount, nextScoutTarget)}/${nextScoutTarget}`
        : `${submissionCount} submitted · ${acceptedCount} approved`;

  return (
    <View
      style={{
        ...shadows.card,
        backgroundColor: palette.surface,
        borderRadius: componentRadii.card,
        gap: spacing[2],
        padding: spacing[3],
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPressIn={onPressIn}
        onPress={onPress}
        accessibilityLabel="Add a stall"
        accessibilityHint="Opens the stall contribution form"
        style={{ alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 48 }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: palette.orangeLight,
            borderRadius: componentRadii.iconButton,
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <AppSymbol name="addStall" size={20} color={palette.accentText} />
        </View>
        <View style={{ flex: 1, gap: spacing[0.5] }}>
          <AppText variant="bodyBold">Add a stall</AppText>
          <AppText variant="bodySmall" tone="muted">
            {subtitle}
          </AppText>
        </View>
        <AppSymbol name="chevronRight" size={14} color={palette.textMuted} />
      </Pressable>
      {submissionCount > 0 ? (
        <Button
          label="See my submissions"
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={onOpenSubmissions}
          style={{ alignSelf: "flex-start", minHeight: 44 }}
        />
      ) : null}
    </View>
  );
}
