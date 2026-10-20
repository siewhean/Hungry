/**
 * Exploration mix: how much of a slate is food the user knows versus food that is new to them.
 *
 * Each candidate lands in exactly one bucket (first match wins):
 *   repeat    — a dish the user liked or ate before
 *   same_type — the same kind of food (dishes.food_type) from a stall they have not had it at
 *   similar   — a different food with a close flavour profile or shared tags
 *   new       — everything else
 *
 * The user's food openness (onboarding / settings) sets the share of each bucket.
 * Users with no liked history keep the legacy pipeline (see tasteEngine stage 4).
 */

import type {
  DishSummary,
  FoodOpenness,
  RecommendationBucket,
  TasteProfile,
  TasteVector,
} from "@/types/domain";
import { normalizeFoodType, type FoodHistory } from "./foodHistory";

export const DEFAULT_FOOD_OPENNESS: FoodOpenness = "mix";

export const OPENNESS_NEOPHILIA_INDEX: Record<FoodOpenness, number> = {
  favourites: 2,
  mix: 5,
  adventurous: 8,
};

/** Share of a slate per bucket. Each row sums to 1. */
export const BUCKET_SHARES: Record<FoodOpenness, Record<RecommendationBucket, number>> = {
  favourites: { repeat: 0.4, same_type: 0.35, similar: 0.2, new: 0.05 },
  mix: { repeat: 0.2, same_type: 0.3, similar: 0.3, new: 0.2 },
  adventurous: { repeat: 0.1, same_type: 0.2, similar: 0.4, new: 0.3 },
};

/** Order empty slots move to when a bucket runs short. */
const FILL_ORDER: RecommendationBucket[] = ["same_type", "similar", "new", "repeat"];
const BUCKETS: RecommendationBucket[] = ["repeat", "same_type", "similar", "new"];

/** At most this many dishes of one food type per slate, so "same food elsewhere" stays a mix. */
export const FOOD_TYPE_CAP = 3;
/** Two dishes this close (0–10 scale, Euclidean over 6 axes) count as a similar flavour. */
export const SIMILAR_FLAVOUR_DISTANCE = 4;

export function neophiliaToOpenness(index: number): FoodOpenness {
  if (index <= 3) return "favourites";
  if (index <= 6) return "mix";
  return "adventurous";
}

export function resolveFoodOpenness(
  tasteProfile: Pick<TasteProfile, "foodOpenness" | "neophiliaIndex"> | undefined,
): FoodOpenness {
  if (tasteProfile?.foodOpenness) return tasteProfile.foodOpenness;
  if (typeof tasteProfile?.neophiliaIndex === "number") {
    return neophiliaToOpenness(tasteProfile.neophiliaIndex);
  }
  return DEFAULT_FOOD_OPENNESS;
}

/** Whole-slot counts per bucket for a slate of `limit`, by largest remainder. */
export function bucketSlotsFor(
  openness: FoodOpenness,
  limit: number,
): Record<RecommendationBucket, number> {
  const shares = BUCKET_SHARES[openness];
  const exact = BUCKETS.map((bucket) => ({ bucket, value: shares[bucket] * limit }));
  const slots = Object.fromEntries(
    exact.map(({ bucket, value }) => [bucket, Math.floor(value)]),
  ) as Record<RecommendationBucket, number>;
  let remaining = limit - BUCKETS.reduce((sum, bucket) => sum + slots[bucket], 0);
  for (const { bucket } of [...exact].sort(
    (a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)),
  )) {
    if (remaining <= 0) break;
    slots[bucket] += 1;
    remaining -= 1;
  }
  return slots;
}

function flavourDistance(a: TasteVector, b: TasteVector): number {
  return Math.sqrt(
    (a.sweet - b.sweet) ** 2 +
      (a.spicy - b.spicy) ** 2 +
      (a.sour - b.sour) ** 2 +
      (a.salty - b.salty) ** 2 +
      (a.rich - b.rich) ** 2 +
      (a.aromatic - b.aromatic) ** 2,
  );
}

function hasFlavourSignal(dish: Pick<DishSummary, "tasteVector" | "tasteConfidence">): boolean {
  if ((dish.tasteConfidence ?? 1) <= 0) return false;
  return Object.values(dish.tasteVector).some((value) => value !== 5);
}

/** The liked dishes' flavours and tags, for the `similar` bucket. */
export interface LikedProfile {
  vectors: TasteVector[];
  tags: Set<string>;
}

export function buildLikedProfile(likedDishes: DishSummary[]): LikedProfile {
  return {
    vectors: likedDishes.filter(hasFlavourSignal).map((dish) => dish.tasteVector),
    tags: new Set(
      likedDishes.flatMap((dish) => dish.tasteTags.map((tag) => tag.trim().toLowerCase())),
    ),
  };
}

export function assignBucket(
  dish: DishSummary,
  history: FoodHistory,
  liked: LikedProfile,
): RecommendationBucket {
  if (history.likedDishIds.has(dish.id)) return "repeat";
  const foodType = normalizeFoodType(dish.foodTypeTag);
  if (foodType && history.likedFoodTypes.has(foodType)) {
    const triedAt = history.venuesByFoodType.get(foodType);
    // Same food at a stall where they already liked it is not a new vendor to compare.
    return triedAt?.has(dish.venueId) ? "similar" : "same_type";
  }
  const closeFlavour =
    hasFlavourSignal(dish) &&
    liked.vectors.some(
      (vector) => flavourDistance(vector, dish.tasteVector) <= SIMILAR_FLAVOUR_DISTANCE,
    );
  const sharedTag = dish.tasteTags.some((tag) => liked.tags.has(tag.trim().toLowerCase()));
  return closeFlavour || sharedTag ? "similar" : "new";
}

export function bucketExplanation(bucket: RecommendationBucket, dish: DishSummary): string {
  switch (bucket) {
    case "repeat":
      return "You liked this before.";
    case "same_type":
      return dish.foodTypeTag
        ? `Another ${dish.foodTypeTag.trim().toLowerCase()} to compare.`
        : "Another take on a dish you like.";
    case "similar":
      return "Close to the flavours you like.";
    case "new":
      return `Something new — try ${dish.name}?`;
  }
}

export interface BucketAllocationOptions {
  openness: FoodOpenness;
  history: FoodHistory;
  liked: LikedProfile;
  limit?: number;
}

/**
 * Fill a slate from score-ordered candidates by bucket share, then interleave the buckets
 * so familiar dishes never bunch up. Dismissed dishes never appear.
 */
export function allocateByBuckets<T extends { dish: DishSummary }>(
  ranked: T[],
  options: BucketAllocationOptions,
): (T & { bucket: RecommendationBucket })[] {
  const limit = options.limit ?? 20;
  const pools = new Map<RecommendationBucket, T[]>(BUCKETS.map((bucket) => [bucket, []]));
  for (const item of ranked) {
    if (options.history.dismissedDishIds.has(item.dish.id)) continue;
    pools.get(assignBucket(item.dish, options.history, options.liked))?.push(item);
  }

  const targets = bucketSlotsFor(options.openness, Math.min(limit, ranked.length));
  const picked = new Map<RecommendationBucket, T[]>(BUCKETS.map((bucket) => [bucket, []]));
  const foodTypeCounts = new Map<string, number>();
  const cursors = new Map<RecommendationBucket, number>(BUCKETS.map((bucket) => [bucket, 0]));

  const takeFrom = (bucket: RecommendationBucket): boolean => {
    const pool = pools.get(bucket) ?? [];
    let cursor = cursors.get(bucket) ?? 0;
    while (cursor < pool.length) {
      const item = pool[cursor];
      cursor += 1;
      const foodType = normalizeFoodType(item.dish.foodTypeTag);
      if (foodType && (foodTypeCounts.get(foodType) ?? 0) >= FOOD_TYPE_CAP) continue;
      if (foodType) foodTypeCounts.set(foodType, (foodTypeCounts.get(foodType) ?? 0) + 1);
      picked.get(bucket)?.push(item);
      cursors.set(bucket, cursor);
      return true;
    }
    cursors.set(bucket, cursor);
    return false;
  };

  let shortfall = 0;
  for (const bucket of BUCKETS) {
    for (let index = 0; index < targets[bucket]; index += 1) {
      if (!takeFrom(bucket)) shortfall += 1;
    }
  }
  for (const bucket of FILL_ORDER) {
    while (shortfall > 0 && takeFrom(bucket)) shortfall -= 1;
  }

  // Interleave: each position goes to the bucket furthest behind its share of the slate so far.
  const total = BUCKETS.reduce((sum, bucket) => sum + (picked.get(bucket)?.length ?? 0), 0);
  const taken = new Map<RecommendationBucket, number>(BUCKETS.map((bucket) => [bucket, 0]));
  const result: (T & { bucket: RecommendationBucket })[] = [];
  for (let position = 0; position < total; position += 1) {
    let best: RecommendationBucket | undefined;
    let bestDeficit = -Infinity;
    for (const bucket of BUCKETS) {
      const count = picked.get(bucket)?.length ?? 0;
      const used = taken.get(bucket) ?? 0;
      if (used >= count) continue;
      const deficit = (count / total) * (position + 1) - used;
      if (deficit > bestDeficit) {
        best = bucket;
        bestDeficit = deficit;
      }
    }
    if (!best) break;
    const used = taken.get(best) ?? 0;
    const item = picked.get(best)?.[used];
    taken.set(best, used + 1);
    if (item) result.push({ ...item, bucket: best });
  }
  return result;
}

/**
 * Reorder an already-ranked dish list (Decide For Me, search-backed surfaces) by the user's
 * openness. Without liked history only dismissals are applied. Dishes the mix did not place
 * follow in their original order, so a caller stepping through the list never runs dry early.
 */
export function mixByFoodHistory<T extends DishSummary>(
  dishes: T[],
  options: {
    history: FoodHistory | undefined;
    openness: FoodOpenness;
    lookup: (dishId: string) => DishSummary | undefined;
    limit?: number;
  },
): T[] {
  const { history } = options;
  if (!history) return dishes;
  const visible = dishes.filter((dish) => !history.dismissedDishIds.has(dish.id));
  if (history.likedDishIds.size === 0) return visible;
  const likedDishes = [...history.likedDishIds]
    .map((dishId) => options.lookup(dishId))
    .filter((dish): dish is DishSummary => Boolean(dish));
  const mixed = allocateByBuckets(
    visible.map((dish) => ({ dish })),
    {
      openness: options.openness,
      history,
      liked: buildLikedProfile(likedDishes),
      limit: options.limit ?? 20,
    },
  ).map(({ dish }) => dish);
  const placed = new Set(mixed.map((dish) => dish.id));
  return [...mixed, ...visible.filter((dish) => !placed.has(dish.id))];
}
