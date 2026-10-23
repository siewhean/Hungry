/**
 * Achievements: tiered goals computed from what a diner has done. Each achievement has a few
 * tiers (for example 10, 25, 50 and 100 dishes); the card shows progress to the next tier.
 * Pure: the screen gathers the counts, this module turns them into display rows.
 */

export type AchievementId =
  | "dish-collector"
  | "centre-hopper"
  | "stall-explorer"
  | "spice-chaser"
  | "sweet-tooth"
  | "budget-eater"
  | "critic"
  | "curator";

export type AchievementIcon =
  | "utensils"
  | "map-pin"
  | "store"
  | "flame"
  | "candy"
  | "coins"
  | "pen"
  | "bookmark";

export type AchievementInput = {
  /** Dishes marked tried or reviewed. */
  triedDishes: number;
  /** Different food centres, malls or markets the diner has visited a stall in. */
  distinctCentres: number;
  /** Stalls marked visited. */
  stallsVisited: number;
  /** Tried dishes that are noticeably spicy. */
  spicyDishes: number;
  /** Tried dishes that are noticeably sweet. */
  sweetDishes: number;
  /** Tried dishes under S$5. */
  budgetDishes: number;
  reviewsWritten: number;
  dishesSaved: number;
};

type AchievementDefinition = {
  id: AchievementId;
  title: string;
  /** Sentence with the unit, for example "Try {n} dishes". */
  describe: (target: number) => string;
  unit: string;
  icon: AchievementIcon;
  tiers: readonly number[];
  read: (input: AchievementInput) => number;
};

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: "dish-collector",
    title: "Dish collector",
    describe: (n) => `Try ${n} different dishes`,
    unit: "dishes",
    icon: "utensils",
    tiers: [10, 25, 50, 100],
    read: (input) => input.triedDishes,
  },
  {
    id: "centre-hopper",
    title: "Centre hopper",
    describe: (n) => `Eat at ${n} different hawker centres or food courts`,
    unit: "centres",
    icon: "map-pin",
    tiers: [2, 5, 10, 20],
    read: (input) => input.distinctCentres,
  },
  {
    id: "stall-explorer",
    title: "Stall explorer",
    describe: (n) => `Visit ${n} different stalls`,
    unit: "stalls",
    icon: "store",
    tiers: [5, 15, 30, 60],
    read: (input) => input.stallsVisited,
  },
  {
    id: "spice-chaser",
    title: "Spice chaser",
    describe: (n) => `Try ${n} spicy dishes`,
    unit: "spicy dishes",
    icon: "flame",
    tiers: [3, 10, 25],
    read: (input) => input.spicyDishes,
  },
  {
    id: "sweet-tooth",
    title: "Sweet tooth",
    describe: (n) => `Try ${n} sweet treats`,
    unit: "sweet dishes",
    icon: "candy",
    tiers: [3, 10, 25],
    read: (input) => input.sweetDishes,
  },
  {
    id: "budget-eater",
    title: "Budget eater",
    describe: (n) => `Try ${n} dishes under S$5`,
    unit: "dishes under S$5",
    icon: "coins",
    tiers: [5, 15, 40],
    read: (input) => input.budgetDishes,
  },
  {
    id: "critic",
    title: "Critic",
    describe: (n) => `Write ${n} reviews`,
    unit: "reviews",
    icon: "pen",
    tiers: [1, 5, 20, 50],
    read: (input) => input.reviewsWritten,
  },
  {
    id: "curator",
    title: "Curator",
    describe: (n) => `Save ${n} dishes to try`,
    unit: "saved",
    icon: "bookmark",
    tiers: [5, 20, 50],
    read: (input) => input.dishesSaved,
  },
];

export type AchievementRow = {
  id: AchievementId;
  title: string;
  icon: AchievementIcon;
  /** Tiers reached so far (0 means not started). */
  level: number;
  totalLevels: number;
  progress: number;
  /** The next target, or the last one when everything is done. */
  target: number;
  completed: boolean;
  /** 0-1 progress towards the next target. */
  fraction: number;
  description: string;
  unit: string;
};

export function computeAchievements(input: AchievementInput): AchievementRow[] {
  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const progress = Math.max(0, Math.floor(definition.read(input)));
    const level = definition.tiers.filter((tier) => progress >= tier).length;
    const completed = level === definition.tiers.length;
    const target = definition.tiers[Math.min(level, definition.tiers.length - 1)] ?? 0;
    const previous = level > 0 ? (definition.tiers[level - 1] ?? 0) : 0;
    const fraction = completed
      ? 1
      : Math.max(0, Math.min(1, (progress - previous) / Math.max(1, target - previous)));
    return {
      id: definition.id,
      title: definition.title,
      icon: definition.icon,
      level,
      totalLevels: definition.tiers.length,
      progress,
      target,
      completed,
      fraction,
      description: definition.describe(target),
      unit: definition.unit,
    };
  });
}

/** Axis value at which a dish counts as spicy or sweet for the matching achievement. */
export const ACHIEVEMENT_TASTE_THRESHOLD = 7;
/** Dishes at or under this price (S$) count for Budget eater. */
export const ACHIEVEMENT_BUDGET_PRICE = 5;
