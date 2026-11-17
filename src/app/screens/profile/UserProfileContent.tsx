import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { NavigationProp } from "@react-navigation/native";
import { AccessibleImage, AppText, Avatar, Button, Card, EmptyState } from "@/components/ui";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";
import type { Bite } from "@/lib/services/types";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = {
  navigation: NavigationProp<RootStackParamList>;
  authorName: string;
  authorAvatarUrl?: string;
  authorId?: string;
};
export function UserProfileContent({ navigation, authorName, authorAvatarUrl, authorId }: Props) {
  const { spacing, palette } = useHungryTheme();
  const root = getRootNavigation(navigation);
  const viewerId = useProfileStore((s) => s.profile.id);
  const safetyVersion = useSocialStore((s) => s.followedUserIds);
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const [posts, setPosts] = useState<Bite[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [followState, setFollowState] = useState<"none" | "pending" | "approved">("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setPosts([]);
    setReviews([]);
    if (!authorId) {
      setLoading(false);
      return;
    }
    const service = getHungryService();
    void Promise.all([
      service.social.listUserPosts(authorId),
      service.reviews.getUserReviews(authorId),
      service.social.listFollowers(authorId),
      service.social.listFollowing(authorId),
      service.social.getFollowState(authorId),
    ])
      .then(([nextPosts, nextReviews, followers, following, relationship]) => {
        if (!active) return;
        setPosts(nextPosts.filter((post) => post.authorId === authorId));
        setReviews(nextReviews.filter((review) => review.authorId === authorId));
        setCounts({
          followers: new Set(followers.map((person) => person.userId)).size,
          following: new Set(following.map((person) => person.userId)).size,
        });
        setFollowState(relationship);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authorId, attempt, safetyVersion]);
  const toggleFollow = async () => {
    if (!authorId || busy) return;
    const target = authorId;
    setBusy(true);
    try {
      const social = getHungryService().social;
      if (followState === "none") await social.followUser(target);
      else await social.unfollowUser(target);
      const next = await social.getFollowState(target);
      setFollowState(next);
      setAttempt((value) => value + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const connections = (target: "Followers" | "Following") => {
    if (authorId)
      root.navigate("MainTabs", {
        screen: "Profile",
        params: { screen: target, params: { userId: authorId, userDisplayName: authorName } },
      });
  };
  return (
    <ProfileScreenShell title={authorName}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
        <Avatar name={authorName} uri={authorAvatarUrl} size={spacing[20]} />
        <AppText variant="h1">{authorName}</AppText>
      </View>
      {!authorId ? (
        <EmptyState
          title="Profile unavailable"
          body="This legacy contribution has no verified account identity."
        />
      ) : (
        <>
          {authorId !== viewerId ? (
            <Button
              label={
                followState === "pending"
                  ? "Requested · Cancel request"
                  : followState === "approved"
                    ? "Following · Unfollow"
                    : "Follow"
              }
              loading={busy}
              disabled={busy || loading}
              onPress={() => void toggleFollow()}
            />
          ) : null}
          {loading ? (
            <ActivityIndicator accessibilityLabel="Loading profile" color={palette.orange} />
          ) : error ? (
            <Button label="Retry loading profile" onPress={() => setAttempt((v) => v + 1)} />
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
                <Button
                  variant="secondary"
                  label={`${counts.followers} Followers`}
                  onPress={() => connections("Followers")}
                />
                <Button
                  variant="secondary"
                  label={`${counts.following} Following`}
                  onPress={() => connections("Following")}
                />
              </View>
              <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: spacing[3] }}>
                {(["posts", "reviews"] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === value }}
                    onPress={() => setTab(value)}
                    style={{ padding: spacing[3], minHeight: spacing[12] }}
                  >
                    <AppText tone={tab === value ? "accent" : "muted"}>
                      {value === "posts"
                        ? `Posts (${posts.length})`
                        : `Reviews (${reviews.length})`}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              {tab === "reviews" ? (
                reviews.length ? (
                  reviews.map((review) => (
                    <Card key={review.id}>
                      <AppText>{review.text || "Rating only"}</AppText>
                      <AppText tone="muted">
                        {review.rating}/5 · {new Date(review.createdAt).toLocaleDateString()}
                      </AppText>
                      {review.dishId ? (
                        <Button
                          variant="secondary"
                          label="View dish"
                          onPress={() => root.navigate("DishDetail", { dishId: review.dishId! })}
                        />
                      ) : null}
                    </Card>
                  ))
                ) : (
                  <EmptyState
                    title="No public reviews"
                    body="Published reviews appear here when available."
                  />
                )
              ) : posts.length ? (
                posts.map((post) => (
                  <Card key={post.id}>
                    <AccessibleImage
                      source={{ uri: post.photoUrl }}
                      accessibilityLabel={post.dishName}
                      style={{ width: "100%", height: spacing[24] + spacing[16] }}
                      contentFit="cover"
                    />
                    <AppText variant="h3">{post.dishName}</AppText>
                    <AppText>{post.caption || "Shared dish"}</AppText>
                    <Button
                      variant="secondary"
                      label="View dish"
                      onPress={() => root.navigate("DishDetail", { dishId: post.dishId })}
                    />
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="No public posts"
                  body="Published posts appear here when available."
                />
              )}
            </>
          )}
        </>
      )}
    </ProfileScreenShell>
  );
}
