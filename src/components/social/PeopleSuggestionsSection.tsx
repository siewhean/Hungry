import { useEffect, useState } from "react";
import { View } from "react-native";

import { FollowPillButton } from "@/components/social/FollowPillButton";
import { AppText, Avatar, ListRow } from "@/components/ui";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { followButtonLabel, suggestionReason } from "@/features/social/relationship";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PeopleSuggestion } from "@/lib/services/types";
import { useSessionStore } from "@/store/useSessionStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useHungryTheme } from "@/theme";

/** How many suggestions to ask for and show. */
export const PEOPLE_SUGGESTIONS_LIMIT = 10;

function SuggestionRow({
  suggestion,
  first,
  onOpen,
}: {
  suggestion: PeopleSuggestion;
  first: boolean;
  onOpen: (suggestion: PeopleSuggestion) => void;
}) {
  const followPress = useFollowPress();
  const isFollowing = useSocialStore((state) => Boolean(state.followedUserIds[suggestion.userId]));
  const isRequested = useSocialStore(
    (state) =>
      !state.followedUserIds[suggestion.userId] &&
      Boolean(state.requestedUserIds[suggestion.userId]),
  );
  const label = followButtonLabel({ isFollowing, isRequested, followsYou: false });
  return (
    <ListRow
      first={first}
      title={suggestion.displayName}
      subtitle={suggestionReason(suggestion)}
      accessibilityHint="Opens their profile"
      onPress={() => onOpen(suggestion)}
      leading={<Avatar name={suggestion.displayName} uri={suggestion.avatarUrl} size={44} />}
      testID={`people-suggestion-${suggestion.userId}`}
      trailing={
        <FollowPillButton
          label={label}
          accessibilityLabel={`${label} ${suggestion.displayName}`}
          muted={isFollowing || isRequested}
          tinted
          minWidth={0}
          onPress={() => {
            if (!isFollowing && !isRequested) {
              trackAnalyticsEvent("people_suggestion_followed", { reason: suggestion.reason });
            }
            followPress({
              userId: suggestion.userId,
              name: suggestion.displayName,
              avatarUrl: suggestion.avatarUrl,
            });
          }}
        />
      }
    />
  );
}

/**
 * "People with your taste": diners with a palate like yours and people your follows follow
 * (get_people_suggestions). Signed-in only; hidden while loading, when empty and when the read
 * fails (reported), so it never pushes an error into a list that works.
 */
export function PeopleSuggestionsSection({
  excludeUserIds,
  onOpen,
  title = "People with your taste",
}: {
  /** People already on the screen (your follows), left out of the suggestions. */
  excludeUserIds?: ReadonlySet<string>;
  onOpen: (suggestion: PeopleSuggestion) => void;
  title?: string;
}) {
  const { spacing } = useHungryTheme();
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const [suggestions, setSuggestions] = useState<PeopleSuggestion[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSuggestions([]);
      return;
    }
    let isActive = true;
    void getHungryService()
      .social.listPeopleSuggestions(PEOPLE_SUGGESTIONS_LIMIT)
      .then((rows) => {
        if (isActive) setSuggestions(rows);
      })
      .catch((error) => {
        reportError(error, { screen: "PeopleSuggestions", action: "load_people_suggestions" });
      });
    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  const visible = suggestions.filter((suggestion) => !excludeUserIds?.has(suggestion.userId));
  if (visible.length === 0) return null;

  return (
    <View style={{ gap: spacing[1], paddingTop: spacing[2] }} testID="people-suggestions">
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
      {visible.map((suggestion, index) => (
        <SuggestionRow
          key={suggestion.userId}
          suggestion={suggestion}
          first={index === 0}
          onOpen={(person) => {
            trackAnalyticsEvent("people_suggestion_opened", { reason: person.reason });
            onOpen(person);
          }}
        />
      ))}
    </View>
  );
}
