import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MapPin, MessageCircle, MessageCircleMore, Star, Utensils } from "lucide-react-native";

const CommentIcon = MessageCircle ?? MessageCircleMore;

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { AppText, Card, EmptyState, Screen } from "@/components/ui";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { usePublishedPostStore } from "@/store/usePublishedPostStore";
import { useHungryTheme } from "@/theme";
import type { StallPost } from "@/types/domain";

type Props = NativeStackScreenProps<RootStackParamList, "UserProfile">;

export function UserProfileScreen({ navigation, route }: Props) {
  const { authorName, authorAvatarUrl, authorLocation } = route.params;
  const { palette, radii, shadows, spacing } = useHungryTheme();
  const repository = getDataRepository();
  const publishedPosts = usePublishedPostStore((state) => state.posts);
  const [posts, setPosts] = useState<StallPost[]>([]);

  useEffect(() => {
    let isMounted = true;
    void listSharedStallPosts(repository).then((sharedPosts) => {
      if (!isMounted) return;
      setPosts(sharedPosts.filter((post) => post.authorName === authorName));
    });
    return () => {
      isMounted = false;
    };
  }, [authorName, publishedPosts, repository]);

  const totalComments = useMemo(() => {
    return posts.reduce((count, post) => {
      return (
        count +
        post.dishIds.reduce((dishCount, dishId) => {
          const dish = repository.getDishById(dishId);
          return dishCount + (dish?.reviews.length ?? 0);
        }, 0)
      );
    }, 0);
  }, [posts, repository]);

  return (
    <Screen title={authorName} subtitle="Community profile" scroll>
      <View style={{ gap: spacing[4] }}>
        <View
          style={[
            shadows.card,
            {
              alignItems: "center",
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderRadius: radii.lg,
              borderWidth: 1,
              gap: spacing[3],
              padding: spacing[4],
            },
          ]}
        >
          <View
            style={{
              borderColor: palette.orange,
              borderRadius: radii.pill,
              borderWidth: 2,
              height: 84,
              overflow: "hidden",
              width: 84,
            }}
          >
            <Image
              source={{ uri: authorAvatarUrl }}
              style={{ height: "100%", width: "100%" }}
              contentFit="cover"
            />
          </View>

          <View style={{ alignItems: "center", gap: spacing[1] }}>
            <AppText variant="h2">{authorName}</AppText>
            {authorLocation ? (
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing[1],
                }}
              >
                <MapPin color={palette.textMuted} size={14} />
                <AppText variant="bodySmall" tone="secondary">
                  {authorLocation}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <StatChip
              icon={<Utensils color={palette.orange} size={14} />}
              label="Posts"
              value={posts.length}
            />
            <StatChip
              icon={<CommentIcon color={palette.orange} size={14} />}
              label="Comments"
              value={totalComments}
            />
          </View>
        </View>

        <View style={{ gap: spacing[2] }}>
          <AppText variant="h3">Recent posts</AppText>
          {posts.length ? (
            posts.map((post) => {
              const topDish = repository.getDishById(post.dishIds[0]);
              const ratingText = topDish ? topDish.rating.toFixed(1) : "-";

              return (
                <Pressable
                  key={post.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open post at ${post.authorLocation}`}
                  onPress={() =>
                    navigation.navigate("ActivityPostDetail", {
                      postId: post.id,
                    })
                  }
                >
                  <Card
                    style={{
                      borderColor: palette.border,
                      borderWidth: 1,
                      gap: spacing[2],
                      padding: spacing[3],
                    }}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        gap: spacing[2],
                      }}
                    >
                      <Image
                        source={{ uri: post.mediaUrl }}
                        style={{
                          borderRadius: radii.md,
                          height: 56,
                          width: 56,
                        }}
                        contentFit="cover"
                      />
                      <View style={{ flex: 1, gap: spacing[1] }}>
                        <AppText variant="bodyBold" numberOfLines={1}>
                          {topDish?.name ?? post.caption}
                        </AppText>
                        <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>
                          {post.caption}
                        </AppText>
                      </View>
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          gap: spacing[1],
                        }}
                      >
                        <Star color={palette.amber} fill={palette.amber} size={14} />
                        <AppText variant="micro">{ratingText}</AppText>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          ) : (
            <EmptyState
              title="No posts yet"
              body="This user has not posted in the community feed yet."
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  const { palette, radii, spacing } = useHungryTheme();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: palette.bgSoft,
        borderRadius: radii.pill,
        flexDirection: "row",
        gap: spacing[1],
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
      }}
    >
      {icon}
      <AppText variant="micro" style={{ fontWeight: "700" }}>
        {label}: {value}
      </AppText>
    </View>
  );
}
