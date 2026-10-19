import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Search } from "lucide-react-native";

import { AppText, Avatar, Card, EmptyState, Input } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type ProfileConnectionsRoute = RouteProp<ProfileStackParamList, "Followers" | "Following">;

type UserProfileItem = {
  userId: string;
  name: string;
  avatarUrl: string;
};

type Props = NativeStackScreenProps<ProfileStackParamList, "Followers" | "Following">;

function ProfileConnectionsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const route = useRoute<ProfileConnectionsRoute>();
  const rootNavigation = getRootNavigation(navigation as any);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const markFollowedUserIds = useSocialStore((state) => state.markFollowedUserIds);
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore((state) => state.profile);
  const targetUserId = route.params?.userId ?? profile.id;
  const targetDisplayName = route.params?.userDisplayName?.trim() || profile.displayName;
  const isOwnProfile = targetUserId === profile.id;
  const isFollowingTab = route.name === "Following";
  // Lists come only from the server for the profile being viewed; local follow state
  // only drives each row's Follow button.
  const [people, setPeople] = useState<UserProfileItem[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const normalizedQuery = searchQuery.toLowerCase().trim();

  useEffect(() => {
    let isActive = true;
    const service = getHungryService().social;
    setIsLoadingConnections(true);

    void (
      isFollowingTab ? service.listFollowing(targetUserId) : service.listFollowers(targetUserId)
    )
      .then((users) => {
        if (!isActive) return;
        const seen = new Set<string>();
        const nextPeople = users
          .filter((user) => {
            if (!user.userId || seen.has(user.userId)) return false;
            seen.add(user.userId);
            return true;
          })
          .map((user) => ({
            userId: user.userId,
            name: user.displayName.trim() || "Hungry User",
            avatarUrl: user.avatarUrl ?? "",
          }));
        if (isFollowingTab && isOwnProfile) {
          markFollowedUserIds(nextPeople.map((person) => person.userId));
        }
        setPeople(nextPeople);
      })
      .catch(() => {
        if (!isActive) return;
        setPeople([]);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingConnections(false);
      });

    return () => {
      isActive = false;
    };
  }, [isFollowingTab, isOwnProfile, markFollowedUserIds, targetUserId]);

  const visiblePeople = useMemo(() => {
    if (!normalizedQuery) return people;
    return people.filter((user) => user.name.toLowerCase().includes(normalizedQuery));
  }, [people, normalizedQuery]);

  const title = route.name === "Followers" ? "Followers" : "Following";
  const emptyTitle = isFollowingTab ? "No users followed yet" : "No followers yet";
  const emptyBody = isFollowingTab
    ? isOwnProfile
      ? "You aren't following anyone yet. Start following users to see them here."
      : `${targetDisplayName} isn't following anyone yet.`
    : isOwnProfile
      ? "You don't have any followers yet."
      : `${targetDisplayName} doesn't have any followers yet.`;
  const loadingTitle = isFollowingTab ? "Loading following" : "Loading followers";
  const loadingBody = isFollowingTab
    ? isOwnProfile
      ? "Fetching users you follow."
      : `Fetching users ${targetDisplayName} follows.`
    : `Fetching ${isOwnProfile ? "your" : `${targetDisplayName}'s`} followers.`;

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
        ) : visiblePeople.length ? (
          visiblePeople.map((person) => (
            <Pressable
              key={person.userId}
              onPress={() =>
                rootNavigation.navigate("UserProfile", {
                  authorName: person.name,
                  authorAvatarUrl: person.avatarUrl,
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
                    const canShowFollowButton = person.userId !== profile.id;
                    const isFollowing = Boolean(followedUserIds[person.userId]);
                    if (!canShowFollowButton) return null;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${isFollowing ? "Following" : "Follow"} ${person.name}`}
                        onPress={() => toggleFollow(person.userId)}
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
