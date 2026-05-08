import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";

import { AppText, EmptyState, Screen } from "@/components/ui";
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

type SocialGridRouteProp = RouteProp<ProfileStackParamList, "SocialGrid">;

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_WIDTH = width / COLUMN_COUNT;

export function SocialGridScreen() {
  const { palette } = useHungryTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<SocialGridRouteProp>();
  const { type } = route.params;

  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const profile = useProfileStore((state) => state.profile);
  const { stories, loadStories } = useStoryStore();
  const { interactions, initializeInteractions } = useSocialStore();
  const publishedPosts = usePublishedPostStore((state) => state.posts);

  const [stallPosts, setStallPosts] = useState<StallPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!isAuthenticated) return;
      setIsLoading(true);
      try {
        const repository = getDataRepository();
        const posts = await listSharedStallPosts(repository);

        await loadStories();

        setStallPosts(posts);
        initializeInteractions(posts);
      } catch (e) {
        console.error("Failed to load grid data", e);
      } finally {
        setIsLoading(false);
      }
    }
    void loadData();
  }, [isAuthenticated, loadStories, initializeInteractions, publishedPosts]);

  const items = useMemo(() => {
    const filteredStories = stories.filter((s) => {
      const isLiked = s.interaction?.liked;
      const isSaved = s.interaction?.saved;
      return type === "liked" ? isLiked : isSaved;
    });

    const filteredPosts = stallPosts.filter((p) => {
      const interaction = interactions[p.id];
      if (!interaction) return false;
      return type === "liked" ? interaction.liked : interaction.saved;
    });

    // Add Favourites (Dishes) for saved type
    const repository = getDataRepository();
    const favourites =
      type === "saved"
        ? profile.favouriteDishIds
            .map((id) => repository.getDishById(id))
            .filter((d): d is DishDetail => Boolean(d))
        : [];

    return [...filteredStories, ...filteredPosts, ...favourites];
  }, [type, stories, stallPosts, interactions, profile.favouriteDishIds]);

  const renderItem = ({ item }: { item: Story | StallPost | DishDetail }) => {
    const isStory = "content" in item;
    const isDish = "venueName" in item;

    let imageUrl = "";
    if (isStory) imageUrl = (item as Story).content.url;
    else if (isDish) imageUrl = (item as DishDetail).imageUrl;
    else imageUrl = (item as StallPost).mediaUrl;

    return (
      <Pressable
        style={styles.gridItem}
        onPress={() => {
          if (isStory) {
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
        <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
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
      fullWidth
      contentContainerStyle={{ paddingHorizontal: 0 }}
    >
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.orange} size="large" />
        </View>
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
          estimatedItemSize={ITEM_WIDTH * 1.5}
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
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.5,
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
