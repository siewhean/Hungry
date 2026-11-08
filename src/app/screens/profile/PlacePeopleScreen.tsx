import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/app/navigation/navigationTypes";
import { ReviewBubblesIllustration } from "@/components/icons/food/PlaceIllustrations";
import { PersonFollowPill } from "@/components/social/PersonFollowPill";
import { AppSymbol, AppText, Avatar, EmptyState, ListRow } from "@/components/ui";
import { placePeopleSummary, usePlacePeople } from "@/features/social/usePlacePeople";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { PlaceRef } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";
import { ProfileScreenShell } from "./ProfileScreenShell";

type Props = NativeStackScreenProps<RootStackParamList, "PlacePeople">;

/** The most people the list asks for (get_place_people's cap). */
export const PLACE_PEOPLE_LIST_LIMIT = 10;

function contributionLine(isFollowed: boolean, contributions: number): string {
  const count = contributions === 1 ? "1 review or post" : `${contributions} reviews and posts`;
  return isFollowed ? `Following, ${count}` : count;
}

/**
 * Everyone People here stands for, at one stall or one dish: the people you follow first, then
 * the most active. A row opens their profile; the pill follows them. Opened from the People here
 * row or a /people?stall= or /people?dish= link.
 */
export function PlacePeopleScreen({ navigation, route }: Props) {
  const { venueId, dishId, placeName } = route.params;
  const { palette, spacing } = useHungryTheme();
  const [reloadKey, setReloadKey] = useState(0);
  const place: PlaceRef | null = venueId ? { venueId } : dishId ? { dishId } : null;
  const { people, totalPeople, status } = usePlacePeople(place, {
    enabled: place !== null,
    limit: PLACE_PEOPLE_LIST_LIMIT,
    screen: "PlacePeople",
    reloadKey,
  });
  const name = placeName?.trim();

  return (
    <ProfileScreenShell title="People here" testID="place-people-screen">
      {name ? (
        <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
          {dishId ? `Who reviewed or posted ${name}` : `Who reviewed or posted at ${name}`}
        </AppText>
      ) : null}
      {status === "loading" ? (
        <View testID="place-people-loading" style={{ minHeight: 200 }} />
      ) : status === "failed" ? (
        <EmptyState
          title="Couldn't load people"
          body="Check your connection and try again."
          icon={<AppSymbol name="retry" size={36} weight="regular" color={palette.textSecondary} />}
          ctaLabel="Retry"
          onPress={() => setReloadKey((key) => key + 1)}
        />
      ) : people.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          body="Reviews and dish posts from other diners will show their names here."
          icon={<ReviewBubblesIllustration testID="place-people-empty-art" />}
        />
      ) : (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="bodySmallBold" testID="place-people-summary">
            {placePeopleSummary(people, totalPeople)}
          </AppText>
          <View testID="place-people-list">
            {people.map((person, index) => (
              <ListRow
                key={person.userId}
                first={index === 0}
                title={person.displayName}
                subtitle={contributionLine(person.isFollowed, person.contributions)}
                accessibilityHint="Opens their profile"
                chevron
                onPress={() => {
                  trackAnalyticsEvent("people_here_opened", { source: "list" });
                  navigation.navigate("UserProfile", {
                    authorId: person.userId,
                    authorName: person.displayName,
                  });
                }}
                leading={<Avatar name={person.displayName} uri={person.avatarUrl} size={44} />}
                trailing={
                  <PersonFollowPill
                    userId={person.userId}
                    name={person.displayName}
                    avatarUrl={person.avatarUrl}
                    testID={`place-people-follow-${person.userId}`}
                  />
                }
                testID={`place-people-row-${person.userId}`}
              />
            ))}
          </View>
          {totalPeople > people.length ? (
            <AppText variant="bodySmall" tone="secondary" testID="place-people-more">
              {totalPeople - people.length === 1
                ? "And 1 more person."
                : `And ${totalPeople - people.length} more people.`}
            </AppText>
          ) : null}
        </View>
      )}
    </ProfileScreenShell>
  );
}
