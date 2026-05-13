/**
 * useGamificationStore — Hungry points + level system
 *
 * Current phase: mock-first. All state is in-memory with sensible defaults.
 * Production swap plan:
 *   1. Add `user_points` table to Supabase (user_id, total_points, level_index, updated_at).
 *   2. Replace `_loadFromRemote` stub with a real Supabase query.
 *   3. Replace `_persistToRemote` stub with an upsert call.
 *   4. Call `loadProfile()` inside `useAppBootstrap` after session hydration.
 *
 * Level thresholds are intentionally in a separate `LEVEL_CONFIG` constant
 * so the backend can own them without touching store logic.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Level config — single source of truth for thresholds and display names
// ---------------------------------------------------------------------------

export interface LevelTier {
  /** Minimum cumulative points to reach this level */
  minPoints: number;
  /** Short display name shown in UI */
  name: string;
  /** Emoji badge (decorative) */
  badge: string;
}

export const LEVEL_CONFIG: LevelTier[] = [
  { minPoints: 0, name: "Hungry Newbie", badge: "🌱" },
  { minPoints: 50, name: "Level 2 Eater", badge: "🍜" },
  { minPoints: 150, name: "Level 3 Foodie", badge: "🌶️" },
  { minPoints: 350, name: "Level 4 Hawker", badge: "🏆" },
  { minPoints: 700, name: "Level 5 Gourmet", badge: "⭐" },
  { minPoints: 1200, name: "Hungry Legend", badge: "🏅" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the tier object for a given total points value. */
export function resolveTier(totalPoints: number): LevelTier {
  let tier = LEVEL_CONFIG[0];
  for (const t of LEVEL_CONFIG) {
    if (totalPoints >= t.minPoints) tier = t;
    else break;
  }
  return tier;
}

/**
 * Progress (0–1) from current tier threshold towards the next tier.
 * Returns 1 if at max tier.
 */
export function resolveLevelProgress(totalPoints: number): number {
  const index = LEVEL_CONFIG.findLastIndex((t) => totalPoints >= t.minPoints);
  if (index === LEVEL_CONFIG.length - 1) return 1; // max tier
  const current = LEVEL_CONFIG[index].minPoints;
  const next = LEVEL_CONFIG[index + 1].minPoints;
  return (totalPoints - current) / (next - current);
}

// ---------------------------------------------------------------------------
// Points awarded per action — easy to tune or move to remote config later
// ---------------------------------------------------------------------------

export const POINTS_PER_ACTION = {
  quickReview: 25,
  photoAttached: 10,
  firstVisitOfVenue: 15,
  shareStall: 5,
} as const;

export type PointsAction = keyof typeof POINTS_PER_ACTION;

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface GamificationState {
  totalPoints: number;
  /** The last number of points awarded (used for the success card animation) */
  lastEarnedPoints: number;
  /** Whether the store has been hydrated (mock or remote) */
  isLoaded: boolean;

  // Computed helpers (derived — do not store)
  tier: () => LevelTier;
  levelProgress: () => number;

  // Actions
  /** Award points for an action. Returns the new total. */
  awardPoints: (action: PointsAction) => number;
  /**
   * Load profile from storage.
   * Mock: resolves immediately with in-memory defaults.
   * Production: replace body with Supabase query.
   */
  loadProfile: () => Promise<void>;
  /**
   * Reset all points (dev/test only).
   */
  _reset: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

const MOCK_INITIAL_POINTS = 150; // starts the user at "Level 3 Foodie"

export const useGamificationStore = create<GamificationState>((set, get) => ({
  totalPoints: MOCK_INITIAL_POINTS,
  lastEarnedPoints: 0,
  isLoaded: false,

  // Derived
  tier: () => resolveTier(get().totalPoints),
  levelProgress: () => resolveLevelProgress(get().totalPoints),

  // Award points
  awardPoints: (action) => {
    const earned = POINTS_PER_ACTION[action];
    const newTotal = get().totalPoints + earned;
    set({ totalPoints: newTotal, lastEarnedPoints: earned });
    // TODO (production): call _persistToRemote(newTotal)
    return newTotal;
  },

  // Load profile
  loadProfile: async () => {
    // Mock phase: just mark loaded with defaults already in state.
    // Production swap: replace this with a Supabase query:
    //   const { data } = await supabase
    //     .from("user_points")
    //     .select("total_points")
    //     .eq("user_id", session.user.id)
    //     .maybeSingle();
    //   if (data) set({ totalPoints: data.total_points });
    await Promise.resolve();
    set({ isLoaded: true });
  },

  _reset: () => set({ totalPoints: 0, lastEarnedPoints: 0, isLoaded: false }),
}));
