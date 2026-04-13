import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Bookmark, Compass, Heart, MessageCircle, MoreHorizontal, PlayCircle, Send, User, Utensils, MapPin, Star } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Button, FeedErrorBoundary, FeedStateView, Skeleton } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, type HomeFeedItem, type HomeFeedSection } from "@/features/home/feed";
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

export function HomeFeedScreen() {
  const navigation = useNavigation<RootNavigation>();
  const repository = getDataRepository();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, spacing, radii, shadows } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfileStore((state) => state.profile);
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

  const [interactionByPostId, setInteractionByPostId] = useState<Record<string, InteractionState>>({});

  const loadFeed = useCallback(async () => {
    setFeedState("loading");
    try {
      const data = await getHomeFeed(profile);
      setSections(data);
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
    return (
      <View style={{ gap: spacing[6], paddingBottom: spacing[4], paddingTop: spacing[2] }}>
        <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[2], flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <AppText style={{ fontSize: 24, fontWeight: "900", color: themeTints.isLateNight ? palette.white : palette.orange }}>{getGreeting()}</AppText>
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
        <BitesCarousel />
      </View>
    );
  }, [palette, spacing, navigation, getGreeting, themeTints, radii, locationLabel, nearbyCount]);

  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();

  const renderFeedCard = useCallback((item: HomeFeedItem) => {
    const interaction = interactionByPostId[item.id] ?? {
      liked: false, saved: false, likeCount: 12, saveCount: 4, shareCount: 2, commentCount: 3,
    };
    const isLiked = interaction.liked;
    const isSaved = interaction.saved;

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
        <View style={{ position: "absolute", top: spacing[3], right: spacing[3], gap: spacing[2] }}>
          <Pressable 
            onPress={() => toggleLike(item.id)}
            style={{ width: 36, height: 36, borderRadius: radii.pill, backgroundColor: themeTints.isLateNight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" }}
          >
            <Heart color={isLiked ? palette.error : (themeTints.isLateNight ? palette.white : palette.text)} fill={isLiked ? palette.error : "transparent"} size={18} />
          </Pressable>
          <Pressable 
            onPress={() => toggleSave(item.id)}
            style={{ width: 36, height: 36, borderRadius: radii.pill, backgroundColor: themeTints.isLateNight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" }}
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
          <AppText variant="micro" style={{ color: themeTints.secondaryText }} numberOfLines={1}>{item.authorName} · {item.authorLocation}</AppText>
          
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
  }, [interactionByPostId, navigateToDish, shadows.card, themeTints, radii, palette.border, palette.error, palette.text, palette.orange, palette.amber, palette.bgSoft, spacing, toggleLike, toggleSave]);

  if (feedState === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeTints.bg }} edges={["top", "left", "right"]}>
        <FeedErrorBoundary onRetry={() => { void loadFeed(); }}>
          <ScrollView scrollEnabled={false}>
            {renderHeader()}
            <FeedSkeleton />
            <FeedSkeleton />
          </ScrollView>
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
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[24] }}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {renderHeader()}

          {sections.map((section) => (
            <View key={section.title} style={{ marginBottom: spacing[4] }}>
              <View style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
                <AppText variant="h2" style={{ color: themeTints.text }}>{section.title}</AppText>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ gap: spacing[4], paddingHorizontal: spacing[4], paddingBottom: spacing[2] }}
              >
                {section.items.map((item) => renderFeedCard(item))}
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

      </FeedErrorBoundary>
    </SafeAreaView>
  );
}
