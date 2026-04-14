import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, FlatList, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark, Heart, MessageCircle, PlayCircle, Send, Star } from "lucide-react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Avatar, Button, EmptyState, FeedErrorBoundary, FeedStateView, Input, Skeleton } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, getHomeSocialFeed, type HomeFeedItem, type HomeFeedSection } from "@/features/home/feed";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { getNearestBuildings } from "@/lib/geo/singaporeBuildings";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

function FeedSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  return (
    <View style={{ gap: spacing[6], padding: spacing[4] }}>
      <Skeleton width="60%" height={24} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[4] }}>
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

type HomeFeedScreenProps = {
  mode?: HomeFeedMode;
};

export function HomeFeedScreen({ mode = "social" }: HomeFeedScreenProps) {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const theme = useHungryTheme();
  const { palette, spacing, radii, shadows, colorScheme } = theme;
  const themePreference = useUIStore((state) => state.themePreference);
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualLocation = useLocationStore((state) => state.manualLocation);
  
  const nearbyBuildings = useMemo(
    () => getNearestBuildings(currentLocation.latitude, currentLocation.longitude, 3, 14),
    [currentLocation.latitude, currentLocation.longitude],
  );
  const locationLabel = manualLocation ?? nearbyBuildings[0]?.name ?? "Nearby";
  const nearbyCount = nearbyBuildings.length || repository.listBuildings().length;

  const [feedState, setFeedState] = useState<"loading" | "ready" | "error">("loading");
  const [sections, setSections] = useState<HomeFeedSection[]>([]);
  const [socialFeed, setSocialFeed] = useState<HomeFeedItem[]>([]);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [activeCommentItem, setActiveCommentItem] = useState<HomeFeedItem | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [localCommentsByPostId, setLocalCommentsByPostId] = useState<Record<string, FeedComment[]>>({});
  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const commentSnapPoints = useMemo(() => ["50%", "88%"], []);

  const [interactionByPostId, setInteractionByPostId] = useState<Record<string, InteractionState>>({});

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
        liked: false, saved: false, likeCount: 12, saveCount: 4, shareCount: 2, commentCount: 3,
      };
      const isLiked = !current.liked;
      return {
        ...prev,
        [postId]: { ...current, liked: isLiked, likeCount: isLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1) },
      };
    });
  }, []);

  const toggleSave = useCallback((postId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInteractionByPostId((prev) => {
      const current = prev[postId] ?? {
        liked: false, saved: false, likeCount: 0, saveCount: 0, shareCount: 0, commentCount: 0,
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
    requestAnimationFrame(() => {
      commentsSheetRef.current?.present();
    });
  }, []);

  const openUserProfile = useCallback((authorName: string, authorAvatarUrl?: string, authorLocation?: string) => {
    navigation.navigate("UserProfile", { authorName, authorAvatarUrl, authorLocation });
  }, [navigation]);

  const commentsForActiveItem = useMemo(() => {
    if (!activeCommentItem) {
      return [];
    }

    const seededComments: FeedComment[] = (activeCommentItem.dishes[0]?.reviews ?? []).map((review) => ({
      id: review.id,
      authorName: review.authorName,
      authorAvatarUrl: undefined,
      text: review.text,
      createdAt: review.createdAt,
    }));

    const local = localCommentsByPostId[activeCommentItem.id] ?? [];
    return [...seededComments, ...local];
  }, [activeCommentItem, localCommentsByPostId]);

  const submitComment = useCallback(() => {
    if (!activeCommentItem) {
      return;
    }

    const trimmed = draftComment.trim();
    if (!trimmed.length) {
      return;
    }

    const newComment: FeedComment = {
      id: `local-comment-${Date.now()}`,
      authorName: profile.displayName,
      authorAvatarUrl: undefined,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    setLocalCommentsByPostId((prev) => ({
      ...prev,
      [activeCommentItem.id]: [...(prev[activeCommentItem.id] ?? []), newComment],
    }));

    setInteractionByPostId((prev) => {
      const current = prev[activeCommentItem.id] ?? {
        liked: false,
        saved: false,
        likeCount: 0,
        saveCount: 0,
        shareCount: 0,
        commentCount: 0,
      };

      return {
        ...prev,
        [activeCommentItem.id]: {
          ...current,
          commentCount: current.commentCount + 1,
        },
      };
    });

    setDraftComment("");
  }, [activeCommentItem, draftComment, profile.displayName]);

  const navigateToDish = useCallback((dishId: string) => {
    navigation.navigate("DishDetail", { dishId });
  }, [navigation]);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${profile.displayName.split(" ")[0]}`;
    if (hour < 17) return "Hungry for lunch?";
    return "Suggested for dinner";
  }, [profile.displayName]);

  const themeTints = useMemo(() => {
    const hour = new Date().getHours();
    const isLateNight = hour >= 22 || hour < 4;
    return {
      bg: isLateNight ? palette.navy : palette.bg,
      text: isLateNight ? palette.white : palette.text, // Kept white for dark mode contrast
      cardBg: isLateNight ? "rgba(255,255,255,0.05)" : palette.surface,
      secondaryText: isLateNight ? "rgba(255,255,255,0.6)" : palette.textSecondary,
      isLateNight,
    };
  }, [palette]);

  const renderHeader = useCallback(() => {
    const stories = socialFeed.slice(0, 5);

    return (
      <View style={{ gap: spacing[6], paddingBottom: spacing[4], paddingTop: spacing[2] }}>
        <View style={{ paddingHorizontal: spacing[3], paddingBottom: spacing[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <AppText style={{ fontSize: 24, fontWeight: "900", color: themeTints.isLateNight ? palette.white : palette.orange }}>{getGreeting()}</AppText>
            <AppText variant="micro" style={{ color: palette.textMuted }}>
              DEBUG: {colorScheme} (Pref: {themePreference}) {themeTints.isLateNight ? '🌙' : ''}
            </AppText>
            <AppText variant="bodySmall" style={{ color: themeTints.secondaryText }}>{`${locationLabel} · ${nearbyCount} nearby`}</AppText>
          </View>
          {FEATURE_FLAGS.directMessagesEnabled ? (
            <Pressable 
              onPress={() => navigation.navigate("DirectMessages")}
              style={{ width: 44, height: 44, borderRadius: radii.pill, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
            >
              <Send color={palette.orange} size={24} />
            </Pressable>
          ) : null}
        </View>
        {mode === "social" ? (
          <>
            <View style={{ gap: spacing[1], paddingHorizontal: spacing[3] }}>
              <AppText variant="micro" tone="accent" style={styles.sectionEyebrow}>
                APPETITE SCROLL
              </AppText>
              <AppText variant="h2" style={{ color: themeTints.text }}>Tonight&apos;s food stories</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Browse what stalls are pushing out right now, then jump straight into the dish.
              </AppText>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[3] }}
            >
              {stories.map((story) => (
                <Pressable
                  key={story.id}
                  onPress={() => openUserProfile(story.authorName, story.authorAvatarUrl, story.authorLocation)}
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
                  <AppText variant="micro" style={styles.storyLabel} numberOfLines={2}>
                    {story.venue.name}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ gap: spacing[2], paddingHorizontal: spacing[3] }}>
              <BitesCarousel />
            </View>
          </>
        ) : null}
      </View>
    );
  }, [palette, spacing, getGreeting, themeTints, radii, locationLabel, nearbyCount, mode, socialFeed, openUserProfile]);

  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

  const renderFeedCard = useCallback((item: HomeFeedItem, variant: "social" | "review" = "review") => {
    const interaction = interactionByPostId[item.id] ?? {
      liked: false, saved: false, likeCount: 12, saveCount: 4, shareCount: 2, commentCount: 3,
    };
    const isLiked = interaction.liked;
    const isSaved = interaction.saved;

    if (variant === "social") {
      const imageHeight = Math.min(Math.max(screenWidth * 1.12, 360), 460);
      const isExpanded = expandedPostId === item.id;

      return (
        <View key={item.id} style={styles.feedItemWrap}>
          <View style={[styles.imageContainer, { height: imageHeight }]}> 
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.dishes[0]?.name ?? item.venue.name} details`}
              onPress={() => navigateToDish(item.dishIds[0])}
              style={StyleSheet.absoluteFill}
            >
              <Image source={{ uri: item.mediaUrl }} style={styles.heroImage} contentFit="cover" transition={200} />
            </Pressable>

            {item.mediaType === "video" ? (
              <View pointerEvents="none" style={styles.playButtonContainer}>
                <View style={styles.playButtonBackdrop}>
                  <PlayCircle color={palette.white} size={54} strokeWidth={1.4} />
                </View>
              </View>
            ) : null}

            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.1)", "rgba(0,0,0,0.8)"]}
              style={styles.gradientScrim}
              pointerEvents="none"
            />

            <View style={[styles.overlayContent, { padding: spacing[3] }]} pointerEvents="box-none">
              <View style={[styles.overlayTopRow, { flexDirection: profile.leftHandedMode ? "row-reverse" : "row" }]} pointerEvents="box-none">
                <View style={[styles.textOverlay, { gap: spacing[1], alignItems: profile.leftHandedMode ? "flex-end" : "flex-start", marginRight: profile.leftHandedMode ? 0 : 12, marginLeft: profile.leftHandedMode ? 12 : 0 }]} pointerEvents="box-none">
                  <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.authorName} profile`}
                      onPress={() => openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation)}
                    >
                      <Avatar uri={item.authorAvatarUrl} name={item.authorName} size={30} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${item.authorName} profile`}
                      onPress={() => openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation)}
                    >
                      <AppText variant="micro" style={{ color: "rgba(255,255,255,0.9)", textAlign: profile.leftHandedMode ? "right" : "left" }}>
                        {item.authorName} · {item.authorLocation}
                      </AppText>
                    </Pressable>
                  </View>
                  <AppText variant="h2" style={{ color: palette.white, textAlign: profile.leftHandedMode ? "right" : "left" }} numberOfLines={2}>
                    {item.dishes[0]?.name ?? item.venue.name}
                  </AppText>
                  <AppText variant="micro" style={{ color: "rgba(255,255,255,0.8)", textAlign: profile.leftHandedMode ? "right" : "left" }}>
                    {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
                  </AppText>
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
                    <VerticalActionMetric icon={<MessageCircle color={palette.white} size={28} />} count={interaction.commentCount} palette={palette} />
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
                      count={interaction.saveCount}
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
                    <VerticalActionMetric icon={<Send color={palette.white} size={26} />} count={interaction.shareCount} palette={palette} />
                  </Pressable>
                </View>
              </View>

              <Pressable hitSlop={10} onPress={() => toggleExpandedPost(item.id)} style={[styles.captionOverlay, { alignItems: profile.leftHandedMode ? "flex-end" : "flex-start" }]}>
                <AppText variant="bodySmall" style={{ color: "rgba(255,255,255,0.9)", textAlign: profile.leftHandedMode ? "right" : "left" }} numberOfLines={isExpanded ? undefined : 2}>
                  {item.caption}
                </AppText>
              </Pressable>

              {isExpanded ? (
                <View style={[styles.quickPostRow, { gap: spacing[2], marginTop: spacing[3], flexDirection: profile.leftHandedMode ? "row-reverse" : "row" }]}>
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
                        screen: "ReviewRating",
                        params: { dishId: item.dishes[0]?.id, venueId: item.venueId },
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
                    <AppText variant="bodySmall" style={{ color: palette.white }}>Quick review</AppText>
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
                    <AppText variant="bodySmall" style={{ color: palette.white }}>Post</AppText>
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
        onPress={() => navigateToDish(item.dishIds[0])}
        style={[
          shadows.card,
          { 
            backgroundColor: themeTints.cardBg, 
            borderRadius: radii.lg, 
            width: 300,
            overflow: "hidden",
            borderWidth: themeTints.isLateNight ? 0 : 1,
            borderColor: palette.border,
          }
        ]}
      >
        <Image source={{ uri: item.mediaUrl }} style={{ width: "100%", height: 180 }} contentFit="cover" />
        
        {/* Interaction Overlay */}
        <View 
          style={{ 
            position: "absolute", 
            top: spacing[3], 
            left: profile.leftHandedMode ? spacing[3] : undefined,
            right: profile.leftHandedMode ? undefined : spacing[3], 
            gap: spacing[2] 
          }}
        >
          <Pressable 
            onPress={() => toggleLike(item.id)}
            style={{ width: 36, height: 36, borderRadius: radii.pill, backgroundColor: themeTints.isLateNight ? "rgba(0,0,0,0.5)" : palette.surfaceTranslucent, alignItems: "center", justifyContent: "center" }}
          >
            <Heart color={isLiked ? palette.error : (themeTints.isLateNight ? palette.white : palette.text)} fill={isLiked ? palette.error : "transparent"} size={18} />
          </Pressable>
          <Pressable 
            onPress={() => toggleSave(item.id)}
            style={{ width: 36, height: 36, borderRadius: radii.pill, backgroundColor: themeTints.isLateNight ? "rgba(0,0,0,0.5)" : palette.surfaceTranslucent, alignItems: "center", justifyContent: "center" }}
          >
            <Bookmark color={isSaved ? palette.orange : (themeTints.isLateNight ? palette.white : palette.text)} fill={isSaved ? palette.orange : "transparent"} size={18} />
          </Pressable>
        </View>

        <View style={{ padding: spacing[3], gap: spacing[1] }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText style={{ fontWeight: "800", fontSize: 16, flex: 1, color: themeTints.text }} numberOfLines={1}>{item.dishes[0]?.name ?? item.caption}</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}>
              <Star color={palette.amber} fill={palette.amber} size={14} />
              <AppText style={{ fontWeight: "700", fontSize: 14, color: themeTints.text }}>{(item.dishes[0]?.rating ?? 4.5).toFixed(1)}</AppText>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.authorName} profile`}
            onPress={() => openUserProfile(item.authorName, item.authorAvatarUrl, item.authorLocation)}
          >
            <AppText variant="micro" style={{ color: themeTints.secondaryText }} numberOfLines={1}>{item.authorName} · {item.authorLocation}</AppText>
          </Pressable>
          
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[2] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[1], backgroundColor: themeTints.isLateNight ? "rgba(255,255,255,0.1)" : palette.bgSoft, paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radii.sm }}>
              <MessageCircle color={themeTints.secondaryText} size={12} />
              <AppText variant="micro" style={{ color: themeTints.secondaryText }}>{interaction.commentCount}</AppText>
            </View>
            {item.dishes[0]?.price && (
              <AppText variant="price" style={{ color: palette.orange, fontSize: 14 }}>S${item.dishes[0].price.toFixed(2)}</AppText>
            )}
          </View>
        </View>
      </Pressable>
    );
  }, [interactionByPostId, navigateToDish, shadows.card, themeTints, radii, palette.border, palette.error, palette.text, palette.orange, palette.amber, palette.bgSoft, spacing, toggleLike, toggleSave, incrementShare, isAuthenticated, setReturnRoute, navigation, screenWidth, expandedPostId, openComments, toggleExpandedPost, openUserProfile, profile.leftHandedMode]);

  if (feedState === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeTints.bg }} edges={["top", "left", "right"]}>
        <FeedErrorBoundary onRetry={() => { void loadFeed(); }}>
          {mode === "social" ? (
            <View style={{ alignItems: "center", flex: 1, gap: spacing[3], justifyContent: "center", paddingHorizontal: spacing[3] }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: themeTints.bg }} edges={["top", "left", "right"]}>
        <FeedErrorBoundary onRetry={() => { void loadFeed(); }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: themeTints.bg }} edges={["top", "left", "right"]}>
      <FeedErrorBoundary
        onRetry={() => { void loadFeed(); }}
        title="Feed temporarily unavailable"
        body="A display issue occurred while rendering this feed. Please retry."
      >
        {mode === "social" ? (
          <View style={{ flex: 1, paddingTop: spacing[3] }}>
            <FlatList
              data={socialFeed}
              keyExtractor={keyExtractor}
              ListHeaderComponent={renderHeader}
              renderItem={({ item }) => renderFeedCard(item, "social")}
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
        ) : (
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing[24] }}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {renderHeader()}

            <View style={{ marginBottom: spacing[6], gap: spacing[3] }}>
              <View style={{ paddingHorizontal: spacing[3], paddingTop: spacing[1] }}>
                <AppText variant="h2" style={{ color: themeTints.text }}>Bites</AppText>
              </View>
              <BitesCarousel showHeader={false} />
            </View>

            {sections.map((section) => (
              <View key={section.title} style={{ marginBottom: spacing[4] }}>
                <View style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[3] }}>
                  <AppText variant="h2" style={{ color: themeTints.text }}>{section.title}</AppText>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing[4], paddingHorizontal: spacing[3], paddingBottom: spacing[2] }}
                >
                  {section.items.map((item) => renderFeedCard(item, "review"))}
                </ScrollView>
              </View>
            ))}

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
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[4],
                paddingBottom: spacing[8] + insets.bottom,
              }}
            >
              <AppText variant="h3">Comments</AppText>
              {commentsForActiveItem.length ? (
                commentsForActiveItem.map((comment) => (
                  <View
                    key={comment.id}
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
                    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2] }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${comment.authorName} profile`}
                        onPress={() => openUserProfile(comment.authorName, comment.authorAvatarUrl, activeCommentItem?.authorLocation)}
                      >
                        <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} size={32} />
                      </Pressable>
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <AppText variant="bodySmall">{comment.authorName}</AppText>
                        <AppText variant="micro" tone="muted">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </AppText>
                      </View>
                    </View>
                    <AppText variant="bodySmall" tone="secondary">
                      {comment.text}
                    </AppText>
                  </View>
                ))
              ) : (
                <AppText variant="bodySmall" tone="secondary">
                  No comments yet. Be the first to share your review.
                </AppText>
              )}

              <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
                <Input
                  placeholder="Write a comment"
                  value={draftComment}
                  onChangeText={setDraftComment}
                  multiline
                />
                <Button
                  label="Post comment"
                  onPress={submitComment}
                  disabled={!draftComment.trim().length}
                />
              </View>
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
  count: number;
  palette: any;
}) {
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      {icon}
      <AppText variant="micro" style={{ color: palette.white, fontWeight: "600" }}>
        {count}
      </AppText>
    </View>
  );
}

const createStyles = ({ palette, spacing, radii }: ReturnType<typeof useHungryTheme>) => StyleSheet.create({
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
