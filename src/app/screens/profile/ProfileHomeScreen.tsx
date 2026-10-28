import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
  Text,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useIsFocused } from "@react-navigation/native";
import {
  ChevronRight,
  Settings,
  Utensils,
  Heart,
  Menu,
  PencilLine,
  Send,
  Copy,
  Share2,
  BarChart3,
  List,
  LogOut,
  Store,
  Bookmark,
  MessageCircleMore,
  ImagePlus,
  Trophy,
  UserPlus,
  UserCheck,
  FolderHeart,
  FlaskConical,
  Users,
} from "lucide-react-native";
import Svg, { Circle, Line, Polygon } from "react-native-svg";

import { ReviewModerationNotice } from "@/components/review";
import { AccessibleImage, AppText, Button, Card, EmptyState, Skeleton } from "@/components/ui";
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
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useExperimentVariant } from "@/lib/experiments/experiments";
import { reportError } from "@/lib/monitoring/reportError";
import { OwnReviewMenuButton, useOwnReviewEditor } from "@/features/profile/useOwnReviewEditor";
import { profileShareUrl, shareProfileLink } from "@/features/share/profileShare";
import { biteToStallPost } from "@/lib/services/postTransforms";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
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
import { TASTE_DIMENSIONS } from "@/constants/taste";
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
import type { Review, StallPost, TasteVector } from "@/types/domain";

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
  const passportProgressMap = usePassportStore((s) => s.progressMap);
  const earnedBadgeCount = useMemo(
    () => usePassportStore.getState().getEarnedStamps().length,
    [passportProgressMap],
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
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

  const profileStatSummary = useMemo(
    () => ({
      saved: profile.stats.favouritesCount,
    }),
    [profile.stats.favouritesCount],
  );
  // A full first page may be cut off: then the server's counter (distinct dishes reviewed).
  const ownReviewCount =
    ownReviews === null
      ? null
      : ownReviews.length >= OWN_REVIEWS_PAGE_SIZE
        ? Math.max(profile.stats.dishesReviewed, ownReviews.length)
        : ownReviews.length;

  useEffect(() => {
    // Refetched on focus so a follow or a removed follower shows on return.
    if (!hasAccountProfile || !isFocused) return;
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
      Alert.alert("Copied", "Your Taste Fingerprint and profile link are on the clipboard.");
    } catch {
      Alert.alert("Couldn't copy", "Try again, or use Share instead.");
    }
  }, [profile.id, tasteShareMessage]);

  const handleShareProfile = useCallback(async () => {
    try {
      await shareProfileLink(profile.id, profile.displayName);
      trackAnalyticsEvent("profile_shared", { channel: "system_share" });
    } catch (error) {
      reportError(error, { screen: "ProfileHome", action: "share_profile" });
    }
  }, [profile.displayName, profile.id]);

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
    }
  }, [profile.id, tasteShareMessage]);

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
    } catch {
      Alert.alert("Could not share taste profile", "Please try again.");
      return;
    }

    setSelectedShareChatIds([]);
    shareSheetRef.current?.dismiss();
  }, [profile.avatarUrl, profile.displayName, profile.id, selectedShareChatIds, sharePostToChat]);

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
  const handleMenuToggle = useCallback(() => {
    setMenuOpen((current) => !current);
  }, []);

  if (!isAuthenticated) {
    // A guest keeps their place: Sign in opens Login on top, and Back or "Not now" returns here.
    return (
      <ProfileScreenShell title="Profile" showBack={false} testID="profile-signed-out">
        <EmptyState
          title="Your Hungry profile"
          body="Sign in to save dishes, follow people and build your Taste Fingerprint."
          icon={<UserCheck size={36} color={palette.textSecondary} />}
          ctaLabel="Sign in"
          onPress={() => {
            setReturnRoute("Profile");
            rootNavigation.navigate("AuthStack", { screen: "Login" });
          }}
        />
      </ProfileScreenShell>
    );
  }

  return (
    <ProfileScreenShell
      title="Profile"
      showBack={false}
      testID="profile-home-screen"
      headerRight={
        <View style={{ position: "relative", alignItems: "flex-end", zIndex: 30, elevation: 30 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? "Close quick access" : "Open quick access"}
            hitSlop={10}
            onPress={handleMenuToggle}
            style={{
              borderRadius: radii.pill,
              alignItems: "center",
              height: headerActionSize,
              justifyContent: "center",
              width: headerActionSize,
            }}
          >
            <Menu color={palette.text} size={22} />
          </Pressable>
          {menuOpen && (
            <View
              accessibilityViewIsModal
              onAccessibilityEscape={() => setMenuOpen(false)}
              style={{
                position: "absolute",
                top: spacing[8] + spacing[0.5],
                right: 0,
                gap: StyleSheet.hairlineWidth,
                ...shadows.floating,
                ...(colorScheme === "dark"
                  ? {
                      shadowColor: palette.white,
                      shadowOpacity: 0.24,
                      shadowRadius: 14,
                      shadowOffset: { width: 0, height: 10 },
                      elevation: 18,
                    }
                  : {}),
                backgroundColor: palette.border,
                borderRadius: componentRadii.card,
                overflow: "hidden",
                minWidth: 230,
                alignItems: "stretch",
                zIndex: 20,
              }}
            >
              {FEATURE_FLAGS.merchantCentreEnabled && merchantAccount !== null && (
                <MenuRow
                  label="Merchant dashboard"
                  icon={<Store size={20} color={palette.orange} />}
                  onPressIn={prefetchMerchantDashboard}
                  onPress={() => {
                    setMenuOpen(false);
                    rootNavigation.navigate("MerchantTabs" as any);
                  }}
                />
              )}
              {FEATURE_FLAGS.merchantCentreEnabled &&
                isAuthenticated &&
                merchantAccount === null && (
                  <MenuRow
                    label="Hungry for Business"
                    icon={<Store size={20} color={palette.orange} />}
                    onPress={() => {
                      setMenuOpen(false);
                      rootNavigation.navigate("MerchantClaimExplainer");
                    }}
                  />
                )}
              {isAuthenticated && FEATURE_FLAGS.collectionsEnabled && (
                <MenuRow
                  label="Liked content"
                  icon={<Heart size={20} color={palette.error} fill={palette.error} />}
                  onPressIn={() => preloadRoute(navigation, "SocialGrid", { type: "liked" })}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("SocialGrid", { type: "liked" });
                  }}
                />
              )}
              {isAuthenticated && (
                <MenuRow
                  label="Add a stall"
                  icon={<ImagePlus size={20} color={palette.orange} />}
                  onPressIn={() => preloadRoute(navigation, "AddStall")}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("AddStall");
                  }}
                />
              )}
              {isAuthenticated && (
                // Saved, lists (portfolios) and checklists live in one Lists area.
                <MenuRow
                  label="Lists"
                  icon={<List size={20} color={palette.orange} />}
                  onPressIn={() => preloadRoute(navigation, "ListsHome")}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("ListsHome");
                  }}
                />
              )}
              {(followRequestCount ?? 0) > 0 || profile.profileVisibility === "private" ? (
                // Follow requests live in the menu, not on the profile page.
                <MenuRow
                  label={
                    followRequestCount
                      ? `Follow requests (${followRequestCount})`
                      : "Follow requests"
                  }
                  icon={<UserPlus size={20} color={palette.orange} />}
                  onPress={() => {
                    setMenuOpen(false);
                    rootNavigation.navigate("FollowRequests");
                  }}
                />
              ) : null}
              <MenuRow
                label="Followed stalls"
                icon={<Store size={20} color={palette.text} />}
                onPressIn={() => preloadRoute(navigation, "FollowedStalls")}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("FollowedStalls");
                }}
              />
              {FEATURE_FLAGS.reviewCreationEnabled ? (
                <MenuRow
                  label="Review history"
                  icon={<PencilLine size={20} color={palette.text} />}
                  onPressIn={() => preloadRoute(navigation, "ReviewHistory")}
                  onPress={() => {
                    setMenuOpen(false);
                    navigation.navigate("ReviewHistory");
                  }}
                />
              ) : null}
              <MenuRow
                label="Settings"
                icon={<Settings size={20} color={palette.text} />}
                onPressIn={() => preloadRoute(navigation, "Settings")}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate("Settings");
                }}
              />
              {isAuthenticated && (
                <MenuRow
                  label="Sign out"
                  icon={<LogOut size={20} color={palette.error} />}
                  onPress={() => {
                    setMenuOpen(false);
                    Alert.alert("Sign out", "You will be signed out from Hungry on this device.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Sign out",
                        style: "destructive",
                        onPress: () => {
                          signOut();
                          rootNavigation.reset({
                            index: 0,
                            routes: [{ name: "AuthStack", params: { screen: "Login" } }],
                          });
                        },
                      },
                    ]);
                  }}
                />
              )}
            </View>
          )}
        </View>
      }
    >
      <View style={{ gap: spacing[1], paddingBottom: spacing[8], position: "relative" }}>
        <PendingDeletionBanner />
        {menuOpen && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close quick access menu"
            onPress={() => setMenuOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
            }}
          />
        )}
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
                {profile.avatarUrl ? (
                  <AccessibleImage
                    source={{ uri: profile.avatarUrl }}
                    accessibilityLabel={`${profile.displayName} profile photo`}
                    style={{
                      borderRadius: radii.pill,
                      height: avatarSize,
                      width: avatarSize,
                    }}
                    contentFit="cover"
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
                  leftIcon={<Share2 size={16} color={palette.text} />}
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

          {/* Saved and Reviews (and Badges with the Passport) side by side, with no box around them. */}
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            {FEATURE_FLAGS.favouritesEnabled ? (
              <StatBlock
                label="Saved dishes"
                value={profileStatSummary.saved}
                icon={<Bookmark size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "Favourites")}
                onPress={() => navigation.navigate("Favourites")}
              />
            ) : null}
            {FEATURE_FLAGS.reviewCreationEnabled ? (
              <StatBlock
                label="Reviews"
                value={ownReviewCount}
                icon={<PencilLine size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(navigation, "ReviewHistory")}
                onPress={handleReviewsCardPress}
              />
            ) : null}
            {gamificationEnabled ? (
              // The Passport route exists only with gamification.
              <StatBlock
                label="Badges"
                value={earnedBadgeCount}
                icon={<Trophy size={14} color={palette.orange} />}
                onPressIn={() => preloadRoute(rootNavigation, "PassportScreen")}
                onPress={() => rootNavigation.navigate("PassportScreen")}
              />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: spacing[2] }} testID="profile-follow-counts">
            <StatBlock
              label="Followers"
              value={
                followCounts === "unavailable"
                  ? STAT_UNAVAILABLE
                  : followCounts
                    ? followCounts.followersCount
                    : null
              }
              icon={<Users size={14} color={palette.orange} />}
              onPressIn={() => preloadRoute(navigation, "Followers")}
              onPress={() => navigation.navigate("Followers")}
            />
            <StatBlock
              label="Following"
              value={
                followCounts === "unavailable"
                  ? STAT_UNAVAILABLE
                  : followCounts
                    ? followCounts.followingCount
                    : null
              }
              icon={<UserCheck size={14} color={palette.orange} />}
              onPressIn={() => preloadRoute(navigation, "Following")}
              onPress={() => navigation.navigate("Following")}
            />
          </View>
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
                leftIcon={<PencilLine size={16} color={palette.textOnOrange} />}
                onPress={openReviewComposer}
                style={{ alignSelf: "flex-start", minHeight: 44 }}
              />
            </View>
          ) : null}
          {isAuthenticated && FEATURE_FLAGS.favouritesEnabled ? (
            <Button
              label="Collections"
              variant="secondary"
              leftIcon={<FolderHeart size={18} color={palette.orange} />}
              accessibilityHint="Opens your saved food and lists, with search"
              onPressIn={() => preloadRoute(navigation, "Collections")}
              onPress={() => navigation.navigate("Collections")}
            />
          ) : null}
        </View>

        {isAuthenticated && gamificationEnabled ? (
          <PassportCard
            onPressIn={() => preloadRoute(rootNavigation, "PassportScreen")}
            onPress={() => rootNavigation.navigate("PassportScreen")}
          />
        ) : null}

        <View style={{ gap: spacing[4] }}>
          {isAuthenticated && gamificationEnabled ? (
            <MissionBanner onPress={() => navigation.navigate("MissionsScreen" as any)} />
          ) : null}
          <StallContributionCard
            submissionCount={stallSubmissions.length}
            menuSubmissionCount={
              stallSubmissions.filter((submission) => submission.menuItems.length > 0).length
            }
            acceptedCount={
              stallSubmissions.filter((submission) => submission.status === "accepted").length
            }
            onPressIn={() => preloadRoute(navigation, "AddStall")}
            onPress={() => navigation.navigate("AddStall")}
            onOpenSubmissions={() => navigation.navigate("StallSubmissions")}
          />
          {/* Taste Fingerprint Section */}
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
                paddingHorizontal: spacing[1],
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                <FlaskConical color={palette.orange} size={20} />
                <AppText variant="h2">Taste Fingerprint</AppText>
              </View>
              {hasTasteFingerprint ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share Taste Fingerprint"
                  accessibilityHint="Opens sharing options for your Taste Fingerprint"
                  onPress={handleShareTaste}
                  hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 }}
                >
                  <Send size={16} color={palette.orange} />
                  <AppText variant="micro" tone="accent" style={{ fontWeight: "700" }}>
                    Share
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            <View
              style={[
                shadows.card,
                {
                  backgroundColor: palette.surface,
                  borderRadius: componentRadii.card,
                  padding: spacing[5],
                  gap: spacing[4],
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                }}
              >
                <View
                  style={{
                    backgroundColor: palette.orangeLight,
                    width: 40,
                    height: 40,
                    borderRadius: radii.pill,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BarChart3 size={20} color={palette.orange} />
                </View>
                <AppText style={{ flex: 1, fontWeight: "600" }}>{tastePersonaSummary}</AppText>
              </View>
              {hasTasteFingerprint ? (
                <View style={{ gap: spacing[1] }} testID="profile-palate-summary">
                  {palate.loves.length > 0 ? (
                    <AppText variant="bodySmall">
                      <AppText variant="bodySmallBold">You enjoy strong: </AppText>
                      {palate.loves.join(", ")}
                    </AppText>
                  ) : null}
                  {palate.mild.length > 0 ? (
                    <AppText variant="bodySmall">
                      <AppText variant="bodySmallBold">You prefer mild: </AppText>
                      {palate.mild.join(", ")}
                    </AppText>
                  ) : null}
                  <AppText variant="micro" tone="secondary">
                    A dish has one standard level for everyone. Your palate decides how strong it
                    tastes to you, and dish pages show that.
                  </AppText>
                </View>
              ) : null}

              {hasTasteFingerprint ? (
                <View style={{ alignItems: "center", gap: spacing[3] }}>
                  <TasteRadar vector={profile.tasteVector} />
                  <Button
                    label="Retake the taste quiz"
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
          </View>
          <View style={{ gap: spacing[4], marginTop: spacing[5] }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <AppText variant="h2">
                {socialFeedEnabled ? "Recent activity" : "Your reviews"}
              </AppText>
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
                      backgroundColor:
                        activeShareTab === "reviews" ? palette.orange : "transparent",
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
                  icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
                  ctaLabel="Retry"
                  onPress={() => setPostsReloadKey((key) => key + 1)}
                />
              ) : (
                <EmptyState
                  title="No posts yet"
                  body="Published posts will appear here."
                  icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
                />
              )
            ) : ownReviews === null ? (
              <ProfileReviewsSkeleton />
            ) : ownReviews.length ? (
              <View style={{ gap: spacing[3] }}>
                {ownReviews.slice(0, OWN_REVIEWS_INLINE_LIMIT).map((review) => {
                  const dish = review.dishId
                    ? getDataRepository().getDishById(review.dishId)
                    : undefined;
                  const dishName = dish?.name;
                  return (
                    <View key={review.id}>
                      <Card style={{ gap: spacing[3] }}>
                        <View
                          style={{
                            alignItems: "center",
                            flexDirection: "row",
                            gap: spacing[2],
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Review of ${dishName ?? "dish"}, rated ${review.rating} out of 5`}
                            accessibilityHint="Opens the dish"
                            disabled={!review.dishId}
                            onPress={() =>
                              review.dishId &&
                              rootNavigation.navigate("DishDetail", { dishId: review.dishId })
                            }
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: spacing[2],
                            }}
                          >
                            {dish?.imageUrl ? (
                              <AccessibleImage
                                source={{ uri: dish.imageUrl }}
                                accessibilityLabel={dishName ?? "Reviewed dish"}
                                contentFit="cover"
                                style={{
                                  borderRadius: radii.md,
                                  height: spacing[20],
                                  width: spacing[20],
                                }}
                              />
                            ) : null}
                            <View style={{ flex: 1, gap: spacing[1] }}>
                              <AppText variant="bodyBold" numberOfLines={1}>
                                {dishName ?? "Reviewed dish"}
                              </AppText>
                              {dish?.venueName ? (
                                <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                                  {dish.venueName}
                                </AppText>
                              ) : null}
                              <AppText variant="bodySmall" tone="secondary">
                                <Text style={{ color: palette.starFill }}>★</Text>{" "}
                                {review.rating.toFixed(1)} / 5
                              </AppText>
                            </View>
                          </Pressable>
                          {ownReviewEditor.enabled ? (
                            <OwnReviewMenuButton
                              onPress={() => ownReviewEditor.openActions(review)}
                            />
                          ) : null}
                        </View>
                        {review.moderationState ? (
                          <ReviewModerationNotice
                            state={review.moderationState}
                            reviewId={review.id}
                            dishName={dishName}
                          />
                        ) : null}
                        {review.text ? (
                          <View
                            style={{
                              backgroundColor: palette.bgSoft,
                              borderRadius: radii.md,
                              padding: spacing[3],
                            }}
                          >
                            <AppText numberOfLines={4} style={{ fontStyle: "italic" }}>
                              {review.text}
                            </AppText>
                          </View>
                        ) : null}
                      </Card>
                    </View>
                  );
                })}
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
                icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
                ctaLabel="Retry"
                onPress={() => setOwnReviewsReloadKey((key) => key + 1)}
              />
            ) : (
              <EmptyState
                title="No reviews yet"
                body="Reviews will appear here after they are published."
                icon={<MessageCircleMore size={36} color={palette.textSecondary} />}
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
                    icon: ({ color, size }) => <Copy color={color} size={size} />,
                    onPress: () => void copyTasteFingerprintLink(),
                  },
                  {
                    key: "share",
                    label: "Share",
                    accessibilityLabel: "Share taste fingerprint to another app",
                    icon: ({ color, size }) => <Share2 color={color} size={size} />,
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

function StallContributionCard({
  submissionCount,
  menuSubmissionCount,
  acceptedCount,
  onPressIn,
  onPress,
  onOpenSubmissions,
}: {
  submissionCount: number;
  menuSubmissionCount: number;
  acceptedCount: number;
  onPressIn?: () => void;
  onPress: () => void;
  onOpenSubmissions: () => void;
}) {
  const { componentRadii, palette, shadows, spacing } = useHungryTheme();
  const nextScoutTarget = submissionCount >= 5 ? 10 : 5;
  const scoutProgress = Math.min(submissionCount, nextScoutTarget);
  // The Scout target belongs to the Passport and FoodCred system; without it, show what happened.
  const showScout = FEATURE_FLAGS.gamificationEnabled;

  return (
    <View
      style={{
        ...shadows.card,
        backgroundColor: palette.surface,
        borderRadius: componentRadii.card,
        gap: spacing[4],
        padding: spacing[4],
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPressIn={onPressIn}
        onPress={onPress}
        accessibilityLabel="Add a stall"
        accessibilityHint="Opens the stall contribution form"
        style={{ gap: spacing[4] }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: palette.orangeLight,
              borderRadius: componentRadii.iconButton,
              height: 44,
              justifyContent: "center",
              width: 44,
            }}
          >
            <ImagePlus color={palette.orange} size={22} />
          </View>
          <View style={{ flex: 1, gap: spacing[0.5] }}>
            <AppText variant="h3">Add a stall</AppText>
            <AppText variant="bodySmall" tone="muted">
              Submit a stall name, photos, menu notes, hours and an ordering link for review.
            </AppText>
          </View>
          <ChevronRight color={palette.textMuted} size={18} />
        </View>

        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <ScoutMetric
            icon={<Store size={14} color={palette.orange} />}
            label="Submitted"
            value={submissionCount}
          />
          <ScoutMetric
            icon={<Utensils size={14} color={palette.orange} />}
            label="With menu"
            value={menuSubmissionCount}
          />
          {showScout ? (
            <ScoutMetric
              icon={<Trophy size={14} color={palette.orange} />}
              label="Scout"
              value={`${scoutProgress}/${nextScoutTarget}`}
            />
          ) : (
            <ScoutMetric
              icon={<UserCheck size={14} color={palette.orange} />}
              label="Approved"
              value={acceptedCount}
            />
          )}
        </View>
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

function ScoutMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  const { palette, radii, spacing } = useHungryTheme();
  return (
    <View
      style={{
        backgroundColor: palette.bgSoft,
        borderRadius: radii.lg,
        flex: 1,
        gap: spacing[1],
        padding: spacing[3],
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
        {icon}
        <AppText variant="bodySmallBold">{value}</AppText>
      </View>
      <AppText variant="micro" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function TasteRadar({ vector }: { vector: TasteVector }) {
  const { palette, radii, spacing } = useHungryTheme();
  const axes = ["spicy", "rich", "salty", "sweet", "sour", "aromatic"] as const;
  const point = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    return { x: 130 + Math.cos(angle) * radius, y: 130 + Math.sin(angle) * radius };
  };
  const polygon = (radius: number) =>
    axes
      .map((_, index) => {
        const { x, y } = point(index, radius);
        return `${x},${y}`;
      })
      .join(" ");
  const values = axes.map((axis, index) =>
    point(index, (Math.max(0, Math.min(10, vector[axis])) / 10) * 92),
  );

  return (
    <View style={{ alignItems: "center", width: "100%", gap: spacing[3] }}>
      {/* Up to 260pt, never wider than the card: a 320-360pt phone leaves less than that. */}
      <View testID="profile-taste-radar" style={{ aspectRatio: 1, maxWidth: 260, width: "100%" }}>
        <Svg
          accessible={Platform.OS === "web" ? undefined : true}
          accessibilityRole="image"
          accessibilityLabel={`Taste vector: ${axes.map((axis) => `${axis} ${vector[axis].toFixed(1)} out of 10`).join(", ")}`}
          width="100%"
          height="100%"
          viewBox="0 0 260 260"
        >
          {[92, 62, 31].map((radius) => (
            <Polygon
              key={radius}
              points={polygon(radius)}
              fill="none"
              stroke={palette.border}
              strokeWidth={1}
            />
          ))}
          {axes.map((axis, index) => {
            const end = point(index, 92);
            return (
              <Line
                key={axis}
                x1={130}
                y1={130}
                x2={end.x}
                y2={end.y}
                stroke={palette.border}
                strokeWidth={1}
              />
            );
          })}
          <Polygon
            points={values.map(({ x, y }) => `${x},${y}`).join(" ")}
            fill={palette.orangeLight}
            stroke={palette.orange}
            strokeWidth={2.5}
          />
          {values.map(({ x, y }, index) => (
            <Circle key={axes[index]} cx={x} cy={y} r={4} fill={palette.orange} />
          ))}
        </Svg>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: spacing[2],
          justifyContent: "center",
        }}
      >
        {TASTE_DIMENSIONS.map(({ key, label }) => (
          <View
            key={key}
            style={{
              alignItems: "center",
              backgroundColor: palette.bgSoft,
              borderRadius: radii.pill,
              flexDirection: "row",
              gap: spacing[1],
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
            }}
          >
            <AppText variant="micro" style={{ color: palette.text }}>
              {label} {Math.round(vector[key] * 10)}%
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A stat whose read failed: a dash on screen, "unavailable" to a screen reader. */
const STAT_UNAVAILABLE = "–";

function StatBlock({
  label,
  value,
  icon,
  onPressIn,
  onPress,
}: {
  label: string;
  /** null while loading; text such as "20+" when only the first page is counted. */
  value: number | string | null;
  icon: ReactNode;
  onPressIn?: () => void;
  onPress?: () => void;
}) {
  const { colorScheme, componentRadii, palette, spacing } = useHungryTheme();

  const row = (
    <>
      {value === null ? (
        <Skeleton width={spacing[6]} height={spacing[5]} borderRadius={4} />
      ) : (
        <AppText variant="h2" style={{ color: palette.text }}>
          {value}
        </AppText>
      )}
      <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[1] }}>
        {icon}
        <AppText variant="micro" style={{ color: palette.textSecondary }}>
          {label}
        </AppText>
      </View>
    </>
  );

  // A flat row of numbers: no card or border around each stat.
  const baseStyle = {
    borderRadius: componentRadii.card,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    alignItems: "center" as const,
    flex: 1,
    gap: spacing[1],
  };

  if (!onPress) {
    return <View style={baseStyle}>{row}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        value === null
          ? `${label}, loading`
          : value === STAT_UNAVAILABLE
            ? `${label}, unavailable`
            : `${label} ${value}`
      }
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => {
        const pressedStyle =
          pressed &&
          (colorScheme === "dark"
            ? { backgroundColor: palette.surface }
            : { backgroundColor: palette.bgSoft, opacity: 0.92 });
        return [baseStyle, pressedStyle];
      }}
    >
      {row}
    </Pressable>
  );
}

function MenuRow({
  label,
  icon,
  onPressIn,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPressIn?: () => void;
  onPress: () => void;
}) {
  const { palette, spacing } = useHungryTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          backgroundColor: pressed ? palette.bgSoft : palette.surface,
          padding: spacing[4],
          gap: spacing[3],
        },
      ]}
    >
      {icon}
      <AppText
        numberOfLines={1}
        style={{ flex: 1, minWidth: 0, fontWeight: "600", color: palette.text }}
      >
        {label}
      </AppText>
      <ChevronRight color={palette.textMuted} size={18} />
    </Pressable>
  );
}
