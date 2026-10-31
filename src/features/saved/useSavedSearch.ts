import { useEffect, useMemo, useState } from "react";

import {
  collectSearchNameIds,
  searchSaved,
  type SavedSearchResults,
} from "@/features/saved/savedSearch";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PortfolioItemDetailRow, SavedDishCard } from "@/lib/services/types";
import { usePortfolioStore } from "@/store/usePortfolioStore";
import type { Portfolio, Review, VenueSummary } from "@/types/domain";

/** Wait for the diner to stop typing before searching. */
export const SAVED_SEARCH_DEBOUNCE_MS = 250;

export type SavedSearchState = {
  /** The query the results are for (trimmed); empty means no search is active. */
  query: string;
  status: "idle" | "loading" | "ready" | "error";
  results: SavedSearchResults;
};

const EMPTY: SavedSearchResults = { dishes: [], stalls: [], lists: [], reviews: [], total: 0 };

type Props = {
  /** What the diner typed; the hook debounces it. */
  rawQuery: string;
  userId: string;
  dishes: readonly SavedDishCard[];
  stalls: readonly VenueSummary[];
  lists: readonly Portfolio[];
};

/**
 * One search over everything the diner saved: dishes, stalls, lists (by name and by what is in
 * them) and their own reviews. The first search loads the rest in a fixed number of batched reads
 * (your reviews, the items of all your lists, then one `getItemDetails` for every name), never a
 * call per row; typing after that only filters what is already in memory.
 */
export function useSavedSearch({
  rawQuery,
  userId,
  dishes,
  stalls,
  lists,
}: Props): SavedSearchState {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const trimmed = rawQuery.trim();
    if (trimmed === "") {
      setQuery("");
      return undefined;
    }
    const timer = setTimeout(() => setQuery(trimmed), SAVED_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const itemsByList = usePortfolioStore((state) => state.items);
  const loadItemsForPortfolios = usePortfolioStore((state) => state.loadItemsForPortfolios);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [names, setNames] = useState<{ key: string; rows: Map<string, string> } | null>(null);
  const [failed, setFailed] = useState(false);
  const active = query !== "";
  const listKey = lists.map((list) => list.id).join(",");

  // Your reviews and the lists' items: loaded once, on the first search.
  useEffect(() => {
    if (!active) return undefined;
    let current = true;
    setFailed(false);
    void (async () => {
      try {
        const [ownReviews] = await Promise.all([
          reviews === null
            ? getHungryService().reviews.getUserReviews(userId, { limit: 200, offset: 0 })
            : Promise.resolve(reviews),
          lists.length > 0
            ? loadItemsForPortfolios(lists.map((list) => list.id))
            : Promise.resolve(),
        ]);
        if (current) setReviews(ownReviews);
      } catch (error) {
        reportError(error, { screen: "Favourites", action: "load_saved_search" });
        if (current) setFailed(true);
      }
    })();
    return () => {
      current = false;
    };
    // reviews are read once; the lists key reloads items when the diner's lists change.
  }, [active, listKey, userId]);

  const wanted = useMemo(
    () => collectSearchNameIds({ lists, itemsByList, reviews: reviews ?? [] }),
    [itemsByList, lists, reviews],
  );
  const wantedKey = `${wanted.dishIds.join(",")}|${wanted.stallIds.join(",")}`;

  // One detail read names every dish and stall in the lists and the reviews.
  useEffect(() => {
    if (!active || reviews === null) return undefined;
    if (wanted.dishIds.length === 0 && wanted.stallIds.length === 0) {
      setNames({ key: wantedKey, rows: new Map() });
      return undefined;
    }
    let current = true;
    getHungryService()
      .discovery.getItemDetails(wanted)
      .then((rows: PortfolioItemDetailRow[]) => {
        if (!current) return;
        const byKey = new Map<string, string>();
        for (const row of rows) {
          if (!row.name) continue;
          if (row.dishId) byKey.set(`dish:${row.dishId}`, row.name);
          else if (row.stallId) byKey.set(`stall:${row.stallId}`, row.name);
        }
        setNames({ key: wantedKey, rows: byKey });
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "Favourites", action: "load_saved_search_names" });
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
    // wantedKey stands for `wanted`.
  }, [active, reviews, wantedKey]);

  const results = useMemo(
    () =>
      active
        ? searchSaved({
            query,
            dishes,
            stalls,
            lists,
            itemsByList,
            reviews: reviews ?? [],
            getName: (type, id) => names?.rows.get(`${type}:${id}`),
          })
        : EMPTY,
    [active, dishes, itemsByList, lists, names, query, reviews, stalls],
  );

  if (!active) return { query, status: "idle", results: EMPTY };
  if (failed && results.total === 0) return { query, status: "error", results };
  const ready = reviews !== null && names?.key === wantedKey;
  return { query, status: ready ? "ready" : "loading", results };
}
