/**
 * gamificationLimits.ts
 *
 * Rate limits and quality gates for gamification actions.
 *
 * Phase 1: Enforced client-side only (store-layer checks).
 * Phase 2: Mirror to Supabase via RLS / Postgres triggers / Edge Functions.
 *
 * Structure:
 *   DAILY_LIMITS  — max occurrences per user per calendar day
 *   CRED_CUTOFFS  — max cred-earning occurrences (soft limit, after which 0 cred)
 *   QUALITY_GATES — text/behaviour rules applied before awarding cred
 */

export interface RateLimit {
  /** Maximum number of actions per day (hard block). */
  dailyMax: number;
  /**
   * After this many actions, no cred is awarded but the action still persists.
   * Set equal to `dailyMax` when no soft limit applies.
   */
  credCutoff: number;
}

/** Per-action daily limits (calendar day, UTC+8 for Singapore). */
export const DAILY_LIMITS: Record<string, RateLimit> = {
  stall_saved: { dailyMax: 20, credCutoff: 10 },
  stall_marked_tried: { dailyMax: 10, credCutoff: 5 },
  review_created: { dailyMax: 5, credCutoff: 5 },
  post_created: { dailyMax: 5, credCutoff: 5 },
  photo_uploaded: { dailyMax: 15, credCutoff: 10 },
  helpful_vote_given: { dailyMax: 30, credCutoff: 30 },
  collection_created: { dailyMax: 3, credCutoff: 3 },
} as const;

/** Quality gates evaluated before awarding Food Cred. */
export const QUALITY_GATES = {
  /** Minimum character count for a review to earn cred. */
  minReviewLength: 20,

  /** Minimum seconds between two reviews on the same stall by the same user. */
  minSecondsBetweenReviewsOnSameStall: 24 * 60 * 60,

  /**
   * How many times a user can toggle save/unsave on the same stall within one
   * hour before cred is withheld and the action is flagged.
   */
  saveToggleAbuseLimitPerHour: 10,
} as const;

/**
 * Returns true when a review body is long enough to earn Food Cred.
 * Trims whitespace so padding does not game the gate.
 */
export function reviewMeetsLengthGate(text: string): boolean {
  return text.trim().length >= QUALITY_GATES.minReviewLength;
}

/**
 * Returns true when enough time has passed since the user's last review
 * on the same stall (anti-spam: same stall, same user, < 24 h).
 */
export function reviewCooldownPassed(lastReviewedAt: string | undefined): boolean {
  if (!lastReviewedAt) return true;
  const elapsedSeconds = (Date.now() - new Date(lastReviewedAt).getTime()) / 1000;
  return elapsedSeconds >= QUALITY_GATES.minSecondsBetweenReviewsOnSameStall;
}

/**
 * Returns true when the user has not exceeded the daily hard limit for
 * a given action. Pass the count of actions already performed today.
 */
export function withinDailyLimit(action: keyof typeof DAILY_LIMITS, todayCount: number): boolean {
  const limit = DAILY_LIMITS[action];
  if (!limit) return true;
  return todayCount < limit.dailyMax;
}

/**
 * Returns true when this action occurrence should still award Food Cred.
 * The cred cutoff is a soft limit — actions beyond it persist but earn 0 cred.
 */
export function withinCredCutoff(action: keyof typeof DAILY_LIMITS, todayCount: number): boolean {
  const limit = DAILY_LIMITS[action];
  if (!limit) return true;
  return todayCount < limit.credCutoff;
}
