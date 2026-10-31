import { useCallback } from "react";
import { Alert } from "react-native";

import { followUserAfterSignIn } from "@/features/auth/finishGuestAction";
import { useRequireAccount } from "@/features/auth/useRequireAccount";
import { confirmHaptic } from "@/lib/haptics";
import { useSocialStore } from "@/store/useSocialStore";

export type FollowTarget = {
  userId: string;
  name: string;
  avatarUrl?: string;
  /** The account approves followers: the button shows "Requested" at once. */
  isPrivate?: boolean;
};

/**
 * The Follow button's tap, shared by a profile and the follower lists: a guest is asked to sign
 * in (and the follow finishes afterwards), unfollowing asks first because it is easy to mis-tap,
 * and tapping "Requested" withdraws the request (toggleFollow handles that).
 */
export function useFollowPress() {
  const requireAccount = useRequireAccount();
  const toggleFollow = useSocialStore((state) => state.toggleFollow);

  return useCallback(
    ({ userId, name, avatarUrl, isPrivate }: FollowTarget) => {
      if (
        !requireAccount(
          `Sign in to follow ${name}`,
          {
            name: "UserProfile",
            params: { authorName: name, authorAvatarUrl: avatarUrl, authorId: userId },
          },
          () => followUserAfterSignIn(userId),
        )
      ) {
        return;
      }
      if (!useSocialStore.getState().followedUserIds[userId]) {
        // One soft thud when the follow lands, in the same frame as the button changing.
        confirmHaptic();
        toggleFollow(userId, { isPrivate });
        return;
      }
      Alert.alert(`Unfollow ${name}?`, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Unfollow", style: "destructive", onPress: () => toggleFollow(userId) },
      ]);
    },
    [requireAccount, toggleFollow],
  );
}
