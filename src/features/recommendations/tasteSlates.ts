/**
 * Two taste-led reads that reuse get_taste_recommendations (recommendations.getSlate):
 * - "Worth the trip" on Home: dishes close to the diner's taste beyond the nearby stalls Home
 *   already ranks (it only sees the nearest 100), well reviewed or a strong verified match.
 * - "Closest to your taste" in Search: the typed words, ranked by the diner's palate.
 * Both only run with a trusted palate, so a new diner is never told what their taste is.
 */
import { useEffect, useMemo, useState } from "react";

import { countNegativeTasteSignals, hasTrustedTasteProfile } from "@/lib/ai/tasteEngine";
import { canShowTastePercent, tasteTrust } from "@/lib/ai/tasteTrust";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type {
  RankedRecommendation,
  RecommendationSlate,
  RecommendationSlateRequest,
} from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import type { Coordinate, DietaryFlag, DishDetail, TasteVector } from "@/types/domain";

export const WORTH_THE_TRIP_RADIUS_METERS = 8_000;
export const TASTE_SEARCH_RADIUS_METERS = 3_000;
export const TASTE_SLATE_LIMIT = 8;
const FETCH_LIMIT = 40;
/** Well reviewed: at least this rating from at least this many reviews. */
const TRIP_MIN_RATING = 4.2;
const TRIP_MIN_REVIEWS = 3;
/** A strong match on verified taste counts as worth the trip even without reviews. */
const TRIP_MIN_VERIFIED_MATCH = 80;
/** A search pick has to fit the palate at least this well. */
const SEARCH_MIN_MATCH = 60;

type SlateSource = { getSlate(request: RecommendationSlateRequest): Promise<RecommendationSlate> };

function onePerVenue(items: readonly RankedRecommendation[], limit: number): DishDetail[] {
  const seen = new Set<string>();
  const picks: DishDetail[] = [];
  for (const item of items) {
    if (seen.has(item.dish.venueId)) continue;
    seen.add(item.dish.venueId);
    picks.push(item.dish);
    if (picks.length >= limit) break;
  }
  return picks;
}

export function worthTheTripRequest(
  palate: TasteVector,
  point: Coordinate,
  dietaryFlags: DietaryFlag[] = [],
): RecommendationSlateRequest {
  return {
    surface: "home",
    tasteProfile: palate,
    dietaryFlags,
    latitude: point.latitude,
    longitude: point.longitude,
    radiusMeters: WORTH_THE_TRIP_RADIUS_METERS,
    limit: FETCH_LIMIT,
    liveOnly: true,
  };
}

/** Further-out dishes that earn the trip: never at a stall Home already shows. */
export function pickWorthTheTrip(
  items: readonly RankedRecommendation[],
  nearbyVenueIds: ReadonlySet<string>,
  limit = TASTE_SLATE_LIMIT,
): DishDetail[] {
  const earned = items.filter(({ dish, matchPercent }) => {
    if (nearbyVenueIds.has(dish.venueId) || tasteTrust(dish) === "unknown") return false;
    const reviewed =
      (dish.rating ?? 0) >= TRIP_MIN_RATING && (dish.reviewCount ?? 0) >= TRIP_MIN_REVIEWS;
    const strongMatch = canShowTastePercent(dish) && matchPercent >= TRIP_MIN_VERIFIED_MATCH;
    return reviewed || strongMatch;
  });
  return onePerVenue(earned, limit);
}

export function tasteSearchRequest(
  palate: TasteVector,
  query: string,
  point: Coordinate,
  dietaryFlags: DietaryFlag[] = [],
): RecommendationSlateRequest {
  return {
    surface: "search",
    tasteProfile: palate,
    dietaryFlags,
    query,
    latitude: point.latitude,
    longitude: point.longitude,
    radiusMeters: TASTE_SEARCH_RADIUS_METERS,
    limit: FETCH_LIMIT,
  };
}

/** The search's dishes that fit the palate, best first, one per stall. */
export function pickTasteSearch(
  items: readonly RankedRecommendation[],
  limit = TASTE_SLATE_LIMIT,
): DishDetail[] {
  const fitting = items.filter(
    ({ dish, matchPercent }) => tasteTrust(dish) !== "unknown" && matchPercent >= SEARCH_MIN_MATCH,
  );
  return onePerVenue(fitting, limit);
}

export async function loadWorthTheTrip(
  service: SlateSource,
  palate: TasteVector,
  point: Coordinate,
  nearbyVenueIds: ReadonlySet<string>,
  dietaryFlags: DietaryFlag[] = [],
): Promise<DishDetail[]> {
  const slate = await service.getSlate(worthTheTripRequest(palate, point, dietaryFlags));
  return pickWorthTheTrip(slate.items, nearbyVenueIds);
}

export async function loadTasteSearch(
  service: SlateSource,
  palate: TasteVector,
  query: string,
  point: Coordinate,
  dietaryFlags: DietaryFlag[] = [],
): Promise<DishDetail[]> {
  const slate = await service.getSlate(tasteSearchRequest(palate, query, point, dietaryFlags));
  return pickTasteSearch(slate.items);
}

const pointKey = (point: Coordinate) =>
  `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
const palateKey = (palate: TasteVector) =>
  Object.values(palate)
    .map((value) => Math.round(value))
    .join(",");

function useSlate(key: string | undefined, load: () => Promise<DishDetail[]>, screen: string) {
  const [items, setItems] = useState<DishDetail[]>([]);
  useEffect(() => {
    let active = true;
    setItems([]);
    if (!key) {
      return () => {
        active = false;
      };
    }
    load()
      .then((picks) => {
        if (active) setItems(picks);
      })
      .catch((error) => reportError(error, { screen, action: "load_taste_slate" }));
    return () => {
      active = false;
    };
    // `key` holds everything `load` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return items;
}

/** Home's "Worth the trip"; empty without a trusted palate or a location. */
export function useWorthTheTrip(
  palate: TasteVector | undefined,
  point: Coordinate | undefined,
  nearbyVenueIds: readonly string[],
  dietaryFlags: DietaryFlag[] = [],
): DishDetail[] {
  const key =
    palate && point
      ? [
          palateKey(palate),
          pointKey(point),
          dietaryFlags.join(","),
          [...nearbyVenueIds].sort().join(","),
        ].join("|")
      : undefined;
  return useSlate(
    key,
    () =>
      palate && point
        ? loadWorthTheTrip(
            getHungryService().recommendations,
            palate,
            point,
            new Set(nearbyVenueIds),
            dietaryFlags,
          )
        : Promise.resolve([]),
    "DiscoverHome",
  );
}

/** Search's "Closest to your taste" for the typed words; empty without a palate or 2+ letters. */
export function useTasteSearch(
  palate: TasteVector | undefined,
  query: string,
  point: Coordinate | undefined,
  dietaryFlags: DietaryFlag[] = [],
): DishDetail[] {
  const trimmed = query.trim();
  const key =
    palate && point && trimmed.length >= 2
      ? [palateKey(palate), trimmed.toLowerCase(), pointKey(point), dietaryFlags.join(",")].join(
          "|",
        )
      : undefined;
  return useSlate(
    key,
    () =>
      palate && point
        ? loadTasteSearch(getHungryService().recommendations, palate, trimmed, point, dietaryFlags)
        : Promise.resolve([]),
    "SearchResults",
  );
}

/** The diner's palate once it is trusted (same rule as Home), else undefined. */
export function useTrustedPalate(): TasteVector | undefined {
  const profile = useProfileStore((state) => state.profile);
  const events = useProfileStore((state) => state.tasteInteractionEvents);
  const skipped = useSessionStore((state) => state.hasSkippedTasteQuiz);
  return useMemo(
    () =>
      hasTrustedTasteProfile(profile.tasteVector, {
        skippedTasteQuiz: skipped,
        signalCount: profile.recommendationSignals?.signalCount,
        negativeSignalCount: countNegativeTasteSignals(events),
      })
        ? profile.tasteVector
        : undefined,
    [events, profile.recommendationSignals?.signalCount, profile.tasteVector, skipped],
  );
}
