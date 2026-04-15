import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Heart, MessageCircle, PlayCircle, Send } from "lucide-react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, EmptyState, Skeleton } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, type HomeFeedItem } from "@/features/home/feed";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

function FeedSkeleton() {
  const { spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const imageHeight = width / (4 / 5);

  return (
    <View style={{ gap: spacing[4], backgroundColor: "#000000", marginBottom: spacing[8] }}>
      <Skeleton height={imageHeight} borderRadius={0} />
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="70%" height={24} />
        <Skeleton width="50%" height={12} />
      </View>
    </View>
  );
}

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
  const leftHandedMode = useProfileStore((state) => state.profile.leftHandedMode ?? false);
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [feed, setFeed] = useState<HomeFeedItem[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const [interactionByPostId, setInteractionByPostId] = useState<Record<string, InteractionState>>({});

  const loadFeed = useCallback(async () => {
    setFeedState("loading");
    try {
      const data = await getHomeFeed(profile);
      setFeed(data);
      setFeedState("ready");
    } catch {
      setFeedState("error");
    }
  }, [profile]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const toggleLike = (postId: string) => {
    setInteractionByPostId((prev) => {
      const current = prev[postId] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };
      const isLiked = !current.liked;
      return {
        ...prev,
        [postId]: {
          ...current,
          liked: isLiked,
          likeCount: isLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1),
        },
      };
    });
  };

  const toggleSave = (postId: string) => {
    setInteractionByPostId((prev) => {
      const current = prev[postId] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };
      const isSaved = !current.saved;
      return {
        ...prev,
        [postId]: {
          ...current,
          saved: isSaved,
          saveCount: isSaved ? current.saveCount + 1 : Math.max(0, current.saveCount - 1),
        },
      };
    });
  };

  const incrementShare = (postId: string) => {
    setInteractionByPostId((prev) => {
      const current = prev[postId] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };
      return {
        ...prev,
        [postId]: {
          ...current,
          shareCount: current.shareCount + 1,
        },
      };
    });
  };

  const toggleExpandedPost = (postId: string) => {
    setExpandedPostId((current) => (current === postId ? null : postId));
  };

  const navigateToDish = (dishId: string) => {
    navigation.navigate("DishDetail", { dishId });
  };

  const navigateToStall = useCallback(
    (venueId: string) => {
      navigation.navigate("StallDetail", { venueId });
    },
    [navigation],
  );

  const stories = useMemo(
    () => [
      { id: "s1", label: "My taste", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" },
      { id: "s2", label: "Nearby", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=100&q=80" },
      { id: "s3", label: "Top rated", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" },
      { id: "s4", label: "Late night", avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=100&q=80" },
    ],
    [],
  );

  const commentSheetRef = useRef<BottomSheetModal>(null);
  const [activePostForComments, setActivePostForComments] = useState<HomeFeedItem | null>(null);

  const openComments = (item: HomeFeedItem) => {
    setActivePostForComments(item);
    commentSheetRef.current?.present();
  };

  const renderCommentBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    [],
  );

  const renderHeader = useCallback(
    () => (
      <View style={{ gap: spacing[6], paddingBottom: spacing[4], paddingTop: spacing[2] }}>
        {/* Stories-like Taste Fingerprints */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[4], paddingHorizontal: spacing[5] }}>
          {stories.map((s) => (
            <View key={s.id} style={{ alignItems: "center", gap: spacing[2] }}>
              <Pressable
                onPress={() => navigation.navigate("TasteFilter")}
                style={[
                  styles.storyRing,
                  {
                    borderColor: palette.orange,
                    borderRadius: 34,
                    height: 68,
                    padding: 3,
                    width: 68,
                  },
                ]}
              >
                <Image source={{ uri: s.avatar }} style={{ borderRadius: 31, height: "100%", width: "100%" }} />
              </Pressable>
              <AppText variant="micro" style={styles.storyLabel}>
                {s.label}
              </AppText>
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing[5] }}>
          <AppText variant="micro" tone="muted" style={styles.sectionEyebrow}>
            Happening now
          </AppText>
          <AppText variant="h1">Dish drops near you</AppText>
        </View>

        {/* Bites section */}
        <View style={{ gap: spacing[2] }}>
          <BitesCarousel />
        </View>
      </View>
    ),
    [navigateToStall, navigation, palette.orange, spacing, stories],
  );

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

      // Dynamic aspect ratio (Instagram-style 4:5 for portrait)
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
                style={StyleSheet.absoluteFill}
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
              <View style={[styles.overlayTopRow, leftHandedMode && { flexDirection: "row-reverse" }]} pointerEvents="box-none">
                <View style={[styles.textOverlay, { gap: spacing[1] }, leftHandedMode && { marginLeft: 12, marginRight: 0 }]} pointerEvents="box-none">
                  <AppText variant="micro" style={{ color: "rgba(255,255,255,0.9)", textAlign: leftHandedMode ? "right" : "left" }}>
                    {item.authorName} · {item.authorLocation}
                  </AppText>
                  <AppText variant="h2" style={{ color: "#FFFFFF", textAlign: leftHandedMode ? "right" : "left" }} numberOfLines={2}>
                    {leadDish?.name ?? item.venue.name}
                  </AppText>
                  <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)", textAlign: leftHandedMode ? "right" : "left" }}>
                    {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
                  </AppText>
                </View>

                {/* Vertical Actions Column (Instagram-inspired overlay style) */}
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

              {/* Caption (Collapsible) */}
              <Pressable
                hitSlop={10}
                onPress={() => toggleExpandedPost(item.id)}
                style={styles.captionOverlay}
              >
                <AppText
                  variant="bodySmall"
                  style={{ color: "rgba(255,255,255,0.9)", textAlign: leftHandedMode ? "right" : "left" }}
                  numberOfLines={isExpanded ? undefined : 2}
                >
                  {item.caption}
                </AppText>
              </Pressable>

              {isExpanded ? (
                <View style={[styles.quickPostRow, { gap: spacing[2], marginTop: spacing[3] }, leftHandedMode && { flexDirection: "row-reverse" }]}>
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
      interactionByPostId,
      isAuthenticated,
      leftHandedMode,
      navigateToDish,
      navigation,
      palette.error,
      palette.orange,
      radii.pill,
      screenWidth,
      setReturnRoute,
      spacing,
    ],
  );

  useScrollToRevealBack();

  if (feedState === "loading") {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: "#000000" }]} edges={["top", "left", "right"]}>
        <ScrollView scrollEnabled={false} contentContainerStyle={{ gap: spacing[4] }}>
          <FeedSkeleton />
          <FeedSkeleton />
        </ScrollView>
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: "#000000" }]} edges={["top", "left", "right"]}>
      <FlatList
        data={feed}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[16] }}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        windowSize={5}
      />

      <BottomSheetModal
        ref={commentSheetRef}
        index={0}
        snapPoints={["60%", "90%"]}
        backdropComponent={renderCommentBackdrop}
        backgroundStyle={{ backgroundColor: palette.surface }}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: spacing[5], gap: spacing[4] }}>
          <AppText variant="h2">Comments</AppText>
          <AppText tone="secondary">Community discussions for {activePostForComments?.venue.name} coming soon.</AppText>
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
