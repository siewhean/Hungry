import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  type NativeSyntheticEvent,
  type GestureResponderEvent,
  type TextLayoutEventData,
  View,
  useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Bell,
  Heart,
  MessageCircle,
  MessageCircleMore,
  MoreHorizontal,
  Copy,
  Share2,
  Send,
  Star,
  X,
  UtensilsCrossed,
} from "lucide-react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetFooter,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
  type CompositeNavigationProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MaterialTopTabNavigationProp } from "@react-navigation/material-top-tabs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

import type { MainTabParamList, RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AccessibleImage,
  AppHeader,
  AppText,
  Avatar,
  Button,
  EmptyState,
  FeedErrorBoundary,
  FeedStateView,
  IconButton,
  Input,
  Skeleton,
} from "@/components/ui";
import { DishCard } from "@/components/dish/DishCard";
import { WeeklyPicksRail } from "@/components/dish/WeeklyPicksRail";
import { WelcomeBackCard } from "@/components/home/WelcomeBackCard";
import { CircleStoryCarousel, FloatingShareSendButton, InAppShareCard } from "@/components/social";
import {
  FeedPostCard,
  formatPostAge,
  type FeedPostCardActions,
} from "@/components/social/FeedPostCard";
import {
  getHomeFeedBundle,
  getHomeFeedNextPage,
  type HomeFeedCursor,
  type HomeFeedItem,
} from "@/features/home/feed";
import { toChatShareRecipient, type ChatShareRecipient } from "@/features/home/chatShare";
import { scheduleIdleWork } from "@/lib/performance/scheduleIdleWork";
import { getActivityUnreadCount, selectActivitySourceUpdates } from "@/features/home/activity";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  prefetchDishDetail,
  prefetchImages,
  prefetchPostDetail,
  prefetchStallDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { getBuildingById, toSummary } from "@/lib/geo/singaporeBuildings";
import { formatDistanceFromUser } from "@/features/detail/stallLocation";
import {
  isContentHiddenForSession,
  promptCommentSafetyActions,
  promptPostSafetyActions,
} from "@/lib/security/communitySafety";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { webShareUrl } from "@/constants/links";
import { withShareSource } from "@/features/share/shareAttribution";
import { useActivityStore } from "@/store/useActivityStore";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { isMerchantModeActive, useMerchantStore } from "@/store/useMerchantStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import {
  followUserAfterSignIn,
  likePostAfterSignIn,
  saveDishAfterSignIn,
  savePostAfterSignIn,
} from "@/features/auth/finishGuestAction";
import { useStoryStore } from "@/store/useStoryStore";
import { useSocialStore, type SocialComment, type SocialReply } from "@/store/useSocialStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useUIStore } from "@/store/useUIStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useHungryTheme, type HungryTheme } from "@/theme";
import type { DishDetail, StoryItem } from "@/types/domain";

const CommentIcon = MessageCircle ?? MessageCircleMore;

/** Post-shaped placeholder: author row, square media, two caption lines. */
function PostSkeleton() {
  const { spacing, radii } = useHungryTheme();
  const { width } = useWindowDimensions();
  return (
    <View style={{ gap: spacing[3], paddingVertical: spacing[3] }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing[2],
          paddingHorizontal: spacing[3],
        }}
      >
        <Skeleton width={32} height={32} borderRadius={radii.pill} />
        <Skeleton width="40%" height={14} />
      </View>
      <Skeleton width={width} height={width} borderRadius={0} />
      <View style={{ gap: spacing[1.5], paddingHorizontal: spacing[3] }}>
        <Skeleton width="90%" height={14} />
        <Skeleton width="60%" height={14} />
      </View>
    </View>
  );
}

/** A video plays once at least 60% of its card is on screen. */
const VIDEO_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

const EMPTY_FEED_DISH_COUNT = 6;

interface HomeEmptyFeedProps {
  title: string;
  /** Replaces the default body (guests get a sign-in prompt). */
  body?: string;
  ctaLabel: string;
  onCtaPress: () => void;
  onOpenDish: (dishId: string) => void;
}

/** Empty feed: a CTA plus the top-rated dishes nearby, so Home is never a dead end. */
function HomeEmptyFeed({ title, body, ctaLabel, onCtaPress, onOpenDish }: HomeEmptyFeedProps) {
  const { spacing, semanticSpacing } = useHungryTheme();
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const coordinate = manualCoordinate ?? currentLocation;
  const [dishes, setDishes] = useState<DishDetail[]>([]);

  useEffect(() => {
    let cancelled = false;
    getHungryService()
      .discovery.listPopularNearby(coordinate?.latitude, coordinate?.longitude)
      .then((nearby) => {
        if (cancelled) return;
        setDishes(
          [...nearby]
            .sort((left, right) => right.rating - left.rating)
            .slice(0, EMPTY_FEED_DISH_COUNT),
        );
      })
      .catch(() => {
        // The CTA still works without dishes; nothing to surface here.
      });
    return () => {
      cancelled = true;
    };
  }, [coordinate?.latitude, coordinate?.longitude]);

  return (
    <View style={{ gap: spacing[4], paddingBottom: spacing[4] }}>
      <EmptyState
        title={title}
        body={
          body ??
          (dishes.length
            ? coordinate
              ? "While it fills up, here are the top-rated dishes near you."
              : "While it fills up, here are the top-rated dishes on Hungry."
            : "Share a dish you loved to get things going.")
        }
        ctaLabel={ctaLabel}
        onPress={onCtaPress}
      />
      {dishes.length ? (
        <View style={{ gap: spacing[3], paddingHorizontal: semanticSpacing.screenEdge }}>
          <AppText variant="h3">
            {coordinate ? "Top rated near you" : "Top rated on Hungry"}
          </AppText>
          {dishes.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              distanceLabel={formatDistanceFromUser(
                coordinate,
                getBuildingById(dish.buildingId)?.coordinate,
              )}
              onPress={() => onOpenDish(dish.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type RootNavigation = CompositeNavigationProp<
  MaterialTopTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

const FEED_LOAD_DEDUPE_MS = 1500;
const POST_IMPRESSION_DWELL_MS = 800;
const MAX_EMPTY_PAGE_SKIPS = 3;
const STORY_OPENING_RING_HOLD_MS = 2200;
const MAP_BUILDING_ID_ALIASES: Record<string, string> = {
  "building-amoy": "hc-amoy",
  "building-lau-pa-sat": "hc-lau-pa-sat",
  "building-maxwell": "hc-maxwell",
};

export function HomeFeedScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute();
  const { width: screenWidth } = useWindowDimensions();
  const theme = useHungryTheme();
  const { componentRadii, palette, spacing, semanticSpacing, radii, shadows, colorScheme } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerActionSize = spacing[8] + spacing[2.5];
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const publishedPostsVersion = usePublishedPostStore((state) => state.version);
  const stories = useStoryStore((state) => state.stories);
  const loadStories = useStoryStore((state) => state.loadStories);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const togglePostLike = useSocialStore((state) => state.toggleLike);
  const togglePostSave = useSocialStore((state) => state.toggleSave);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const showToast = useUIStore((state) => state.showToast);
  const recordTasteInteraction = useProfileStore((state) => state.recordTasteInteraction);
  const incrementPostShare = useSocialStore((state) => state.incrementShare);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const addPostComment = useSocialStore((state) => state.addComment);
  const addPostReply = useSocialStore((state) => state.addReply);
  const loadCommentsForPost = useSocialStore((state) => state.loadCommentsForPost);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const requestedUserIds = useSocialStore((state) => state.requestedUserIds);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const serviceProviderMode = getServiceProvider().mode;
  const readActivityIds = useActivityStore((state) => state.readActivityIds);
  const activityUpdates = useActivityStore((state) => state.activityUpdates);
  const dbActivityEvents = useActivityStore((state) => state.dbActivityEvents);
  const fetchActivityEvents = useActivityStore((state) => state.fetchActivityEvents);
  const updateUnreadCount = useMemo(
    () =>
      // Same source and recipient filter as the Activity inbox, so the counts match.
      getActivityUnreadCount(
        readActivityIds,
        selectActivitySourceUpdates(serviceProviderMode, dbActivityEvents, activityUpdates),
        profile.id,
      ),
    [readActivityIds, activityUpdates, dbActivityEvents, profile.id, serviceProviderMode],
  );
  const directMessagesEnabled = FEATURE_FLAGS.directMessagesEnabled;
  const commentsEnabled = FEATURE_FLAGS.commentsEnabled;
  const storiesEnabled = FEATURE_FLAGS.storiesEnabled;
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const activityUnreadCount = updateUnreadCount + (directMessagesEnabled ? chatUnreadCount : 0);
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setHighlightedStallVenueId = useDiscoveryStore((state) => state.setHighlightedStallVenueId);
  const isDeveloperMode = useMerchantStore((state) => state.developerMerchantMode);
  const isMerchantMode = useMerchantStore(isMerchantModeActive);
  const canAccessMap = isDeveloperMode || isMerchantMode;
  const isUserMode = !isDeveloperMode && !isMerchantMode;
  const shouldShowStories = storiesEnabled && !isUserMode;

  const requireAccount = useRequireAccount();
  const requireAuthForPostAction = useCallback(
    (message = "Sign in to react, comment or follow.", onSignedIn?: () => void) =>
      requireAccount(message, { name: "MainTabs", params: { screen: "Home" } }, onSignedIn),
    [requireAccount],
  );
  const requireAuthForFollow = useCallback(
    (onSignedIn?: () => void) =>
      requireAccount(
        "Sign in to follow people.",
        { name: "MainTabs", params: { screen: "Home" } },
        onSignedIn,
      ),
    [requireAccount],
  );

  const openComposerFromEmptyFeed = useCallback(() => {
    if (!isAuthenticated) {
      setReturnRoute({ name: "Post" });
      navigation.navigate("AuthStack", { screen: "Login" });
      return;
    }
    navigation.navigate("Post");
  }, [isAuthenticated, navigation, setReturnRoute]);
  const openSignInFromEmptyFeed = useCallback(() => {
    setReturnRoute({ name: "MainTabs", params: { screen: "Home" } });
    navigation.navigate("AuthStack", { screen: "Login" });
  }, [navigation, setReturnRoute]);
  const openDishFromEmptyFeed = useCallback(
    (dishId: string) => navigation.navigate("DishDetail", { dishId }),
    [navigation],
  );

  // The bell count is read from the server: refresh it when Home is shown and when the
  // app returns to the foreground, not only once at mount.
  useFocusEffect(
    useCallback(() => {
      if (serviceProviderMode === "mock") return undefined;
      void fetchActivityEvents();
      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") void fetchActivityEvents();
      });
      return () => subscription.remove();
    }, [fetchActivityEvents, serviceProviderMode]),
  );
  const storyCarouselItems = useMemo<StoryItem[]>(() => {
    if (!storiesEnabled) {
      return [];
    }

    if (isUserMode) {
      return [];
    }

    if (stories.some((story) => story.isOwn)) {
      return stories;
    }

    return [
      {
        id: "your-story-create",
        displayName: "Your Story",
        avatarUrl: profile.avatarUrl,
        hasUnseen: false,
        isStall: false,
        isOwn: true,
      },
      ...stories,
    ];
  }, [isUserMode, profile.avatarUrl, stories, storiesEnabled]);

  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [feedError, setFeedError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [socialFeed, setSocialFeed] = useState<HomeFeedItem[]>([]);
  const [activeCommentItem, setActiveCommentItem] = useState<HomeFeedItem | null>(null);
  const [activeShareItem, setActiveShareItem] = useState<HomeFeedItem | null>(null);
  const [shareRecipients, setShareRecipients] = useState<ChatShareRecipient[]>([]);
  const [selectedShareChatIds, setSelectedShareChatIds] = useState<string[]>([]);
  const [draftComment, setDraftComment] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  // The one video that may play: the most visible video card.
  const [activeVideoPostId, setActiveVideoPostId] = useState<string | null>(null);
  // Home stays mounted under pushed screens and other tabs; videos pause there.
  const isFocused = useIsFocused();
  const [openingUnseenStoryId, setOpeningUnseenStoryId] = useState<string | null>(null);
  const [openingUnseenStoryDisplayName, setOpeningUnseenStoryDisplayName] = useState<string | null>(
    null,
  );
  const feedRefreshSeedRef = useRef(0);
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<any>(null);
  const commentSnapPoints = useMemo(() => ["50%", "88%"], []);
  const openCommentSheet = useCallback(() => {
    const commentSheet = commentsSheetRef.current;
    if (!commentSheet) return;

    void commentSheet.present?.();
    requestAnimationFrame(() => {
      commentSheet.snapToIndex(0);
    });
  }, []);
  const shareSnapPoints = useMemo(() => ["45%"], []);
  const openingStoryRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingUnseenStoryIdRef = useRef<string | null>(null);
  const openingUnseenStoryDisplayNameRef = useRef<string | null>(null);
  // Paging: where the next page starts (null when the feed has no more pages).
  const nextCursorRef = useRef<HomeFeedCursor | null>(null);
  const isLoadingMoreRef = useRef(false);
  const [hasMoreFeed, setHasMoreFeed] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const socialFeedRef = useRef<HomeFeedItem[]>([]);
  const activeFeedLoadIdRef = useRef(0);
  const lastLoadedFeedAtRef = useRef(0);
  const lastLoadedFeedKeyRef = useRef<string | null>(null);
  // home_feed_viewed fires once per focus, not on every reload.
  const feedViewTrackedRef = useRef(false);
  const socialFeedListRef = useRef<FlashListRef<HomeFeedItem> | null>(null);
  // A post counts as seen after it stays on screen for a moment; once per post per visit.
  const impressionTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const impressionTrackedRef = useRef<Set<string>>(new Set());
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item?: HomeFeedItem; isViewable: boolean }[] }) => {
      const firstVideo = viewableItems.find(
        (token) => token.isViewable && token.item?.mediaType === "video",
      );
      setActiveVideoPostId(firstVideo?.item?.id ?? null);

      const timers = impressionTimersRef.current;
      for (const token of viewableItems) {
        const postId = token.item?.id;
        if (!postId) continue;
        if (!token.isViewable) {
          const pending = timers.get(postId);
          if (pending) clearTimeout(pending);
          timers.delete(postId);
        } else if (!impressionTrackedRef.current.has(postId) && !timers.has(postId)) {
          timers.set(
            postId,
            setTimeout(() => {
              timers.delete(postId);
              impressionTrackedRef.current.add(postId);
              trackAnalyticsEvent("post_impression", { post_id: postId });
            }, POST_IMPRESSION_DWELL_MS),
          );
        }
      }
    },
    [],
  );
  useEffect(() => {
    const timers = impressionTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);
  // Taste changes on every like, save, comment or share tap; read it at load time
  // so a tap does not reload the feed. The key holds only what changes content.
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const profileFeedKey = useMemo(() => {
    return [
      profile.id,
      publishedPostsVersion,
      Object.entries(followedAuthors)
        .filter(([, isFollowing]) => isFollowing)
        .map(([authorName]) => authorName)
        .sort()
        .join(","),
      Object.entries(followedUserIds)
        .filter(([, isFollowing]) => isFollowing)
        .map(([userId]) => userId)
        .sort()
        .join(","),
    ].join("|");
  }, [followedAuthors, followedUserIds, profile.id, publishedPostsVersion]);

  const loadFeed = useCallback(
    async (options?: { force?: boolean; showLoading?: boolean }): Promise<boolean> => {
      const requestKey = profileFeedKey;
      const now = Date.now();
      if (
        !options?.force &&
        lastLoadedFeedKeyRef.current === requestKey &&
        now - lastLoadedFeedAtRef.current < FEED_LOAD_DEDUPE_MS
      ) {
        return true;
      }

      const loadId = activeFeedLoadIdRef.current + 1;
      activeFeedLoadIdRef.current = loadId;
      if (options?.showLoading !== false) {
        setFeedState((current) => (current === "ready" && !options?.force ? current : "loading"));
      }
      try {
        const bundle = await getHomeFeedBundle(profileRef.current, {
          followedAuthors,
          followedUserIds,
          refreshSeed: feedRefreshSeedRef.current,
        });
        if (activeFeedLoadIdRef.current !== loadId) {
          return true;
        }
        socialFeedRef.current = bundle.socialFeed;
        nextCursorRef.current = bundle.nextCursor;
        setHasMoreFeed(Boolean(bundle.nextCursor));
        setSocialFeed(bundle.socialFeed);
        initializeInteractions(bundle.socialFeed, now);
        lastLoadedFeedKeyRef.current = requestKey;
        lastLoadedFeedAtRef.current = Date.now();
        setFeedError("");
        setFeedState("ready");
        if (!feedViewTrackedRef.current) {
          feedViewTrackedRef.current = true;
          trackAnalyticsEvent("home_feed_viewed", { post_count: bundle.socialFeed.length });
        }
        return true;
      } catch (error) {
        setFeedError(error instanceof Error ? error.message : "Unable to load home feed.");
        if (activeFeedLoadIdRef.current !== loadId) {
          return false;
        }
        // Posts already on screen stay; only an empty feed becomes the error card.
        if (socialFeedRef.current.length > 0) {
          setFeedState("ready");
          useUIStore.getState().showToast({
            message: "Could not refresh your feed. Check your connection.",
            tone: "error",
          });
        } else {
          setFeedState("error");
        }
        return false;
      }
    },
    [followedAuthors, followedUserIds, initializeInteractions, profileFeedKey],
  );

  const loadMoreFeed = useCallback(async () => {
    if (isLoadingMoreRef.current || !nextCursorRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const loadId = activeFeedLoadIdRef.current;
    try {
      // A page can hold only posts that were hidden or blocked; skip to the next one.
      for (
        let attempt = 0;
        attempt <= MAX_EMPTY_PAGE_SKIPS && nextCursorRef.current;
        attempt += 1
      ) {
        const page = await getHomeFeedNextPage(nextCursorRef.current, {
          followedAuthors,
          followedUserIds,
        });
        if (activeFeedLoadIdRef.current !== loadId) return;
        nextCursorRef.current = page.nextCursor;
        setHasMoreFeed(Boolean(page.nextCursor));
        const knownIds = new Set(socialFeedRef.current.map((item) => item.id));
        const fresh = page.socialFeed.filter((item) => !knownIds.has(item.id));
        if (fresh.length) {
          socialFeedRef.current = [...socialFeedRef.current, ...fresh];
          setSocialFeed(socialFeedRef.current);
          initializeInteractions(fresh, Date.now());
          break;
        }
      }
    } catch {
      // Keep the cursor: reaching the end again retries the same page.
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [followedAuthors, followedUserIds, initializeInteractions]);

  const hidePostFromCurrentFeed = useCallback((postId: string) => {
    socialFeedRef.current = socialFeedRef.current.filter((item) => item.id !== postId);
    setSocialFeed(socialFeedRef.current);
  }, []);

  // Bumped after a block so comment lists re-run the session block filter.
  const [blockedAuthorsVersion, setBlockedAuthorsVersion] = useState(0);
  const hideAuthorFromCurrentFeed = useCallback((blockedAuthorId: string) => {
    const isAllowedPost = (item: HomeFeedItem) => item.authorId?.trim() !== blockedAuthorId;
    socialFeedRef.current = socialFeedRef.current.filter(isAllowedPost);
    setSocialFeed(socialFeedRef.current);
    setBlockedAuthorsVersion((current) => current + 1);
  }, []);

  const refreshHomeFeed = useCallback(async () => {
    setIsRefreshing(true);
    try {
      feedRefreshSeedRef.current += 1;
      await loadFeed({ force: true, showLoading: false });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadFeed]);

  const clearOpeningStoryRingHold = useCallback(() => {
    if (openingStoryRingTimerRef.current) {
      clearTimeout(openingStoryRingTimerRef.current);
      openingStoryRingTimerRef.current = null;
    }
    openingUnseenStoryIdRef.current = null;
    openingUnseenStoryDisplayNameRef.current = null;
    setOpeningUnseenStoryId(null);
    setOpeningUnseenStoryDisplayName(null);
  }, []);

  const holdOpeningStoryRing = useCallback(
    (story: StoryItem) => {
      if (!story.hasUnseen || story.isOwn) {
        return;
      }

      if (openingStoryRingTimerRef.current) {
        clearTimeout(openingStoryRingTimerRef.current);
      }
      openingUnseenStoryIdRef.current = story.id;
      openingUnseenStoryDisplayNameRef.current = story.displayName;
      setOpeningUnseenStoryId(story.id);
      setOpeningUnseenStoryDisplayName(story.displayName);
      openingStoryRingTimerRef.current = setTimeout(
        clearOpeningStoryRingHold,
        STORY_OPENING_RING_HOLD_MS,
      );
    },
    [clearOpeningStoryRingHold],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (openingUnseenStoryIdRef.current) {
        clearOpeningStoryRingHold();
      }
    });

    return unsubscribe;
  }, [clearOpeningStoryRingHold, navigation]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      feedViewTrackedRef.current = false;
      const cancelIdle = scheduleIdleWork(() => {
        if (!cancelled) {
          void loadFeed();
          // Requests may have been approved or declined since the last visit.
          void useSocialStore
            .getState()
            .reconcileRequestedFollows()
            .catch(() => undefined);
        }
      });

      return () => {
        cancelled = true;
        cancelIdle();
        activeFeedLoadIdRef.current += 1;
      };
    }, [loadFeed]),
  );

  // Pressing the Home tab while Home is showing scrolls the feed back to the top.
  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      if (!navigation.isFocused()) return;
      socialFeedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const leadingItems = socialFeed.slice(0, 4);
    leadingItems.forEach((item) => prefetchPostDetail(item));
    prefetchImages(
      leadingItems.map((item) => item.mediaUrls?.[0] ?? item.mediaUrl),
      8,
    );
  }, [socialFeed]);

  const recordPostDishInteraction = useCallback(
    (item: HomeFeedItem, buttonId: string, type: "dish_like" | "food_button_click") => {
      const primaryDish = item.dishes[0];
      if (!primaryDish) return;
      recordTasteInteraction({
        type,
        surface: "home",
        dish: primaryDish,
        buttonId,
      });
    },
    [recordTasteInteraction],
  );

  const openComments = useCallback(
    (item: HomeFeedItem) => {
      if (!commentsEnabled) return;

      recordPostDishInteraction(item, "comments", "food_button_click");
      setActiveCommentItem(item);
      setDraftComment("");
      setActiveReplyCommentId(null);
      openCommentSheet();
    },
    [commentsEnabled, openCommentSheet, recordPostDishInteraction],
  );

  const loadChatConversations = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) {
      setChatUnreadCount(0);
      setShareRecipients([]);
      return;
    }

    try {
      const conversations = await getHungryService().chat.listConversations();
      setChatUnreadCount(
        conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
      );
      setShareRecipients(conversations.map(toChatShareRecipient));
    } catch {
      setChatUnreadCount(0);
      setShareRecipients([]);
    }
  }, []);

  const openShareSheet = useCallback(
    (item: HomeFeedItem) => {
      recordPostDishInteraction(item, "share", "food_button_click");
      setActiveShareItem(item);
      setSelectedShareChatIds([]);
      void loadChatConversations();
      requestAnimationFrame(() => {
        shareSheetRef.current?.present();
      });
    },
    [loadChatConversations, recordPostDishInteraction],
  );

  const toggleShareChat = useCallback((chatId: string) => {
    setSelectedShareChatIds((current) =>
      current.includes(chatId)
        ? current.filter((candidate) => candidate !== chatId)
        : [...current, chatId],
    );
  }, []);

  const sendPostToHungryUsers = useCallback(async () => {
    if (!FEATURE_FLAGS.directMessagesEnabled) return;
    if (!activeShareItem || selectedShareChatIds.length === 0) return;

    const results = await Promise.allSettled(
      selectedShareChatIds.map((chatId) =>
        sharePostToChat(chatId, {
          postId: activeShareItem.id,
          title: activeShareItem.dishes[0]?.name ?? activeShareItem.venue.name,
          subtitle: `${activeShareItem.venue.name} · ${activeShareItem.authorName}`,
          imageUrl: activeShareItem.mediaUrl,
          authorName: activeShareItem.authorName,
        }),
      ),
    );
    const failedChatIds = selectedShareChatIds.filter(
      (_chatId, index) => results[index]?.status === "rejected",
    );
    if (failedChatIds.length === selectedShareChatIds.length) {
      Alert.alert("Could not share post", "Please try again.");
      return;
    }
    if (failedChatIds.length > 0) {
      // Keep only the chats that failed selected, so a retry does not resend.
      setSelectedShareChatIds(failedChatIds);
      Alert.alert(
        "Shared to some chats",
        `Could not send to ${failedChatIds.length} chat${failedChatIds.length === 1 ? "" : "s"}. Try again for those.`,
      );
      incrementPostShare(activeShareItem.id, "in_app");
      return;
    }
    incrementPostShare(activeShareItem.id, "in_app");
    setActiveShareItem(null);
    setSelectedShareChatIds([]);
    shareSheetRef.current?.dismiss();
  }, [activeShareItem, incrementPostShare, sharePostToChat, selectedShareChatIds]);

  const resetShareSheet = useCallback(() => {
    setSelectedShareChatIds([]);
    setActiveShareItem(null);
  }, []);

  const copySharePostLink = useCallback(async () => {
    if (!activeShareItem) return;
    await Clipboard.setStringAsync(
      withShareSource(webShareUrl("post", activeShareItem.id), "copy_link"),
    );
    incrementPostShare(activeShareItem.id, "copy_link");
    showToast({ message: "Link copied", tone: "success" });
  }, [activeShareItem, incrementPostShare, showToast]);

  const sharePostOutsideApp = useCallback(async () => {
    if (!activeShareItem) return;
    const link = withShareSource(webShareUrl("post", activeShareItem.id), "system_share");
    const result = await Share.share({
      message: `${activeShareItem.dishes[0]?.name ?? "Post"} at ${
        activeShareItem.venue.name
      }. ${activeShareItem.caption}\n${link}`,
      url: link,
    });
    // Count a share only when the user actually sent it, not on cancel.
    if (result.action === Share.sharedAction) {
      incrementPostShare(activeShareItem.id, "system_share");
    }
  }, [activeShareItem, incrementPostShare]);

  const openUserProfile = useCallback(
    (authorName: string, authorAvatarUrl?: string, authorLocation?: string, authorId?: string) => {
      const normalizedAuthorName = authorName.trim();
      const normalizedAvatarUrl = authorAvatarUrl?.trim();
      const normalizedLocation = authorLocation?.trim();
      navigation.navigate("UserProfile", {
        authorName: normalizedAuthorName,
        authorAvatarUrl: normalizedAvatarUrl,
        authorLocation: normalizedLocation,
        authorId: authorId?.trim(),
      });
    },
    [navigation],
  );

  const prefetchUserProfileRoute = useCallback(
    (item: HomeFeedItem) => {
      preloadRoute(navigation, "UserProfile", {
        authorName: item.authorName.trim(),
        authorAvatarUrl: item.authorAvatarUrl?.trim(),
        authorLocation: item.authorLocation?.trim(),
        authorId: item.authorId?.trim(),
      });
      prefetchImages([item.authorAvatarUrl?.trim()], 1);
    },
    [navigation],
  );

  const prefetchMapRoute = useCallback(
    (item: HomeFeedItem) => {
      if (!canAccessMap) return;
      prefetchStallDetail(item.venueId);
      preloadRoute(navigation, "DiscoverMap");
    },
    [canAccessMap, navigation],
  );

  const prefetchFeedCardRoute = useCallback(
    (item: HomeFeedItem) => {
      prefetchPostDetail(item);
      const primaryDishId = item.dishes[0]?.id;
      if (primaryDishId) {
        prefetchDishDetail(primaryDishId);
        preloadRoute(navigation, "DishDetail", { dishId: primaryDishId });
        return;
      }
      prefetchStallDetail(item.venueId);
      preloadRoute(navigation, "StallDetail", { venueId: item.venueId });
    },
    [navigation],
  );

  const openVenueOnMap = useCallback(
    (item: HomeFeedItem) => {
      if (!canAccessMap) return;
      const mapBuildingId = MAP_BUILDING_ID_ALIASES[item.buildingId] ?? item.buildingId;
      const mapBuilding = getBuildingById(mapBuildingId);
      if (mapBuilding) {
        setSelectedBuilding(toSummary(mapBuilding));
      }
      setSelectedFloor(item.venue.floor);
      setHighlightedStallVenueId(item.venueId);
      navigation.navigate("DiscoverMap");
    },
    [canAccessMap, navigation, setHighlightedStallVenueId, setSelectedBuilding, setSelectedFloor],
  );

  const handlePostLike = useCallback(
    (item: HomeFeedItem) => {
      if (
        !requireAuthForPostAction("Sign in to like this post.", () => likePostAfterSignIn(item.id))
      )
        return;
      const wasLiked = useSocialStore.getState().interactions[item.id]?.liked;
      void togglePostLike(item.id);
      if (!wasLiked) {
        requestAnimationFrame(() => {
          recordPostDishInteraction(item, "like", "dish_like");
        });
      }
    },
    [recordPostDishInteraction, requireAuthForPostAction, togglePostLike],
  );

  const handlePostSave = useCallback(
    (item: HomeFeedItem) => {
      const primaryDish = item.dishes?.[0];
      if (
        !requireAuthForPostAction(`Sign in to save ${primaryDish?.name ?? "this post"}`, () => {
          savePostAfterSignIn(item.id);
          if (primaryDish?.id) saveDishAfterSignIn(primaryDish);
        })
      )
        return;
      const wasSaved = Boolean(useSocialStore.getState().interactions[item.id]?.saved);
      void togglePostSave(item.id);
      // Saving a post also saves its dish: say so, since unsaving the post keeps the dish.
      if (!wasSaved && primaryDish?.name) {
        showToast({ message: `Saved ${primaryDish.name} to your dishes`, tone: "success" });
      }
      // Saving a post also saves its dish, but never un-saves a dish the user
      // already had, and unsaving the post leaves the dish alone.
      if (
        !wasSaved &&
        primaryDish?.id &&
        !useProfileStore.getState().profile.favouriteDishIds.includes(primaryDish.id)
      ) {
        requestAnimationFrame(() => {
          toggleFavourite(primaryDish);
        });
      }
    },
    [requireAuthForPostAction, showToast, toggleFavourite, togglePostSave],
  );

  const commentsForActiveItem = useMemo(() => {
    if (!activeCommentItem) {
      return [];
    }

    // Only the post's own comments: dish reviews are not comments (they read as
    // "now" and cannot be replied to).
    const localComments = commentsByPostId[activeCommentItem.id] ?? [];

    return [...localComments]
      .filter((comment) => !isContentHiddenForSession({ id: comment.id, authorId: comment.userId }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // blockedAuthorsVersion re-runs the session block filter after a block.
  }, [activeCommentItem, blockedAuthorsVersion, commentsByPostId]);

  const visibleRepliesFor = useCallback(
    (commentId: string) =>
      (repliesByCommentId[commentId] ?? []).filter(
        (reply) => !isContentHiddenForSession({ id: reply.id, authorId: reply.userId }),
      ),
    // blockedAuthorsVersion re-runs the session block filter after a block.
    [blockedAuthorsVersion, repliesByCommentId],
  );

  useEffect(() => {
    if (!activeCommentItem?.id) return;
    void loadCommentsForPost(activeCommentItem.id);
  }, [activeCommentItem?.id, loadCommentsForPost]);

  const handlePostCommentOrReply = useCallback(() => {
    if (!activeCommentItem || !draftComment.trim().length) return;
    if (!isAuthenticated) {
      // Close the sheet first so it does not stay on top of the sign-in screen.
      commentsSheetRef.current?.dismiss();
      requireAccount("Sign in to comment.", { name: "MainTabs", params: { screen: "Home" } });
      return;
    }

    if (activeReplyCommentId) {
      const newReply: SocialReply = {
        id: `reply-${Date.now()}`,
        parentCommentId: activeReplyCommentId,
        userId: profile.id,
        authorName: profile.displayName,
        authorAvatarUrl: profile.avatarUrl,
        text: draftComment.trim(),
        createdAt: new Date().toISOString(),
      };

      addPostReply(activeCommentItem.id, newReply);
      setActiveReplyCommentId(null);
    } else {
      const newComment: SocialComment = {
        id: `comment-${Date.now()}`,
        userId: profile.id,
        authorName: profile.displayName,
        authorAvatarUrl: profile.avatarUrl,
        text: draftComment.trim(),
        createdAt: new Date().toISOString(),
      };

      addPostComment(activeCommentItem.id, newComment);
    }

    setDraftComment("");
  }, [
    activeCommentItem,
    addPostComment,
    addPostReply,
    draftComment,
    activeReplyCommentId,
    isAuthenticated,
    requireAccount,
    profile.id,
    profile.avatarUrl,
    profile.displayName,
  ]);

  const themeTints = useMemo(() => {
    const isDark = colorScheme === "dark";
    return {
      bg: palette.bg,
      cardBg: palette.surface,
      text: palette.text,
      secondaryText: palette.textSecondary,
      badgeBg: palette.bgSoft,
      actionOverlayBg: palette.surfaceTranslucent,
      isDark,
    };
  }, [palette, colorScheme]);

  const navigateToDish = useCallback(
    (item: HomeFeedItem) => {
      const primaryDish = item.dishes[0];
      if (!primaryDish) {
        navigation.navigate("StallDetail", { venueId: item.venueId });
        return;
      }
      navigation.navigate("DishDetail", { dishId: primaryDish.id });
      scheduleIdleWork(
        () => {
          recordTasteInteraction({
            type: "dish_result_click",
            surface: "home",
            dish: primaryDish,
            buttonId: "feed_card",
          });
        },
        { timeout: 500, fallbackDelayMs: 80 },
      );
    },
    [navigation, recordTasteInteraction],
  );

  const handleStoryPress = useCallback(
    (story: StoryItem) => {
      if (!shouldShowStories) return;

      if (story.isOwn) {
        const ownStory = stories.find((candidate) => candidate.isOwn);
        if (ownStory) {
          navigation.navigate("StoryViewer", { initialStoryId: ownStory.id });
          return;
        }
        navigation.navigate("AddStory");
        return;
      }
      holdOpeningStoryRing(story);
      navigation.navigate("StoryViewer", { initialStoryId: story.id });
    },
    [holdOpeningStoryRing, navigation, shouldShowStories, stories],
  );

  const handleAddStoryPress = useCallback(() => {
    if (!shouldShowStories) return;

    navigation.navigate("AddStory");
  }, [navigation, shouldShowStories]);

  useEffect(() => {
    if (shouldShowStories && stories.length === 0) {
      void loadStories();
    }
  }, [loadStories, shouldShowStories, stories.length]);

  useEffect(() => {
    void loadChatConversations();
  }, [loadChatConversations]);

  useEffect(
    () => () => {
      if (openingStoryRingTimerRef.current) {
        clearTimeout(openingStoryRingTimerRef.current);
      }
    },
    [],
  );

  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();
  const activityInitialTab = directMessagesEnabled ? "messages" : "updates";

  const renderActivityButton = useCallback(
    () => (
      <View style={styles.activityButtonWrap}>
        <IconButton
          accessibilityLabel={
            activityUnreadCount > 0 ? `Activity, ${activityUnreadCount} unread` : "Activity"
          }
          accessibilityHint={
            directMessagesEnabled
              ? "Opens your messages and updates"
              : "Opens who liked, followed or asked to follow you"
          }
          icon={<Bell color={palette.text} size={22} />}
          onPress={() => navigation.navigate("ActivityInbox", { initialTab: activityInitialTab })}
          onPressIn={() =>
            preloadRoute(navigation, "ActivityInbox", { initialTab: activityInitialTab })
          }
          size={headerActionSize}
          testID="home-activity-inbox-button"
          variant="ghost"
        />
        {activityUnreadCount > 0 ? (
          <View style={[styles.activityBadge, { backgroundColor: palette.error }]}>
            <AppText variant="micro" style={{ color: palette.white, fontWeight: "900" }}>
              {activityUnreadCount > 9 ? "9+" : activityUnreadCount}
            </AppText>
          </View>
        ) : null}
      </View>
    ),
    [
      activityUnreadCount,
      activityInitialTab,
      directMessagesEnabled,
      navigation,
      palette.error,
      palette.text,
      palette.white,
      headerActionSize,
      styles.activityBadge,
      styles.activityButtonWrap,
    ],
  );

  const renderHeader = useCallback(
    () => (
      <View style={{ paddingBottom: 0, gap: 0 }}>
        <AppHeader
          title="Home"
          showBack={false}
          right={renderActivityButton()}
          horizontalPadding={semanticSpacing.screenEdge}
          style={{ minHeight: 68 }}
        />
        <WelcomeBackCard
          horizontalPadding={semanticSpacing.screenEdge}
          onOpenDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
          onOpenSaved={() => navigation.navigate("Favourites")}
        />
        <WeeklyPicksRail
          horizontalPadding={semanticSpacing.screenEdge}
          onOpenDish={(dishId) => navigation.navigate("DishDetail", { dishId })}
          onDecideForMe={() => navigation.navigate("DecideForMeResult", { surface: "home" })}
        />
        {storiesEnabled ? (
          shouldShowStories ? (
            <CircleStoryCarousel
              stories={storyCarouselItems}
              openingUnseenStoryId={openingUnseenStoryId}
              openingUnseenStoryDisplayName={openingUnseenStoryDisplayName}
              onStoryPressIn={holdOpeningStoryRing}
              onStoryPress={handleStoryPress}
              onAddStoryPress={handleAddStoryPress}
            />
          ) : null
        ) : null}
      </View>
    ),
    [
      navigation,
      handleAddStoryPress,
      handleStoryPress,
      holdOpeningStoryRing,
      openingUnseenStoryDisplayName,
      openingUnseenStoryId,
      palette.orange,
      renderActivityButton,
      semanticSpacing.screenEdge,
      shouldShowStories,
      storiesEnabled,
      storyCarouselItems,
    ],
  );
  const listHeader = useMemo(() => renderHeader(), [renderHeader]);

  const canUseAuthorFallbackFollow =
    serviceProviderMode === "mock" || (typeof __DEV__ !== "undefined" && __DEV__);

  const handleToggleFollow = useCallback(
    (item: HomeFeedItem) => {
      const followTargetId = item.authorId;
      if (
        !requireAuthForFollow(
          followTargetId ? () => followUserAfterSignIn(followTargetId) : undefined,
        )
      )
        return;
      void (followTargetId ? toggleFollow(followTargetId) : toggleAuthorFollow(item.authorName));
    },
    [requireAuthForFollow, toggleAuthorFollow, toggleFollow],
  );

  const handleOpenPostMenu = useCallback(
    (item: HomeFeedItem) => {
      // Report, hide and block all need an account; guests get the sign-in sheet.
      if (!requireAuthForPostAction("Sign in to report or block.")) return;
      promptPostSafetyActions({
        postId: item.id,
        authorName: item.authorName,
        authorId: item.authorId,
        label: "post",
        onHidden: hidePostFromCurrentFeed,
        onBlocked: hideAuthorFromCurrentFeed,
      });
    },
    [hideAuthorFromCurrentFeed, hidePostFromCurrentFeed, requireAuthForPostAction],
  );

  const feedCardActions = useMemo<FeedPostCardActions>(
    () => ({
      like: handlePostLike,
      save: handlePostSave,
      share: openShareSheet,
      openComments,
      openMenu: handleOpenPostMenu,
      toggleFollow: handleToggleFollow,
      openProfile: (item) =>
        openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation, item.authorId),
      openDish: navigateToDish,
      openVenue: (item) =>
        canAccessMap
          ? openVenueOnMap(item)
          : navigation.navigate("StallDetail", { venueId: item.venueId }),
      prefetchProfile: prefetchUserProfileRoute,
      prefetchVenue: prefetchMapRoute,
      prefetchDish: prefetchFeedCardRoute,
      openPost: (item) => navigation.navigate("ActivityPostDetail", { postId: item.id }),
    }),
    [
      canAccessMap,
      handleOpenPostMenu,
      handlePostLike,
      handlePostSave,
      handleToggleFollow,
      navigateToDish,
      navigation,
      openComments,
      openShareSheet,
      openUserProfile,
      openVenueOnMap,
      prefetchFeedCardRoute,
      prefetchMapRoute,
      prefetchUserProfileRoute,
    ],
  );

  const renderFeedItem = useCallback(
    ({ item }: { item: HomeFeedItem }) => (
      <FeedPostCard
        item={item}
        actions={feedCardActions}
        isVideoActive={isFocused && activeVideoPostId === item.id}
        canAccessMap={canAccessMap}
        canShowFollow={Boolean(item.authorId) || canUseAuthorFallbackFollow}
        commentsEnabled={commentsEnabled}
        viewerId={profile.id}
      />
    ),
    [
      activeVideoPostId,
      canAccessMap,
      canUseAuthorFallbackFollow,
      commentsEnabled,
      feedCardActions,
      isFocused,
      profile.id,
    ],
  );

  const retryFeed = useCallback(() => {
    void loadFeed({ force: true });
  }, [loadFeed]);

  const feedFooter = isLoadingMore ? (
    <View style={{ alignItems: "center", paddingVertical: spacing[4] }}>
      <ActivityIndicator color={palette.orange} />
    </View>
  ) : socialFeed.length > 0 && !hasMoreFeed ? (
    <View style={{ alignItems: "center", paddingVertical: spacing[4] }}>
      <AppText variant="bodySmall" tone="muted">
        You&apos;re all caught up
      </AppText>
    </View>
  ) : null;

  if (feedState === "loading") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: themeTints.bg }}
        edges={["top", "left", "right"]}
      >
        <FeedErrorBoundary onRetry={retryFeed}>
          <ScrollView
            scrollEnabled={false}
            accessibilityLabel="Loading your food feed"
            accessibilityState={{ busy: true }}
          >
            {listHeader}
            <PostSkeleton />
            <PostSkeleton />
          </ScrollView>
        </FeedErrorBoundary>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: themeTints.bg }}
      edges={["top", "left", "right"]}
    >
      <FeedErrorBoundary
        onRetry={retryFeed}
        title="Feed temporarily unavailable"
        body="A display issue occurred while rendering this feed. Please retry."
      >
        <View testID="home-social-feed" style={{ flex: 1 }}>
          <FlashList
            ref={socialFeedListRef}
            accessibilityLabel="Home food feed"
            accessibilityHint="Swipe vertically to browse food posts and pull down to refresh"
            data={socialFeed}
            keyExtractor={keyExtractor}
            ListHeaderComponent={listHeader}
            ListFooterComponent={feedFooter}
            renderItem={renderFeedItem}
            onEndReached={() => void loadMoreFeed()}
            onEndReachedThreshold={1.5}
            viewabilityConfig={VIDEO_VIEWABILITY_CONFIG}
            onViewableItemsChanged={handleViewableItemsChanged}
            ListEmptyComponent={
              feedState === "error" ? (
                // The header (bell, picks, Decide for me) stays; only the posts failed.
                <FeedStateView
                  state="error"
                  title="Something went wrong"
                  body="We couldn't load your feed right now. Please check your connection and try again."
                  errorMessage={feedError}
                  errorContext="Home feed"
                  ctaLabel="Retry"
                  onPress={retryFeed}
                />
              ) : isAuthenticated ? (
                <HomeEmptyFeed
                  title="No posts yet"
                  ctaLabel="Share a dish"
                  onCtaPress={openComposerFromEmptyFeed}
                  onOpenDish={openDishFromEmptyFeed}
                />
              ) : (
                <HomeEmptyFeed
                  title="Sign in to see your feed"
                  body="Follow foodies to see what they eat. Until then, here are top-rated dishes on Hungry."
                  ctaLabel="Sign in"
                  onCtaPress={openSignInFromEmptyFeed}
                  onOpenDish={openDishFromEmptyFeed}
                />
              )
            }
            contentContainerStyle={{
              gap: spacing[2],
              paddingBottom: spacing[16] + insets.bottom + spacing[6],
            }}
            onScroll={onScroll}
            refreshControl={
              <RefreshControl
                colors={[palette.orange]}
                onRefresh={refreshHomeFeed}
                refreshing={isRefreshing}
                tintColor={palette.orange}
              />
            }
            scrollEventThrottle={scrollEventThrottle}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <BottomSheetModal
          ref={commentsSheetRef}
          snapPoints={commentSnapPoints}
          index={1}
          enablePanDownToClose
          accessibilityLabel="Post comments"
          accessibilityViewIsModal
          onDismiss={() => {
            setActiveCommentItem(null);
            setActiveReplyCommentId(null);
            setDraftComment("");
          }}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              opacity={0.5}
              pressBehavior="close"
              accessibilityRole="button"
              accessibilityLabel="Close comments"
              accessibilityHint="Dismisses the comments sheet"
            />
          )}
          backgroundStyle={{ backgroundColor: palette.surface }}
          handleIndicatorStyle={{ backgroundColor: palette.border }}
          footerComponent={(props) => (
            <BottomSheetFooter {...props}>
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderTopWidth: 1,
                  borderTopColor: palette.border,
                  paddingHorizontal: spacing[3],
                  paddingTop: spacing[2],
                  paddingBottom: Math.max(insets.bottom, spacing[4]),
                  gap: spacing[2],
                }}
              >
                {activeReplyCommentId ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: palette.bgSoft,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1.5],
                      borderRadius: radii.md,
                    }}
                  >
                    <AppText variant="micro" tone="secondary">
                      Replying to{" "}
                      <AppText variant="micro" style={{ fontWeight: "700" }}>
                        {
                          commentsForActiveItem.find((c) => c.id === activeReplyCommentId)
                            ?.authorName
                        }
                      </AppText>
                    </AppText>
                    <Pressable
                      onPress={() => setActiveReplyCommentId(null)}
                      hitSlop={15}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel reply"
                      accessibilityHint="Stops replying to the selected comment"
                    >
                      <X size={14} color={palette.textMuted} />
                    </Pressable>
                  </View>
                ) : null}
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: spacing[2],
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Input
                      ref={commentInputRef}
                      placeholder={activeReplyCommentId ? "Write a reply..." : "Add a comment..."}
                      value={draftComment}
                      onChangeText={setDraftComment}
                      multiline={false}
                      numberOfLines={1}
                      textAlignVertical="center"
                      style={{ minHeight: 44, maxHeight: 44 }}
                    />
                  </View>
                  <Pressable
                    onPress={handlePostCommentOrReply}
                    disabled={!draftComment.trim().length}
                    accessibilityRole="button"
                    accessibilityLabel={activeReplyCommentId ? "Post reply" : "Post comment"}
                    accessibilityState={{ disabled: !draftComment.trim().length }}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                      opacity: draftComment.trim().length ? 1 : 0.5,
                    }}
                  >
                    <AppText variant="bodyBold" style={{ color: palette.orangeText }}>
                      Post
                    </AppText>
                  </Pressable>
                </View>
              </View>
            </BottomSheetFooter>
          )}
        >
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing[3],
              paddingTop: spacing[0.5],
              paddingBottom: spacing[24] + spacing[8] + insets.bottom,
            }}
          >
            {activeCommentItem ? (
              <View
                style={{
                  backgroundColor: palette.bgSoft,
                  borderColor: palette.border,
                  borderRadius: componentRadii.card,
                  borderWidth: 1,
                  gap: spacing[2],
                  marginBottom: spacing[5],
                  padding: spacing[3],
                }}
              >
                <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                  <Avatar
                    uri={activeCommentItem.authorAvatarUrl}
                    name={activeCommentItem.authorName}
                    size={28}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodySmallBold">{activeCommentItem.authorName}</AppText>
                    <AppText variant="micro" tone="secondary">
                      {formatPostAge(activeCommentItem.createdAt)}
                    </AppText>
                  </View>
                </View>
                <AppText variant="bodySmall" style={styles.commentText}>
                  {activeCommentItem.caption}
                </AppText>
              </View>
            ) : null}

            {commentsForActiveItem.length ? (
              commentsForActiveItem.map((comment) => (
                <View key={comment.id} style={{ gap: spacing[3], marginBottom: spacing[5] }}>
                  <View style={{ flexDirection: "row", gap: spacing[3] }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${comment.authorName} profile`}
                      onPress={() =>
                        openUserProfile(
                          comment.authorName,
                          comment.authorAvatarUrl,
                          activeCommentItem?.authorLocation,
                          comment.userId,
                        )
                      }
                    >
                      <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} size={36} />
                    </Pressable>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          gap: spacing[2],
                          justifyContent: "space-between",
                        }}
                      >
                        <View
                          style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}
                        >
                          <AppText variant="bodySmallBold">{comment.authorName}</AppText>
                          <AppText variant="micro" tone="muted">
                            {formatTimeAgo(comment.createdAt)}
                          </AppText>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Manage comment by ${comment.authorName}`}
                          hitSlop={8}
                          onPress={() =>
                            promptCommentSafetyActions({
                              commentId: comment.id,
                              authorName: comment.authorName,
                              authorId: comment.userId,
                              postId: activeCommentItem?.id,
                              label: "comment",
                              onBlocked: hideAuthorFromCurrentFeed,
                            })
                          }
                        >
                          <MoreHorizontal color={palette.textMuted} size={18} />
                        </Pressable>
                      </View>
                      <AppText variant="bodySmall" style={styles.commentText}>
                        {comment.text}
                      </AppText>
                      <Pressable
                        onPress={() => {
                          setActiveReplyCommentId(comment.id);
                          commentInputRef.current?.focus();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Reply to ${comment.authorName}`}
                        hitSlop={12}
                        style={{ marginTop: 4 }}
                      >
                        <AppText
                          variant="micro"
                          style={{
                            fontWeight: "700",
                            color: palette.textMuted,
                          }}
                        >
                          Reply
                        </AppText>
                      </Pressable>

                      {/* Replies */}
                      {visibleRepliesFor(comment.id).length > 0 && (
                        <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
                          {visibleRepliesFor(comment.id).map((reply) => (
                            <View
                              key={reply.id}
                              style={{
                                flexDirection: "row",
                                gap: spacing[3],
                              }}
                            >
                              <Avatar
                                uri={reply.authorAvatarUrl}
                                name={reply.authorName}
                                size={24}
                              />
                              <View style={{ flex: 1, gap: 2 }}>
                                <View
                                  style={{
                                    alignItems: "center",
                                    flexDirection: "row",
                                    gap: spacing[2],
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <View
                                    style={{
                                      alignItems: "center",
                                      flexDirection: "row",
                                      gap: spacing[2],
                                    }}
                                  >
                                    <AppText variant="micro" style={{ fontWeight: "700" }}>
                                      {reply.authorName}
                                    </AppText>
                                    <AppText variant="micro" tone="muted">
                                      {formatTimeAgo(reply.createdAt)}
                                    </AppText>
                                  </View>
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Manage reply by ${reply.authorName}`}
                                    hitSlop={8}
                                    onPress={() =>
                                      promptCommentSafetyActions({
                                        commentId: reply.id,
                                        authorName: reply.authorName,
                                        authorId: reply.userId,
                                        postId: activeCommentItem?.id,
                                        label: "reply",
                                        onBlocked: hideAuthorFromCurrentFeed,
                                      })
                                    }
                                  >
                                    <MoreHorizontal color={palette.textMuted} size={16} />
                                  </Pressable>
                                </View>
                                <AppText variant="bodySmall" style={styles.replyText}>
                                  {reply.text}
                                </AppText>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View
                style={{
                  alignItems: "center",
                  paddingTop: spacing[4],
                }}
              >
                <EmptyState
                  title="No comments yet"
                  body="Be the first to comment."
                  icon={
                    CommentIcon ? <CommentIcon size={42} color={palette.textMuted} /> : undefined
                  }
                />
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheetModal>

        <BottomSheetModal
          ref={shareSheetRef}
          snapPoints={shareSnapPoints}
          index={0}
          enablePanDownToClose
          accessibilityLabel="Share post"
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
              accessibilityHint="Dismisses the post sharing sheet"
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
                      onPress={sendPostToHungryUsers}
                      bottomInset={insets.bottom}
                      accessibilityLabel="Send shared post"
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
                title={directMessagesEnabled ? "Share in Hungry" : "Share post"}
                quickActions={[
                  {
                    key: "copy",
                    label: "Copy link",
                    accessibilityLabel: "Copy post link",
                    icon: ({ color, size }) => <Copy color={color} size={size} />,
                    onPress: copySharePostLink,
                  },
                  {
                    key: "share",
                    label: "Share",
                    accessibilityLabel: "Share post to another app",
                    icon: ({ color, size }) => <Share2 color={color} size={size} />,
                    onPress: () => void sharePostOutsideApp(),
                  },
                ]}
                recipients={directMessagesEnabled ? shareRecipients : []}
                selectedRecipientIds={selectedShareChatIds}
                onToggleRecipient={toggleShareChat}
                onSend={sendPostToHungryUsers}
                lastRecipientId={
                  directMessagesEnabled
                    ? shareRecipients[shareRecipients.length - 1]?.id
                    : undefined
                }
                recipientAccessibilityLabelPrefix="Share post to"
              />
            </BottomSheetScrollView>
          </BottomSheetView>
        </BottomSheetModal>
      </FeedErrorBoundary>
    </SafeAreaView>
  );
}

function keyExtractor(item: HomeFeedItem) {
  return item.id;
}

const createStyles = ({ spacing, radii }: ReturnType<typeof useHungryTheme>) =>
  StyleSheet.create({
    activityButtonWrap: {
      minHeight: 42,
      minWidth: 42,
      position: "relative",
    },
    activityBadge: {
      alignItems: "center",
      borderRadius: radii.pill,
      minWidth: 18,
      paddingHorizontal: spacing[1],
      paddingVertical: 1,
      position: "absolute",
      right: 0,
      top: 0,
    },
    commentText: {
      flexShrink: 1,
      lineHeight: 20,
      width: "100%",
    },
    replyText: {
      flexShrink: 1,
      lineHeight: 18,
      width: "100%",
    },
  });
