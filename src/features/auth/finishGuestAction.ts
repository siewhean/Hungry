import type { DishDetail } from "@/types/domain";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useDishLikeStore } from "@/store/useDishLikeStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { useStallFollowStore } from "@/store/useStallFollowStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

// Actions a guest asked for, finished after sign-in (SignInPromptSheet). Each one only
// ever adds: the account may already have the save/like/follow, so it never toggles off.

// Runs right after sign-in, before the account's favourites have loaded; the server
// toggle deletes an existing save, so check the server's list first. Resolves false
// when the account's saves could not be read or the save itself failed.
export async function saveDishAfterSignIn(dish: DishDetail): Promise<boolean> {
  const savedIds = await getHungryService()
    .profile.getFavouriteDishIds()
    .catch(() => null);
  if (!savedIds) return false;
  if (savedIds.includes(dish.id)) return true;
  const profile = useProfileStore.getState();
  if (profile.profile.favouriteDishIds.includes(dish.id)) return true;
  const result = await profile.toggleFavourite(dish);
  return result.status !== "failed";
}

/**
 * The multi-dish form of saveDishAfterSignIn: reads the account's saves once, then adds
 * each dish it does not have yet. Resolves to the dishes that could not be saved.
 */
export async function saveDishesAfterSignIn(dishes: DishDetail[]): Promise<DishDetail[]> {
  const savedIds = await getHungryService()
    .profile.getFavouriteDishIds()
    .catch(() => null);
  if (!savedIds) return dishes;
  const failed: DishDetail[] = [];
  for (const dish of dishes) {
    if (savedIds.includes(dish.id)) continue;
    const profile = useProfileStore.getState();
    if (profile.profile.favouriteDishIds.includes(dish.id)) continue;
    // n-plus-one-ok: a guest's pending saves (at most 8); each goes through the store toggle for its taste-vector update, analytics and rollback, and there is no batched favourites write yet.
    const result = await profile.toggleFavourite(dish);
    if (result.status === "failed") failed.push(dish);
  }
  return failed;
}

// The server's tried mark is idempotent, so marking an already-tried dish changes nothing.
export async function markDishTriedAfterSignIn(dishId: string): Promise<boolean> {
  return useProfileStore.getState().setDishTried(dishId, true);
}

// Dish likes are kept on the device per account: only ever adds.
export function likeDishAfterSignIn(dishId: string) {
  const userId = useProfileStore.getState().profile.id;
  const likes = useDishLikeStore.getState();
  if (!likes.isLiked(userId, dishId)) likes.toggleLike(userId, dishId);
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
