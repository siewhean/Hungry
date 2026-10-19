import { useMemo } from "react";

import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";

/**
 * Stalls the user has visited: stalls marked tried (user_stall_interactions) plus the stalls of
 * dishes they tried or reviewed. The Profile "Stalls" stat and the Visited stalls list both read
 * this, so the count always matches the list.
 */
export function useVisitedStallIds(): string[] {
  const interactions = useStallInteractionStore((state) => state.interactions);
  const reviewedDishIds = useProfileStore((state) => state.profile.reviewedDishIds);

  return useMemo(() => {
    const repository = getDataRepository();
    const ids = new Set<string>();
    for (const interaction of Object.values(interactions)) {
      if (interaction.isTried) ids.add(interaction.stallId);
    }
    for (const dishId of reviewedDishIds) {
      const venueId = repository.getDishById(dishId)?.venueId;
      if (venueId) ids.add(venueId);
    }
    return [...ids].filter((id) => Boolean(repository.getVenueById(id)));
  }, [interactions, reviewedDishIds]);
}
