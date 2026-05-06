import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  type NativeSyntheticEvent,
  type GestureResponderEvent,
  type TextLayoutEventData,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Bell,
  Heart,
  MessageCircle,
  PlayCircle,
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList } from "@shopify/flash-list";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppHeader,
  AppText,
  Avatar,
  Button,
  EmptyState,
  FeedErrorBoundary,
  FeedStateView,
  HungryLogo,
  IconButton,
  Input,
  Skeleton,
} from "@/components/ui";
import {
  BitesCarousel,
  CircleStoryCarousel,
  FloatingShareSendButton,
  InAppShareCard,
  ZoomableMedia,
} from "@/components/social";
import {
  getHomeFeed,
  getHomeSocialFeed,
  type HomeFeedItem,
  type HomeFeedSection,
} from "@/features/home/feed";
import { ACTIVITY_MESSAGES } from "@/features/home/activity";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { getBuildingById, toSummary } from "@/lib/geo/singaporeBuildings";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useActivityStore } from "@/store/useActivityStore";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useStoryStore } from "@/store/useStoryStore";
import { useSocialStore, type SocialComment, type SocialReply } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import type { StoryItem } from "@/types/domain";

function FeedSkeleton() {
  const { spacing, semanticSpacing, radii, palette } = useHungryTheme();
  return (
    <View style={{ gap: spacing[6], padding: semanticSpacing.screenEdge }}>
      <Skeleton width="60%" height={24} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[4] }}
      >
        <Skeleton width={280} height={200} borderRadius={radii.lg} />
        <Skeleton width={280} height={200} borderRadius={radii.lg} />
      </ScrollView>
    </View>
  );
}

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

type HomeFeedMode = "social" | "review";

type HomeFeedScreenProps = {
  mode?: HomeFeedMode;
};

const DOUBLE_TAP_DELAY_MS = 280;
const COLLAPSED_CAPTION_MAX_CHARS = 118;
const MAP_BUILDING_ID_ALIASES: Record<string, string> = {
  "building-amoy": "hc-amoy",
  "building-lau-pa-sat": "hc-lau-pa-sat",
  "building-maxwell": "hc-maxwell",
};

function formatPostAge(createdAt: string) {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return createdAt;

  const ageMs = Date.now() - timestamp;
  if (ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000) {
    return formatTimeAgo(createdAt);
  }

  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

function formatCollapsedCaption(caption: string) {
  if (caption.length <= COLLAPSED_CAPTION_MAX_CHARS) {
    return caption;
  }

  return `${caption.slice(0, COLLAPSED_CAPTION_MAX_CHARS).trimEnd()}...`;
}

export function HomeFeedScreen({ mode = "social" }: HomeFeedScreenProps) {
  const navigation = useNavigation<RootNavigation>();
  const { width: screenWidth } = useWindowDimensions();
  const theme = useHungryTheme();
  const { palette, spacing, semanticSpacing, radii, shadows, colorScheme } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerActionSize = spacing[8] + spacing[2.5];
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const stories = useStoryStore((state) => state.stories);
  const loadStories = useStoryStore((state) => state.loadStories);
  const interactions = useSocialStore((state) => state.interactions);
  const initializeInteractions = useSocialStore((state) => state.initializeInteractions);
  const togglePostLike = useSocialStore((state) => state.toggleLike);
  const togglePostSave = useSocialStore((state) => state.toggleSave);
  const toggleFavourite = useProfileStore((state) => state.toggleFavourite);
  const incrementPostShare = useSocialStore((state) => state.incrementShare);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const addPostComment = useSocialStore((state) => state.addComment);
  const addPostReply = useSocialStore((state) => state.addReply);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const activityUnreadCount = useActivityStore((state) => state.getUnreadCount());
  const sharePostToChat = useActivityStore((state) => state.sharePostToChat);
  const setSelectedBuilding = useDiscoveryStore((state) => state.setSelectedBuilding);
  const setSelectedFloor = useDiscoveryStore((state) => state.setSelectedFloor);
  const setHighlightedStallVenueId = useDiscoveryStore((state) => state.setHighlightedStallVenueId);
  const storyCarouselItems = useMemo<StoryItem[]>(() => {
    if (stories.some((story) => story.isOwn)) {
      return stories;
    }

    return [
      {
        id: "your-story-create",
        displayName: "Your Story",
        avatarUrl: profile.avatarUrl || "https://i.pravatar.cc/150?u=me",
        hasUnseen: false,
        isStall: false,
        isOwn: true,
      },
      ...stories,
    ];
  }, [profile.avatarUrl, stories]);

  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [sections, setSections] = useState<HomeFeedSection[]>([]);
  const [socialFeed, setSocialFeed] = useState<HomeFeedItem[]>([]);
  const [activeCommentItem, setActiveCommentItem] = useState<HomeFeedItem | null>(null);
  const [activeShareItem, setActiveShareItem] = useState<HomeFeedItem | null>(null);
  const [selectedShareChatIds, setSelectedShareChatIds] = useState<string[]>([]);
  const [draftComment, setDraftComment] = useState("");
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [captionOverflowByPostId, setCaptionOverflowByPostId] = useState<Record<string, boolean>>(
    {},
  );
  const [carouselIndexByPostId, setCarouselIndexByPostId] = useState<Record<string, number>>({});
  const carouselScrollRefs = useRef<Record<string, ScrollView | null>>({});
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const shareSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<any>(null);
  const commentSnapPoints = useMemo(() => ["50%", "88%"], []);
  const shareSnapPoints = useMemo(() => ["45%"], []);
  const lastImageTapRef = useRef<{ postId: string; at: number } | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartBurstAnim = useRef(new Animated.Value(0)).current;
  const [heartBurst, setHeartBurst] = useState<{
    postId: string;
    key: number;
    originX: number;
    originY: number;
  } | null>(null);

  const loadFeed = useCallback(async () => {
    setFeedState("loading");
    try {
      const data = await getHomeFeed(profile);
      const socialData = await getHomeSocialFeed(profile);
      setSections(data);
      setSocialFeed(socialData);
      initializeInteractions([...socialData, ...data.flatMap((section) => section.items)]);
      setFeedState("ready");
    } catch {
      setFeedState("error");
    }
  }, [initializeInteractions, profile]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const openComments = useCallback((item: HomeFeedItem) => {
    setActiveCommentItem(item);
    setDraftComment("");
    setActiveReplyCommentId(null);
    requestAnimationFrame(() => {
      commentsSheetRef.current?.present();
      commentsSheetRef.current?.snapToIndex(0);
    });
  }, []);

  const openShareSheet = useCallback((item: HomeFeedItem) => {
    setActiveShareItem(item);
    setSelectedShareChatIds([]);
    requestAnimationFrame(() => {
      shareSheetRef.current?.present();
    });
  }, []);

  const toggleShareChat = useCallback((chatId: string) => {
    setSelectedShareChatIds((current) =>
      current.includes(chatId)
        ? current.filter((candidate) => candidate !== chatId)
        : [...current, chatId],
    );
  }, []);

  const sendPostToHungryUsers = useCallback(() => {
    if (!activeShareItem || selectedShareChatIds.length === 0) return;

    selectedShareChatIds.forEach((chatId) => {
      sharePostToChat(chatId, {
        postId: activeShareItem.id,
        title: activeShareItem.dishes[0]?.name ?? activeShareItem.venue.name,
        subtitle: `${activeShareItem.venue.name} · ${activeShareItem.authorName}`,
        imageUrl: activeShareItem.mediaUrl,
        authorName: activeShareItem.authorName,
      });
    });
    incrementPostShare(activeShareItem.id);
    setActiveShareItem(null);
    setSelectedShareChatIds([]);
    shareSheetRef.current?.dismiss();
  }, [activeShareItem, incrementPostShare, sharePostToChat, selectedShareChatIds]);

  const resetShareSheet = useCallback(() => {
    setSelectedShareChatIds([]);
    setActiveShareItem(null);
  }, []);

  const copySharePostLink = useCallback(() => {
    if (!activeShareItem) return;
    const firstDish = activeShareItem.dishes[0]?.name ?? "Dish";
    Clipboard.setString(`${firstDish} - Hungry: ${activeShareItem.venue.name}`);
  }, [activeShareItem]);

  const sharePostOutsideApp = useCallback(async () => {
    if (!activeShareItem) return;
    await Share.share({
      message: `${activeShareItem.dishes[0]?.name ?? "Post"} at ${
        activeShareItem.venue.name
      }. ${activeShareItem.caption}`,
    });
  }, [activeShareItem]);

  const openUserProfile = useCallback(
    (authorName: string, authorAvatarUrl?: string, authorLocation?: string) => {
      navigation.navigate("UserProfile", {
        authorName,
        authorAvatarUrl,
        authorLocation,
      });
    },
    [navigation],
  );

  const openVenueOnMap = useCallback(
    (item: HomeFeedItem) => {
      const mapBuildingId = MAP_BUILDING_ID_ALIASES[item.buildingId] ?? item.buildingId;
      const mapBuilding = getBuildingById(mapBuildingId);
      if (mapBuilding) {
        setSelectedBuilding(toSummary(mapBuilding));
      }
      setSelectedFloor(item.venue.floor);
      setHighlightedStallVenueId(item.venueId);
      navigation.navigate("DiscoverMap");
    },
    [navigation, setHighlightedStallVenueId, setSelectedBuilding, setSelectedFloor],
  );

  const handlePostSave = useCallback(
    (item: HomeFeedItem) => {
      void togglePostSave(item.id);
      const primaryDish = item.dishes?.[0];
      if (primaryDish?.id) {
        toggleFavourite(primaryDish);
      }
    },
    [toggleFavourite, togglePostSave],
  );

  const handleCaptionTextLayout = useCallback(
    (postId: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const isOverflowing = event.nativeEvent.lines.length > 2;
      setCaptionOverflowByPostId((current) =>
        current[postId] === isOverflowing || (current[postId] && !isOverflowing)
          ? current
          : { ...current, [postId]: isOverflowing },
      );
    },
    [],
  );

  const commentsForActiveItem = useMemo(() => {
    if (!activeCommentItem) {
      return [];
    }

    const seededComments: SocialComment[] = (activeCommentItem.dishes[0]?.reviews ?? []).map(
      (review) => ({
        id: review.id,
        authorName: review.authorName,
        authorAvatarUrl: undefined,
        text: review.text,
        createdAt: new Date().toISOString(),
      }),
    );

    const localComments = commentsByPostId[activeCommentItem.id] ?? [];

    return [...seededComments, ...localComments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeCommentItem, commentsByPostId]);

  const handlePostCommentOrReply = useCallback(() => {
    if (!activeCommentItem || !draftComment.trim().length) return;

    if (activeReplyCommentId) {
      const newReply: SocialReply = {
        id: `reply-${Date.now()}`,
        parentCommentId: activeReplyCommentId,
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
      actionOverlayBg: "rgba(255,255,255,0.85)",
      isDark,
    };
  }, [palette, colorScheme]);

  const navigateToDish = useCallback(
    (dishId: string) => {
      navigation.navigate("DishDetail", { dishId });
    },
    [navigation],
  );

  const runDoubleTapHeartAnimation = useCallback(
    (postId: string, origin: { x: number; y: number }) => {
      setHeartBurst({
        postId,
        key: Date.now(),
        originX: origin.x,
        originY: origin.y,
      });
      heartBurstAnim.stopAnimation();
      heartBurstAnim.setValue(0);
      Animated.timing(heartBurstAnim, {
        toValue: 1,
        duration: 980,
        useNativeDriver: true,
      }).start(() => {
        setHeartBurst((current) => (current?.postId === postId ? null : current));
      });
    },
    [heartBurstAnim],
  );

  const handlePostImagePress = useCallback(
    (
      item: HomeFeedItem,
      event: GestureResponderEvent,
      options?: {
        isCarousel?: boolean;
        carouselPostKey?: string;
        slideCount?: number;
      },
    ) => {
      const tapOrigin = {
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      };
      const now = Date.now();
      const lastTap = lastImageTapRef.current;

      if (lastTap?.postId === item.id && now - lastTap.at <= DOUBLE_TAP_DELAY_MS) {
        lastImageTapRef.current = null;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }

        if (!interactions[item.id]?.liked) {
          void togglePostLike(item.id);
        }
        runDoubleTapHeartAnimation(item.id, tapOrigin);
        return;
      }

      lastImageTapRef.current = { postId: item.id, at: now };
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        if (options?.isCarousel && options.carouselPostKey && (options.slideCount ?? 0) > 1) {
          const slideCount = options.slideCount ?? 0;
          const currentIndex = carouselIndexByPostId[options.carouselPostKey] ?? 0;
          const roundedIndex = Math.round(currentIndex);
          const isRightTap = tapOrigin.x >= screenWidth / 2;
          const nextIndex = isRightTap
            ? Math.min(roundedIndex + 1, slideCount - 1)
            : Math.max(roundedIndex - 1, 0);
          const clampedIndex = Math.max(0, Math.min(nextIndex, slideCount - 1));

          if (clampedIndex !== roundedIndex) {
            setCarouselIndexByPostId((current) => {
              const isAlreadyAtTarget =
                Math.abs((current[options.carouselPostKey!] ?? 0) - clampedIndex) < 0.0005;

              if (isAlreadyAtTarget) {
                return current;
              }

              return {
                ...current,
                [options.carouselPostKey!]: clampedIndex,
              };
            });

            const carouselScrollRef = carouselScrollRefs.current[options.carouselPostKey];
            if (carouselScrollRef) {
              carouselScrollRef.scrollTo({
                x: clampedIndex * screenWidth,
                animated: true,
              });
            }
          }
        }
        lastImageTapRef.current = null;
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY_MS);
    },
    [interactions, runDoubleTapHeartAnimation, togglePostLike, carouselIndexByPostId, screenWidth],
  );

  const handleStoryPress = useCallback(
    (story: StoryItem) => {
      if (story.isOwn) {
        const ownStory = stories.find((candidate) => candidate.isOwn);
        if (ownStory) {
          navigation.navigate("StoryViewer", { initialStoryId: ownStory.id });
          return;
        }
        navigation.navigate("AddStory");
        return;
      }
      navigation.navigate("StoryViewer", { initialStoryId: story.id });
    },
    [navigation, stories],
  );

  const handleAddStoryPress = useCallback(() => {
    navigation.navigate("AddStory");
  }, [navigation]);

  useEffect(() => {
    if (stories.length === 0) {
      void loadStories();
    }
  }, [loadStories, stories.length]);

  useEffect(
    () => () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    },
    [],
  );

  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

  const renderActivityButton = useCallback(
    () => (
      <View style={styles.activityButtonWrap}>
        <IconButton
          accessibilityLabel="Open activity inbox"
          accessibilityHint="Shows messages, comments, likes, and shares"
          icon={<Bell color={palette.text} size={22} />}
          onPress={() => navigation.navigate("ActivityInbox", { initialTab: "updates" })}
          size={headerActionSize}
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
          title="Hungry"
          showBack={false}
          right={renderActivityButton()}
          horizontalPadding={semanticSpacing.screenEdge}
          titleStyle={{ color: palette.orange }}
        />
        <CircleStoryCarousel
          stories={storyCarouselItems}
          onStoryPress={handleStoryPress}
          onAddStoryPress={handleAddStoryPress}
        />
      </View>
    ),
    [
      handleAddStoryPress,
      handleStoryPress,
      palette.orange,
      renderActivityButton,
      semanticSpacing.screenEdge,
      spacing,
      storyCarouselItems,
    ],
  );
  const listHeader = useMemo(() => renderHeader(), [renderHeader]);

  const renderFeedCard = useCallback(
    (item: HomeFeedItem, cardMode: HomeFeedMode, postPosition = 0) => {
      const interaction = interactions[item.id] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };
      const isLiked = interaction.liked;
      const isSaved = interaction.saved;

      if (cardMode === "social") {
        const imageHeight = Math.min(Math.max(screenWidth * 1.12, 360), 460);
        const authorRowHeight = spacing[3] * 2 + 32;
        const heartOriginX = heartBurst?.postId === item.id ? heartBurst.originX : screenWidth / 2;
        const heartOriginY = heartBurst?.postId === item.id ? heartBurst.originY : imageHeight / 2;
        const likeIconTargetTranslateX = screenWidth - spacing[3] - 12 - heartOriginX;
        const likeIconTargetTranslateY =
          imageHeight + spacing[3] + 32 + spacing[2] + 12 - heartOriginY;
        const isFollowingAuthor = Boolean(followedAuthors[item.authorName]);
        const postAgeLabel = formatPostAge(item.createdAt);
        const mediaUrls =
          item.mediaType === "photo" && item.mediaUrls?.length ? item.mediaUrls : [item.mediaUrl];
        const isCarousel = item.mediaType === "photo" && mediaUrls.length > 1;
        const carouselPostKey = `${cardMode}-${postPosition}-${item.id}`;
        const carouselSlideOptions = mediaUrls.map((uri, index) => ({
          key: `${carouselPostKey}-slide-${index}`,
          uri,
          index,
        }));
        const activeCarouselIndex = Math.min(
          carouselIndexByPostId[carouselPostKey] ?? 0,
          Math.max(carouselSlideOptions.length - 1, 0),
        );
        const postTags =
          (item.tags?.length ? item.tags : item.dishes[0]?.tasteTags)?.slice(0, 4) ?? [];
        const captionOverflows = Boolean(captionOverflowByPostId[item.id]);

        return (
          <View key={item.id} style={[styles.feedItemWrap, { backgroundColor: themeTints.bg }]}>
            {/* Row 1: Profile & Follow */}
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.authorName} profile photo`}
                  hitSlop={8}
                  onPress={() =>
                    openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation)
                  }
                >
                  <Avatar uri={item.authorAvatarUrl} name={item.authorName} size={32} />
                </Pressable>
                <View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.authorName} profile`}
                    hitSlop={8}
                    onPress={() =>
                      openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation)
                    }
                  >
                    <AppText variant="bodySmallBold" style={{ color: themeTints.text }}>
                      {item.authorName}
                    </AppText>
                  </Pressable>
                  <View style={{ alignItems: "center", flexDirection: "row" }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${item.authorLocation} on map`}
                      hitSlop={8}
                      onPress={() => openVenueOnMap(item)}
                    >
                      <AppText variant="micro" tone="secondary">
                        {item.authorLocation}
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${isFollowingAuthor ? "Unfollow" : "Follow"} ${item.authorName}`}
                hitSlop={8}
                onPress={() => toggleAuthorFollow(item.authorName)}
                style={[
                  styles.followButton,
                  {
                    backgroundColor: isFollowingAuthor ? themeTints.cardBg : palette.orange,
                    borderColor: isFollowingAuthor ? palette.border : palette.orange,
                  },
                ]}
              >
                <AppText
                  variant="micro"
                  style={{
                    color: isFollowingAuthor ? themeTints.text : palette.white,
                    fontWeight: "800",
                  }}
                >
                  {isFollowingAuthor ? "Following" : "Follow"}
                </AppText>
              </Pressable>
            </View>

            {/* Image Container */}
            <View style={[styles.imageContainer, { height: imageHeight }]}>
              {isCarousel ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  bounces={false}
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  ref={(ref) => {
                    if (ref) {
                      carouselScrollRefs.current[carouselPostKey] = ref;
                    } else {
                      delete carouselScrollRefs.current[carouselPostKey];
                    }
                  }}
                  onScroll={(event) => {
                    const viewportWidth = Math.max(event.nativeEvent.layoutMeasurement.width, 1);
                    const nextIndex = event.nativeEvent.contentOffset.x / viewportWidth;
                    const clampedIndex = Math.max(
                      0,
                      Math.min(nextIndex, carouselSlideOptions.length - 1),
                    );
                    setCarouselIndexByPostId((current) => {
                      const currentIndex = current[carouselPostKey];
                      if (
                        currentIndex !== undefined &&
                        Math.abs(currentIndex - clampedIndex) < 0.0005
                      ) {
                        return current;
                      }

                      return {
                        ...current,
                        [carouselPostKey]: clampedIndex,
                      };
                    });
                  }}
                  onMomentumScrollEnd={(event) => {
                    const viewportWidth = Math.max(event.nativeEvent.layoutMeasurement.width, 1);
                    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
                    const clampedIndex = Math.max(
                      0,
                      Math.min(nextIndex, carouselSlideOptions.length - 1),
                    );
                    setCarouselIndexByPostId((current) => {
                      if (current[carouselPostKey] === clampedIndex) {
                        return current;
                      }

                      return {
                        ...current,
                        [carouselPostKey]: clampedIndex,
                      };
                    });
                  }}
                  style={StyleSheet.absoluteFill}
                >
                  {carouselSlideOptions.map(({ key, uri }) => (
                    <View
                      key={key}
                      style={[styles.carouselPage, { width: screenWidth, height: imageHeight }]}
                    >
                      <ZoomableMedia
                        uri={uri}
                        type="image"
                        onPress={(event) =>
                          handlePostImagePress(item, event, {
                            isCarousel: true,
                            carouselPostKey,
                            slideCount: carouselSlideOptions.length,
                          })
                        }
                        style={styles.heroImage}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <ZoomableMedia
                  uri={mediaUrls[0]}
                  type={item.mediaType === "video" ? "video" : "image"}
                  onPress={(event) => handlePostImagePress(item, event)}
                  style={styles.heroImage}
                />
              )}

              {isCarousel ? (
                <View pointerEvents="none" style={styles.carouselDots}>
                  {carouselSlideOptions.map(({ key }, index) => {
                    const activeDelta = Math.abs(activeCarouselIndex - index);
                    const dotWidth = activeDelta <= 1 ? 6 + (18 - 6) * (1 - activeDelta) : 6;
                    const dotOpacity = Math.max(0.35, 1 - activeDelta);

                    return (
                      <View
                        key={`${key}-dot-${index}`}
                        style={[
                          styles.carouselDot,
                          { opacity: dotOpacity, width: dotWidth },
                          activeDelta < 0.01 ? styles.carouselDotActive : null,
                        ]}
                      />
                    );
                  })}
                </View>
              ) : null}

              {item.mediaType === "video" ? (
                <View pointerEvents="none" style={styles.playButtonContainer}>
                  <View style={styles.playButtonBackdrop}>
                    <PlayCircle color={palette.white} size={54} strokeWidth={1.4} />
                  </View>
                </View>
              ) : null}

              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={[styles.gradientScrim, { height: "40%", top: "60%" }]}
                pointerEvents="none"
              />

              <View
                style={{
                  position: "absolute",
                  bottom: spacing[3],
                  left: spacing[3],
                  right: spacing[3],
                  gap: spacing[0.5],
                }}
                pointerEvents="box-none"
              >
                <AppText variant="h3" style={{ color: palette.white }}>
                  {item.dishes[0]?.name ?? item.venue.name}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${item.venue.name} on map`}
                  hitSlop={8}
                  onPress={() => openVenueOnMap(item)}
                >
                  <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
                  </AppText>
                </Pressable>
              </View>
            </View>

            {heartBurst?.postId === item.id ? (
              <Animated.View
                key={heartBurst.key}
                pointerEvents="none"
                style={[
                  styles.doubleTapHeart,
                  {
                    top: authorRowHeight + heartBurst.originY - 42,
                    left: heartBurst.originX - 42,
                    opacity: heartBurstAnim.interpolate({
                      inputRange: [0, 0.12, 0.86, 1],
                      outputRange: [0, 1, 1, 0],
                    }),
                    transform: [
                      {
                        translateX: heartBurstAnim.interpolate({
                          inputRange: [0, 0.38, 0.55, 1],
                          outputRange: [
                            0,
                            0,
                            likeIconTargetTranslateX * 0.35,
                            likeIconTargetTranslateX,
                          ],
                        }),
                      },
                      {
                        translateY: heartBurstAnim.interpolate({
                          inputRange: [0, 0.24, 0.42, 1],
                          outputRange: [0, -76, -58, likeIconTargetTranslateY],
                        }),
                      },
                      {
                        scale: heartBurstAnim.interpolate({
                          inputRange: [0, 0.18, 0.34, 0.72, 1],
                          outputRange: [0.7, 1.28, 1.05, 0.82, 0.42],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Heart color={palette.error} fill={palette.error} size={84} strokeWidth={1.5} />
              </Animated.View>
            ) : null}

            {/* Post Details (Below Image) */}
            <View
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[3],
                gap: spacing[2],
              }}
            >
              {/* Row 1: Icons */}
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: spacing[4],
                  }}
                >
                  <Pressable
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Share ${item.dishes[0]?.name ?? item.venue.name} in Hungry`}
                    onPress={() => openShareSheet(item)}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                  >
                    <Send color={themeTints.text} size={24} />
                    {interaction.shareCount > 0 && (
                      <AppText
                        variant="micro"
                        style={{ color: themeTints.text, fontWeight: "600" }}
                      >
                        {interaction.shareCount}
                      </AppText>
                    )}
                  </Pressable>
                  <Pressable
                    hitSlop={10}
                    onPress={() => handlePostSave(item)}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                  >
                    <Bookmark
                      color={isSaved ? palette.orange : themeTints.text}
                      fill={isSaved ? palette.orange : "transparent"}
                      size={24}
                    />
                  </Pressable>
                  <Pressable
                    hitSlop={10}
                    onPress={() => openComments(item)}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                  >
                    <MessageCircle color={themeTints.text} size={24} />
                    {interaction.commentCount > 0 && (
                      <AppText
                        variant="micro"
                        style={{ color: themeTints.text, fontWeight: "600" }}
                      >
                        {interaction.commentCount}
                      </AppText>
                    )}
                  </Pressable>
                  <Pressable
                    hitSlop={10}
                    onPress={() => void togglePostLike(item.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
                  >
                    <Heart
                      color={isLiked ? palette.error : themeTints.text}
                      fill={isLiked ? palette.error : "transparent"}
                      size={24}
                    />
                    {interaction.likeCount > 0 && (
                      <AppText
                        variant="micro"
                        style={{ color: themeTints.text, fontWeight: "600" }}
                      >
                        {interaction.likeCount}
                      </AppText>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Row 2: Caption */}
              <View style={{ gap: spacing[1] }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Read comments for ${item.authorName}'s post`}
                  onPress={() => openComments(item)}
                  hitSlop={6}
                >
                  <AppText
                    variant="bodySmall"
                    numberOfLines={2}
                    onTextLayout={(event) => handleCaptionTextLayout(item.id, event)}
                    style={{
                      color: themeTints.text,
                      textAlign: profile.leftHandedMode ? "right" : "left",
                      marginTop: spacing[1],
                    }}
                  >
                    {captionOverflows ? formatCollapsedCaption(item.caption) : item.caption}
                    {captionOverflows ? (
                      <AppText
                        variant="bodySmall"
                        style={{ color: palette.orange, fontWeight: "900" }}
                      >
                        {" more"}
                      </AppText>
                    ) : null}
                  </AppText>
                </Pressable>
                <AppText
                  variant="micro"
                  tone="secondary"
                  style={{ alignSelf: profile.leftHandedMode ? "flex-end" : "flex-start" }}
                >
                  {postAgeLabel}
                </AppText>
              </View>

              {postTags.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[1] }}>
                  {postTags.map((tag) => (
                    <View
                      key={`${item.id}-${tag}`}
                      style={[
                        styles.postTag,
                        { backgroundColor: palette.bgSoft, borderColor: palette.border },
                      ]}
                    >
                      <AppText variant="micro" tone="secondary" style={{ fontWeight: "800" }}>
                        {tag}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        );
      }

      return (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={
            item.dishes[0]?.id
              ? `Open details for ${item.dishes[0]?.name ?? "dish"}`
              : `Open stall details for ${item.venue.name}`
          }
          onPress={() => {
            const primaryDishId = item.dishes[0]?.id;
            if (primaryDishId) {
              navigateToDish(primaryDishId);
              return;
            }
            navigation.navigate("StallDetail", { venueId: item.venueId });
          }}
          style={[
            shadows.card,
            {
              backgroundColor: themeTints.cardBg,
              borderRadius: radii.lg,
              width: 300,
              overflow: "hidden",
              borderWidth: themeTints.isDark ? 0 : 1,
              borderColor: palette.border,
            },
          ]}
        >
          <Image
            source={{ uri: item.mediaUrls?.[0] ?? item.mediaUrl }}
            style={{ width: "100%", height: 180 }}
            contentFit="cover"
          />

          {/* Interaction Overlay */}
          <View
            style={{
              position: "absolute",
              top: spacing[3],
              left: profile.leftHandedMode ? spacing[3] : undefined,
              right: profile.leftHandedMode ? undefined : spacing[3],
              gap: spacing[2],
            }}
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                void togglePostLike(item.id);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                backgroundColor: themeTints.actionOverlayBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Heart
                color={isLiked ? palette.error : themeTints.text}
                fill={isLiked ? palette.error : "transparent"}
                size={18}
              />
            </Pressable>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                handlePostSave(item);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.pill,
                backgroundColor: themeTints.actionOverlayBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bookmark
                color={isSaved ? palette.orange : themeTints.text}
                fill={isSaved ? palette.orange : "transparent"}
                size={18}
              />
            </Pressable>
          </View>

          <View style={{ padding: spacing[3], gap: spacing[1] }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <AppText
                style={{
                  fontWeight: "800",
                  fontSize: 16,
                  flex: 1,
                  color: themeTints.text,
                }}
                numberOfLines={1}
              >
                {item.dishes[0]?.name ?? item.caption}
              </AppText>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[1],
                }}
              >
                <Star color={palette.amber} fill={palette.amber} size={14} />
                <AppText
                  style={{
                    fontWeight: "700",
                    fontSize: 14,
                    color: themeTints.text,
                  }}
                >
                  {(item.dishes[0]?.rating ?? 4.5).toFixed(1)}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.authorName} profile`}
                onPress={() =>
                  openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation)
                }
              >
                <AppText
                  variant="micro"
                  style={{ color: themeTints.secondaryText }}
                  numberOfLines={1}
                >
                  {item.authorName}
                </AppText>
              </Pressable>
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                {" · "}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.authorLocation} on map`}
                onPress={() => openVenueOnMap(item)}
              >
                <AppText
                  variant="micro"
                  style={{ color: themeTints.secondaryText }}
                  numberOfLines={1}
                >
                  {item.authorLocation}
                </AppText>
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
                marginTop: spacing[2],
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[1],
                  backgroundColor: themeTints.badgeBg,
                  paddingHorizontal: spacing[2],
                  paddingVertical: spacing[1],
                  borderRadius: radii.sm,
                }}
              >
                <MessageCircle color={themeTints.secondaryText} size={12} />
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  {interaction.commentCount}
                </AppText>
              </View>
              {item.dishes[0]?.price && (
                <AppText variant="price" style={{ color: palette.orange, fontSize: 14 }}>
                  S${item.dishes[0].price.toFixed(2)}
                </AppText>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [
      interactions,
      captionOverflowByPostId,
      handleCaptionTextLayout,
      handlePostImagePress,
      heartBurst,
      heartBurstAnim,
      followedAuthors,
      navigateToDish,
      shadows.card,
      themeTints,
      radii,
      palette.border,
      palette.error,
      palette.text,
      palette.orange,
      palette.amber,
      palette.bgSoft,
      spacing,
      togglePostLike,
      handlePostSave,
      toggleAuthorFollow,
      incrementPostShare,
      openShareSheet,
      navigation,
      screenWidth,
      openComments,
      openVenueOnMap,
      openUserProfile,
      profile.leftHandedMode,
      palette.white,
      carouselIndexByPostId,
    ],
  );

  if (feedState === "loading") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: themeTints.bg }}
        edges={["top", "left", "right"]}
      >
        <FeedErrorBoundary
          onRetry={() => {
            void loadFeed();
          }}
        >
          {mode === "social" ? (
            <View
              style={{
                alignItems: "center",
                flex: 1,
                gap: spacing[3],
                justifyContent: "center",
                paddingHorizontal: spacing[3],
              }}
            >
              <ActivityIndicator color={palette.orange} />
              <AppText tone="secondary">Loading your food feed...</AppText>
            </View>
          ) : (
            <ScrollView scrollEnabled={false}>
              {renderHeader()}
              <FeedSkeleton />
              <FeedSkeleton />
            </ScrollView>
          )}
        </FeedErrorBoundary>
      </SafeAreaView>
    );
  }

  if (feedState === "error") {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: themeTints.bg }}
        edges={["top", "left", "right"]}
      >
        <FeedErrorBoundary
          onRetry={() => {
            void loadFeed();
          }}
        >
          <FeedStateView
            state="error"
            title="Something went wrong"
            body="We couldn't load your feed right now. Please check your connection and try again."
            ctaLabel="Retry"
            onPress={loadFeed}
          />
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
        onRetry={() => {
          void loadFeed();
        }}
        title="Feed temporarily unavailable"
        body="A display issue occurred while rendering this feed. Please retry."
      >
        {mode === "social" ? (
          <View style={{ flex: 1 }}>
            <FlashList
              data={socialFeed}
              keyExtractor={keyExtractor}
              ListHeaderComponent={listHeader}
              renderItem={({ item, index }) => renderFeedCard(item, "social", index)}
              // @ts-ignore
              estimatedItemSize={500}
              ListEmptyComponent={
                <EmptyState
                  title="No food stories yet"
                  body="Nothing to show right now. Try Discover to find dishes nearby."
                />
              }
              contentContainerStyle={{
                gap: spacing[2],
                paddingBottom: spacing[16] + insets.bottom + spacing[6],
              }}
              onScroll={onScroll}
              scrollEventThrottle={scrollEventThrottle}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + spacing[24],
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            <AppHeader
              title="Hungry"
              showBack={false}
              right={renderActivityButton()}
              horizontalPadding={semanticSpacing.screenEdge}
              titleStyle={{ color: palette.orange }}
            />
            <View style={{ paddingTop: 0 }}>
              {sections.map((section) => (
                <View key={section.title} style={{ marginBottom: spacing[4] }}>
                  <View
                    style={{
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[3],
                    }}
                  >
                    <AppText variant="h2" style={{ color: themeTints.text }}>
                      {section.title}
                    </AppText>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      gap: spacing[4],
                      paddingHorizontal: spacing[3],
                      paddingBottom: spacing[2],
                    }}
                  >
                    {section.items.map((item, index) => renderFeedCard(item, "review", index))}
                  </ScrollView>
                </View>
              ))}
            </View>

            {sections.length === 0 && (
              <FeedStateView
                state="empty"
                title="Feed is taking a break"
                body="We're still gathering the latest food stories for you. Check back shortly for new recommendations near you!"
              />
            )}
          </Animated.ScrollView>
        )}

        {mode === "social" ? (
          <BottomSheetModal
            ref={commentsSheetRef}
            snapPoints={commentSnapPoints}
            index={1}
            enablePanDownToClose
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
                      <Pressable onPress={() => setActiveReplyCommentId(null)}>
                        <X size={14} color={palette.textMuted} />
                      </Pressable>
                    </View>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: spacing[2],
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Input
                        ref={commentInputRef}
                        placeholder={activeReplyCommentId ? "Write a reply..." : "Add a comment..."}
                        value={draftComment}
                        onChangeText={setDraftComment}
                        multiline
                        style={{ maxHeight: 100 }}
                      />
                    </View>
                    <Pressable
                      onPress={handlePostCommentOrReply}
                      disabled={!draftComment.trim().length}
                      style={{
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[3],
                        opacity: draftComment.trim().length ? 1 : 0.5,
                      }}
                    >
                      <AppText variant="bodyBold" style={{ color: palette.orange }}>
                        Post
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              </BottomSheetFooter>
            )}
          >
            <View
              style={{
                borderBottomWidth: 1,
                borderBottomColor: palette.border,
                paddingVertical: spacing[3],
                alignItems: "center",
              }}
            >
              <AppText variant="h3">Comments</AppText>
            </View>
            <BottomSheetScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[4],
                paddingBottom: spacing[24] + spacing[8] + insets.bottom,
              }}
            >
              {activeCommentItem ? (
                <View
                  style={{
                    backgroundColor: palette.bgSoft,
                    borderColor: palette.border,
                    borderRadius: radii.lg,
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
                        onPress={() =>
                          openUserProfile(
                            comment.authorName,
                            comment.authorAvatarUrl,
                            activeCommentItem?.authorLocation,
                          )
                        }
                      >
                        <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} size={36} />
                      </Pressable>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: spacing[2],
                          }}
                        >
                          <AppText variant="bodySmallBold">{comment.authorName}</AppText>
                          <AppText variant="micro" tone="muted">
                            {formatTimeAgo(comment.createdAt)}
                          </AppText>
                        </View>
                        <AppText variant="bodySmall" style={styles.commentText}>
                          {comment.text}
                        </AppText>
                        <Pressable
                          onPress={() => {
                            setActiveReplyCommentId(comment.id);
                            commentInputRef.current?.focus();
                          }}
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
                        {(repliesByCommentId[comment.id] ?? []).length > 0 && (
                          <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
                            {(repliesByCommentId[comment.id] ?? []).map((reply) => (
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
                                      flexDirection: "row",
                                      alignItems: "center",
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
                  <MessageCircle
                    size={48}
                    color={palette.border}
                    style={{ marginBottom: spacing[4] }}
                  />
                  <AppText tone="secondary">No comments yet</AppText>
                  <AppText variant="bodySmall" tone="muted">
                    Be the first to share your review!
                  </AppText>
                </View>
              )}
            </BottomSheetScrollView>
          </BottomSheetModal>
        ) : null}

        <BottomSheetModal
          ref={shareSheetRef}
          snapPoints={shareSnapPoints}
          index={0}
          enablePanDownToClose
          onDismiss={resetShareSheet}
          backdropComponent={(props) => (
            <BottomSheetBackdrop
              {...props}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              opacity={0.4}
              pressBehavior="close"
            />
          )}
          backgroundStyle={{ backgroundColor: palette.surface }}
          handleIndicatorStyle={{ backgroundColor: palette.border }}
          footerComponent={(props) => (
            <BottomSheetFooter {...props}>
              <FloatingShareSendButton
                selectedCount={selectedShareChatIds.length}
                onPress={sendPostToHungryUsers}
                bottomInset={insets.bottom}
                accessibilityLabel="Send shared post"
                placement="inline"
              />
            </BottomSheetFooter>
          )}
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
                title="Share in Hungry"
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
                recipients={ACTIVITY_MESSAGES}
                selectedRecipientIds={selectedShareChatIds}
                onToggleRecipient={toggleShareChat}
                onSend={sendPostToHungryUsers}
                lastRecipientId={ACTIVITY_MESSAGES[ACTIVITY_MESSAGES.length - 1]?.id}
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

function VerticalActionMetric({
  icon,
  count,
  palette,
}: {
  icon: ReactNode;
  count?: number;
  palette: any;
}) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      {icon}
      {count !== undefined && (
        <AppText variant="micro" style={{ color: palette.white, fontWeight: "600" }}>
          {count}
        </AppText>
      )}
    </View>
  );
}

const createStyles = ({ palette, spacing, radii }: ReturnType<typeof useHungryTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
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
    feedItemWrap: {
      backgroundColor: palette.navy,
      marginBottom: spacing[6],
      overflow: "visible",
      position: "relative",
    },
    followButton: {
      alignItems: "center",
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 32,
      minWidth: 78,
      paddingHorizontal: spacing[3],
    },
    carouselPage: {
      overflow: "hidden",
      position: "relative",
    },
    carouselDots: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[1],
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: spacing[3],
    },
    carouselDot: {
      backgroundColor: "rgba(255,255,255,0.48)",
      borderRadius: radii.pill,
      height: 6,
      width: 6,
    },
    carouselDotActive: {
      backgroundColor: palette.white,
      width: 18,
    },
    postTag: {
      borderRadius: radii.pill,
      borderWidth: 1,
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
    },
    imageContainer: {
      width: "100%",
      position: "relative",
      backgroundColor: palette.navy,
    },
    heroImage: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    doubleTapHeart: {
      alignItems: "center",
      height: 84,
      justifyContent: "center",
      position: "absolute",
      width: 84,
      zIndex: 30,
    },
    gradientScrim: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      height: "100%",
    },
    overlayContent: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: "flex-end",
    },
    overlayTopRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    textOverlay: {
      flex: 1,
      marginRight: 12,
    },
    sideActions: {
      alignItems: "center",
    },
    verticalActionMetric: {
      alignItems: "center",
      gap: 4,
    },
    captionOverlay: {
      marginTop: 8,
    },
    playButtonContainer: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1,
    },
    playButtonBackdrop: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    quickPostRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    quickPostButton: {
      borderWidth: 1,
      minHeight: 36,
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
    storyRing: {
      backgroundColor: palette.surface,
      borderWidth: 2,
    },
    storyLabel: {
      textAlign: "center",
    },
    sectionEyebrow: {
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
  });
