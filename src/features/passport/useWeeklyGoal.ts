import { useMemo } from "react";

import { computeWeeklyGoal, type WeeklyGoalProgress } from "@/features/passport/weeklyGoal";
import { computeWeeklyStreak, type WeeklyStreak } from "@/features/passport/weeklyStreak";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

/**
 * `triedAt` of every stall and dish the diner marked tried, for this week's goal and the streak.
 * One entry per tried stall or dish: a stall tried and on a checklist counts once.
 */
export function useTriedTimestamps(): string[] {
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const checklistItems = useChecklistStore((state) => state.items);
  return useMemo(() => {
    const triedAtByItem = new Map<string, string>();
    for (const interaction of Object.values(stallInteractions)) {
      if (interaction.isTried && interaction.triedAt) {
        triedAtByItem.set(`stall:${interaction.stallId}`, interaction.triedAt);
      }
    }
    for (const item of Object.values(checklistItems).flat()) {
      if (!item.triedAt) continue;
      const key = item.dishId
        ? `dish:${item.dishId}`
        : item.stallId
          ? `stall:${item.stallId}`
          : `item:${item.id}`;
      if (!triedAtByItem.has(key)) triedAtByItem.set(key, item.triedAt);
    }
    return [...triedAtByItem.values()];
  }, [checklistItems, stallInteractions]);
}

export function useWeeklyGoal(): WeeklyGoalProgress {
  const triedAt = useTriedTimestamps();
  return useMemo(() => computeWeeklyGoal(triedAt), [triedAt]);
}

/** The weekly streak from the same tried stalls and dishes (weeklyStreak.ts). */
export function useWeeklyStreak(): WeeklyStreak {
  const triedAt = useTriedTimestamps();
  return useMemo(() => computeWeeklyStreak(triedAt), [triedAt]);
}
