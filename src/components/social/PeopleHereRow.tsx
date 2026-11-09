import { Pressable, ScrollView, View } from "react-native";

import { PersonFollowPill } from "@/components/social/PersonFollowPill";
import { AppText, Avatar, Button } from "@/components/ui";
import { placePeopleSummary, usePlacePeople } from "@/features/social/usePlacePeople";
import type { PlacePerson, PlaceRef } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

/** Avatars the row shows before "See all". */
export const PEOPLE_HERE_LIMIT = 5;

type Props = {
  place: PlaceRef;
  /** Only when follows are live and the diner is signed in. */
  enabled: boolean;
  /** For error reports. */
  screen: string;
  onOpenPerson: (person: PlacePerson) => void;
  onSeeAll: () => void;
  testID?: string;
};

/**
 * People here, on a stall or a dish page: up to five people who reviewed or posted there, the
 * people you follow first. Each avatar opens their profile, with a Follow pill for anyone you do
 * not follow yet. Hidden while loading, when nobody else has been here, or when the read fails.
 */
export function PeopleHereRow({
  place,
  enabled,
  screen,
  onOpenPerson,
  onSeeAll,
  testID = "people-here",
}: Props) {
  const { palette, spacing } = useHungryTheme();
  const { people, totalPeople } = usePlacePeople(place, {
    enabled,
    limit: PEOPLE_HERE_LIMIT,
    screen,
  });
  if (!enabled || people.length === 0) return null;
  return (
    <View testID={testID} style={{ gap: spacing[2] }}>
      <View style={{ gap: spacing[1] }}>
        <AppText variant="h2">People here</AppText>
        <AppText variant="bodySmall" tone="secondary" testID={`${testID}-summary`}>
          {placePeopleSummary(people, totalPeople)}
        </AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[3] }}
      >
        {people.map((person) => (
          <View key={person.userId} style={{ alignItems: "center", gap: spacing[1], width: 76 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${person.displayName}'s profile`}
              accessibilityHint={person.isFollowed ? "You follow them" : undefined}
              onPress={() => onOpenPerson(person)}
              testID={`${testID}-person-${person.userId}`}
              style={{ alignItems: "center", gap: spacing[1], minHeight: 44 }}
            >
              <Avatar uri={person.avatarUrl} name={person.displayName} size={52} />
              <AppText
                variant="micro"
                numberOfLines={1}
                style={{ color: palette.text, maxWidth: 76, textAlign: "center" }}
              >
                {person.displayName}
              </AppText>
            </Pressable>
            {person.isFollowed ? (
              <AppText variant="micro" tone="secondary">
                Following
              </AppText>
            ) : (
              <PersonFollowPill
                userId={person.userId}
                name={person.displayName}
                avatarUrl={person.avatarUrl}
              />
            )}
          </View>
        ))}
      </ScrollView>
      {totalPeople > people.length ? (
        <Button
          label={`See all ${totalPeople} people`}
          variant="ghost"
          fullWidth={false}
          onPress={onSeeAll}
          testID={`${testID}-see-all`}
        />
      ) : null}
    </View>
  );
}
