import { useCallback, useEffect, useMemo, useState } from "react";

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

/** One get_item_details call for all dishes and stalls (checklists, which have no portfolio id). */
async function fetchDetailsById(
  targets: string[],
): Promise<{ details: Record<string, ItemDetail>; failedIds: Set<string> }> {
  const dishIds = targets
    .filter((target) => target.startsWith("d:"))
    .map((target) => target.slice(2));
  const stallIds = targets
    .filter((target) => target.startsWith("s:"))
    .map((target) => target.slice(2));
  try {
    const rows = await getHungryService().discovery.getItemDetails({ dishIds, stallIds });
    const details: Record<string, ItemDetail> = {};
    rows.forEach((row) => {
      const id = row.dishId ?? row.stallId;
      if (!id || !row.name) return;
      details[id] = {
        name: row.name,
        imageUrl: row.imageUrl || undefined,
        stallName: row.dishId ? row.stallName : undefined,
        price: row.dishId && Number.isFinite(row.price) ? row.price : undefined,
      };
    });
    return { details, failedIds: new Set() };
  } catch {
    // A failed lookup is not a deleted row: the caller offers a retry.
    return { details: {}, failedIds: new Set(targets.map((target) => target.slice(2))) };
  }
}

/** One call for a whole portfolio (get_portfolio_item_details). */
async function fetchPortfolioDetails(
  portfolioId: string,
  targets: string[],
): Promise<{ details: Record<string, ItemDetail>; failedIds: Set<string> }> {
  try {
    const rows = await getHungryService().portfolio.getPortfolioItemDetails(portfolioId);
    const details: Record<string, ItemDetail> = {};
    rows.forEach((row) => {
      const id = row.dishId ?? row.stallId;
      if (!id || !row.name) return;
      details[id] = {
        name: row.name,
        imageUrl: row.imageUrl,
        stallName: row.dishId ? row.stallName : undefined,
        price: row.dishId ? row.price : undefined,
      };
    });
    return { details, failedIds: new Set() };
  } catch {
    return { details: {}, failedIds: new Set(targets.map((target) => target.slice(2))) };
  }
}

/**
 * Name, photo, stall and price for each list item, keyed by dish or stall id.
 * Pass `portfolioId` to read a whole portfolio in one call instead of one request
 * per item. `failedIds` are ids whose lookup errored (offline, timeout), which is
 * not the same as a confirmed missing row; `retry` looks them up again.
 */
export function useItemDetailsState(
  items: readonly LabelTarget[],
  portfolioId?: string,
): {
  details: Record<string, ItemDetail>;
  isLoaded: boolean;
  failedIds: ReadonlySet<string>;
  retry: () => void;
} {
  const targetsKey = useMemo(() => itemLabelTargetsKey(items), [items]);
  const [details, setDetails] = useState<Record<string, ItemDetail>>({});
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let mounted = true;
    const targets = targetsKey ? targetsKey.split(",") : [];

    void (async () => {
      const result =
        portfolioId && targets.length > 0
          ? await fetchPortfolioDetails(portfolioId, targets)
          : await fetchDetailsById(targets);
      if (!mounted) return;
      setDetails((current) => (sameDetails(current, result.details) ? current : result.details));
      setFailedIds(result.failedIds);
      setLoadedKey(targetsKey);
    })();

    return () => {
      mounted = false;
    };
  }, [attempt, portfolioId, targetsKey]);

  return { details, isLoaded: loadedKey === targetsKey, failedIds, retry };
}
