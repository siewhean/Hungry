import { useEffect, useMemo, useState } from "react";

import type { AchievementInput } from "@/features/achievements/achievements";
import { hasDishTasteSignal } from "@/lib/ai/tasteEngine";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { reportError } from "@/lib/monitoring/reportError";
import { triedDishFacts, useAchievementTallyStore } from "@/store/useAchievementTallyStore";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

/** Same floor the dish page uses before it shows taste. */
const MIN_TASTE_CONFIDENCE = 0.3;

/**
 * Gathers the counts the achievements need. Spicy, sweet and budget dishes come from the
 * facts saved when a dish was marked tried, falling back to the cached dish for older marks.
 * Distinct centres need one batched venue lookup for the visited stalls.
 */
export function useAchievementInput(): AchievementInput {
  const profile = useProfileStore((state) => state.profile);
  const reviewEntries = useProfileStore((state) => state.reviewEntries);
  const stallInteractions = useStallInteractionStore((state) => state.interactions);
  const triedFacts = useAchievementTallyStore((state) => state.triedByUser[profile.id]);
  const [centreByStall, setCentreByStall] = useState<Record<string, string>>({});

  const visitedStallIds = useMemo(
    () =>
      Object.values(stallInteractions)
        .filter((interaction) => interaction.isTried)
        .map((interaction) => interaction.stallId)
        .sort(),
    [stallInteractions],
  );
  const visitedKey = visitedStallIds.join(",");

  useEffect(() => {
    const missing = visitedStallIds.filter((id) => !(id in centreByStall));
    if (missing.length === 0) return;
    let cancelled = false;
    getHungryService()
      .discovery.getVenuesByIds(missing)
      .then((venues) => {
        if (cancelled) return;
        setCentreByStall((current) => {
          const next = { ...current };
          for (const venue of venues) next[venue.id] = venue.buildingId;
          return next;
        });
      })
      .catch((error) => reportError(error, { screen: "Achievements", action: "load-centres" }));
    return () => {
      cancelled = true;
    };
    // visitedKey stands for visitedStallIds; centreByStall is read only to skip known stalls.
  }, [visitedKey]);

  return useMemo(() => {
    const repository = getDataRepository();
    let spicyDishes = 0;
    let sweetDishes = 0;
    let budgetDishes = 0;
    for (const dishId of profile.reviewedDishIds) {
      let facts = triedFacts?.[dishId];
      if (!facts) {
        const dish = repository.getDishById(dishId);
        if (dish)
          facts = triedDishFacts(
            dish,
            hasDishTasteSignal(dish) && (dish.tasteConfidence ?? 1) >= MIN_TASTE_CONFIDENCE,
          );
      }
      if (facts?.spicy) spicyDishes += 1;
      if (facts?.sweet) sweetDishes += 1;
      if (facts?.budget) budgetDishes += 1;
    }
    return {
      triedDishes: profile.reviewedDishIds.length,
      distinctCentres: new Set(
        visitedStallIds.map((id) => centreByStall[id]).filter((id): id is string => Boolean(id)),
      ).size,
      stallsVisited: visitedStallIds.length,
      spicyDishes,
      sweetDishes,
      budgetDishes,
      reviewsWritten: Math.max(profile.stats.dishesReviewed, Object.keys(reviewEntries).length),
      dishesSaved: profile.favouriteDishIds.length,
    };
  }, [centreByStall, profile, reviewEntries, triedFacts, visitedStallIds]);
}
