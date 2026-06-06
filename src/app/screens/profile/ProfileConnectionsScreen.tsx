import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Search } from "lucide-react-native";

import { AppText, Avatar, Card, EmptyState, Input } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
} from "@/lib/services/serviceProvider";
import { listSharedStallPosts } from "@/features/social/sharedStallPosts";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type ProfileConnectionsRoute = RouteProp<ProfileStackParamList, "Followers" | "Following">;

type UserProfileItem = {
  userId?: string;
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
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const commentsByPostId = useSocialStore((state) => state.commentsByPostId);
  const repliesByCommentId = useSocialStore((state) => state.repliesByCommentId);
  const toggleAuthorFollow = useSocialStore((state) => state.toggleAuthorFollow);
  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const repository = getDataRepository();
  const serviceProviderMode = getServiceProvider().mode;
  const canUseAuthorFallbackFollow =
    serviceProviderMode === "mock" || (typeof __DEV__ !== "undefined" && __DEV__);
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore((state) => state.profile);
  const targetUserId = route.params?.userId ?? profile.id;
  const targetDisplayName = route.params?.userDisplayName?.trim() || profile.displayName;
  const [chatProfilesByName, setChatProfilesByName] = useState<Record<string, ConversationProfile>>(
    {},
  );
  const [communityPostsByAuthor, setCommunityPostsByAuthor] = useState<UserProfileItem[]>([]);
  const [serviceFollowers, setServiceFollowers] = useState<UserProfileItem[]>([]);
  const [serviceFollowing, setServiceFollowing] = useState<UserProfileItem[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const normalizedQuery = searchQuery.toLowerCase().trim();

  useEffect(() => {
    let isActive = true;
    void listSharedStallPosts().then((posts) => {
      if (!isActive) return;
      setCommunityPostsByAuthor(
        posts.map((post) => ({
          userId: post.authorId,
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
    const service = getHungryService().social;
    setIsLoadingConnections(true);

    void Promise.all([service.listFollowers(targetUserId), service.listFollowing(targetUserId)])
      .then(([followers, following]) => {
        if (!isActive) return;
        setServiceFollowers(
          followers.map((user) => ({
            userId: user.userId,
            name: user.displayName,
            avatarUrl: user.avatarUrl ?? "",
          })),
        );
        setServiceFollowing(
          following.map((user) => ({
            userId: user.userId,
            name: user.displayName,
            avatarUrl: user.avatarUrl ?? "",
          })),
        );
      })
      .catch(() => {
        if (!isActive) return;
        setServiceFollowers([]);
        setServiceFollowing([]);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingConnections(false);
      });

    return () => {
      isActive = false;
    };
  }, [targetUserId]);

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

    const upsertUser = (name: string, avatarUrl?: string, location?: string, userId?: string) => {
      const normalizedName = normalizePersonName(name);
      const key = userId?.trim() || normalizedName;
      if (!key) return;

      const existing = users.get(key);
      users.set(key, {
        userId: userId ?? existing?.userId,
        name: existing?.name ?? name.trim(),
        avatarUrl: avatarUrl?.trim() || existing?.avatarUrl || "",
        location: location?.trim() || existing?.location,
      });
    };

    repository.listStallPosts().forEach((post) => {
      upsertUser(post.authorName, post.authorAvatarUrl, post.authorLocation, post.authorId);
    });

    communityPostsByAuthor.forEach((post) => {
      upsertUser(post.name, post.avatarUrl, post.location, post.userId);
    });

    Object.values(commentsByPostId).forEach((comments) => {
      comments.forEach((comment) => {
        upsertUser(comment.authorName, comment.authorAvatarUrl, undefined, comment.userId);
      });
    });

    Object.values(repliesByCommentId).forEach((replies) => {
      replies.forEach((reply) => {
        upsertUser(reply.authorName, reply.authorAvatarUrl, undefined, reply.userId);
      });
    });

    Object.values(chatProfilesByName).forEach((profile) => {
      upsertUser(profile.name, profile.avatarUrl, undefined);
    });

    [...serviceFollowers, ...serviceFollowing].forEach((user) => {
      upsertUser(user.name, user.avatarUrl, user.location, user.userId);
    });

    return users;
  }, [
    chatProfilesByName,
    commentsByPostId,
    communityPostsByAuthor,
    repliesByCommentId,
    repository,
    serviceFollowers,
    serviceFollowing,
  ]);

  const following = useMemo(() => {
    const followedById = Object.entries(followedUserIds)
      .filter(([, isFollowing]) => isFollowing)
      .map(([userId]) => {
        return (
          communityUsersByName.get(userId) ??
          serviceFollowing.find((user) => user.userId === userId) ?? {
            userId,
            name: userId,
            avatarUrl: "",
            location: undefined,
          }
        );
      });
    const followedNames = canUseAuthorFallbackFollow
      ? Object.entries(followedAuthors)
          .filter(([, isFollowing]) => isFollowing)
          .map(([name]) => name.trim())
      : [];

    const followedByName = followedNames
      .map((name) => {
        const normalizedName = normalizePersonName(name);
        return (
          Array.from(communityUsersByName.values()).find(
            (user) => normalizePersonName(user.name) === normalizedName,
          ) ?? {
            name,
            avatarUrl: "",
            location: undefined,
          }
        );
      })
      .filter((user) => user.name.trim().length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const seen = new Set<string>();
    return [...serviceFollowing, ...followedById, ...followedByName]
      .filter((user) => {
        const key = normalizePersonName(user.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    canUseAuthorFallbackFollow,
    communityUsersByName,
    followedAuthors,
    followedUserIds,
    serviceFollowing,
  ]);

  const followerCandidates = useMemo<UserProfileItem[]>(() => {
    const all = [...serviceFollowers, ...Array.from(communityUsersByName.values())];
    const dedupeByName = (users: UserProfileItem[]) => {
      const seen = new Set<string>();

      return users.filter((user) => {
        const key = normalizePersonName(user.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    if (route.name === "Followers") {
      const normalizedProfileName = normalizePersonName(targetDisplayName);
      return dedupeByName(
        [...all]
          .filter((user) => user.name.trim().length > 0)
          .filter((user) => normalizePersonName(user.name) !== normalizedProfileName),
      ).sort((a, b) => a.name.localeCompare(b.name));
    }
    const normalizedProfileName = normalizePersonName(targetDisplayName);
    return dedupeByName(
      all.filter((user) => normalizePersonName(user.name) !== normalizedProfileName),
    );
  }, [communityUsersByName, route.name, serviceFollowers, targetDisplayName]);

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
  const loadingTitle = route.name === "Following" ? "Loading following" : "Loading followers";
  const loadingBody =
    route.name === "Following"
      ? "Fetching users you follow."
      : "Fetching followers connected to this user.";

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
        {isLoadingConnections ? (
          <View style={{ alignItems: "center", paddingTop: spacing[3], gap: spacing[2] }}>
            <ActivityIndicator color={palette.orange} />
            <EmptyState title={loadingTitle} body={loadingBody} />
          </View>
        ) : people.length ? (
          people.map((person) => (
            <Pressable
              key={person.userId ?? person.name}
              onPress={() =>
                rootNavigation.navigate("UserProfile", {
                  authorName: person.name,
                  authorAvatarUrl: person.avatarUrl,
                  authorLocation: person.location,
                  authorId: person.userId,
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
                  {(() => {
                    const canShowFollowButton =
                      Boolean(person.userId) || canUseAuthorFallbackFollow;
                    const isFollowing =
                      Boolean(person.userId && followedUserIds[person.userId]) ||
                      (canUseAuthorFallbackFollow &&
                        (Boolean(followedAuthors[person.name]) ||
                          Boolean(followedAuthors[normalizePersonName(person.name)])));
                    if (!canShowFollowButton) return null;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${isFollowing ? "Following" : "Follow"} ${person.name}`}
                        onPress={() =>
                          person.userId
                            ? toggleFollow(person.userId)
                            : toggleAuthorFollow(person.name)
                        }
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
                  })()}
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
