import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Heart, MessageCircle, PlayCircle, Send, Star, X } from "lucide-react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetFooter,
} from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { FlashList } from "@shopify/flash-list";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  FeedErrorBoundary,
  FeedStateView,
  Input,
  Skeleton,
} from "@/components/ui";
import { BitesCarousel, CircleStoryCarousel, ZoomableMedia } from "@/components/social";
import {
  getHomeFeed,
  getHomeSocialFeed,
  type HomeFeedItem,
  type HomeFeedSection,
} from "@/features/home/feed";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { formatTimeAgo } from "@/lib/date/formatTimeAgo";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

function FeedSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  return (
    <View style={{ gap: spacing[6], padding: spacing[4] }}>
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

type InteractionState = {
  liked: boolean;
  saved: boolean;
  likeCount: number;
  saveCount: number;
  shareCount: number;
  commentCount: number;
};
type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

type HomeFeedMode = "social" | "review";

type FeedComment = {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
};

type FeedReply = {
  id: string;
  parentCommentId: string;
  authorName: string;
  authorAvatarUrl?: string;
  text: string;
  createdAt: string;
};

type HomeFeedScreenProps = {
  mode?: HomeFeedMode;
};

export function HomeFeedScreen({ mode = "social" }: HomeFeedScreenProps) {
  const navigation = useNavigation<RootNavigation>();
  const { width: screenWidth } = useWindowDimensions();
  const theme = useHungryTheme();
  const { palette, spacing, radii, shadows, colorScheme } = theme;
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);

  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [sections, setSections] = useState<HomeFeedSection[]>([]);
  const [socialFeed, setSocialFeed] = useState<HomeFeedItem[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [activeCommentItem, setActiveCommentItem] = useState<HomeFeedItem | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [localCommentsByPostId, setLocalCommentsByPostId] = useState<Record<string, FeedComment[]>>(
    {},
  );
  const [localRepliesByCommentId, setLocalRepliesByCommentId] = useState<
    Record<string, FeedReply[]>
  >({});
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [draftReplyByCommentId, setDraftReplyByCommentId] = useState<Record<string, string>>({});
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const commentInputRef = useRef<any>(null);
  const commentSnapPoints = useMemo(() => ["50%", "88%"], []);

  const [interactionByPostId, setInteractionByPostId] = useState<Record<string, InteractionState>>(
    {},
  );

  const loadFeed = useCallback(async () => {
    setFeedState("loading");
    try {
      const data = await getHomeFeed(profile);
      const socialData = await getHomeSocialFeed(profile);
      setSections(data);
      setSocialFeed(socialData);
      setInteractionByPostId((current) => {
        const next = { ...current };
        const allItems = [...socialData, ...data.flatMap((section) => section.items)];

        allItems.forEach((item) => {
          if (next[item.id]) {
            return;
          }

          const baseComments = item.dishes[0]?.reviews.length ?? 0;
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
  }, [profile]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const toggleLike = useCallback((postId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInteractionByPostId((prev) => {
      const current = prev[postId] ?? {
        liked: false,
        saved: false,
        likeCount: 12,
        saveCount: 4,
        shareCount: 2,
        commentCount: 3,
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
  }, []);

  const toggleSave = useCallback((postId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        [postId]: { ...current, saved: !current.saved },
      };
    });
  }, []);

  const incrementShare = useCallback((postId: string) => {
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
  }, []);

  const toggleExpandedPost = useCallback((postId: string) => {
    setExpandedPostId((current) => (current === postId ? null : postId));
  }, []);

  const openComments = useCallback((item: HomeFeedItem) => {
    setActiveCommentItem(item);
    setDraftComment("");
    setActiveReplyCommentId(null);
    setDraftReplyByCommentId({});
    requestAnimationFrame(() => {
      commentsSheetRef.current?.present();
    });
  }, []);

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

  const commentsForActiveItem = useMemo(() => {
    if (!activeCommentItem) {
      return [];
    }

    const seededComments: FeedComment[] = (activeCommentItem.dishes[0]?.reviews ?? []).map(
      (review) => ({
        id: review.id,
        authorName: review.authorName,
        authorAvatarUrl: undefined,
        text: review.text,
        createdAt: new Date().toISOString(),
      }),
    );

    const localComments = localCommentsByPostId[activeCommentItem.id] ?? [];

    return [...seededComments, ...localComments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeCommentItem, localCommentsByPostId]);

  const handlePostCommentOrReply = useCallback(() => {
    if (!activeCommentItem || !draftComment.trim().length) return;

    if (activeReplyCommentId) {
      const newReply: FeedReply = {
        id: `reply-${Date.now()}`,
        parentCommentId: activeReplyCommentId,
        authorName: profile.displayName,
        text: draftComment.trim(),
        createdAt: new Date().toISOString(),
      };

      setLocalRepliesByCommentId((prev) => ({
        ...prev,
        [activeReplyCommentId]: [...(prev[activeReplyCommentId] ?? []), newReply],
      }));
      setActiveReplyCommentId(null);
    } else {
      const newComment: FeedComment = {
        id: `comment-${Date.now()}`,
        authorName: profile.displayName,
        text: draftComment.trim(),
        createdAt: new Date().toISOString(),
      };

      setLocalCommentsByPostId((prev) => ({
        ...prev,
        [activeCommentItem.id]: [...(prev[activeCommentItem.id] ?? []), newComment],
      }));
    }

    setDraftComment("");
  }, [activeCommentItem, draftComment, activeReplyCommentId, profile.displayName]);

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

  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

  const renderHeader = useCallback(
    () => (
      <View style={{ paddingBottom: spacing[2], gap: spacing[2] }}>
        <View style={{ paddingHorizontal: spacing[4], paddingTop: 0 }}>
          <AppText variant="displayBold" style={{ color: palette.orange, fontSize: 32 }}>
            Hungry
          </AppText>
        </View>
        <CircleStoryCarousel />
      </View>
    ),
    [spacing, palette.orange],
  );

  const renderFeedCard = useCallback(
    (item: HomeFeedItem, cardMode: HomeFeedMode) => {
      const interaction = interactionByPostId[item.id] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };
      const isLiked = interaction.liked;
      const isSaved = interaction.saved;
      const isExpanded = expandedPostId === item.id;

      if (cardMode === "social") {
        const imageHeight = Math.min(Math.max(screenWidth * 1.3, 400), 520);

        return (
          <View key={item.id} style={styles.feedItemWrap}>
            <View style={[styles.imageContainer, { height: imageHeight }]}>
              <ZoomableMedia
                uri={item.mediaUrl}
                type={item.mediaType as "image" | "video"}
                style={StyleSheet.absoluteFill}
              />

              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.8)"]}
                style={styles.gradientScrim}
                pointerEvents="none"
              />

              <View
                style={[styles.overlayContent, { padding: spacing[3] }]}
                pointerEvents="box-none"
              >
                <View
                  style={[
                    styles.overlayTopRow,
                    { flexDirection: profile.leftHandedMode ? "row-reverse" : "row" },
                  ]}
                  pointerEvents="box-none"
                >
                  <View
                    style={[
                      styles.textOverlay,
                      {
                        gap: spacing[1],
                        alignItems: profile.leftHandedMode ? "flex-end" : "flex-start",
                        marginRight: profile.leftHandedMode ? 0 : 12,
                        marginLeft: profile.leftHandedMode ? 12 : 0,
                      },
                    ]}
                    pointerEvents="box-none"
                  >
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        gap: spacing[2],
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${item.authorName} profile`}
                        onPress={() =>
                          openUserProfile(
                            item.authorName,
                            item.authorAvatarUrl,
                            item.authorLocation,
                          )
                        }
                      >
                        <Avatar uri={item.authorAvatarUrl} name={item.authorName} size={30} />
                      </Pressable>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Pressable
                          onPress={() =>
                            openUserProfile(
                              item.authorName,
                              item.authorAvatarUrl,
                              item.authorLocation,
                            )
                          }
                        >
                          <AppText
                            variant="micro"
                            style={{
                              color: "rgba(255,255,255,0.9)",
                            }}
                          >
                            {item.authorName}
                          </AppText>
                        </Pressable>
                        <AppText variant="micro" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {" · "}
                        </AppText>
                        <Pressable
                          onPress={() =>
                            navigation.navigate("StallDetail", { venueId: item.venueId })
                          }
                        >
                          <AppText
                            variant="micro"
                            style={{
                              color: "rgba(255,255,255,0.9)",
                              textDecorationLine: "underline",
                            }}
                          >
                            {item.authorLocation}
                          </AppText>
                        </Pressable>
                      </View>
                    </View>
                    <AppText
                      variant="h2"
                      style={{
                        color: palette.white,
                        textAlign: profile.leftHandedMode ? "right" : "left",
                      }}
                      numberOfLines={2}
                    >
                      {item.dishes[0]?.name ?? item.venue.name}
                    </AppText>
                    <Pressable
                      onPress={() => navigation.navigate("StallDetail", { venueId: item.venueId })}
                    >
                      <AppText
                        variant="micro"
                        style={{
                          color: "rgba(255,255,255,0.8)",
                          textAlign: profile.leftHandedMode ? "right" : "left",
                        }}
                      >
                        {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
                      </AppText>
                    </Pressable>
                  </View>

                  <View style={[styles.sideActions, { gap: spacing[4] }]} pointerEvents="box-none">
                    <Pressable hitSlop={10} onPress={() => toggleLike(item.id)}>
                      <VerticalActionMetric
                        icon={
                          <Heart
                            color={isLiked ? palette.error : palette.white}
                            fill={isLiked ? palette.error : "transparent"}
                            size={28}
                          />
                        }
                        count={interaction.likeCount}
                        palette={palette}
                      />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => openComments(item)}>
                      <VerticalActionMetric
                        icon={<MessageCircle color={palette.white} size={28} />}
                        count={interaction.commentCount}
                        palette={palette}
                      />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => toggleSave(item.id)}>
                      <VerticalActionMetric
                        icon={
                          <Bookmark
                            color={isSaved ? palette.orange : palette.white}
                            fill={isSaved ? palette.orange : "transparent"}
                            size={28}
                          />
                        }
                        palette={palette}
                      />
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      onPress={async () => {
                        if (!item.dishes[0]) return;
                        await Share.share({
                          message: `Check out ${item.dishes[0].name} at ${item.venue.name} on Hungry.`,
                        });
                        incrementShare(item.id);
                      }}
                    >
                      <VerticalActionMetric
                        icon={<Send color={palette.white} size={26} />}
                        count={interaction.shareCount}
                        palette={palette}
                      />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  hitSlop={10}
                  onPress={() => toggleExpandedPost(item.id)}
                  style={[
                    styles.captionOverlay,
                    {
                      alignItems: profile.leftHandedMode ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  <AppText
                    variant="bodySmall"
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      textAlign: profile.leftHandedMode ? "right" : "left",
                    }}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {item.caption}
                  </AppText>
                </Pressable>

                {isExpanded ? (
                  <View
                    style={[
                      styles.quickPostRow,
                      {
                        gap: spacing[2],
                        marginTop: spacing[3],
                        flexDirection: profile.leftHandedMode ? "row-reverse" : "row",
                      },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Quick review"
                      onPress={() => {
                        if (!isAuthenticated) {
                          setReturnRoute("Review");
                          navigation.navigate("AuthStack", { screen: "Login" });
                          return;
                        }

                        navigation.navigate("ReviewStack", {
                          screen: "ReviewMain",
                          params: {
                            dishId: item.dishes[0]?.id,
                            venueId: item.venueId,
                          },
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
                      <AppText variant="bodySmall" style={{ color: palette.white }}>
                        Quick review
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Create post"
                      onPress={() => {
                        if (!isAuthenticated) {
                          setReturnRoute("Post");
                          navigation.navigate("AuthStack", { screen: "Login" });
                          return;
                        }
                        navigation.navigate("Post", {
                          dishId: item.dishes[0]?.id,
                          venueId: item.venueId,
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
                      <AppText variant="bodySmall" style={{ color: palette.white }}>
                        Post
                      </AppText>
                    </Pressable>
                  </View>
                ) : null}
              </View>
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
              width: 280,
              overflow: "hidden",
              borderWidth: themeTints.isDark ? 0 : 1,
              borderColor: palette.border,
            },
          ]}
        >
          <Image
            source={{ uri: item.mediaUrl }}
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
                toggleLike(item.id);
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
                toggleSave(item.id);
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
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.authorName} profile`}
                onPress={(event) => {
                  event.stopPropagation();
                  openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation);
                }}
              >
                <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                  {item.authorName}
                </AppText>
              </Pressable>
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>
                {" · "}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open stall details for ${item.authorLocation}`}
                onPress={(event) => {
                  event.stopPropagation();
                  navigation.navigate("StallDetail", { venueId: item.venueId });
                }}
              >
                <AppText
                  variant="micro"
                  style={{ color: themeTints.secondaryText, textDecorationLine: "underline" }}
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
      interactionByPostId,
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
      toggleLike,
      toggleSave,
      incrementShare,
      isAuthenticated,
      setReturnRoute,
      navigation,
      screenWidth,
      expandedPostId,
      openComments,
      toggleExpandedPost,
      openUserProfile,
      profile.leftHandedMode,
      palette.white,
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
          <View style={{ flex: 1, paddingTop: spacing[3] }}>
            <FlashList
              data={socialFeed}
              keyExtractor={keyExtractor}
              ListHeaderComponent={renderHeader}
              renderItem={({ item }) => renderFeedCard(item, "social")}
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
            <View
              style={{ paddingHorizontal: spacing[4], paddingTop: 0, paddingBottom: spacing[2] }}
            >
              <AppText variant="displayBold" style={{ color: palette.orange, fontSize: 32 }}>
                Hungry
              </AppText>
            </View>
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
                    {section.items.map((item) => renderFeedCard(item, "review"))}
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
            index={0}
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
                paddingBottom: spacing[24], // Space for footer
              }}
            >
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
                        <AppText variant="bodySmall" style={{ lineHeight: 18 }}>
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
                        {(localRepliesByCommentId[comment.id] ?? []).length > 0 && (
                          <View style={{ gap: spacing[3], marginTop: spacing[3] }}>
                            {(localRepliesByCommentId[comment.id] ?? []).map((reply) => (
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
                                  <AppText variant="bodySmall" style={{ lineHeight: 16 }}>
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
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingTop: spacing[12],
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
    feedItemWrap: {
      backgroundColor: palette.navy,
    },
    imageContainer: {
      width: "100%",
      position: "relative",
      backgroundColor: palette.navy,
    },
    heroImage: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    gradientScrim: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      height: "100%",
    },
    overlayContent: {
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
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
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
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
