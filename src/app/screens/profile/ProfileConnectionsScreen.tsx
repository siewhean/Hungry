import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Search } from "lucide-react-native";

import { AppText, Avatar, Card, EmptyState, Input } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
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

type ConversationProfile = {
  name: string;
  avatarUrl: string;
};

type Props = NativeStackScreenProps<ProfileStackParamList, "Followers" | "Following">;

function normalizePersonName(name: string) {
  return name.trim().toLowerCase();
}

function ProfileConnectionsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const route = useRoute<ProfileConnectionsRoute>();
  const rootNavigation = getRootNavigation(navigation as any);
  const followedAuthors = useSocialStore((state) => state.followedAuthors);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const repository = getDataRepository();
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore((state) => state.profile);
  const [chatProfilesByName, setChatProfilesByName] = useState<Record<string, ConversationProfile>>(
    {},
  );
  const [communityPostsByAuthor, setCommunityPostsByAuthor] = useState<UserProfileItem[]>([]);
  const normalizedQuery = searchQuery.toLowerCase().trim();

  useEffect(() => {
    let isActive = true;
    void listSharedStallPosts().then((posts) => {
      if (!isActive) return;
      setCommunityPostsByAuthor(
        posts.map((post) => ({
          name: post.authorName,
          avatarUrl: post.authorAvatarUrl ?? "",
          location: post.authorLocation,
        })),
      );
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    void getHungryService()
      .chat.listConversations()
      .then((conversations) => {
        if (!isActive) return;
        const next: Record<string, ConversationProfile> = {};

        conversations.forEach((conversation) => {
          const conversationAvatar = conversation.avatarUrl?.trim();

          conversation.participants.forEach((participant) => {
            const normalizedName = normalizePersonName(participant.displayName);
            const avatarUrl = participant.avatarUrl?.trim();

            const resolvedAvatar =
              avatarUrl ||
              (conversationAvatar && !participant.isCurrentUser ? conversationAvatar : "");

            if (!normalizedName || !resolvedAvatar) {
              return;
            }

            if (!next[normalizedName]) {
              next[normalizedName] = {
                name: participant.displayName,
                avatarUrl: resolvedAvatar,
              };
            }
          });
        });

        setChatProfilesByName(next);
      })
      .catch(() => {
        if (!isActive) return;
        setChatProfilesByName({});
      });

    return () => {
      isActive = false;
    };
  }, []);

  const communityUsersByName = useMemo<Map<string, UserProfileItem>>(() => {
    const users = new Map<string, UserProfileItem>();

    const upsertUser = (name: string, avatarUrl?: string, location?: string) => {
      const normalizedName = normalizePersonName(name);
      if (!normalizedName) return;

      const existing = users.get(normalizedName);
      users.set(normalizedName, {
        name: existing?.name ?? name.trim(),
        avatarUrl: avatarUrl?.trim() || existing?.avatarUrl || "",
        location: location?.trim() || existing?.location,
      });
    };

    repository.listStallPosts().forEach((post) => {
      upsertUser(post.authorName, post.authorAvatarUrl, post.authorLocation);
    });

    communityPostsByAuthor.forEach((post) => {
      upsertUser(post.name, post.avatarUrl, post.location);
    });

    Object.values(commentsByPostId).forEach((comments) => {
      comments.forEach((comment) => {
        upsertUser(comment.authorName, comment.authorAvatarUrl, undefined);
      });
    });

    Object.values(repliesByCommentId).forEach((replies) => {
      replies.forEach((reply) => {
        upsertUser(reply.authorName, reply.authorAvatarUrl, undefined);
      });
    });

    Object.values(chatProfilesByName).forEach((profile) => {
      upsertUser(profile.name, profile.avatarUrl, undefined);
    });

    return users;
  }, [
    chatProfilesByName,
    commentsByPostId,
    communityPostsByAuthor,
    repliesByCommentId,
    repository,
  ]);

  const following = useMemo(() => {
    const followedNames = Object.entries(followedAuthors)
      .filter(([, isFollowing]) => isFollowing)
      .map(([name]) => name.trim());

    return followedNames
      .map((name) => {
        const normalizedName = normalizePersonName(name);
        return (
          communityUsersByName.get(normalizedName) ?? {
            name,
            avatarUrl: "",
            location: undefined,
          }
        );
      })
      .filter((user) => user.name.trim().length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [communityUsersByName, followedAuthors]);

  const followerCandidates = useMemo<UserProfileItem[]>(() => {
    const all = Array.from(communityUsersByName.values());
    if (route.name === "Followers") {
      const normalizedProfileName = normalizePersonName(profile.displayName);
      return [...all]
        .filter((user) => user.name.trim().length > 0)
        .filter((user) => normalizePersonName(user.name) !== normalizedProfileName)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const normalizedProfileName = normalizePersonName(profile.displayName);
    return all.filter((user) => normalizePersonName(user.name) !== normalizedProfileName);
  }, [communityUsersByName, profile.displayName, route.name]);

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
                  borderRadius: componentRadii.card,
                  backgroundColor: pressed ? palette.bgSoft : palette.surface,
                },
              ]}
            >
              <Card style={{ padding: spacing[3] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
                  <Avatar name={person.name} uri={person.avatarUrl} size={44} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyBold">{person.name}</AppText>
                  </View>
                  {route.name === "Following"
                    ? (() => {
                        const isFollowing =
                          Boolean(followedAuthors[person.name]) ||
                          Boolean(followedAuthors[normalizePersonName(person.name)]);
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
                                borderRadius: componentRadii.button,
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
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 78,
    paddingHorizontal: 12,
  },
});
