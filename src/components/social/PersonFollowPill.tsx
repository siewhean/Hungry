import { FollowPillButton } from "@/components/social/FollowPillButton";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useFollowPress } from "@/features/profile/useFollowPress";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";

/** Follows are live: the pill and the People links show only then. */
export function peopleLinksEnabled(): boolean {
  return FEATURE_FLAGS.followConnectionsEnabled && FEATURE_FLAGS.foodPortfolioEnabled;
}

type Props = {
  userId?: string | null;
  name: string;
  avatarUrl?: string;
  testID?: string;
};

/**
 * A quiet Follow pill beside a person's name on a review, a board row or a comparison. It hides
 * itself for your own name and for someone you already follow; the screen decides whether follows
 * are on (peopleLinksEnabled) and leaves the pill out when they are not.
 */
export function PersonFollowPill({ userId, name, avatarUrl, testID }: Props) {
  const followPress = useFollowPress();
  const viewerId = useProfileStore((state) => state.profile.id);
  const id = userId ?? "";
  const isFollowing = useSocialStore((state) => Boolean(state.followedUserIds[id]));
  const isRequested = useSocialStore((state) => Boolean(state.requestedUserIds[id]));
  if (!id || id === viewerId || isFollowing) return null;
  return (
    <FollowPillButton
      label={isRequested ? "Requested" : "Follow"}
      accessibilityLabel={isRequested ? `Follow request sent to ${name}` : `Follow ${name}`}
      accessibilityHint={isRequested ? "Cancels your follow request" : undefined}
      muted={isRequested}
      tinted
      minWidth={0}
      onPress={() => followPress({ userId: id, name, avatarUrl })}
      testID={testID}
    />
  );
}
