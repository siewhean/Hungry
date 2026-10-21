import {
  hasDishTasteSignal,
  isNeutralTasteVector,
  runRecommendationPipeline,
} from "@/lib/ai/tasteEngine";
import type { FoodHistory } from "@/lib/ai/foodHistory";
import type { DishDetail, FoodOpenness, TasteVector, UserProfile } from "@/types/domain";

export const WEEKLY_PICKS_COUNT = 5;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const POOL_SIZE = 15;
/** Score bump for dishes with a real photo, so they lead when scores are close (0-1 scale). */
export const WEEKLY_PICKS_PHOTO_BONUS = 0.05;

function hasPhoto(dish: Pick<DishDetail, "imageUrl">): boolean {
  return Boolean(dish.imageUrl?.trim());
}

/**
 * Whether the picks can honestly be called "for your taste": the user has a non-neutral
 * vector and most candidate dishes carry a real taste signal. Otherwise the ranking is
 * really distance and rating, so the rail should say "Popular near you".
 */
export function isWeeklyPicksPersonalised(
  userVector: TasteVector | undefined,
  candidates: Pick<DishDetail, "tasteVector" | "tasteConfidence">[],
): boolean {
  if (isNeutralTasteVector(userVector) || candidates.length === 0) return false;
  const tagged = candidates.filter(hasDishTasteSignal).length;
  return tagged * 2 > candidates.length;
}

export interface WeeklyPick {
  dish: DishDetail;
  explanation: string;
}

/** What the saved picks belong to: the account, the week, and the dietary filters. */
export function getWeeklyPicksCacheKey(
  profileId: string,
  weekKey: string,
  dietaryPreferences: readonly string[],
): string {
  return `${profileId}|${weekKey}|${[...dietaryPreferences].sort().join(",")}`;
}

/**
 * Turns saved picks back into dishes. Returns null when a saved dish is gone from the
 * catalog, so the caller recomputes instead of showing a short or stale list.
 */
export function resolveStoredWeeklyPicks(
  stored: { picks: { dishId: string; explanation: string }[] },
  getDishById: (dishId: string) => DishDetail | undefined,
): WeeklyPick[] | null {
  const resolved: WeeklyPick[] = [];
  for (const entry of stored.picks) {
    const dish = getDishById(entry.dishId);
    if (!dish) return null;
    resolved.push({ dish, explanation: entry.explanation });
  }
  return resolved;
}

/** ISO week key ("2026-W42") in Singapore time, so picks refresh every Monday 00:00 SGT. */
export function getWeeklyPicksKey(now = new Date()): string {
  const local = new Date(now.getTime() + SINGAPORE_OFFSET_MS);
  const date = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * Up to five dishes for this week: taste-ranked, one per stall, skipping dishes already tried.
 * The pool rotates by week so the list changes each Monday; when there are fewer good
 * distinct dishes than five, it returns fewer instead of padding with weak matches.
 */
export function buildWeeklyPicks(
  dishes: DishDetail[],
  profile: Pick<
    UserProfile,
    "id" | "tasteVector" | "dietaryPreferences" | "tasteProfile" | "reviewedDishIds"
  >,
  weekKey: string,
  count = WEEKLY_PICKS_COUNT,
  personalisation?: { history: FoodHistory; openness: FoodOpenness },
): WeeklyPick[] {
  const ranked = runRecommendationPipeline(dishes, {
    userVector: profile.tasteVector,
    dietaryFlags: profile.dietaryPreferences,
    neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
    radiusMeters: Number.MAX_SAFE_INTEGER,
    excludeDishIds: profile.reviewedDishIds,
    history: personalisation?.history,
    openness: personalisation?.openness,
  });
  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  // Photo dishes get a small bump so they lead when scores are close; photo-less dishes stay eligible.
  const adjusted = ranked
    .map((result, rank) => {
      const dish = dishById.get(result.dishId);
      const bonus = dish && hasPhoto(dish) ? WEEKLY_PICKS_PHOTO_BONUS : 0;
      return { result, dish, rank, adjustedScore: result.score + bonus };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore || a.rank - b.rank);
  const seenVenues = new Set<string>();
  const pool: (WeeklyPick & { adjustedScore: number })[] = [];
  for (const { result, dish, adjustedScore } of adjusted) {
    if (!dish || seenVenues.has(dish.venueId)) continue;
    seenVenues.add(dish.venueId);
    pool.push({ dish, explanation: result.explanation, adjustedScore });
    if (pool.length >= POOL_SIZE) break;
  }
  const toPick = ({ dish, explanation }: WeeklyPick): WeeklyPick => ({ dish, explanation });
  if (pool.length <= count) return pool.map(toPick);

  const offset = hashString(`${profile.id}:${weekKey}`) % pool.length;
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length])
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .map(toPick);
}
