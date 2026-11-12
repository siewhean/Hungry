/**
 * Stall history: which stalls a diner keeps coming back to, from views, directions, shares,
 * saves and visits. The same maths as food history (foodHistory.ts): signed evidence that halves
 * every 90 days, shrunk toward zero so one look is never a habit.
 *
 * The server table is public.user_stall_affinities (migration 20261113090000), written by
 * record_stall_signal and a trigger on saved/tried stalls. Keep the weights in step with it.
 * Private to the diner: never shown to merchants or other diners.
 */

import {
  AFFINITY_HALF_LIFE_DAYS,
  AFFINITY_SHRINKAGE,
  DISMISS_DAYS,
  LIKED_AFFINITY_THRESHOLD,
} from "@/lib/ai/foodHistory";

export const STALL_AFFINITY_WEIGHTS = {
  /** The stall page stayed open for STALL_VIEW_DWELL_MS. */
  view: 1,
  /** A review of a dish at the stall was opened. */
  review_opened: 1,
  directions: 3,
  share: 3,
  saved: 3,
  unsaved: -2,
  tried: 3,
  /** "Not for me": hidden from recommendations for DISMISS_DAYS. */
  not_for_me: -4,
} as const;

export type StallSignal = keyof typeof STALL_AFFINITY_WEIGHTS;
/** The signals the app sends; saves and visits are counted on the server from the stall's state. */
export type SentStallSignal = Extract<
  StallSignal,
  "view" | "review_opened" | "directions" | "share" | "not_for_me"
>;

/** How long a stall page must stay open before it counts as a view, not a scroll past. */
export const STALL_VIEW_DWELL_MS = 3000;

export interface UserStallAffinity {
  venueId: string;
  evidence: number;
  absEvidence: number;
  lastEventAt: string;
  dismissedUntil?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function decayFactor(fromMs: number, toMs: number): number {
  const days = Math.max(0, (toMs - fromMs) / DAY_MS);
  return Math.pow(2, -days / AFFINITY_HALF_LIFE_DAYS);
}

/** TS twin of app_private.apply_stall_affinity_event: decay the row to `at`, then add the signal. */
export function applyStallSignal(
  row: UserStallAffinity | undefined,
  venueId: string,
  signal: StallSignal,
  at = Date.now(),
): UserStallAffinity {
  const weight = STALL_AFFINITY_WEIGHTS[signal];
  const lastMs = row ? Date.parse(row.lastEventAt) : at;
  const factor = row && Number.isFinite(lastMs) ? decayFactor(lastMs, at) : 1;
  return {
    venueId,
    evidence: (row?.evidence ?? 0) * factor + weight,
    absEvidence: (row?.absEvidence ?? 0) * factor + Math.abs(weight),
    lastEventAt: new Date(Math.max(at, Number.isFinite(lastMs) ? lastMs : at)).toISOString(),
    dismissedUntil:
      signal === "not_for_me"
        ? new Date(at + DISMISS_DAYS * DAY_MS).toISOString()
        : row?.dismissedUntil,
  };
}

/** Shrunk, decayed affinity in [-1, 1]. */
export function stallAffinityScore(row: UserStallAffinity, now = Date.now()): number {
  const lastMs = Date.parse(row.lastEventAt);
  const factor = Number.isFinite(lastMs) ? decayFactor(lastMs, now) : 1;
  return (row.evidence * factor) / (AFFINITY_SHRINKAGE + row.absEvidence * factor);
}

export interface StallHistory {
  /** venueId -> affinity in [-1, 1] */
  scores: Map<string, number>;
  /** Stalls at or above the liked threshold, most liked first. */
  likedVenueIds: string[];
  /** Stalls hidden after "Not for me" until the 30 days are up. */
  hiddenVenueIds: Set<string>;
  /** Stalls viewed or acted on, most recent first (for "Because you viewed"). */
  recentVenueIds: string[];
}

export function buildStallHistory(
  rows: readonly UserStallAffinity[],
  now = Date.now(),
): StallHistory {
  const scores = new Map<string, number>();
  const hiddenVenueIds = new Set<string>();
  for (const row of rows) {
    scores.set(row.venueId, stallAffinityScore(row, now));
    if (row.dismissedUntil && Date.parse(row.dismissedUntil) > now) hiddenVenueIds.add(row.venueId);
  }
  const likedVenueIds = [...scores]
    .filter(([venueId, score]) => score >= LIKED_AFFINITY_THRESHOLD && !hiddenVenueIds.has(venueId))
    .sort((a, b) => b[1] - a[1])
    .map(([venueId]) => venueId);
  const recentVenueIds = [...rows]
    .filter((row) => !hiddenVenueIds.has(row.venueId) && (scores.get(row.venueId) ?? 0) > 0)
    .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt))
    .map((row) => row.venueId);
  return { scores, likedVenueIds, hiddenVenueIds, recentVenueIds };
}
