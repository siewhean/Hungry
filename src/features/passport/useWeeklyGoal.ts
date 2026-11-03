import { useMemo } from "react";

import { computeWeeklyGoal, type WeeklyGoalProgress } from "@/features/passport/weeklyGoal";
import { useChecklistStore } from "@/store/useChecklistStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

/**
 * This week's goal from the stalls and dishes the diner marked tried. One entry per tried stall
 * or dish: a stall tried and on a checklist counts once.
 */
export function useWeeklyGoal(): WeeklyGoalProgress {
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
    return computeWeeklyGoal([...triedAtByItem.values()]);
  }, [checklistItems, stallInteractions]);
}
