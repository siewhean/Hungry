import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Search } from "lucide-react-native";

import { AppText, Avatar, Card, EmptyState, Input } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository } from "@/lib/services/serviceProvider";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type ProfileConnectionsRoute = RouteProp<ProfileStackParamList, "Followers" | "Following">;

type UserProfileItem = {
  name: string;
  avatarUrl: string;
  location?: string;
};

type Props = NativeStackScreenProps<ProfileStackParamList, "Followers" | "Following">;

function ProfileConnectionsScreen({ navigation }: Props) {
  const { palette, spacing, radii } = useHungryTheme();
  const route = useRoute<ProfileConnectionsRoute>();
  const rootNavigation = getRootNavigation(navigation as any);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const repository = getDataRepository();
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore((state) => state.profile);
  const normalizedQuery = searchQuery.toLowerCase().trim();

  const communityUsersByName = useMemo<Map<string, UserProfileItem>>(() => {
    const users = new Map<string, UserProfileItem>();

    repository.listStallPosts().forEach((post) => {
      if (!users.has(post.authorName)) {
        users.set(post.authorName, {
          name: post.authorName,
          avatarUrl: post.authorAvatarUrl,
          location: post.authorLocation,
        });
      }
    });

    return users;
  }, [repository]);

  const following = useMemo(() => {
    const followedNames = Object.entries(followedAuthors)
      .filter(([, isFollowing]) => isFollowing)
      .map(([name]) => name);

    return followedNames
      .map((name) => communityUsersByName.get(name) ?? { name, avatarUrl: "" })
      .filter((user) => user.name.trim().length > 0);
  }, [communityUsersByName, followedAuthors]);

  const followerCandidates = useMemo<UserProfileItem[]>(() => {
    const all = Array.from(communityUsersByName.values());
    if (route.name === "Followers") {
      const targetCount = Math.max(0, profile.stats.followersCount);
      if (!targetCount) {
        return [];
      }
      return all.slice(0, Math.min(all.length, targetCount));
    }
    return all.filter((user) => user.name !== profile.displayName);
  }, [communityUsersByName, profile.displayName, profile.stats.followersCount, route.name]);

  const basePeople = route.name === "Following" ? following : followerCandidates;
  const people = useMemo(() => {
    if (!normalizedQuery) return basePeople;
    return basePeople.filter(
      (user) =>
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.location?.toLowerCase().includes(normalizedQuery),
    );
  }, [basePeople, normalizedQuery]);

  const title = route.name === "Followers" ? "Followers" : "Following";
  const emptyTitle = route.name === "Following" ? "No users followed yet" : "No followers yet";
  const emptyBody =
    route.name === "Following"
      ? "You aren't following anyone yet. Start following users to see them here."
      : "You don't have any followers yet.";

  return (
    <ProfileScreenShell title={title}>
      <Input
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={`Search ${title.toLowerCase()}...`}
        leftIcon={<Search size={18} color={palette.textMuted} />}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ScrollView contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {people.length ? (
          people.map((person) => (
            <Pressable
              key={person.name}
              onPress={() =>
                rootNavigation.navigate("UserProfile", {
                  authorName: person.name,
                  authorAvatarUrl: person.avatarUrl,
                  authorLocation: person.location,
                })
              }
              style={({ pressed }) => [
                {
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: 16,
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                },
              ]}
            >
              <Card style={{ padding: spacing[3] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <Avatar name={person.name} uri={person.avatarUrl} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyBold">{person.name}</AppText>
                    {person.location ? (
                      <AppText tone="secondary" numberOfLines={1}>
                        {person.location}
                      </AppText>
                    ) : null}
                  </View>
                  {route.name === "Following"
                    ? (() => {
                        const isFollowing = Boolean(followedAuthors[person.name]);
                        return (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${isFollowing ? "Unfollow" : "Follow"} ${person.name}`}
                            onPress={() => toggleAuthorFollow(person.name)}
                            hitSlop={8}
                            style={[
                              styles.followButton,
                              {
                                backgroundColor: isFollowing ? palette.surface : palette.orange,
                                borderColor: isFollowing ? palette.border : palette.orange,
                                borderRadius: radii.pill,
                              },
                            ]}
                          >
                            <AppText
                              variant="micro"
                              style={{
                                color: isFollowing ? palette.text : palette.white,
                                fontWeight: "800",
                              }}
                            >
                              {isFollowing ? "Following" : "Follow"}
                            </AppText>
                          </Pressable>
                        );
                      })()
                    : null}
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState title={emptyTitle} body={emptyBody} />
        )}
      </ScrollView>
    </ProfileScreenShell>
  );
}

export function FollowersScreen(props: Props) {
  return <ProfileConnectionsScreen {...props} />;
}

export function FollowingScreen(props: Props) {
  return <ProfileConnectionsScreen {...props} />;
}

const styles = StyleSheet.create({
  followButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 78,
    paddingHorizontal: 12,
  },
});
