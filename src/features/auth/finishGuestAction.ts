import type { DishDetail } from "@/types/domain";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useAchievementTallyStore, type TriedDishFacts } from "@/store/useAchievementTallyStore";
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
 * the dishes it does not have yet in one write. Resolves to the dishes that could not be saved.
 */
export async function saveDishesAfterSignIn(dishes: DishDetail[]): Promise<DishDetail[]> {
  const savedIds = await getHungryService()
    .profile.getFavouriteDishIds()
    .catch(() => null);
  if (!savedIds) return dishes;
  const saved = new Set(savedIds);
  const missing = dishes.filter((dish) => !saved.has(dish.id));
  const failed = await useProfileStore.getState().addFavourites(missing);
  const failedIds = new Set(failed.map((dish) => dish.id));
  return missing.filter((dish) => failedIds.has(dish.id));
}

export type DishTriedResult = { saved: boolean; pointsAwarded: number; stallMarkFailed: boolean };

/**
 * Everything a "Tried" mark does, for the dish page and for a guest's Tried finished after
 * sign-in: the dish mark, the achievement tally, `dish_marked_tried`, and the stall marked
 * visited the first time. The server's tried mark is idempotent.
 */
export async function markDishTried(
  dish: { id: string; venueId: string },
  facts: TriedDishFacts,
): Promise<DishTriedResult> {
  if (!(await useProfileStore.getState().setDishTried(dish.id, true))) {
    return { saved: false, pointsAwarded: 0, stallMarkFailed: false };
  }
  const userId = useProfileStore.getState().profile.id;
  useAchievementTallyStore.getState().recordTriedDish(userId, dish.id, facts);
  trackAnalyticsEvent("dish_marked_tried", { dish_id: dish.id, stall_id: dish.venueId });
  const stalls = useStallInteractionStore.getState();
  // Read the saved stalls first so an already-visited stall is never marked again.
  await stalls.loadInteractions(userId).catch((error: unknown) => {
    reportError(error, { screen: "DishDetail", action: "load_stall_interactions" });
  });
  if (useStallInteractionStore.getState().getInteraction(dish.venueId)?.isTried) {
    return { saved: true, pointsAwarded: 0, stallMarkFailed: false };
  }
  try {
    const result = await stalls.markTried(userId, dish.venueId, "DishDetail");
    return { saved: true, pointsAwarded: result.pointsAwarded, stallMarkFailed: false };
  } catch (error) {
    // The store rolled the stall mark back; the dish itself is marked.
    reportError(error, { screen: "DishDetail", action: "mark_stall_tried" });
    return { saved: true, pointsAwarded: 0, stallMarkFailed: true };
  }
}

/** A guest's Tried, finished after sign-in with the same side effects as a signed-in tap. */
export function markDishTriedAfterSignIn(
  dish: { id: string; venueId: string },
  facts: TriedDishFacts,
): Promise<DishTriedResult> {
  return markDishTried(dish, facts);
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
// save could not be stored (nothing was changed). `onNewlySaved` runs only when this call
// stored a new save, so the page can confirm it and count it like a tap on Save.
export async function saveStallAfterSignIn(
  stallId: string,
  onNewlySaved?: () => void,
): Promise<boolean> {
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
    .then(() => {
      onNewlySaved?.();
      return true;
    })
    .catch(() => false);
}
