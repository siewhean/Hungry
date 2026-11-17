import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, Avatar, Button, Card, EmptyState, Input } from "@/components/ui";
import { getRootNavigation } from "@/app/navigation/getRootNavigation";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useHungryTheme } from "@/theme";
import type { ProfileStackParamList } from "./ProfileStack";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<ProfileStackParamList, "Followers" | "Following">;
type Person = Awaited<
  ReturnType<ReturnType<typeof getHungryService>["social"]["listFollowers"]>
>[number];
function ProfileConnectionsScreen({ navigation, route }: Props) {
  const { spacing, palette } = useHungryTheme();
  const root = getRootNavigation(navigation);
  const profileId = useProfileStore((s) => s.profile.id);
  const userId = route.params?.userId ?? profileId;
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setPeople([]);
    const social = getHungryService().social;
    void (route.name === "Followers" ? social.listFollowers(userId) : social.listFollowing(userId))
      .then((next) => {
        if (active) setPeople([...new Map(next.map((person) => [person.userId, person])).values()]);
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
  }, [route.name, userId, attempt]);
  const filtered = useMemo(
    () =>
      people.filter((person) =>
        person.displayName.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [people, query],
  );
  return (
    <ProfileScreenShell title={route.name}>
      <Input
        accessibilityLabel={`Search ${route.name.toLowerCase()}`}
        placeholder="Search people"
        value={query}
        onChangeText={setQuery}
      />
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading connections" color={palette.orange} />
      ) : error ? (
        <Button label="Retry loading connections" onPress={() => setAttempt((v) => v + 1)} />
      ) : filtered.length ? (
        filtered.map((person) => (
          <Pressable
            key={person.userId}
            accessibilityRole="button"
            accessibilityLabel={`Open ${person.displayName}'s profile`}
            onPress={() =>
              root.navigate("UserProfile", {
                authorId: person.userId,
                authorName: person.displayName,
                authorAvatarUrl: person.avatarUrl,
              })
            }
          >
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  minHeight: spacing[12],
                }}
              >
                <Avatar name={person.displayName} uri={person.avatarUrl} size={spacing[12]} />
                <AppText>{person.displayName}</AppText>
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        <EmptyState
          title={query ? "No matching people" : `No ${route.name.toLowerCase()} yet`}
          body="Only confirmed account relationships appear here."
        />
      )}
    </ProfileScreenShell>
  );
}
export function FollowersScreen(props: Props) {
  return <ProfileConnectionsScreen {...props} />;
}
export function FollowingScreen(props: Props) {
  return <ProfileConnectionsScreen {...props} />;
}
