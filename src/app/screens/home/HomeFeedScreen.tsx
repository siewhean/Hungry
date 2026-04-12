import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Bookmark, Compass, Heart, MessageCircle, MoreHorizontal, PlayCircle, Send, User, Utensils, MapPin } from "lucide-react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { AppText, Button, EmptyState, Skeleton } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, type HomeFeedItem } from "@/features/home/feed";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";

function FeedSkeleton() {
  const { spacing, radii, palette } = useHungryTheme();
  const { width } = useWindowDimensions();
  const imageHeight = width / (4 / 5);

  return (
    <View style={{ gap: spacing[4], backgroundColor: palette.bg, marginBottom: spacing[8] }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], gap: spacing[3] }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ gap: spacing[1], flex: 1 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="30%" height={12} />
        </View>
      </View>
      <Skeleton height={imageHeight} borderRadius={0} />
      <View style={{ paddingHorizontal: spacing[4], gap: spacing[3] }}>
        <Skeleton width="70%" height={14} />
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
  const { palette, spacing, radii } = useHungryTheme();
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInteractionByPostId((prev) => {
      const current = prev[postId] ?? {
        liked: false, saved: false, likeCount: 0, saveCount: 0, shareCount: 0, commentCount: 0,
      };
      const isLiked = !current.liked;
      return {
        ...prev,
        [postId]: { ...current, liked: isLiked, likeCount: isLiked ? current.likeCount + 1 : Math.max(0, current.likeCount - 1) },
      };
    });
  };

  const toggleSave = (postId: string) => {
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
  };

  const openComments = useCallback((item: HomeFeedItem) => {
    commentsSheetRef.current?.present();
  }, []);

  const commentsSheetRef = useRef<BottomSheetModal>(null);
  const commentSnapPoints = useMemo(() => ["60%", "90%"], []);
  const renderCommentBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />,
    [],
  );

  const navigateToStall = useCallback((venueId: string) => {
    navigation.navigate("StallDetail", { venueId });
  }, [navigation]);

  const navigateToDish = useCallback((dishId: string) => {
    navigation.navigate("DishDetail", { dishId });
  }, [navigation]);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return `Good morning, ${profile.displayName.split(" ")[0]}`;
    if (hour < 17) return "Hungry for lunch?";
    return "Suggested for dinner";
  }, [profile.displayName]);

  const renderHeader = useCallback(() => {
    return (
      <View style={{ gap: spacing[6], paddingBottom: spacing[4] }}>
        <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <AppText style={{ fontSize: 24, fontWeight: "900", color: palette.orange }}>{getGreeting()}</AppText>
            <AppText variant="bodySmall" tone="secondary">Tanjong Pagar · 14 nearby</AppText>
          </View>
          <Pressable 
            onPress={() => navigation.navigate("DirectMessages")}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.bgSoft, alignItems: "center", justifyContent: "center" }}
          >
            <Send color={palette.orange} size={24} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}>
          {feed.slice(0, 5).map((item) => (
            <Pressable key={`story-${item.id}`} style={{ alignItems: "center", gap: spacing[1] }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: palette.orange, padding: 2 }}>
                <Image source={{ uri: item.authorAvatarUrl }} style={{ width: "100%", height: "100%", borderRadius: 30 }} contentFit="cover" />
              </View>
              <AppText variant="micro" numberOfLines={1} style={{ width: 68, textAlign: "center" }}>{item.authorName.split(" ")[0]}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  }, [feed, palette, spacing, navigation, getGreeting]);

  const renderItem = useCallback(
    ({ item }: { item: HomeFeedItem }) => {
      const interaction = interactionByPostId[item.id] ?? {
        liked: false, saved: false, likeCount: 12, saveCount: 4, shareCount: 2, commentCount: 3,
      };
      const isLiked = interaction.liked;
      const isSaved = interaction.saved;

      const imageAspectRatio = 4 / 5;
      const imageHeight = screenWidth / imageAspectRatio;

      return (
        <View style={{ marginBottom: spacing[8], backgroundColor: palette.bg }}>
          {/* Top Bar: Author & Location */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[3] }}>
            <Image source={{ uri: item.authorAvatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            <View style={{ flex: 1 }}>
              <AppText style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}>{item.authorName}</AppText>
              <AppText style={{ fontSize: 12, color: palette.textSecondary }}>{item.authorLocation}</AppText>
            </View>
            <MoreHorizontal color={palette.textMuted} size={20} />
          </View>

          {/* Media */}
          <Pressable onPress={() => navigateToDish(item.dishIds[0])}>
            <Image source={{ uri: item.mediaUrl }} style={{ width: screenWidth, height: imageHeight }} contentFit="cover" />
          </Pressable>

          {/* Interaction Bar */}
          <View
            style={{
              flexDirection: leftHandedMode ? "row-reverse" : "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              justifyContent: "space-between",
            }}
          >
            {/* Left side: Location with Icon */}
            <Pressable 
              onPress={() => navigation.navigate("MapZoomedIn", { buildingId: item.venue.buildingId })}
              style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: spacing[3] }}
            >
              <MapPin color={palette.orange} size={16} style={{ marginRight: 4 }} />
              <AppText style={{ fontFamily: "Nunito_700Bold", color: palette.text, fontSize: 15 }} numberOfLines={1}>
                {item.venue.buildingId.replace("hc-", "").replace("fc-", "").replace("building-", "").replace("-", " ").toUpperCase()}
              </AppText>
            </Pressable>

            {/* Right side: Interaction Icons */}
            <View style={{ flexDirection: leftHandedMode ? "row-reverse" : "row", alignItems: "center", gap: spacing[4], flexShrink: 0 }}>
              <View style={{ alignItems: "center" }}>
                <Pressable onPress={() => toggleSave(item.id)}>
                  <Bookmark color={isSaved ? palette.orange : palette.text} fill={isSaved ? palette.orange : "transparent"} size={24} />
                </Pressable>
                <AppText variant="micro" tone="secondary" style={{ marginTop: 2 }}>{interaction.saveCount}</AppText>
              </View>
              <View style={{ alignItems: "center" }}>
                <Pressable onPress={() => openComments(item)}>
                  <MessageCircle color={palette.text} size={24} />
                </Pressable>
                <AppText variant="micro" tone="secondary" style={{ marginTop: 2 }}>{interaction.commentCount}</AppText>
              </View>
              <View style={{ alignItems: "center" }}>
                <Pressable onPress={() => toggleLike(item.id)}>
                  <Heart color={isLiked ? palette.error : palette.text} fill={isLiked ? palette.error : "transparent"} size={24} />
                </Pressable>
                <AppText variant="micro" tone="secondary" style={{ marginTop: 2 }}>{interaction.likeCount}</AppText>
              </View>
            </View>
          </View>

          {/* Caption & Metadata */}
          <View style={{ paddingHorizontal: spacing[4], gap: spacing[1] }}>
            <AppText style={{ lineHeight: 22, fontSize: 15 }}>
              <AppText style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}>{item.authorName} </AppText>
              <AppText style={{ fontSize: 15 }}>{item.caption}</AppText>
            </AppText>
            <AppText variant="micro" tone="muted">{item.createdAt}</AppText>
          </View>
        </View>
      );
    },
    [interactionByPostId, leftHandedMode, navigateToDish, palette, screenWidth, spacing, navigation, openComments, toggleLike, toggleSave],
  );

  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

  if (feedState === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
        <ScrollView scrollEnabled={false}>
          <FeedSkeleton />
          <FeedSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (feedState === "error") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing[5] }}>
          <EmptyState 
            title="Something went wrong" 
            body="We couldn't load your feed right now. Please check your connection and try again." 
            ctaLabel="Retry" 
            onPress={loadFeed} 
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["top", "left", "right"]}>
      <Animated.FlatList
        data={feed}
        keyExtractor={(item: HomeFeedItem) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing[16] }}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        windowSize={5}
        ListEmptyComponent={
          <EmptyState
            title="Feed is taking a break"
            body="We're still gathering the latest food stories for you. Check back shortly for new recommendations near you!"
          />
        }
      />

      <BottomSheetModal
        ref={commentsSheetRef}
        index={0}
        snapPoints={commentSnapPoints}
        backdropComponent={renderCommentBackdrop}
        backgroundStyle={{ backgroundColor: palette.surface }}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
      >
        <BottomSheetScrollView contentContainerStyle={{ padding: spacing[5], gap: spacing[4] }}>
          <AppText variant="h2">Comments</AppText>
          <AppText tone="secondary">Community discussions coming soon.</AppText>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}
