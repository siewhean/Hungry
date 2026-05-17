/**
 * passportConfig.ts — Hungry Passport achievement stamp definitions
 *
 * These are static config/seed records — not user-generated.
 * Passport progress is computed at runtime by joining this config
 * against the user's stall interactions.
 *
 * The visual language mirrors the Hungry Passport concept: food-travel
 * achievement stamps that feel like immigration checkpoints.
 */

import type { PassportCategory } from "@/types/domain";

// ─── Cuisine Achievement Stamps ───────────────────────────────────────────────

export const PASSPORT_CUISINE_CATEGORIES: PassportCategory[] = [
  {
    id: "cuisine-hawker",
    name: "Hawker Explorer",
    description: "Discover bold hawker flavours where the locals eat.",
    type: "cuisine",
    matchTag: "hawker",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-chinese",
    name: "Noodle Nomad",
    description: "Collect noodle, roast, dumpling, and wok-hei checkpoints.",
    type: "cuisine",
    matchTag: "chinese",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-malay",
    name: "Spice Survivor",
    description: "Conquer sambal, satay, nasi lemak, mee rebus, and heat-packed classics.",
    type: "cuisine",
    matchTag: "malay",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-indian",
    name: "Curry Trailblazer",
    description: "Journey through prata, biryani, thosai, curry, and masala-rich plates.",
    type: "cuisine",
    matchTag: "indian",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-japanese",
    name: "Ramen Rambler",
    description: "Stamp your way through ramen, donburi, sushi, and izakaya finds.",
    type: "cuisine",
    matchTag: "japanese",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "cuisine-western",
    name: "Brunch Pilgrim",
    description: "Explore burgers, pasta, brunch plates, grills, and cafe comfort food.",
    type: "cuisine",
    matchTag: "western",
    stampThresholds: [1, 3, 5, 10],
  },
];

// ─── Neighbourhood Checkpoints ────────────────────────────────────────────────

export const PASSPORT_NEIGHBOURHOOD_CATEGORIES: PassportCategory[] = [
  {
    id: "hood-cbd",
    name: "CBD Lunch Pilot",
    description: "Navigate the Central Business District's quickest lunch checkpoints.",
    type: "neighbourhood",
    matchTag: "cbd",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-chinatown",
    name: "Local Legend",
    description: "Unlock heritage food routes through Chinatown's classic stalls.",
    type: "neighbourhood",
    matchTag: "chinatown",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-bugis",
    name: "Night Market Hunter",
    description: "Hunt down Bugis, Arab Street, and after-dark food trail discoveries.",
    type: "neighbourhood",
    matchTag: "bugis",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-tampines",
    name: "Neighbourhood Voyager",
    description: "Collect east-side checkpoints across Tampines hawker centres and cafes.",
    type: "neighbourhood",
    matchTag: "tampines",
    stampThresholds: [1, 3, 5, 10],
  },
  {
    id: "hood-tiong-bahru",
    name: "Coffee Conqueror",
    description: "Sip, savour, and discover Tiong Bahru's coffee and brunch trail.",
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
