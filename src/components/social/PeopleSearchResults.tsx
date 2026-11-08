import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { FollowPillButton } from "@/components/social/FollowPillButton";
import { AppText, Avatar } from "@/components/ui";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";

/** People shown above the food results; the rest are in People. */
export const SEARCH_PEOPLE_LIMIT = 3;
export const SEARCH_PEOPLE_DEBOUNCE_MS = 350;

export type FoundPerson = { userId: string; displayName: string; avatarUrl?: string };

function FoundPersonRow({
  person,
  onOpen,
}: {
  person: FoundPerson;
  onOpen: (person: FoundPerson) => void;
}) {
  const { spacing } = useHungryTheme();
  const followPress = useFollowPress();
  const isFollowing = useSocialStore((state) => Boolean(state.followedUserIds[person.userId]));
  const isRequested = useSocialStore((state) => Boolean(state.requestedUserIds[person.userId]));
  const label = isFollowing ? "Following" : isRequested ? "Requested" : "Follow";
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: spacing[2], minHeight: 52 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${person.displayName}'s Food Portfolio`}
        onPress={() => onOpen(person)}
        style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: spacing[3] }}
      >
        <Avatar uri={person.avatarUrl} name={person.displayName} size={36} />
        <AppText numberOfLines={1} variant="bodyBold" style={{ flex: 1 }}>
          {person.displayName}
        </AppText>
      </Pressable>
      <FollowPillButton
        label={label}
        accessibilityLabel={
          isRequested
            ? `Follow request sent to ${person.displayName}`
            : `${label} ${person.displayName}`
        }
        muted={isFollowing || isRequested}
        tinted
        minWidth={0}
        onPress={() =>
          followPress({
            userId: person.userId,
            name: person.displayName,
            avatarUrl: person.avatarUrl,
          })
        }
      />
    </View>
  );
}

/** A few people whose name matches the search, above the dishes and stalls. Hidden when none. */
export function PeopleSearchResults({
  query,
  enabled,
  onOpen,
}: {
  query: string;
  enabled: boolean;
  onOpen: (person: FoundPerson) => void;
}) {
  const { spacing } = useHungryTheme();
  // Results remember the words they were for, so a new search never shows the last one's people.
  const [found, setFound] = useState<{ term: string; people: FoundPerson[] }>({
    term: "",
    people: [],
  });
  const term = query.trim();
  const searchable = enabled && term.length >= 2;
  useEffect(() => {
    if (!searchable) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      getHungryService()
        .social.searchProfiles(term, { limit: SEARCH_PEOPLE_LIMIT })
        .then((rows) => {
          if (active) setFound({ term, people: rows.slice(0, SEARCH_PEOPLE_LIMIT) });
        })
        .catch((error) => {
          // People are extra on a food search: the dishes and stalls still show.
          reportError(error, { screen: "SearchResults", action: "search_people" });
          if (active) setFound({ term, people: [] });
        });
    }, SEARCH_PEOPLE_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchable, term]);

  const people = searchable && found.term === term ? found.people : [];
  if (people.length === 0) return null;
  return (
    <View testID="search-people-results" accessibilityLabel="People" style={{ gap: spacing[1] }}>
      <AppText tone="secondary" variant="micro">
        People
      </AppText>
      {people.map((person) => (
        <FoundPersonRow key={person.userId} person={person} onOpen={onOpen} />
      ))}
    </View>
  );
}
