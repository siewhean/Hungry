import { useEffect, useState } from "react";

import { buildBrowseRequest, roundCoordinate } from "@/features/search/browseGrid";
import { reportError } from "@/lib/monitoring/reportError";
import {
  CatalogRateLimitedError,
  type CatalogRawDishCard,
  type CatalogRawVenueCard,
} from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";

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
 * is never shown under new text. A failure is reported once and shown as "error"; a rate limit
 * (a fast typist) is shown the same way but not reported. Asks the way the results page does
 * (best match, from the same position), so the top 3 here are the first 3 there.
 */
export function useTypeaheadMatches(query: string, enabled: boolean): TypeaheadMatches {
  const [answer, setAnswer] = useState<{ query: string; matches: TypeaheadMatches } | null>(null);
  const permission = useLocationStore((state) => state.permission);
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const manualCoordinate = useLocationStore((state) => state.manualCoordinate);
  const { coordinate: effective } = getEffectiveLocation({
    permission,
    currentLocation,
    manualCoordinate,
  });
  const latitude = roundCoordinate(effective.latitude);
  const longitude = roundCoordinate(effective.longitude);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      const service = getCatalogRawService();
      const request = buildBrowseRequest({
        query,
        filters: [],
        sort: "relevance",
        coordinate: { latitude, longitude },
      });
      Promise.all([
        service.listDishes({ ...request, limit: TYPEAHEAD_DISH_LIMIT }),
        service.listVenues({ ...request, limit: TYPEAHEAD_STALL_LIMIT }),
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
          if (!(error instanceof CatalogRateLimitedError)) {
            reportError(error, { surface: "search_home", load: "typeahead_matches" });
          }
          if (active) {
            setAnswer({ query, matches: { status: "error", dishes: [], stalls: [] } });
          }
        });
    }, TYPEAHEAD_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [enabled, query, latitude, longitude]);

  if (!enabled) return IDLE;
  return answer?.query === query ? answer.matches : LOADING;
}
