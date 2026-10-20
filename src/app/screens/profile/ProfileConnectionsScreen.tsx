import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Search } from "lucide-react-native";

import { AppText, Avatar, Button, Card, EmptyState, Input } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";
import { useProfileStore } from "@/store/useProfileStore";
import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

// Also registered on the root stack (UserFollowers/UserFollowing) for other users' profiles.
type ProfileConnectionsRoute = RouteProp<
  ProfileStackParamList & Pick<RootStackParamList, "UserFollowers" | "UserFollowing">,
  "Followers" | "Following" | "UserFollowers" | "UserFollowing"
>;

type UserProfileItem = {
  userId: string;
  name: string;
  avatarUrl: string;
};

type Props =
  | NativeStackScreenProps<ProfileStackParamList, "Followers" | "Following">
  | NativeStackScreenProps<RootStackParamList, "UserFollowers" | "UserFollowing">;

/** Rows per request; matches the list RPCs' default page size. */
const CONNECTIONS_PAGE_SIZE = 100;

function toPersonItems(users: { userId: string; displayName: string; avatarUrl?: string }[]) {
  return users
    .filter((user) => Boolean(user.userId))
    .map((user) => ({
      userId: user.userId,
      name: user.displayName.trim() || "Hungry User",
      avatarUrl: user.avatarUrl ?? "",
    }));
}

function mergePeople(current: UserProfileItem[], next: UserProfileItem[]) {
  const seen = new Set(current.map((person) => person.userId));
  const merged = [...current];
  next.forEach((person) => {
    if (seen.has(person.userId)) return;
    seen.add(person.userId);
    merged.push(person);
  });
  return merged;
}

function ProfileConnectionsScreen({ navigation }: Props) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const route = useRoute<ProfileConnectionsRoute>();
  const rootNavigation = getRootNavigation(navigation as any);
  const followedUserIds = useSocialStore((state) => state.followedUserIds);
  const requestedUserIds = useSocialStore((state) => state.requestedUserIds);
  const toggleFollow = useSocialStore((state) => state.toggleFollow);
  const markFollowedUserIds = useSocialStore((state) => state.markFollowedUserIds);
  const [searchQuery, setSearchQuery] = useState("");
  const profile = useProfileStore((state) => state.profile);
  const targetUserId = route.params?.userId ?? profile.id;
  const targetDisplayName = route.params?.userDisplayName?.trim() || profile.displayName;
  const isOwnProfile = targetUserId === profile.id;
  const isFollowingTab = route.name === "Following" || route.name === "UserFollowing";
  // Lists come only from the server for the profile being viewed; local follow state
  // only drives each row's Follow button.
  const [people, setPeople] = useState<UserProfileItem[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  // Server rows fetched so far (offset for the next page) and whether another page may exist.
  const [loadedRowCount, setLoadedRowCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Private account (viewer not an approved follower) or blocked pair: the lists are hidden.
  const [listsHidden, setListsHidden] = useState(false);
  // A failed read is shown as an error with Retry, never as an empty list.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const normalizedQuery = searchQuery.toLowerCase().trim();

  const loadPage = useCallback(
    (offset: number) => {
      const service = getHungryService().social;
      const page = { limit: CONNECTIONS_PAGE_SIZE, offset };
      return (
        isFollowingTab
          ? service.listFollowing(targetUserId, page)
          : service.listFollowers(targetUserId, page)
      ).then((users) => {
        const nextPeople = toPersonItems(users);
        if (isFollowingTab && isOwnProfile) {
          markFollowedUserIds(nextPeople.map((person) => person.userId));
        }
        return { nextPeople, rowCount: users.length };
      });
    },
    [isFollowingTab, isOwnProfile, markFollowedUserIds, targetUserId],
  );

  useEffect(() => {
    // Rows may show "Requested" for requests approved or declined since they were sent.
    void useSocialStore
      .getState()
      .reconcileRequestedFollows()
      .catch(() => undefined);
  }, [targetUserId, isFollowingTab]);

  useEffect(() => {
    let isActive = true;
    const service = getHungryService().social;
    setIsLoadingConnections(true);
    setListsHidden(false);
    setLoadFailed(false);
    setHasMore(false);
    setLoadedRowCount(0);

    void Promise.all([
      loadPage(0),
      isOwnProfile
        ? Promise.resolve(true)
        : service.canViewFollowLists(targetUserId).catch(() => true),
    ])
      .then(([{ nextPeople, rowCount }, canView]) => {
        if (!isActive) return;
        setListsHidden(!canView);
        setPeople(mergePeople([], nextPeople));
        setLoadedRowCount(rowCount);
        setHasMore(rowCount === CONNECTIONS_PAGE_SIZE);
      })
      .catch((error) => {
        console.error("Failed to load connections:", error);
        if (!isActive) return;
        setPeople([]);
        setLoadFailed(true);
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingConnections(false);
      });

    return () => {
      isActive = false;
    };
  }, [isOwnProfile, loadPage, reloadKey, targetUserId]);

  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    void loadPage(loadedRowCount)
      .then(({ nextPeople, rowCount }) => {
        setPeople((current) => mergePeople(current, nextPeople));
        setLoadedRowCount((current) => current + rowCount);
        setHasMore(rowCount === CONNECTIONS_PAGE_SIZE);
      })
      .catch((error) => {
        console.error("Failed to load more connections:", error);
      })
      .finally(() => setIsLoadingMore(false));
  };

  const visiblePeople = useMemo(() => {
    if (!normalizedQuery) return people;
    return people.filter((user) => user.name.toLowerCase().includes(normalizedQuery));
  }, [people, normalizedQuery]);

  const title = isFollowingTab ? "Following" : "Followers";
  const emptyTitle = listsHidden
    ? "This account is private"
    : isFollowingTab
      ? "No users followed yet"
      : "No followers yet";
  const emptyBody = listsHidden
    ? `Only ${targetDisplayName}'s approved followers can see this list.`
    : isFollowingTab
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
      <View style={{ gap: spacing[3], paddingBottom: spacing[5] }}>
        {isLoadingConnections ? (
          <View style={{ alignItems: "center", paddingTop: spacing[3], gap: spacing[2] }}>
            <ActivityIndicator color={palette.orange} />
            <EmptyState title={loadingTitle} body={loadingBody} />
          </View>
        ) : loadFailed ? (
          <View style={{ gap: spacing[3] }}>
            <EmptyState
              title={`Couldn't load ${title.toLowerCase()}`}
              body="Check your connection and try again."
            />
            <Button
              label="Retry"
              variant="secondary"
              size="sm"
              onPress={() => setReloadKey((current) => current + 1)}
            />
          </View>
        ) : visiblePeople.length ? (
          visiblePeople.map((person) => (
            <Pressable
              key={person.userId}
              accessibilityRole="button"
              accessibilityLabel={person.name}
              accessibilityHint="Opens their profile"
              onPress={() =>
                rootNavigation.navigate("UserProfile", {
                  authorName: person.name,
                  authorAvatarUrl: person.avatarUrl,
                  authorId: person.userId,
                })
              }
              // Card draws the border; the row only dims while pressed.
              style={({ pressed }) => [
                { borderRadius: componentRadii.card, opacity: pressed ? 0.85 : 1 },
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
                    const isRequested = !isFollowing && Boolean(requestedUserIds[person.userId]);
                    const isMuted = isFollowing || isRequested;
                    const label = isRequested ? "Requested" : isFollowing ? "Following" : "Follow";
                    if (!canShowFollowButton) return null;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isRequested
                            ? `Follow request sent to ${person.name}`
                            : `${label} ${person.name}`
                        }
                        accessibilityHint={isRequested ? "Cancels your follow request" : undefined}
                        onPress={() => toggleFollow(person.userId)}
                        hitSlop={8}
                        style={[
                          styles.followButton,
                          {
                            backgroundColor: isMuted ? palette.surface : palette.orange,
                            borderColor: isMuted ? palette.border : palette.orange,
                            borderRadius: componentRadii.button,
                          },
                        ]}
                      >
                        <AppText
                          variant="micro"
                          style={{
                            color: isMuted ? palette.text : palette.white,
                            fontWeight: "800",
                          }}
                        >
                          {label}
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
        {!isLoadingConnections && hasMore ? (
          <Button
            label="Load more"
            variant="ghost"
            size="sm"
            loading={isLoadingMore}
            onPress={loadMore}
          />
        ) : null}
      </View>
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
    // With the 8pt hitSlop the tap target is at least 44pt.
    minHeight: 36,
    minWidth: 78,
    paddingHorizontal: 12,
  },
});
