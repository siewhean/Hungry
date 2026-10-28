import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Search } from "lucide-react-native";

import { AppText, Avatar, Button, Card, EmptyState, Input } from "@/components/ui";
import { FollowPillButton } from "@/components/social/FollowPillButton";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { reportError } from "@/lib/monitoring/reportError";
import { confirmAction } from "@/lib/runtime/confirmAction";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSocialStore } from "@/store/useSocialStore";
import { useUIStore } from "@/store/useUIStore";
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
/** People-search results shown under your Following list. */
const FIND_PEOPLE_LIMIT = 20;
const FIND_PEOPLE_DEBOUNCE_MS = 350;

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

/**
 * One person. The row that opens their profile and the Follow / Remove buttons are siblings, not
 * nested: an accessible parent groups its children on iOS, which would hide the buttons from
 * VoiceOver.
 */
const PersonRow = memo(function PersonRow({
  person,
  viewerId,
  canRemove,
  onOpen,
  onRemove,
}: {
  person: UserProfileItem;
  viewerId: string;
  /** Your own Followers list: offer "Remove", and "Follow back" for people you do not follow. */
  canRemove: boolean;
  onOpen: (person: UserProfileItem) => void;
  onRemove: (person: UserProfileItem) => void;
}) {
  const { palette, spacing } = useHungryTheme();
  const followPress = useFollowPress();
  const isFollowing = useSocialStore((state) => Boolean(state.followedUserIds[person.userId]));
  const isRequested = useSocialStore(
    (state) =>
      !state.followedUserIds[person.userId] && Boolean(state.requestedUserIds[person.userId]),
  );
  const canShowFollowButton = person.userId !== viewerId;
  const label = isRequested
    ? "Requested"
    : isFollowing
      ? "Following"
      : canRemove
        ? "Follow back"
        : "Follow";

  return (
    <Card style={{ padding: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={person.name}
          accessibilityHint="Opens their profile"
          onPress={() => onOpen(person)}
          style={({ pressed }) => ({
            alignItems: "center",
            flex: 1,
            flexDirection: "row",
            gap: spacing[3],
            minWidth: 0,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Avatar name={person.name} uri={person.avatarUrl} size={44} />
          <AppText variant="bodyBold" numberOfLines={1} style={{ flex: 1, color: palette.text }}>
            {person.name}
          </AppText>
        </Pressable>
        {canShowFollowButton ? (
          <FollowPillButton
            label={label}
            accessibilityLabel={
              isRequested ? `Follow request sent to ${person.name}` : `${label} ${person.name}`
            }
            accessibilityHint={isRequested ? "Cancels your follow request" : undefined}
            muted={isFollowing || isRequested}
            onPress={() =>
              followPress({
                userId: person.userId,
                name: person.name,
                avatarUrl: person.avatarUrl,
              })
            }
          />
        ) : null}
        {canRemove && canShowFollowButton ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${person.name} as a follower`}
            hitSlop={8}
            onPress={() => onRemove(person)}
            style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: spacing[1] }}
          >
            <AppText variant="micro" tone="secondary" style={{ fontWeight: "800" }}>
              Remove
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
});

function ProfileConnectionsScreen({ navigation }: Props) {
  const { palette, spacing } = useHungryTheme();
  const route = useRoute<ProfileConnectionsRoute>();
  const rootNavigation = getRootNavigation(navigation as any);
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
        reportError(error, { screen: "ProfileConnections", action: "load_connections" });
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

  const loadMore = useCallback(() => {
    if (isLoadingConnections || isLoadingMore || !hasMore || loadFailed) return;
    setIsLoadingMore(true);
    void loadPage(loadedRowCount)
      .then(({ nextPeople, rowCount }) => {
        setPeople((current) => mergePeople(current, nextPeople));
        setLoadedRowCount((current) => current + rowCount);
        setHasMore(rowCount === CONNECTIONS_PAGE_SIZE);
      })
      .catch((error) => {
        reportError(error, { screen: "ProfileConnections", action: "load_more_connections" });
        // Stop auto-paging after a failure; scrolling away and back tries again.
        setHasMore(false);
      })
      .finally(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingConnections, isLoadingMore, loadFailed, loadPage, loadedRowCount]);

  const visiblePeople = useMemo(() => {
    if (!normalizedQuery) return people;
    return people.filter((user) => user.name.toLowerCase().includes(normalizedQuery));
  }, [people, normalizedQuery]);

  // Find people: your own Following list also searches everyone on Hungry (server side).
  const canFindPeople = isOwnProfile && isFollowingTab;
  const [foundPeople, setFoundPeople] = useState<UserProfileItem[]>([]);
  const [isFindingPeople, setIsFindingPeople] = useState(false);
  const [findPeopleFailed, setFindPeopleFailed] = useState(false);
  useEffect(() => {
    if (!canFindPeople || normalizedQuery.length < 2) {
      setFoundPeople([]);
      setIsFindingPeople(false);
      setFindPeopleFailed(false);
      return;
    }
    let isActive = true;
    setIsFindingPeople(true);
    setFindPeopleFailed(false);
    const timer = setTimeout(() => {
      void getHungryService()
        .social.searchProfiles(normalizedQuery, { limit: FIND_PEOPLE_LIMIT })
        .then((rows) => {
          if (isActive) setFoundPeople(toPersonItems(rows));
        })
        .catch((error) => {
          reportError(error, { screen: "ProfileConnections", action: "find_people" });
          if (!isActive) return;
          setFoundPeople([]);
          setFindPeopleFailed(true);
        })
        .finally(() => {
          if (isActive) setIsFindingPeople(false);
        });
    }, FIND_PEOPLE_DEBOUNCE_MS);
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [canFindPeople, normalizedQuery]);
  const knownIds = useMemo(() => new Set(people.map((person) => person.userId)), [people]);
  const newPeople = useMemo(
    () => foundPeople.filter((person) => !knownIds.has(person.userId)),
    [foundPeople, knownIds],
  );

  const openPerson = useCallback(
    (person: UserProfileItem) =>
      rootNavigation.navigate("UserProfile", {
        authorName: person.name,
        authorAvatarUrl: person.avatarUrl,
        authorId: person.userId,
      }),
    [rootNavigation],
  );

  const removeFollower = useCallback(
    (person: UserProfileItem) => {
      const followAgain =
        profile.profileVisibility === "private"
          ? "They won't be told, and they'd need your approval to follow you again."
          : "They won't be told, and they can follow you again.";
      confirmAction({
        title: `Remove ${person.name}?`,
        message: followAgain,
        confirmLabel: "Remove",
        destructive: true,
        onConfirm: () => {
          void getHungryService()
            .social.removeFollower(person.userId)
            .then(() => {
              setPeople((current) => current.filter((item) => item.userId !== person.userId));
              useUIStore
                .getState()
                .showToast({ message: `${person.name} no longer follows you.`, tone: "info" });
            })
            .catch((error) => {
              reportError(error, { screen: "ProfileConnections", action: "remove_follower" });
              useUIStore.getState().showToast({
                message: "Couldn't remove the follower. Please try again.",
                tone: "error",
              });
            });
        },
      });
    },
    [profile.profileVisibility],
  );

  const title = isFollowingTab ? "Following" : "Followers";
  const emptyTitle = listsHidden
    ? "This account is private"
    : normalizedQuery
      ? "No matches"
      : isFollowingTab
        ? "Not following anyone yet"
        : "No followers yet";
  const emptyBody = listsHidden
    ? `Only ${targetDisplayName}'s approved followers can see this list.`
    : normalizedQuery
      ? hasMore || isLoadingMore
        ? "Still searching the people loaded so far."
        : `Nobody in ${title.toLowerCase()} matches "${searchQuery.trim()}".`
      : isFollowingTab
        ? isOwnProfile
          ? "You aren't following anyone yet. Search by name above to find people."
          : `${targetDisplayName} isn't following anyone yet.`
        : isOwnProfile
          ? "You don't have any followers yet."
          : `${targetDisplayName} doesn't have any followers yet.`;
  const loadingTitle = isFollowingTab ? "Loading people you follow" : "Loading followers";
  const loadingBody = isFollowingTab
    ? isOwnProfile
      ? "Fetching users you follow."
      : `Fetching users ${targetDisplayName} follows.`
    : `Fetching ${isOwnProfile ? "your" : `${targetDisplayName}'s`} followers.`;

  const emptyComponent = isLoadingConnections ? (
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
  ) : canFindPeople && normalizedQuery.length >= 2 ? null : (
    <EmptyState title={emptyTitle} body={emptyBody} />
  );

  const footerComponent = (
    <View style={{ gap: spacing[3] }}>
      {isLoadingMore ? <ActivityIndicator color={palette.orange} /> : null}
      {normalizedQuery && hasMore && !isLoadingConnections && !loadFailed ? (
        // The list pages in as you scroll; the search only sees the people loaded so far.
        <AppText variant="micro" tone="muted" style={{ textAlign: "center" }}>
          Search covers the {people.length} people loaded so far. Scroll to load more.
        </AppText>
      ) : null}
      {canFindPeople && normalizedQuery.length >= 2 ? (
        <View style={{ gap: spacing[3] }} testID="find-people-results">
          <AppText variant="h3">People on Hungry</AppText>
          {isFindingPeople ? (
            <ActivityIndicator color={palette.orange} accessibilityLabel="Searching people" />
          ) : findPeopleFailed ? (
            <AppText tone="secondary">Couldn&apos;t search people right now. Try again.</AppText>
          ) : newPeople.length === 0 ? (
            <AppText tone="secondary">No one new matches that name.</AppText>
          ) : (
            newPeople.map((person) => (
              <PersonRow
                key={person.userId}
                person={person}
                viewerId={profile.id}
                canRemove={false}
                onOpen={openPerson}
                onRemove={removeFollower}
              />
            ))
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <ProfileScreenShell title={title} scroll={false}>
      <Input
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={
          canFindPeople ? "Search or find people..." : `Search ${title.toLowerCase()}...`
        }
        accessibilityLabel={`Search ${title.toLowerCase()}`}
        leftIcon={<Search size={18} color={palette.textMuted} />}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        style={{ flex: 1 }}
        data={isLoadingConnections || loadFailed ? [] : visiblePeople}
        keyExtractor={(person) => person.userId}
        renderItem={({ item }) => (
          <PersonRow
            person={item}
            viewerId={profile.id}
            canRemove={isOwnProfile && !isFollowingTab}
            onOpen={openPerson}
            onRemove={removeFollower}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={footerComponent}
        ListFooterComponentStyle={{ paddingTop: spacing[3] }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
      />
    </ProfileScreenShell>
  );
}

export function FollowersScreen(props: Props) {
  return <ProfileConnectionsScreen {...props} />;
}

export function FollowingScreen(props: Props) {
  return <ProfileConnectionsScreen {...props} />;
}
