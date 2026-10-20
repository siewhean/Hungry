import { useMemo } from "react";

import { buildFoodHistory, type FoodHistory } from "@/lib/ai/foodHistory";
import { resolveFoodOpenness } from "@/lib/ai/exploration";
import { selectFoodHistoryRows, useProfileStore } from "@/store/useProfileStore";
import type { FoodOpenness } from "@/types/domain";

/** The signed-in or guest user's food history and openness, ready for the ranking pipeline. */
export function useFoodHistory(): { history: FoodHistory; openness: FoodOpenness } {
  const foodHistory = useProfileStore((state) => state.foodHistory);
  const profile = useProfileStore((state) => state.profile);
  return useMemo(
    () => ({
      history: buildFoodHistory(selectFoodHistoryRows({ foodHistory, profile })),
      openness: resolveFoodOpenness(profile.tasteProfile),
    }),
    [foodHistory, profile],
  );
}
