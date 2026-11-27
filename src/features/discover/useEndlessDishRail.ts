import { useCallback, useEffect, useRef, useState } from "react";

import { catalogDishToBite } from "@/features/discover/catalogDishBite";
import type { CatalogPageRequest } from "@/lib/services/catalog";
import { reportError } from "@/lib/monitoring/reportError";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type { Bite } from "@/lib/services/types";

/** Dishes one catalogue page adds to a rail. */
export const ENDLESS_RAIL_PAGE = 20;
/** A rail stops asking for more after this many catalogue dishes. */
export const ENDLESS_RAIL_MAX = 400;

type RailState = {
  key: string;
  bites: Bite[];
  cursor?: string;
  done: boolean;
};

/**
 * More dishes for a Home rail once it has shown the feed's own: each call to `loadMore` reads the
 * next catalogue page for the same request (near here, top rated, under S$8), so the row keeps
 * going like a Netflix row. Pass null to switch it off. Nothing loads until the first `loadMore`.
 */
export function useEndlessDishRail(request: Omit<CatalogPageRequest, "cursor" | "limit"> | null) {
  const key = request ? JSON.stringify(request) : null;
  const [state, setState] = useState<RailState | null>(null);
  const inFlight = useRef<string | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    inFlight.current = null;
  }, [key]);

  const loadMore = useCallback(() => {
    const current = requestRef.current;
    if (!key || !current || inFlight.current === key) return;
    const prior = stateRef.current?.key === key ? stateRef.current : undefined;
    if (prior?.done || (prior?.bites.length ?? 0) >= ENDLESS_RAIL_MAX) return;
    inFlight.current = key;
    void getCatalogRawService()
      .listDishes({ ...current, cursor: prior?.cursor, limit: ENDLESS_RAIL_PAGE })
      .then((page) => {
        if (inFlight.current !== key) return;
        setState((latest) => {
          const base = latest?.key === key ? latest : { key, bites: [], done: false };
          const seen = new Set(base.bites.map((bite) => bite.dishId));
          const added = page.items
            .filter((item) => !seen.has(item.id))
            .map((item) => catalogDishToBite(item));
          return {
            key,
            bites: [...base.bites, ...added],
            cursor: page.nextCursor,
            done: !page.nextCursor || page.items.length === 0,
          };
        });
      })
      .catch((error: unknown) => {
        reportError(error, { surface: "discover_home_endless_rail" });
        // Stop here: the rail keeps what it has instead of retrying in a loop.
        setState((latest) =>
          latest?.key === key ? { ...latest, done: true } : { key, bites: [], done: true },
        );
      })
      .finally(() => {
        if (inFlight.current === key) inFlight.current = null;
      });
  }, [key]);

  return { bites: state && state.key === key ? state.bites : EMPTY, loadMore };
}

const EMPTY: Bite[] = [];
