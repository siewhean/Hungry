import type { DishDetail } from "@/types/domain";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";

// Actions a guest asked for, finished after sign-in (SignInPromptSheet). Each one only
// ever adds: the account may already have the save/like/follow, so it never toggles off.

// Runs right after sign-in, before the account's favourites have loaded; the server
// toggle deletes an existing save, so check the server's list first.
export async function saveDishAfterSignIn(dish: DishDetail) {
  const savedIds = await getHungryService()
    .profile.getFavouriteDishIds()
    .catch(() => null);
  if (!savedIds || savedIds.includes(dish.id)) return;
  const profile = useProfileStore.getState();
  if (!profile.profile.favouriteDishIds.includes(dish.id)) profile.toggleFavourite(dish);
}

export function likePostAfterSignIn(postId: string) {
  const social = useSocialStore.getState();
  if (!social.interactions[postId]?.liked) social.toggleLike(postId);
}

export function savePostAfterSignIn(postId: string) {
  const social = useSocialStore.getState();
  if (!social.interactions[postId]?.saved) social.toggleSave(postId);
}

export function followUserAfterSignIn(userId: string) {
  const social = useSocialStore.getState();
  if (!social.followedUserIds[userId] && !social.requestedUserIds[userId]) {
    social.toggleFollow(userId);
  }
}

export async function followStallAfterSignIn(stallId: string) {
  const stalls = useStallFollowStore.getState();
  await stalls.loadFollowedStalls().catch(() => undefined);
  if (!useStallFollowStore.getState().followedStallIds.includes(stallId)) {
    await stalls.toggleFollow(stallId).catch(() => undefined);
  }
}
