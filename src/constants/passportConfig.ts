/**
 * passportConfig.ts — Hungry Passport category definitions
 *
 * These are static config/seed records — not user-generated.
 * Passport progress is computed at runtime by joining this config
 * against the user's stall interactions.
 *
 * MVP: 6 cuisine categories + 5 neighbourhood categories (11 total).
 * Phase 3: expand with Singapore Classics, Dietary, Budget categories.
 */

import type { PassportCategory } from "@/types/domain";

// ─── Cuisine Categories ───────────────────────────────────────────────────────

export const PASSPORT_CUISINE_CATEGORIES: PassportCategory[] = [
  {
    id: "cuisine-hawker",
    name: "Hawker Food Explorer",
    description: "Explore Singapore's beloved hawker culture.",
    type: "cuisine",
    matchTag: "hawker",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-chinese",
    name: "Chinese Food Explorer",
    description: "From char kway teow to roast duck.",
    type: "cuisine",
    matchTag: "chinese",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-malay",
    name: "Malay Food Explorer",
    description: "Nasi lemak, satay, mee rebus and more.",
    type: "cuisine",
    matchTag: "malay",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-indian",
    name: "Indian Food Explorer",
    description: "Roti prata, biryani, fish head curry.",
    type: "cuisine",
    matchTag: "indian",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-japanese",
    name: "Japanese Explorer",
    description: "Sushi, ramen, donburi and izakaya finds.",
    type: "cuisine",
    matchTag: "japanese",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-western",
    name: "Western Food Explorer",
    description: "Burgers, pasta, brunch and more.",
    type: "cuisine",
    matchTag: "western",
    stampThresholds: [1, 3, 5, 10],
  },
];

// ─── Neighbourhood Categories ─────────────────────────────────────────────────

export const PASSPORT_NEIGHBOURHOOD_CATEGORIES: PassportCategory[] = [
  {
    id: "hood-cbd",
    name: "CBD Lunch Explorer",
    description: "The best quick lunches in the Central Business District.",
    type: "neighbourhood",
    matchTag: "cbd",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-chinatown",
    name: "Chinatown Classics",
    description: "Old-school hawker culture in Singapore's heritage district.",
    type: "neighbourhood",
    matchTag: "chinatown",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-bugis",
    name: "Bugis Food Trail",
    description: "From Arab Street to Bugis Junction.",
    type: "neighbourhood",
    matchTag: "bugis",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-tampines",
    name: "Tampines Food Explorer",
    description: "Discover the east's best hawker centres and cafes.",
    type: "neighbourhood",
    matchTag: "tampines",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-tiong-bahru",
    name: "Tiong Bahru Cafe Trail",
    description: "Coffee, brunch, and heritage in one of Singapore's trendiest areas.",
    type: "neighbourhood",
    matchTag: "tiong_bahru",
    stampThresholds: [1, 3, 5, 10],
  },
];

// ─── Combined Export ──────────────────────────────────────────────────────────

export const ALL_PASSPORT_CATEGORIES: PassportCategory[] = [
  ...PASSPORT_CUISINE_CATEGORIES,
  ...PASSPORT_NEIGHBOURHOOD_CATEGORIES,
];

/**
 * Computes passport progress for a single category given a list
 * of stall interaction records filtered to matching stalls.
 *
 * @param category - The passport category to evaluate
 * @param triedMatchingStallCount - Count of unique tried stalls that match category.matchTag
 */
export function computePassportProgress(
  category: PassportCategory,
  triedMatchingStallCount: number,
) {
  const earned = category.stampThresholds.filter((t) => triedMatchingStallCount >= t);
  const nextIdx = earned.length; // index into stampThresholds for next stamp
  return {
    categoryId: category.id,
    triedCount: triedMatchingStallCount,
    nextStampIndex: nextIdx,
    earnedStampThresholds: earned,
  };
}
