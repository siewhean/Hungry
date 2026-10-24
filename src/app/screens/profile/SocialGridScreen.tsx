import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { AccessibleImage, AppText, EmptyState, Screen } from "@/components/ui";
import {
  prefetchDishDetail,
  prefetchImage,
  prefetchPostDetail,
  preloadRoute,
} from "@/features/navigation/prefetch";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { useHungryTheme } from "@/theme";
import { useStoryStore } from "@/store/useStoryStore";
import { useSocialStore } from "@/store/useSocialStore";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";
import { useProfileStore } from "@/store/useProfileStore";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import type { ProfileStackParamList } from "@/app/navigation/navigationTypes";
import type { Story, StallPost, DishDetail } from "@/types/domain";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

type SocialGridRouteProp = RouteProp<ProfileStackParamList, "SocialGrid">;

const COLUMN_COUNT = 3;

export function SocialGridScreen() {
  const { palette } = useHungryTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<SocialGridRouteProp>();
  const { type } = route.params;

  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const storiesEnabled = FEATURE_FLAGS.storiesEnabled;
  const profile = useProfileStore((state) => state.profile);
  const { stories, loadStories } = useStoryStore();
  const { interactions, initializeInteractions } = useSocialStore();
  const publishedPosts = usePublishedPostStore((state) => state.posts);

  const [stallPosts, setStallPosts] = useState<StallPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Follows rotation and split-screen resizes instead of the width at module load.
  const { width: windowWidth } = useWindowDimensions();
  const itemWidth = windowWidth / COLUMN_COUNT;

  const getSavedSortKey = useCallback((timestamp?: string) => {
    if (!timestamp) return 0;
    const value = new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : 0;
  }, []);

  useEffect(() => {
    async function loadData() {
      // Signed out there is nothing to load, so the spinner must not run forever.
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadFailed(false);
      try {
        const repository = getDataRepository();
        const posts = await listSharedStallPosts(repository);

        if (storiesEnabled) {
          await loadStories();
        }

        setStallPosts(posts);
        initializeInteractions(posts);
      } catch (e) {
        console.error("Failed to load grid data", e);
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [
    isAuthenticated,
    loadStories,
    initializeInteractions,
    publishedPosts,
    reloadKey,
    storiesEnabled,
  ]);

  const items = useMemo(() => {
    const filteredStories = storiesEnabled
      ? stories
          .filter((story) => {
            const isLiked = story.interaction?.liked;
            const isSaved = story.interaction?.saved;
            return type === "liked" ? isLiked : isSaved;
          })
          .map((story) => ({
            story,
            savedAt: getSavedSortKey(story.interaction?.savedAt),
          }))
          .sort((a, b) => b.savedAt - a.savedAt)
          .map(({ story }) => story)
      : [];

    const filteredPosts = stallPosts
      .map((post) => ({
        post,
        savedAt: getSavedSortKey(interactions[post.id]?.savedAt),
      }))
      .filter(({ post }) => {
        const interaction = interactions[post.id];
        if (!interaction) return false;
        return type === "liked" ? interaction.liked : interaction.saved;
      })
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(({ post }) => post);

    // Add Favourites (Dishes) for saved type
    const repository = getDataRepository();
    const dedupeDishIds = new Set<string>();
    if (type === "saved") {
      filteredPosts.forEach((post) => {
        post.dishIds.forEach((dishId) => dedupeDishIds.add(dishId));
      });
    }

    const favouriteDishes =
      type === "saved"
        ? profile.favouriteDishIds
            .map((id) => repository.getDishById(id))
            .filter((d): d is DishDetail => Boolean(d))
            .filter((dish) => {
              if (!dish.id || dedupeDishIds.has(dish.id)) {
                return false;
              }
              dedupeDishIds.add(dish.id);
              return true;
            })
        : [];

    return [...filteredStories, ...filteredPosts, ...favouriteDishes];
  }, [
    getSavedSortKey,
    interactions,
    profile.favouriteDishIds,
    stallPosts,
    stories,
    storiesEnabled,
    type,
  ]);

  const renderItem = ({ item }: { item: Story | StallPost | DishDetail }) => {
    const isStory = "content" in item;
    const isDish = "venueName" in item;

    let imageUrl = "";
    if (isStory) imageUrl = (item as Story).content.url;
    else if (isDish) imageUrl = (item as DishDetail).imageUrl;
    else imageUrl = (item as StallPost).mediaUrl;
    const itemLabel = isStory
      ? "Open story"
      : isDish
        ? `Open ${(item as DishDetail).name}`
        : `Open post ${(item as StallPost).caption || (item as StallPost).id}`;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={itemLabel}
        style={[styles.gridItem, { width: itemWidth, height: itemWidth * 1.5 }]}
        onPressIn={() => {
          if (isStory) {
            if (!storiesEnabled) return;
            prefetchImage((item as Story).content.url);
            preloadRoute(navigation, "StoryViewer", { initialStoryId: (item as Story).id });
          } else if (isDish) {
            prefetchDishDetail((item as DishDetail).id);
            preloadRoute(navigation, "DishDetail", { dishId: (item as DishDetail).id });
          } else {
            prefetchPostDetail(item as StallPost);
            preloadRoute(navigation, "SocialPostDetail", {
              postId: (item as StallPost).id,
              type,
            });
          }
        }}
        onPress={() => {
          if (isStory) {
            if (!storiesEnabled) return;
            navigation.navigate("StoryViewer", { initialStoryId: (item as Story).id });
          } else if (isDish) {
            navigation.navigate("DishDetail", { dishId: (item as DishDetail).id });
          } else {
            navigation.navigate("SocialPostDetail", {
              postId: (item as StallPost).id,
              type,
            });
          }
        }}
      >
        <AccessibleImage
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          decorative
        />
        {isStory && (
          <View style={[styles.badge, { backgroundColor: palette.orange }]}>
            <AppText variant="bodySmallBold" style={{ color: palette.textOnOrange }}>
              Story
            </AppText>
          </View>
        )}
        {isDish && (
          <View style={[styles.badge, { backgroundColor: palette.statusFast }]}>
            <AppText variant="bodySmallBold" style={{ color: palette.white }}>
              Dish
            </AppText>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Screen
      title={type === "liked" ? "Liked content" : "Saved content"}
      fullWidth
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.orange} size="large" />
        </View>
      ) : loadFailed && items.length === 0 ? (
        <EmptyState
          title="Couldn't load this content"
          body="Check your connection and try again."
          ctaLabel="Retry"
          onPress={() => setReloadKey((key) => key + 1)}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={`No ${type} content found`}
          body="Add content to see it appear in this grid."
        />
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          // @ts-ignore
          estimatedItemSize={itemWidth * 1.5}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  gridItem: {
    padding: 1,
  },
  image: {
    flex: 1,
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
