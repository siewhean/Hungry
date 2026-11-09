import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { PersonFollowPill } from "@/components/social/PersonFollowPill";
import { AppText, Avatar } from "@/components/ui";
import { useHungryTheme } from "@/theme";
import type { Review } from "@/types/domain";

/** Most people the rail shows. */
export const REVIEWERS_RAIL_LIMIT = 8;

export type RailReviewer = { userId: string; name: string; avatarUrl?: string; count: number };

/**
 * Who wrote the reviews on screen, most reviews first, then the newest: one row per person, the
 * viewer left out. Built from the loaded page, so it needs no read of its own.
 */
export function reviewersFromReviews(
  reviews: readonly Pick<Review, "authorId" | "authorName" | "authorAvatarUrl">[],
  viewerId: string,
  limit = REVIEWERS_RAIL_LIMIT,
): RailReviewer[] {
  const byId = new Map<string, RailReviewer & { order: number }>();
  reviews.forEach((review, index) => {
    const id = review.authorId;
    if (!id || id === viewerId) return;
    const current = byId.get(id);
    if (current) current.count += 1;
    else
      byId.set(id, {
        userId: id,
        name: review.authorName,
        avatarUrl: review.authorAvatarUrl,
        count: 1,
        order: index,
      });
  });
  return [...byId.values()]
    .sort((left, right) => right.count - left.count || left.order - right.order)
    .slice(0, limit)
    .map(({ order: _order, ...person }) => person);
}

type Props = {
  reviews: readonly Pick<Review, "authorId" | "authorName" | "authorAvatarUrl">[];
  viewerId: string;
  onOpen: (person: RailReviewer) => void;
};

/**
 * The people behind the Review tab's grid: an avatar that opens their Food Portfolio and a Follow
 * pill for anyone you do not follow yet. Hidden when fewer than two other people have reviewed.
 */
export function ReviewersRail({ reviews, viewerId, onOpen }: Props) {
  const { palette, spacing } = useHungryTheme();
  const people = useMemo(() => reviewersFromReviews(reviews, viewerId), [reviews, viewerId]);
  if (people.length < 2) return null;
  return (
    <View testID="reviewers-rail" style={{ gap: spacing[2], paddingBottom: spacing[2] }}>
      <AppText variant="bodySmallBold" style={{ paddingHorizontal: spacing[4] }}>
        Reviewers
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
      >
        {people.map((person) => (
          <View key={person.userId} style={{ alignItems: "center", gap: spacing[1], width: 76 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${person.name}'s Food Portfolio`}
              onPress={() => onOpen(person)}
              testID={`reviewer-${person.userId}`}
              style={{ alignItems: "center", gap: spacing[1], minHeight: 44 }}
            >
              <Avatar uri={person.avatarUrl} name={person.name} size={52} />
              <AppText
                variant="micro"
                numberOfLines={1}
                style={{ color: palette.text, maxWidth: 76, textAlign: "center" }}
              >
                {person.name}
              </AppText>
            </Pressable>
            <PersonFollowPill
              userId={person.userId}
              name={person.name}
              avatarUrl={person.avatarUrl}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
