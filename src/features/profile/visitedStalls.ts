import { useMemo } from "react";

import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

/**
 * Stalls the user has visited: stalls marked tried (user_stall_interactions) plus the stalls of
 * dishes they tried or reviewed. The Profile "Stalls" stat, the Visited stalls list and Saved,
 * Stalls, Visited all read this, so the count always matches the list. Most recent first.
 *
 * `cachedOnly` (the default) keeps the stalls the local catalog cache knows. The cache holds
 * only part of the catalog, so a list that reads its stall rows from the server passes
 * `cachedOnly: false` and does not lose a stall the cache lacks.
 */
export function useVisitedStallIds({ cachedOnly = true }: { cachedOnly?: boolean } = {}): string[] {
  const interactions = useStallInteractionStore((state) => state.interactions);
  const reviewedDishIds = useProfileStore((state) => state.profile.reviewedDishIds);

  return useMemo(() => {
    const repository = getDataRepository();
    const ids = new Set<string>();
    const tried = Object.values(interactions)
      .filter((interaction) => interaction.isTried)
      .sort((left, right) => (right.triedAt ?? "").localeCompare(left.triedAt ?? ""));
    for (const interaction of tried) ids.add(interaction.stallId);
    for (const dishId of reviewedDishIds) {
      const venueId = repository.getDishById(dishId)?.venueId;
      if (venueId) ids.add(venueId);
    }
    const all = [...ids];
    return cachedOnly ? all.filter((id) => Boolean(repository.getVenueById(id))) : all;
  }, [cachedOnly, interactions, reviewedDishIds]);
}
