/**
 * "Mei and 2 others you follow posted here": avatars of people you follow who posted a dish
 * from this stall lately, opening the Feed tab of People filtered to the stall. One read of
 * your Following feed's newest page, and only when you follow someone.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AppSymbol, AppText, Avatar } from "@/components/ui";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";
import { useHungryTheme } from "@/theme";

/** Newest posts read from your Following feed (the RPC's maximum page). */
export const POSTED_HERE_SCAN = 50;
const AVATARS_SHOWN = 4;

export interface PostedHerePerson {
  userId: string;
  name: string;
  avatarUrl?: string;
}

/** The distinct people who posted from this stall, newest first. */
export function postersAt(posts: readonly Bite[], venueId: string): PostedHerePerson[] {
  const seen = new Set<string>();
  const people: PostedHerePerson[] = [];
  for (const post of posts) {
    if (post.venueId !== venueId || seen.has(post.authorId)) continue;
    seen.add(post.authorId);
    people.push({ userId: post.authorId, name: post.authorName, avatarUrl: post.authorAvatar });
  }
  return people;
}

/** "Mei posted here", "Mei and Arun posted here", "Mei and 3 others you follow posted here". */
export function postedHereLabel(people: readonly PostedHerePerson[]): string {
  const [first, second] = people;
  if (!first) return "";
  if (people.length === 1) return `${first.name} posted here`;
  if (people.length === 2) return `${first.name} and ${second.name} posted here`;
  return `${first.name} and ${people.length - 1} others you follow posted here`;
}

export function FollowsPostedHere({
  venueId,
  enabled,
  onOpen,
}: {
  venueId: string;
  enabled: boolean;
  onOpen: () => void;
}) {
  const { componentRadii, palette, spacing } = useHungryTheme();
  const [posts, setPosts] = useState<Bite[]>([]);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    void getHungryService()
      .foodPortfolio.getFollowingFeed({ limit: POSTED_HERE_SCAN })
      .then((rows) => {
        if (active) setPosts(rows);
      })
      .catch((error) => {
        reportError(error, { screen: "StallDetail", action: "load_follows_posted_here" });
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  const people = useMemo(() => postersAt(posts, venueId), [posts, venueId]);
  if (!enabled || people.length === 0) return null;
  const label = postedHereLabel(people);

  return (
    <Pressable
      testID="stall-follows-posted-here"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Shows the dishes they posted from this stall"
      onPress={onOpen}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? palette.bgSoft : palette.surface,
        borderRadius: componentRadii.card,
        flexDirection: "row",
        gap: spacing[3],
        minHeight: 56,
        paddingHorizontal: spacing[3],
      })}
    >
      <View style={{ flexDirection: "row" }}>
        {people.slice(0, AVATARS_SHOWN).map((person, index) => (
          <View
            key={person.userId}
            style={{
              borderColor: palette.surface,
              borderRadius: 999,
              borderWidth: 2,
              marginLeft: index === 0 ? 0 : -spacing[2],
            }}
          >
            <Avatar name={person.name} uri={person.avatarUrl} size={32} />
          </View>
        ))}
      </View>
      <AppText variant="bodyBold" numberOfLines={2} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppSymbol name="chevronRight" size={14} color={palette.textMuted} />
    </Pressable>
  );
}
