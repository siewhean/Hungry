import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MessageCircleMore,
  MoreHorizontal,
  Send,
} from "lucide-react-native";

import { AppText, Avatar } from "@/components/ui";
import { ZoomableMedia } from "@/components/social/ZoomableMedia";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { formatVenueLine, type HomeFeedItem } from "@/features/home/feed";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";

const CommentIcon = MessageCircle ?? MessageCircleMore;

const DOUBLE_TAP_DELAY_MS = 280;
export const COLLAPSED_CAPTION_MAX_CHARS = 118;

type HapticsModule = typeof import("@/lib/haptics");
let hapticsModule: HapticsModule | null | undefined;

async function triggerDoubleTapHaptic() {
  try {
    if (hapticsModule === undefined) {
      hapticsModule = await import("@/lib/haptics");
    }
    await hapticsModule?.impactAsync(hapticsModule.ImpactFeedbackStyle.Light);
  } catch {
    hapticsModule = null;
  }
}

export function formatPostAge(createdAt: string) {
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

export function formatCollapsedCaption(caption: string) {
  if (caption.length <= COLLAPSED_CAPTION_MAX_CHARS) {
    return caption;
  }

  return `${caption.slice(0, COLLAPSED_CAPTION_MAX_CHARS).trimEnd()}...`;
}

/**
 * Everything a card does goes through these callbacks, so the screen can hand every card
 * the same object and a like on one post does not re-render the others.
 */
export interface FeedPostCardActions {
  like: (item: HomeFeedItem) => void;
  save: (item: HomeFeedItem) => void;
  share: (item: HomeFeedItem) => void;
  openComments: (item: HomeFeedItem) => void;
  openMenu: (item: HomeFeedItem) => void;
  /** Follow, unfollow, or cancel a pending request (the screen gates it on sign-in). */
  toggleFollow: (item: HomeFeedItem) => void;
  openProfile: (item: HomeFeedItem) => void;
  /** The dish, or the stall when the dish is not in the local catalog. */
  openDish: (item: HomeFeedItem) => void;
  /** The venue on the map, or its stall page when the map is not available. */
  openVenue: (item: HomeFeedItem) => void;
  prefetchProfile: (item: HomeFeedItem) => void;
  prefetchVenue: (item: HomeFeedItem) => void;
  prefetchDish: (item: HomeFeedItem) => void;
  /** Opens the post's own screen. Left out on that screen. */
  openPost?: (item: HomeFeedItem) => void;
}

interface FeedPostCardProps {
  item: HomeFeedItem;
  actions: FeedPostCardActions;
  /** True for the one video that may play. */
  isVideoActive: boolean;
  canAccessMap: boolean;
  canShowFollow: boolean;
  commentsEnabled: boolean;
  leftHandedMode: boolean;
  /** The viewer's account id; the viewer's own posts show no Follow button. */
  viewerId: string;
}

const EMPTY_INTERACTION = {
  liked: false,
  saved: false,
  likeCount: 0,
  saveCount: 0,
  shareCount: 0,
  commentCount: 0,
};

/**
 * One post in the feed: author row with Follow, the photo carousel or video, the dish and
 * venue overlay, the action row and the caption. Used by Home and by the post detail screen.
 * It owns its carousel position, caption state and heart burst, and reads its own counts
 * from the social store, so only the card that changed re-renders.
 */
function FeedPostCardImpl({
  item,
  actions,
  isVideoActive,
  canAccessMap,
  canShowFollow,
  commentsEnabled,
  leftHandedMode,
  viewerId,
}: FeedPostCardProps) {
  const theme = useHungryTheme();
  const { palette, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width: screenWidth } = useWindowDimensions();

  const interaction = useSocialStore((state) => state.interactions[item.id]) ?? EMPTY_INTERACTION;
  const followTargetId = item.authorId;
  const isFollowingAuthor = useSocialStore((state) =>
    followTargetId
      ? Boolean(state.followedUserIds[followTargetId])
      : Boolean(state.followedAuthors[item.authorName]),
  );
  // Pending request to a private account: tapping again cancels it.
  const isFollowRequested = useSocialStore((state) =>
    Boolean(
      followTargetId &&
      !state.followedUserIds[followTargetId] &&
      state.requestedUserIds[followTargetId],
    ),
  );
  const isLiked = interaction.liked;
  const isSaved = Boolean(interaction.saved);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselIndexRef = useRef(0);
  const carouselScrollRef = useRef<ScrollView | null>(null);
  const [captionOverflow, setCaptionOverflow] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [heartBurst, setHeartBurst] = useState<{ key: number; x: number; y: number } | null>(null);
  const [heartBurstAnim] = useState(() => new Animated.Value(0));
  const lastTapAtRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    },
    [],
  );

  const isVideo = item.mediaType === "video";
  useEffect(() => {
    if (isVideo && isVideoActive) {
      trackAnalyticsEvent("video_play", { post_id: item.id });
    }
  }, [isVideo, isVideoActive, item.id]);

  const imageHeight = Math.min(Math.max(screenWidth * 1.12, 360), 460);
  const authorRowHeight = spacing[3] * 2 + 32;
  const mediaUrls =
    item.mediaType === "photo" && item.mediaUrls?.length ? item.mediaUrls : [item.mediaUrl];
  const isCarousel = item.mediaType === "photo" && mediaUrls.length > 1;
  const activeCarouselIndex = Math.min(carouselIndex, Math.max(mediaUrls.length - 1, 0));
  const postTags = (item.tags?.length ? item.tags : item.dishes[0]?.tasteTags)?.slice(0, 4) ?? [];
  // onTextLayout may not report lines on Android: length is the fallback signal.
  const captionOverflows = captionOverflow || item.caption.length > COLLAPSED_CAPTION_MAX_CHARS;
  const actionTargetName = item.dishes[0]?.name ?? item.venue.name;
  const shouldShowFoodContextOverlay = item.showFoodContextOverlay !== false;
  const isOwnAuthor = Boolean(followTargetId && followTargetId === viewerId);
  const isFollowMuted = isFollowingAuthor || isFollowRequested;
  const postAgeLabel = formatPostAge(item.createdAt);
  const venueLine = formatVenueLine(item.venue);
  const venueLabel = canAccessMap ? `Show ${item.venue.name} on map` : `Open ${item.venue.name}`;
  const mediaHint = isCarousel
    ? "Tap the left or right side to change photo. Double tap to like."
    : "Double tap to like.";

  const likeIconTargetTranslateX =
    screenWidth - spacing[3] - 12 - (heartBurst?.x ?? screenWidth / 2);
  const likeIconTargetTranslateY =
    imageHeight + spacing[3] + 32 + spacing[2] + 12 - (heartBurst?.y ?? imageHeight / 2);

  const runHeartBurst = useCallback(
    (origin: { x: number; y: number }) => {
      setHeartBurst({ key: Date.now(), x: origin.x, y: origin.y });
      heartBurstAnim.stopAnimation();
      heartBurstAnim.setValue(0);
      Animated.timing(heartBurstAnim, {
        toValue: 1,
        duration: 980,
        useNativeDriver: true,
      }).start(() => setHeartBurst(null));
    },
    [heartBurstAnim],
  );

  const likeFromDoubleTap = useCallback(
    (origin: { x: number; y: number }) => {
      if (!useSocialStore.getState().interactions[item.id]?.liked) {
        actions.like(item);
      } else {
        void triggerDoubleTapHaptic();
      }
      runHeartBurst(origin);
    },
    [actions, item, runHeartBurst],
  );

  const moveCarousel = useCallback(
    (tapX: number) => {
      const slideCount = mediaUrls.length;
      const roundedIndex = Math.round(carouselIndexRef.current);
      const nextIndex = tapX >= screenWidth / 2 ? roundedIndex + 1 : roundedIndex - 1;
      const clamped = Math.max(0, Math.min(nextIndex, slideCount - 1));
      if (clamped === roundedIndex) return;
      carouselIndexRef.current = clamped;
      setCarouselIndex(clamped);
      carouselScrollRef.current?.scrollTo({ x: clamped * screenWidth, animated: true });
    },
    [mediaUrls.length, screenWidth],
  );

  const handleImagePress = useCallback(
    (event: GestureResponderEvent, carousel: boolean) => {
      const origin = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const now = Date.now();
      if (now - lastTapAtRef.current <= DOUBLE_TAP_DELAY_MS) {
        lastTapAtRef.current = 0;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        likeFromDoubleTap(origin);
        return;
      }
      lastTapAtRef.current = now;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        if (carousel) moveCarousel(origin.x);
        lastTapAtRef.current = 0;
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY_MS);
    },
    [likeFromDoubleTap, moveCarousel],
  );

  const handleCaptionTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const isOverflowing = event.nativeEvent.lines.length > 2;
      setCaptionOverflow((current) =>
        current === isOverflowing || current ? current : isOverflowing,
      );
    },
    [],
  );

  const openProfile = () => actions.openProfile(item);
  const countStyle = { color: palette.text, fontWeight: "600" as const };

  return (
    <View style={[styles.feedItemWrap, { backgroundColor: palette.bg }]}>
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
        <View
          style={{
            alignItems: "center",
            flex: 1,
            flexDirection: "row",
            gap: spacing[2],
            minWidth: 0,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.authorName} profile photo`}
            hitSlop={8}
            onPressIn={() => actions.prefetchProfile(item)}
            onPress={openProfile}
          >
            <Avatar uri={item.authorAvatarUrl} name={item.authorName} size={32} />
          </Pressable>
          <View style={{ flexShrink: 1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.authorName} profile`}
              hitSlop={8}
              onPressIn={() => actions.prefetchProfile(item)}
              onPress={openProfile}
            >
              <AppText variant="bodySmallBold" style={{ color: palette.text }} numberOfLines={1}>
                {item.authorName}
              </AppText>
            </Pressable>
            {/* The overlay already names the venue; the header carries the time. */}
            {shouldShowFoodContextOverlay ? (
              <AppText variant="micro" tone="secondary">
                {postAgeLabel}
              </AppText>
            ) : (
              <View style={{ alignItems: "center", flexDirection: "row" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={venueLabel}
                  hitSlop={8}
                  onPressIn={() => actions.prefetchVenue(item)}
                  onPress={() => actions.openVenue(item)}
                >
                  <AppText variant="micro" tone="secondary" numberOfLines={1}>
                    {item.venue.name}
                  </AppText>
                </Pressable>
                <AppText variant="micro" tone="secondary">
                  {` · ${postAgeLabel}`}
                </AppText>
              </View>
            )}
          </View>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
          {!isOwnAuthor && canShowFollow ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isFollowRequested ? "Cancel follow request to" : isFollowingAuthor ? "Unfollow" : "Follow"} ${item.authorName}`}
              hitSlop={8}
              onPress={() => actions.toggleFollow(item)}
              style={[
                styles.followButton,
                {
                  // orangeControl keeps the white micro label above 4.5:1.
                  backgroundColor: isFollowMuted ? palette.surface : palette.orangeControl,
                  borderColor: isFollowMuted ? palette.border : palette.orangeControl,
                },
              ]}
            >
              <AppText
                variant="micro"
                style={{
                  color: isFollowMuted ? palette.text : palette.white,
                  fontWeight: "800",
                }}
              >
                {isFollowRequested ? "Requested" : isFollowingAuthor ? "Following" : "Follow"}
              </AppText>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${item.authorName}'s post`}
            hitSlop={10}
            onPress={() => actions.openMenu(item)}
            style={styles.moreAction}
          >
            <MoreHorizontal color={palette.text} size={20} />
          </Pressable>
        </View>
      </View>

      {/* Image Container */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {isCarousel ? (
          <ScrollView
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            ref={carouselScrollRef}
            // State is written only when the rounded page index changes, not every
            // scroll frame. onScroll (not onMomentumScrollEnd) so web updates too.
            scrollEventThrottle={16}
            onScroll={(event) => {
              const viewportWidth = Math.max(event.nativeEvent.layoutMeasurement.width, 1);
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
              const clamped = Math.max(0, Math.min(nextIndex, mediaUrls.length - 1));
              carouselIndexRef.current = clamped;
              setCarouselIndex((current) => (current === clamped ? current : clamped));
            }}
            style={StyleSheet.absoluteFill}
          >
            {mediaUrls.map((uri, index) => (
              <View
                key={`${item.id}-slide-${index}`}
                style={[styles.carouselPage, { width: screenWidth, height: imageHeight }]}
              >
                <ZoomableMedia
                  uri={uri}
                  type="image"
                  accessibilityLabel={`${actionTargetName} post image ${index + 1} of ${mediaUrls.length}`}
                  accessibilityHint={mediaHint}
                  onPress={(event) => handleImagePress(event, true)}
                  style={styles.heroImage}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <ZoomableMedia
            uri={mediaUrls[0] ?? item.mediaUrl}
            type={isVideo ? "video" : "image"}
            accessibilityLabel={`${actionTargetName} post ${isVideo ? "video" : "image"}`}
            accessibilityHint={mediaHint}
            onPress={(event) => handleImagePress(event, false)}
            isActive={isVideoActive}
            onDoubleTap={likeFromDoubleTap}
            style={styles.heroImage}
          />
        )}

        {isCarousel ? (
          <View pointerEvents="none" style={styles.carouselDots}>
            {mediaUrls.map((_uri, index) => {
              const activeDelta = Math.abs(activeCarouselIndex - index);
              const dotWidth = activeDelta <= 1 ? 6 + (18 - 6) * (1 - activeDelta) : 6;
              const dotOpacity = Math.max(0.35, 1 - activeDelta);

              return (
                <View
                  key={`${item.id}-dot-${index}`}
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

        {shouldShowFoodContextOverlay ? (
          <>
            <LinearGradient
              colors={["transparent", palette.mediaScrimStrong]}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  item.dishes[0]?.id
                    ? `Open ${item.dishes[0]?.name ?? "dish"}`
                    : `Open ${item.venue.name}`
                }
                hitSlop={8}
                onPressIn={() => actions.prefetchDish(item)}
                onPress={() => actions.openDish(item)}
              >
                <AppText variant="h3" style={{ color: palette.white }}>
                  {item.dishes[0]?.name ?? item.venue.name}
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={venueLabel}
                hitSlop={8}
                onPressIn={() => actions.prefetchVenue(item)}
                onPress={() => actions.openVenue(item)}
              >
                <AppText variant="micro" style={{ color: palette.inverseTextSecondary }}>
                  {venueLine}
                </AppText>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>

      {heartBurst ? (
        <Animated.View
          key={heartBurst.key}
          pointerEvents="none"
          style={[
            styles.doubleTapHeart,
            {
              top: authorRowHeight + heartBurst.y - 42,
              left: heartBurst.x - 42,
              opacity: heartBurstAnim.interpolate({
                inputRange: [0, 0.12, 0.86, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateX: heartBurstAnim.interpolate({
                    inputRange: [0, 0.38, 0.55, 1],
                    outputRange: [0, 0, likeIconTargetTranslateX * 0.35, likeIconTargetTranslateX],
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
              accessibilityLabel={`Share ${actionTargetName} in Hungry`}
              accessibilityHint="Opens sharing options for this post"
              onPress={() => actions.share(item)}
              style={styles.actionButton}
            >
              <Send color={palette.text} size={24} />
              {interaction.shareCount > 0 && (
                <AppText variant="micro" style={countStyle}>
                  {interaction.shareCount}
                </AppText>
              )}
            </Pressable>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${isSaved ? "Unsave" : "Save"} ${actionTargetName}`}
              accessibilityHint={
                isSaved
                  ? "Removes this post from your saved items"
                  : "Adds this post and its dish to your saved items"
              }
              accessibilityState={{ selected: isSaved }}
              onPress={() => actions.save(item)}
              style={styles.actionButton}
            >
              <Bookmark
                color={isSaved ? palette.orange : palette.text}
                fill={isSaved ? palette.orange : "transparent"}
                size={24}
              />
            </Pressable>
            {commentsEnabled ? (
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Comment on ${actionTargetName}`}
                accessibilityHint="Opens the comments for this post"
                onPress={() => actions.openComments(item)}
                style={styles.actionButton}
              >
                {CommentIcon ? <CommentIcon color={palette.text} size={24} /> : null}
                {interaction.commentCount > 0 && (
                  <AppText variant="micro" style={countStyle}>
                    {interaction.commentCount}
                  </AppText>
                )}
              </Pressable>
            ) : null}
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${isLiked ? "Unlike" : "Like"} ${actionTargetName}`}
              accessibilityHint={
                isLiked ? "Removes your like from this post" : "Adds a like to this post"
              }
              accessibilityState={{ selected: isLiked }}
              onPress={() => actions.like(item)}
              style={styles.actionButton}
            >
              <Heart
                color={isLiked ? palette.error : palette.text}
                fill={isLiked ? palette.error : "transparent"}
                size={24}
              />
              {interaction.likeCount > 0 && (
                <AppText variant="micro" style={countStyle}>
                  {interaction.likeCount}
                </AppText>
              )}
            </Pressable>
          </View>
        </View>

        {/* Row 2: Caption */}
        <View style={{ gap: spacing[1] }}>
          {/* A collapsed caption expands in place; comments stay on the comment button. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              captionOverflows && !isCaptionExpanded
                ? `Show the full caption of ${item.authorName}'s post`
                : actions.openPost
                  ? `Open ${item.authorName}'s post`
                  : `${item.authorName}'s caption`
            }
            accessibilityState={captionOverflows ? { expanded: isCaptionExpanded } : undefined}
            onPress={() => {
              if (captionOverflows && !isCaptionExpanded) {
                setIsCaptionExpanded(true);
                return;
              }
              actions.openPost?.(item);
            }}
            hitSlop={6}
          >
            <AppText
              variant="bodySmall"
              numberOfLines={isCaptionExpanded ? undefined : 2}
              onTextLayout={handleCaptionTextLayout}
              style={{
                color: palette.text,
                textAlign: leftHandedMode ? "right" : "left",
                marginTop: spacing[1],
              }}
            >
              {captionOverflows && !isCaptionExpanded
                ? formatCollapsedCaption(item.caption)
                : item.caption}
              {captionOverflows && !isCaptionExpanded ? (
                <AppText
                  variant="bodySmall"
                  style={{ color: palette.orangeText, fontWeight: "900" }}
                >
                  {" more"}
                </AppText>
              ) : null}
            </AppText>
          </Pressable>
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

export const FeedPostCard = memo(FeedPostCardImpl);

const createStyles = ({ palette, spacing, radii }: ReturnType<typeof useHungryTheme>) =>
  StyleSheet.create({
    feedItemWrap: {
      marginBottom: spacing[6],
      overflow: "visible",
      position: "relative",
    },
    followButton: {
      alignItems: "center",
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      minWidth: 78,
      paddingHorizontal: spacing[3],
    },
    moreAction: {
      alignItems: "center",
      borderRadius: radii.pill,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    actionButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[1],
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
      backgroundColor: palette.inverseIndicator,
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
  });
