import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import type { DishDetail, UserProfile } from "@/types/domain";

export const WEEKLY_PICKS_COUNT = 5;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const POOL_SIZE = 15;

export interface WeeklyPick {
  dish: DishDetail;
  explanation: string;
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
): WeeklyPick[] {
  const ranked = runRecommendationPipeline(dishes, {
    userVector: profile.tasteVector,
    dietaryFlags: profile.dietaryPreferences,
    neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
    radiusMeters: Number.MAX_SAFE_INTEGER,
    excludeDishIds: profile.reviewedDishIds,
  });
  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const seenVenues = new Set<string>();
  const pool: WeeklyPick[] = [];
  for (const result of ranked) {
    const dish = dishById.get(result.dishId);
    if (!dish || seenVenues.has(dish.venueId)) continue;
    seenVenues.add(dish.venueId);
    pool.push({ dish, explanation: result.explanation });
    if (pool.length >= POOL_SIZE) break;
  }
  if (pool.length <= count) return pool;

  const offset = hashString(`${profile.id}:${weekKey}`) % pool.length;
  return Array.from({ length: count }, (_, index) => pool[(offset + index) % pool.length]);
}
