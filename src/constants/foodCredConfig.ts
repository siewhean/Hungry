/**
 * foodCredConfig.ts — Food Cred system configuration
 *
 * Single source of truth for:
 *   - Level tiers and thresholds
 *   - Points awarded per action
 *   - Daily rate limits per action
 *
 * Production swap: these constants can be moved to remote config
 * (e.g. Supabase remote_config table) without changing store logic.
 */

import type { FoodCredAction, FoodCredLevel } from "@/types/domain";

// ─── Level Tiers ──────────────────────────────────────────────────────────────

/**
 * Professional level naming — no emojis, no childish game-world language.
 * Ordered ascending by minPoints.
 */
export const FOOD_CRED_LEVELS: FoodCredLevel[] = [
  { index: 0, name: "Explorer", badgeLabel: "Explorer", minPoints: 0 },
  { index: 1, name: "Regular", badgeLabel: "Regular", minPoints: 50 },
  { index: 2, name: "Reviewer", badgeLabel: "Reviewer", minPoints: 200 },
  { index: 3, name: "Specialist", badgeLabel: "Specialist", minPoints: 500 },
  { index: 4, name: "Curator", badgeLabel: "Curator", minPoints: 1200 },
  { index: 5, name: "Hungry Insider", badgeLabel: "Insider", minPoints: 3000 },
] as const;

// ─── Points Per Action ────────────────────────────────────────────────────────

/** Points awarded for each qualifying action. */
export const FOOD_CRED_POINTS: Record<FoodCredAction, number> = {
  stall_saved: 2,
  stall_marked_tried: 5,
  review_created: 15,
  photo_uploaded: 5,
  post_created: 10,
  helpful_vote_received: 3,
  stall_info_corrected: 10,
  tag_added: 3,
  collection_created: 10,
  mission_completed: 0, // variable — set per mission; use 0 as default
};

// ─── Daily Rate Limits ────────────────────────────────────────────────────────

/**
 * Maximum number of cred-earning events per action per calendar day.
 * Actions beyond the daily cap are still allowed (saves, etc.) but earn 0 cred.
 *
 * Example: user can save up to 20 stalls/day but only earns cred for the first 10.
 */
export const FOOD_CRED_DAILY_CAP: Record<FoodCredAction, number> = {
  stall_saved: 10,
  stall_marked_tried: 5,
  review_created: 5,
  photo_uploaded: 10,
  post_created: 3,
  helpful_vote_received: 99, // no practical cap — quality-controlled by vote limits
  stall_info_corrected: 3,
  tag_added: 5,
  collection_created: 2,
  mission_completed: 4, // max 4 missions/week
};

// ─── Quality Gates ────────────────────────────────────────────────────────────

/** Minimum review text length to qualify for cred. Shorter reviews earn 0 cred. */
export const MIN_REVIEW_LENGTH_FOR_CRED = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the tier for a given cumulative points total.
 * Always returns a valid tier (floor-capped to index 0).
 */
export function resolveFoodCredLevel(totalPoints: number): FoodCredLevel {
  let resolved = FOOD_CRED_LEVELS[0];
  for (const tier of FOOD_CRED_LEVELS) {
    if (totalPoints >= tier.minPoints) resolved = tier;
    else break;
  }
  return resolved;
}

/**
 * Progress (0–1) from the current tier threshold toward the next tier.
 * Returns 1 if the user is already at max tier.
 */
export function resolveLevelProgress(totalPoints: number): number {
  const idx = [...FOOD_CRED_LEVELS].reverse().findIndex((t) => totalPoints >= t.minPoints);
  const currentIdx = idx === -1 ? 0 : FOOD_CRED_LEVELS.length - 1 - idx;
  if (currentIdx >= FOOD_CRED_LEVELS.length - 1) return 1;
  const current = FOOD_CRED_LEVELS[currentIdx].minPoints;
  const next = FOOD_CRED_LEVELS[currentIdx + 1].minPoints;
  return (totalPoints - current) / (next - current);
}
