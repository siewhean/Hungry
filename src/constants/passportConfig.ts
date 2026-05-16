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

import type {
  EarnedPassportStamp,
  PassportBadgeDefinition,
  PassportCategory,
  PassportCelebrateMarker,
  PassportInkTone,
  PassportNextStamp,
  PassportStampAssetKey,
  PassportStampDefinition,
  PassportStampShape,
  UserPassportProgress,
} from "@/types/domain";

const STAMP_TONES: PassportInkTone[] = ["orange", "amber", "teal", "navy"];
const STAMP_SHAPES: PassportStampShape[] = ["rounded", "oval", "slanted"];

const STAMP_LEVELS: Pick<
  PassportStampDefinition,
  "index" | "title" | "subtitle" | "description"
>[] = [
  {
    index: 0,
    title: "First stamp",
    subtitle: "Entry mark",
    description: "Started this food trail.",
  },
  {
    index: 1,
    title: "Return visit",
    subtitle: "Second checkpoint",
    description: "Built real momentum here.",
  },
  {
    index: 2,
    title: "Trail regular",
    subtitle: "Regular mark",
    description: "Unlocked the regular explorer mark.",
  },
  {
    index: 3,
    title: "Passport veteran",
    subtitle: "Completion mark",
    description: "Completed the full trail set.",
  },
];

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

export const PASSPORT_STAMP_DEFINITIONS: PassportStampDefinition[] =
  ALL_PASSPORT_CATEGORIES.flatMap((category, categoryIndex) =>
    category.stampThresholds.map((threshold, index) => {
      const level = STAMP_LEVELS[index] ?? {
        index,
        title: `Stamp ${index + 1}`,
        subtitle: "Trail mark",
        description: `Tried ${threshold} matching stalls.`,
      };
      return {
        id: getPassportStampId(category.id, threshold),
        categoryId: category.id,
        threshold,
        index,
        title: `${category.name}: ${level.title}`,
        subtitle: level.subtitle,
        description: level.description,
        assetKey: resolveStampAssetKey(category),
        inkTone: STAMP_TONES[(categoryIndex + index) % STAMP_TONES.length],
        stampShape: STAMP_SHAPES[(categoryIndex + index) % STAMP_SHAPES.length],
      };
    }),
  );

export const PASSPORT_BADGE_DEFINITIONS: PassportBadgeDefinition[] = [
  {
    id: "badge-hawker-explorer",
    title: "Hawker Explorer",
    description: "First stamp on the hawker trail.",
    categoryType: "cuisine",
    assetKey: "badge-hawker-explorer",
    unlockCategoryId: "cuisine-hawker",
    unlockThreshold: 1,
  },
  {
    id: "badge-classics-trail",
    title: "Classics Trail",
    description: "Progress across Singapore's classic food map.",
    categoryType: "classic",
    assetKey: "badge-classics-trail",
    unlockCategoryId: "hood-chinatown",
    unlockThreshold: 1,
  },
  {
    id: "badge-night-makan",
    title: "Night Makan",
    description: "Late-night discovery credentials for supper routes.",
    categoryType: "neighbourhood",
    assetKey: "badge-night-makan",
    unlockCategoryId: "hood-bugis",
    unlockThreshold: 1,
  },
  {
    id: "badge-contributor",
    title: "Contributor",
    description: "Recognition for useful food discovery contributions.",
    categoryType: "contributor",
    assetKey: "badge-contributor",
    unlockThreshold: 1,
  },
];

const PASSPORT_STAMPS_BY_ID = PASSPORT_STAMP_DEFINITIONS.reduce<
  Record<string, PassportStampDefinition>
>((map, stamp) => {
  map[stamp.id] = stamp;
  return map;
}, {});

const PASSPORT_CATEGORIES_BY_ID = ALL_PASSPORT_CATEGORIES.reduce<Record<string, PassportCategory>>(
  (map, category) => {
    map[category.id] = category;
    return map;
  },
  {},
);

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
): UserPassportProgress {
  const earned = category.stampThresholds.filter((t) => triedMatchingStallCount >= t);
  const nextIdx = earned.length; // index into stampThresholds for next stamp
  return {
    categoryId: category.id,
    triedCount: triedMatchingStallCount,
    nextStampIndex: nextIdx,
    earnedStampThresholds: earned,
  };
}

export function getPassportStampId(categoryId: string, threshold: number): string {
  return `${categoryId}-${threshold}`;
}

function resolveStampAssetKey(category: PassportCategory): PassportStampAssetKey {
  if (category.id === "hood-chinatown") return "stamp-hood-chinatown";
  if (category.matchTag.toLowerCase().includes("halal")) return "stamp-dietary-halal";
  if (category.matchTag.toLowerCase().includes("laksa")) return "stamp-classic-laksa";
  return "stamp-cuisine-hawker";
}

export function getPassportStampDefinition(
  categoryId: string,
  threshold: number,
): PassportStampDefinition | null {
  return PASSPORT_STAMPS_BY_ID[getPassportStampId(categoryId, threshold)] ?? null;
}

export function getEarnedPassportStamps(
  progressMap: Record<string, UserPassportProgress>,
): EarnedPassportStamp[] {
  return Object.values(progressMap)
    .flatMap((progress) =>
      progress.earnedStampThresholds.flatMap((threshold) => {
        const stamp = getPassportStampDefinition(progress.categoryId, threshold);
        return stamp ? [{ ...stamp, triedCount: progress.triedCount }] : [];
      }),
    )
    .sort((a, b) => b.threshold - a.threshold || a.categoryId.localeCompare(b.categoryId));
}

export function isPassportBadgeEarned(
  badge: PassportBadgeDefinition,
  earnedStamps: Pick<EarnedPassportStamp, "id">[],
): boolean {
  if (!badge.unlockCategoryId) return false;
  const unlockCategoryId = badge.unlockCategoryId;

  return earnedStamps.some(
    (stamp) => stamp.id === getPassportStampId(unlockCategoryId, badge.unlockThreshold),
  );
}

export function getNextPassportStamp(
  progressMap: Record<string, UserPassportProgress>,
): PassportNextStamp | null {
  return ALL_PASSPORT_CATEGORIES.reduce<PassportNextStamp | null>((best, category) => {
    const progress = progressMap[category.id];
    const threshold = category.stampThresholds[progress?.nextStampIndex ?? 0];
    if (!progress || threshold === undefined) return best;

    const stamp = getPassportStampDefinition(category.id, threshold);
    if (!stamp) return best;

    const next: PassportNextStamp = {
      category,
      stamp,
      triedCount: progress.triedCount,
      remainingCount: Math.max(threshold - progress.triedCount, 0),
      progressFraction: Math.min(progress.triedCount / threshold, 1),
    };

    if (!best) return next;
    if (next.progressFraction !== best.progressFraction) {
      return next.progressFraction > best.progressFraction ? next : best;
    }
    return next.remainingCount < best.remainingCount ? next : best;
  }, null);
}

export function getNewlyEarnedUncelebratedStamp(
  progressMap: Record<string, UserPassportProgress>,
  celebratedStampIds: Record<string, boolean>,
): EarnedPassportStamp | null {
  return (
    getEarnedPassportStamps(progressMap).find((stamp) => !celebratedStampIds[stamp.id]) ?? null
  );
}

export function createPassportCelebrateMarker(
  stamp: EarnedPassportStamp | null,
): PassportCelebrateMarker | null {
  if (!stamp) return null;
  const category = PASSPORT_CATEGORIES_BY_ID[stamp.categoryId];
  return {
    stampId: stamp.id,
    categoryId: stamp.categoryId,
    title: category ? category.name : stamp.title,
    shouldCelebrate: true,
  };
}
