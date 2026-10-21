import { useEffect, useMemo, useState } from "react";

import { getHungryService } from "@/lib/services/serviceProvider";

type LabelTarget = { dishId?: string; stallId?: string };

/** Stable key of the dish/stall ids to label, so unrelated re-renders don't refetch. */
export function itemLabelTargetsKey(items: readonly LabelTarget[]): string {
  const ids = new Set<string>();
  items.forEach((item) => {
    if (item.dishId) ids.add(`d:${item.dishId}`);
    if (item.stallId) ids.add(`s:${item.stallId}`);
  });
  return [...ids].sort().join(",");
}

/** What a list row shows for a dish or stall besides its name. */
export interface ItemDetail {
  name: string;
  imageUrl?: string;
  /** The dish's stall, for dish rows. */
  stallName?: string;
  price?: number;
}

function sameDetails(left: Record<string, ItemDetail>, right: Record<string, ItemDetail>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Dish/stall names for list items, keyed by id. Refetches only when the set of
 * ids changes, and keeps the same object when nothing changed (no render loop).
 */
export function useItemLabels(items: readonly LabelTarget[]): Record<string, string> {
  return useItemLabelsState(items).labels;
}

/**
 * Labels plus whether the lookup for the current ids has finished, so rows can say
 * "Loading…" instead of flashing "Deleted dish" before names arrive.
 */
export function useItemLabelsState(items: readonly LabelTarget[]): {
  labels: Record<string, string>;
  isLoaded: boolean;
} {
  const { details, isLoaded } = useItemDetailsState(items);
  const labels = useMemo(
    () => Object.fromEntries(Object.entries(details).map(([id, detail]) => [id, detail.name])),
    [details],
  );
  return { labels, isLoaded };
}

/** Name, photo, stall and price for each list item, keyed by dish or stall id. */
export function useItemDetailsState(items: readonly LabelTarget[]): {
  details: Record<string, ItemDetail>;
  isLoaded: boolean;
} {
  const targetsKey = useMemo(() => itemLabelTargetsKey(items), [items]);
  const [details, setDetails] = useState<Record<string, ItemDetail>>({});
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const service = getHungryService();
    const targets = targetsKey ? targetsKey.split(",") : [];

    void (async () => {
      const nextDetails: Record<string, ItemDetail> = {};
      await Promise.all(
        targets.map(async (target) => {
          const id = target.slice(2);
          try {
            if (target.startsWith("d:")) {
              const dish = await service.discovery.getDish(id);
              if (dish) {
                nextDetails[id] = {
                  name: dish.name,
                  imageUrl: dish.imageUrl || undefined,
                  stallName: dish.venueName || undefined,
                  price: Number.isFinite(dish.price) ? dish.price : undefined,
                };
              }
            } else {
              const venue = await service.discovery.getVenue(id);
              if (venue) nextDetails[id] = { name: venue.name, imageUrl: venue.imageUrl };
            }
          } catch {
            // Unknown name: the row shows its "Deleted dish/stall" fallback.
          }
        }),
      );
      if (!mounted) return;
      setDetails((current) => (sameDetails(current, nextDetails) ? current : nextDetails));
      setLoadedKey(targetsKey);
    })();

    return () => {
      mounted = false;
    };
  }, [targetsKey]);

  return { details, isLoaded: loadedKey === targetsKey };
}
