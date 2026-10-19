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

function sameLabels(left: Record<string, string>, right: Record<string, string>) {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

/**
 * Dish/stall names for list items, keyed by id. Refetches only when the set of
 * ids changes, and keeps the same object when nothing changed (no render loop).
 */
export function useItemLabels(items: readonly LabelTarget[]): Record<string, string> {
  const targetsKey = useMemo(() => itemLabelTargetsKey(items), [items]);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    const service = getHungryService();
    const targets = targetsKey ? targetsKey.split(",") : [];

    void (async () => {
      const nextLabels: Record<string, string> = {};
      await Promise.all(
        targets.map(async (target) => {
          const id = target.slice(2);
          try {
            if (target.startsWith("d:")) {
              const dish = await service.discovery.getDish(id);
              if (dish) nextLabels[id] = dish.name;
            } else {
              const venue = await service.discovery.getVenue(id);
              if (venue) nextLabels[id] = venue.name;
            }
          } catch {
            // Unknown name: the row shows its "Deleted dish/stall" fallback.
          }
        }),
      );
      if (mounted) setLabels((current) => (sameLabels(current, nextLabels) ? current : nextLabels));
    })();

    return () => {
      mounted = false;
    };
  }, [targetsKey]);

  return labels;
}
