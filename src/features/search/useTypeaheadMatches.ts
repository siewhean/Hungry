import { useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import type { CatalogRawDishCard, CatalogRawVenueCard } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";

/** How many dishes and stalls Search home lists under the suggestions while the user types. */
export const TYPEAHEAD_DISH_LIMIT = 3;
export const TYPEAHEAD_STALL_LIMIT = 2;
/** Longer than the suggestion debounce: this is two page requests, not one. */
export const TYPEAHEAD_DEBOUNCE_MS = 350;

export type TypeaheadMatches =
  | { status: "idle" | "loading"; dishes: []; stalls: []; releaseId?: undefined }
  | {
      status: "ready" | "error";
      dishes: CatalogRawDishCard[];
      stalls: CatalogRawVenueCard[];
      releaseId?: string;
    };

const IDLE: TypeaheadMatches = { status: "idle", dishes: [], stalls: [] };
const LOADING: TypeaheadMatches = { status: "loading", dishes: [], stalls: [] };

/**
 * The top dishes and stalls for the text being typed, so Search home can show answers before
 * the user opens the full results. Kept with the text they answer, so a slow reply for old text
 * is never shown under new text. A failure is reported once and shown as "error".
 */
export function useTypeaheadMatches(query: string, enabled: boolean): TypeaheadMatches {
  const [answer, setAnswer] = useState<{ query: string; matches: TypeaheadMatches } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      const service = getCatalogRawService();
      Promise.all([
        service.listDishes({ query, limit: TYPEAHEAD_DISH_LIMIT }),
        service.listVenues({ query, limit: TYPEAHEAD_STALL_LIMIT }),
      ])
        .then(([dishes, stalls]) => {
          if (!active) return;
          setAnswer({
            query,
            matches: {
              status: "ready",
              dishes: dishes.items.slice(0, TYPEAHEAD_DISH_LIMIT),
              stalls: stalls.items.slice(0, TYPEAHEAD_STALL_LIMIT),
              releaseId: dishes.releaseId || undefined,
            },
          });
        })
        .catch((error) => {
          reportError(error, { surface: "search_home", load: "typeahead_matches" });
          if (active) {
            setAnswer({ query, matches: { status: "error", dishes: [], stalls: [] } });
          }
        });
    }, TYPEAHEAD_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, query]);

  if (!enabled) return IDLE;
  return answer?.query === query ? answer.matches : LOADING;
}
