import type { DishDetail } from "@/types/domain";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

// Actions a guest asked for, finished after sign-in (SignInPromptSheet). Each one only
// ever adds: the account may already have the save/like/follow, so it never toggles off.

// Runs right after sign-in, before the account's favourites have loaded; the server
// toggle deletes an existing save, so check the server's list first. Resolves false
// when the account's saves could not be read (nothing was changed).
export async function saveDishAfterSignIn(dish: DishDetail): Promise<boolean> {
  const savedIds = await getHungryService()
    .profile.getFavouriteDishIds()
    .catch(() => null);
  if (!savedIds) return false;
  if (savedIds.includes(dish.id)) return true;
  const profile = useProfileStore.getState();
  if (!profile.profile.favouriteDishIds.includes(dish.id)) profile.toggleFavourite(dish);
  return true;
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

// The stall page's Save. The account's saved stalls are read first, so a stall it already
// saved stays saved (Save toggles). Resolves false when the saves could not be read or the
// save could not be stored (nothing was changed).
export async function saveStallAfterSignIn(stallId: string): Promise<boolean> {
  const userId = useProfileStore.getState().profile.id;
  const stalls = useStallInteractionStore.getState();
  const loaded = await stalls
    .loadInteractions(userId)
    .then(() => true)
    .catch(() => false);
  if (!loaded) return false;
  if (useStallInteractionStore.getState().interactions[stallId]?.isSaved) return true;
  return stalls
    .toggleSaved(userId, stallId)
    .then(() => true)
    .catch(() => false);
}
