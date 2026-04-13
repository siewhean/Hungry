import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Bookmark, Heart, MessageCircle, PlayCircle, Send, Utensils } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, EmptyState } from "@/components/ui";
import { BitesCarousel } from "@/components/social";
import { getHomeFeed, type HomeFeedItem } from "@/features/home/feed";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useDiscoveryStore } from "@/store/useDiscoveryStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useHungryTheme } from "@/theme";

const IMAGE_HEIGHT = 500;

export function HomeFeedScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const { palette, radii, spacing } = useHungryTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const setReturnRoute = useSessionStore((state) => state.setReturnRoute);
  const profile = useProfileStore((state) => state.profile);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Record<string, boolean>>({});
  const setDecideForMe = useDiscoveryStore((state) => state.setDecideForMe);
  const { onScroll, scrollEventThrottle } = useScrollToRevealBack();
  const feed = getHomeFeed(profile);
  const stories = useMemo(() => feed.slice(0, 5), [feed]);
  const isCompact = screenWidth < 390;

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
    setLikedPostIds((current) => ({
      ...current,
      [postId]: !current[postId],
    }));
  }, []);

  const handleDecideForMe = useCallback(() => {
    const picked = mockRepository.getDecideForMe(profile.tasteVector);
    if (picked) {
      setDecideForMe(picked);
    }
    navigation.navigate("DecideForMeResult");
  }, [navigation, profile.tasteVector, setDecideForMe]);

  const renderItem = useCallback(
    ({ item, index }: { item: HomeFeedItem; index: number }) => {
      const leadDish = item.dishes[0];
      const isExpanded = expandedPostId === item.id;
      const isLiked = Boolean(likedPostIds[item.id]);
      const baseReactionCount = (leadDish?.reviewCount ?? 24) + 36 + index * 4;
      const reactionCount = baseReactionCount + (isLiked ? 1 : 0);
      const commentCount = Math.max(12, Math.round(reactionCount / 4));
      const bookmarkCount = Math.max(8, Math.round(commentCount / 2));
      const captionGesture = Gesture.Exclusive(
        Gesture.Tap()
          .numberOfTaps(2)
          .maxDuration(260)
          .onEnd((_event, success) => {
            if (success) {
              runOnJS(toggleLike)(item.id);
            }
          }),
        Gesture.Tap()
          .maxDuration(260)
          .onEnd((_event, success) => {
            if (success) {
              runOnJS(toggleExpandedPost)(item.id);
            }
          }),
      );

      return (
        <View style={styles.feedItemWrap}>
          <Pressable
            onPress={() => {
              if (leadDish) {
                navigateToDish(leadDish.id);
                return;
              }
              navigateToStall(item.venueId);
            }}
          >
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: item.mediaUrl }}
                style={styles.heroImage}
                contentFit="cover"
                transition={200}
              />
              {item.mediaType === "video" ? (
                <View style={styles.playButtonContainer}>
                  <View style={styles.playButtonBackdrop}>
                    <PlayCircle color="#FFFFFF" size={54} strokeWidth={1.4} />
                  </View>
                </View>
              ) : null}
            </View>
          </Pressable>

          <View
            style={[
              styles.belowImageSection,
              {
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[4],
                gap: spacing[3],
              },
            ]}
          >
            <View style={[styles.textGestureRegion, { gap: spacing[2] }]}>
              <View style={styles.metaRow}>
                <AppText variant="bodySmall">{item.authorName} · {item.authorLocation}</AppText>
                {isLiked ? (
                  <AppText variant="bodySmall" tone="muted">
                    Liked
                  </AppText>
                ) : null}
              </View>

              <AppText variant="h2" numberOfLines={2}>
                {leadDish?.name ?? item.venue.name}
              </AppText>
              <GestureDetector gesture={captionGesture}>
                <View style={styles.captionHitArea}>
                  <AppText variant="bodySmall" tone="secondary" numberOfLines={isExpanded ? undefined : isCompact ? 2 : 3}>
                    {item.caption}
                  </AppText>
                </View>
              </GestureDetector>
              <AppText variant="micro" tone="muted">
                {item.venue.name} · {item.venue.floor} {item.venue.unitNumber}
              </AppText>
            </View>

            {isExpanded ? (
              <View style={[styles.quickPostRow, { gap: spacing[2] }]}>
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
                      borderColor: palette.border,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                    },
                  ]}
                >
                  <AppText variant="bodySmall">Quick review</AppText>
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
                      borderColor: palette.border,
                      borderRadius: radii.pill,
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                    },
                  ]}
                >
                  <AppText variant="bodySmall">Post</AppText>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.postFooterRow}>
              <AppText variant="micro" tone="muted">
                {item.createdAt}
              </AppText>
              <View style={styles.postActionsRow}>
                <InlineActionMetric icon={<Heart color={isLiked ? palette.error : palette.textMuted} size={14} />} count={reactionCount} />
                <InlineActionMetric icon={<Send color={palette.textMuted} size={14} />} count={6} />
                <InlineActionMetric icon={<MessageCircle color={palette.textMuted} size={14} />} count={commentCount} />
                <InlineActionMetric icon={<Bookmark color={palette.textMuted} size={14} />} count={bookmarkCount} />
              </View>
            </View>
          </View>
        </View>
      );
    },
    [
      expandedPostId,
      isAuthenticated,
      isCompact,
      likedPostIds,
      navigateToDish,
      navigateToStall,
      palette.border,
      palette.error,
      palette.textMuted,
      spacing,
      setReturnRoute,
      toggleExpandedPost,
      toggleLike,
      navigation,
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
              body="Follow stalls and save dishes to fill your feed with food stories you'll love."
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
        <Pressable
          onPress={handleDecideForMe}
          style={[
            styles.fab,
            {
              backgroundColor: palette.orange,
              bottom: insets.bottom + spacing[6],
              right: spacing[5],
            },
          ]}
        >
          <Utensils color="#FFFFFF" size={24} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function keyExtractor(item: HomeFeedItem) {
  return item.id;
}

function InlineActionMetric({
  icon,
  count,
}: {
  icon: ReactNode;
  count: number;
}) {
  return (
    <View style={styles.inlineActionMetric}>
      {icon}
      <AppText variant="micro" tone="muted">
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
    backgroundColor: "#FFFFFF",
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: "100%",
    position: "relative",
  },
  heroImage: {
    height: IMAGE_HEIGHT,
    width: "100%",
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonBackdrop: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  belowImageSection: {},
  textGestureRegion: {},
  quickPostRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  quickPostButton: {
    borderWidth: 1,
    minHeight: 36,
  },
  captionHitArea: {
    minHeight: 28,
    justifyContent: "center",
    paddingVertical: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  postFooterRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  postActionsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginLeft: "auto",
  },
  inlineActionMetric: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
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
  fab: {
    alignItems: "center",
    borderRadius: 28,
    elevation: 4,
    height: 56,
    justifyContent: "center",
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    width: 56,
  },
});
