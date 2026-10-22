import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { AccessibleImage, AppText, Button, EmptyState, Screen } from "@/components/ui";
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
import { useCommunitySafetyRevision } from "@/lib/security/communitySafety";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

type SocialGridRouteProp = RouteProp<ProfileStackParamList, "SocialGrid">;

const COLUMN_COUNT = 3;

export function SocialGridScreen() {
  const { palette, spacing } = useHungryTheme();
  const { width } = useWindowDimensions();
  const itemWidth = width / COLUMN_COUNT;
  const navigation = useNavigation<any>();
  const route = useRoute<SocialGridRouteProp>();
  const { type } = route.params;
  const safetyRevision = useCommunitySafetyRevision();

  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const storiesEnabled = FEATURE_FLAGS.storiesEnabled;
  const profile = useProfileStore((state) => state.profile);
  const { stories, loadStories } = useStoryStore();
  const { interactions, initializeInteractions } = useSocialStore();
  const publishedPosts = usePublishedPostStore((state) => state.posts);

  const [stallPosts, setStallPosts] = useState<StallPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const getSavedSortKey = useCallback((timestamp?: string) => {
    if (!timestamp) return 0;
    const value = new Date(timestamp).getTime();
    return Number.isFinite(value) ? value : 0;
  }, []);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!isAuthenticated) {
        setStallPosts([]);
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

        if (!active) return;
        setStallPosts(posts);
        initializeInteractions(posts);
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [
    isAuthenticated,
    loadStories,
    initializeInteractions,
    publishedPosts,
    storiesEnabled,
    attempt,
    safetyRevision,
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
            <AppText variant="bodySmallBold" style={{ color: palette.white }}>
              STORY
            </AppText>
          </View>
        )}
        {isDish && (
          <View style={[styles.badge, { backgroundColor: palette.statusFast }]}>
            <AppText variant="bodySmallBold" style={{ color: palette.white }}>
              DISH
            </AppText>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Screen
      title={type === "liked" ? "Liked Content" : "Saved Content"}
      scroll={false}
      fullWidth
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      {loadFailed ? (
        <Button
          label="Retry loading saved content"
          onPress={() => setAttempt((value) => value + 1)}
        />
      ) : null}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.orange} size="large" />
        </View>
      ) : items.length === 0 && !loadFailed ? (
        <EmptyState
          title={`No ${type} content found`}
          body="Add content to see it appear in this grid."
        />
      ) : items.length ? (
        <FlashList
          data={items}
          renderItem={renderItem}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={{ paddingBottom: spacing[8] }}
        />
      ) : null}
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
