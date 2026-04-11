import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Heart, MessageCircle, PlayCircle, Send } from "lucide-react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, EmptyState } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, type HomeFeedItem } from "@/features/home/feed";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

type InteractionState = {
  liked: boolean;
  saved: boolean;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
};

export function HomeFeedScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [feed, setFeed] = useState<HomeFeedItem[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [interactionByPostId, setInteractionByPostId] = useState<Record<string, InteractionState>>({});
  const [activeCommentItem, setActiveCommentItem] = useState<HomeFeedItem | null>(null);
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const commentSnapPoints = useMemo(() => ["50%", "88%"], []);
  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();
  const stories = useMemo(() => feed.slice(0, 5), [feed]);
  const isCompact = screenWidth < 390;

  const loadFeed = useCallback(() => {
    try {
      const nextFeed = getHomeFeed(useProfileStore.getState().profile);
      setFeed(nextFeed);
      setInteractionByPostId((current) => {
        const next = { ...current };

        nextFeed.forEach((item) => {
          if (next[item.id]) {
            return;
          }
          const leadDish = item.dishes[0];
          const baseComments = leadDish?.reviews.length ?? 0;
          next[item.id] = {
            liked: false,
            saved: false,
            likeCount: baseComments,
            saveCount: 0,
            shareCount: 0,
            commentCount: baseComments,
          };
        });

        return next;
      });
      setFeedState("ready");
    } catch {
      setFeedState("error");
    }
  }, []);

  useEffect(() => {
    setFeedState("loading");
    const timer = setTimeout(() => loadFeed(), 180);
    return () => clearTimeout(timer);
  }, [loadFeed]);

  const navigateToStall = useCallback(
    (venueId: string) => navigation.navigate("StallDetail", { venueId }),
    [navigation],
  );

  const navigateToDish = useCallback(
    (dishId: string) => navigation.navigate("DishDetail", { dishId }),
    [navigation],
  );

  const toggleExpandedPost = useCallback((postId: string) => {
    setExpandedPostId((current) => (current === postId ? null : postId));
  }, []);

  const toggleLike = useCallback((postId: string) => {
    setInteractionByPostId((current) => {
      const previous = current[postId];
      if (!previous) {
        return current;
      }

      const nextLiked = !previous.liked;
      return {
        ...current,
        [postId]: {
          ...previous,
          liked: nextLiked,
          likeCount: Math.max(0, previous.likeCount + (nextLiked ? 1 : -1)),
        },
      };
    });
  }, []);

  const toggleSave = useCallback((postId: string) => {
    setInteractionByPostId((current) => {
      const previous = current[postId];
      if (!previous) {
        return current;
      }
      const nextSaved = !previous.saved;
      return {
        ...current,
        [postId]: {
          ...previous,
          saved: nextSaved,
          saveCount: Math.max(0, previous.saveCount + (nextSaved ? 1 : -1)),
        },
      };
    });
  }, []);

  const incrementShare = useCallback((postId: string) => {
    setInteractionByPostId((current) => {
      const previous = current[postId];
      if (!previous) {
        return current;
      }
      return {
        ...current,
        [postId]: {
          ...previous,
          shareCount: previous.shareCount + 1,
        },
      };
    });
  }, []);

  const openComments = useCallback((item: HomeFeedItem) => {
    setActiveCommentItem(item);
    requestAnimationFrame(() => {
      commentsSheetRef.current?.present();
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: HomeFeedItem; index: number }) => {
      const leadDish = item.dishes[0];
      const isExpanded = expandedPostId === item.id;
      const interaction = interactionByPostId[item.id] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: leadDish?.reviews.length ?? 0,
      };
      const reactionCount = interaction.likeCount;
      const commentCount = interaction.commentCount;
      const bookmarkCount = interaction.saveCount;
      const shareCount = interaction.shareCount;
      const isLiked = interaction.liked;
      const isSaved = interaction.saved;

      // Instagram-style portrait aspect ratio (4:5)
      const imageAspectRatio = 4 / 5;
      const imageHeight = screenWidth / imageAspectRatio;

      return (
        <View style={styles.feedItemWrap}>
          <View style={[styles.imageContainer, { height: imageHeight }]}>
            <Pressable
              onPress={() => {
                if (leadDish) {
                  navigateToDish(leadDish.id);
                  return;
                }
                navigateToStall(item.venueId);
              }}
              style={StyleSheet.absoluteFill}
            >
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
              />
            </Pressable>

            {item.mediaType === "video" ? (
              <View pointerEvents="none" style={styles.playButtonContainer}>
                <View style={styles.playButtonBackdrop}>
                  <PlayCircle color="#FFFFFF" size={54} strokeWidth={1.4} />
                </View>
              </View>
            ) : null}

            {/* Immersive Overlay Scrim */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"]}
              style={styles.gradientScrim}
              pointerEvents="none"
            />

            {/* Metadata & Actions Overlay */}
            <View style={[styles.overlayContent, { padding: spacing[4] }]} pointerEvents="box-none">
              <View style={styles.overlayTopRow} pointerEvents="box-none">
                <View style={[styles.textOverlay, { gap: spacing[1] }]} pointerEvents="box-none">
                  <AppText variant="micro" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {item.authorName} · {item.authorLocation}
                  </AppText>
                  <AppText variant="h2" style={{ color: "#FFFFFF" }} numberOfLines={2}>
                    {leadDish?.name ?? item.venue.name}
                  </AppText>
                  <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
                  </AppText>
                </View>

                {/* Vertical Actions Column */}
                <View style={[styles.sideActions, { gap: spacing[4] }]} pointerEvents="box-none">
                  <Pressable hitSlop={10} onPress={() => toggleLike(item.id)}>
                    <VerticalActionMetric
                      icon={
                        <Heart
                          color={isLiked ? palette.error : "#FFFFFF"}
                          fill={isLiked ? palette.error : "transparent"}
                          size={28}
                        />
                      }
                      count={reactionCount}
                    />
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => openComments(item)}>
                    <VerticalActionMetric
                      icon={<MessageCircle color="#FFFFFF" size={28} />}
                      count={commentCount}
                    />
                  </Pressable>
                  <Pressable hitSlop={10} onPress={() => toggleSave(item.id)}>
                    <VerticalActionMetric
                      icon={
                        <Bookmark
                          color={isSaved ? palette.orange : "#FFFFFF"}
                          fill={isSaved ? palette.orange : "transparent"}
                          size={28}
                        />
                      }
                      count={bookmarkCount}
                    />
                  </Pressable>
                  <Pressable
                    hitSlop={10}
                    onPress={async () => {
                      if (!leadDish) return;
                      await Share.share({
                        message: `Check out ${leadDish.name} at ${item.venue.name} (${item.venue.floor} ${item.venue.unitNumber}) on Hungry.`,
                      });
                      incrementShare(item.id);
                    }}
                  >
                    <VerticalActionMetric
                      icon={<Send color="#FFFFFF" size={26} />}
                      count={shareCount}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Caption */}
              <Pressable
                hitSlop={10}
                onPress={() => toggleExpandedPost(item.id)}
                style={styles.captionOverlay}
              >
                <AppText
                  variant="bodySmall"
                  style={{ color: "rgba(255,255,255,0.9)" }}
                  numberOfLines={isExpanded ? undefined : 2}
                >
                  {item.caption}
                </AppText>
              </Pressable>

              {isExpanded ? (
                <View style={[styles.quickPostRow, { gap: spacing[2], marginTop: spacing[3] }]}>
                  <Pressable
                    onPress={() => {
                      if (!isAuthenticated) {
                        setReturnRoute("Review");
                        navigation.navigate("AuthStack", { screen: "Login" });
                        return;
                      }
                      navigation.navigate("ReviewStack", {
                        screen: "ReviewRating",
                        params: { dishId: leadDish?.id, venueId: item.venueId },
                      });
                    }}
                    style={[
                      styles.quickPostButton,
                      {
                        backgroundColor: "rgba(255,255,255,0.2)",
                        borderColor: "rgba(255,255,255,0.4)",
                        borderRadius: radii.pill,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}
                  >
                    <AppText variant="bodySmall" style={{ color: "#FFFFFF" }}>
                      Quick review
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (!isAuthenticated) {
                        setReturnRoute("Post");
                        navigation.navigate("AuthStack", { screen: "Login" });
                        return;
                      }
                      navigation.navigate("Post");
                    }}
                    style={[
                      styles.quickPostButton,
                      {
                        backgroundColor: "rgba(255,255,255,0.2)",
                        borderColor: "rgba(255,255,255,0.4)",
                        borderRadius: radii.pill,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                      },
                    ]}
                  >
                    <AppText variant="bodySmall" style={{ color: "#FFFFFF" }}>
                      Post
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      );
    },
    [
      expandedPostId,
      isAuthenticated,
      isCompact,
      interactionByPostId,
      navigateToDish,
      navigateToStall,
      palette.border,
      palette.error,
      palette.textMuted,
      spacing,
      setReturnRoute,
      toggleExpandedPost,
      toggleLike,
      toggleSave,
      incrementShare,
      navigation,
      openComments,
    ],
  );

  const listHeader = useMemo(
    () => (
      <View style={{ gap: spacing[4], paddingHorizontal: spacing[5], paddingTop: spacing[1] }}>
        <View style={{ gap: spacing[1] }}>
          <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
            APPETITE SCROLL
          </AppText>
          <AppText variant="h1">Tonight&apos;s food stories</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Browse what stalls are pushing out right now, then jump straight into the dish.
          </AppText>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[3] }}
        >
          {stories.map((story) => (
            <Pressable
              key={story.id}
              onPress={() => navigateToStall(story.venueId)}
              style={{ width: 78, gap: spacing[2], alignItems: "center" }}
            >
              <View
                style={[
                  styles.storyRing,
                  {
                    borderColor: palette.orange,
                    borderRadius: radii.pill,
                    padding: 3,
                  },
                ]}
              >
                <Image
                  source={{ uri: story.authorAvatarUrl }}
                  style={{ width: 58, height: 58, borderRadius: 29 }}
                  contentFit="cover"
                />
              </View>
              <AppText
                variant="micro"
                style={styles.storyLabel}
                numberOfLines={2}
              >
                {story.venue.name}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Bites section */}
        <View style={{ gap: spacing[2] }}>
          <BitesCarousel />
        </View>
      </View>
    ),
    [navigateToStall, palette.orange, radii.pill, spacing, stories],
  );

  if (feedState === "loading") {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
        <View style={{ alignItems: "center", flex: 1, gap: spacing[3], justifyContent: "center", paddingHorizontal: spacing[5] }}>
          <ActivityIndicator color={palette.orange} />
          <AppText tone="secondary">Loading your food feed…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (feedState === "error") {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing[5] }}>
          <EmptyState
            title="Unable to load feed"
            body="Please try again."
            ctaLabel="Retry"
            onPress={loadFeed}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]} edges={["top", "left", "right"]}>
      <View style={{ flex: 1, paddingTop: spacing[3] }}>
        <FlatList
          data={feed}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              title="No food stories yet"
              body="Nothing to show right now. Try Discover to find dishes nearby."
            />
          }
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: spacing[5],
            paddingBottom: spacing[16] + insets.bottom + spacing[6],
          }}
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <BottomSheetModal
        ref={commentsSheetRef}
        snapPoints={commentSnapPoints}
        index={0}
        enablePanDownToClose
        onDismiss={() => setActiveCommentItem(null)}
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
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: spacing[3],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[4],
            paddingBottom: spacing[8] + insets.bottom,
          }}
        >
          <AppText variant="h3">Comments</AppText>
          {activeCommentItem?.dishes[0]?.reviews?.length ? (
            activeCommentItem.dishes[0].reviews.map((review) => (
              <View
                key={review.id}
                style={{
                  backgroundColor: palette.bgSoft,
                  borderColor: palette.border,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  gap: spacing[1],
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[3],
                }}
              >
                <AppText variant="bodySmall">{review.authorName}</AppText>
                <AppText variant="micro" tone="muted">
                  {new Date(review.createdAt).toLocaleDateString()}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {review.text}
                </AppText>
              </View>
            ))
          ) : (
            <AppText variant="bodySmall" tone="secondary">
              No comments yet. Be the first to share your review.
            </AppText>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>

    </SafeAreaView>
  );
}

function keyExtractor(item: HomeFeedItem) {
  return item.id;
}

function VerticalActionMetric({
  icon,
  count,
}: {
  icon: ReactNode;
  count: number;
}) {
  return (
    <View style={styles.verticalActionMetric}>
      {icon}
      <AppText variant="micro" style={{ color: "#FFFFFF", fontWeight: "600" }}>
        {count}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  feedItemWrap: {
    backgroundColor: "#000000",
  },
  imageContainer: {
    width: "100%",
    position: "relative",
    backgroundColor: "#1A2E44",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientScrim: {
    ...StyleSheet.absoluteFillObject,
    height: "100%",
  },
  overlayContent: {
    ...StyleSheet.absoluteFillObject,
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
    ...StyleSheet.absoluteFillObject,
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
  storyRing: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
  },
  storyLabel: {
    textAlign: "center",
  },
  sectionEyebrow: {
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  inlineActionMetric: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
});
