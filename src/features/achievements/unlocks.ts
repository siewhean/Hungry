// Which achievement tiers a diner has newly reached. Pure: the caller keeps the last level it
// reported for each achievement and passes it back in.

import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementIcon,
  type AchievementId,
  type AchievementRow,
} from "@/features/achievements/achievements";

export type AchievementLevels = Partial<Record<AchievementId, number>>;

export interface AchievementUnlock {
  achievementId: AchievementId;
  title: string;
  icon: AchievementIcon;
  /** The tier just reached, from 1. */
  level: number;
  totalLevels: number;
  /** What was done to reach it, for example "Try 10 different dishes". */
  reached: string;
}

export interface UnlockResult {
  unlocks: AchievementUnlock[];
  /** The levels to remember: never lower than before, so a level is celebrated once. */
  levels: AchievementLevels;
}

export function detectAchievementUnlocks(
  rows: readonly AchievementRow[],
  reported: AchievementLevels,
): UnlockResult {
  const unlocks: AchievementUnlock[] = [];
  const levels: AchievementLevels = { ...reported };
  for (const row of rows) {
    const before = reported[row.id] ?? 0;
    if (row.level <= before) continue;
    levels[row.id] = row.level;
    const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === row.id);
    const tier = definition?.tiers[row.level - 1];
    // Several tiers at once (a first load) celebrate the highest one only.
    unlocks.push({
      achievementId: row.id,
      title: row.title,
      icon: row.icon,
      level: row.level,
      totalLevels: row.totalLevels,
      reached: definition && tier !== undefined ? definition.describe(tier) : row.title,
    });
  }
  return { unlocks, levels };
}
