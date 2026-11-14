/**
 * "More like this": dishes and stalls that taste like the one the diner is looking at, close to
 * it. One server read per screen (get_taste_recommendations, ranked by the dish's own taste
 * instead of the diner's, around the stall), then one pick per stall.
 *
 * Different from "Other <dish> stalls nearby" (similarDishes.ts), which finds the same dish by
 * name. Here a laksa can lead to a mee siam: a different dish with the same character.
 */
import { useEffect, useState } from "react";

import { dishNameMatchesQuery, similarDishQuery } from "@/features/detail/similarDishes";
import { tasteTrust } from "@/lib/ai/tasteTrust";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { RecommendationSlate, RecommendationSlateRequest } from "@/lib/services/types";
import type { Coordinate, DietaryFlag, DishDetail } from "@/types/domain";

export const MORE_LIKE_THIS_RADIUS_METERS = 3_000;
export const MORE_LIKE_THIS_LIMIT = 6;
/** Rows read per lookup: the stall's own dishes and its neighbours' near-copies are dropped. */
export const MORE_LIKE_THIS_FETCH_LIMIT = 30;

type SlateSource = { getSlate(request: RecommendationSlateRequest): Promise<RecommendationSlate> };
type SourceDish = Pick<DishDetail, "id" | "venueId" | "name" | "tasteVector" | "tasteConfidence">;

/** The lookup for dishes that taste like `dish`, around `point`; undefined when taste is unknown. */
export function moreLikeThisRequest(
  dish: SourceDish,
  point: Coordinate | undefined,
  dietaryFlags: DietaryFlag[] = [],
): RecommendationSlateRequest | undefined {
  if (!point || tasteTrust(dish) === "unknown") return undefined;
  return {
    surface: "dish_detail",
    tasteProfile: dish.tasteVector,
    dietaryFlags,
    latitude: point.latitude,
    longitude: point.longitude,
    radiusMeters: MORE_LIKE_THIS_RADIUS_METERS,
    excludeDishIds: [dish.id],
    limit: MORE_LIKE_THIS_FETCH_LIMIT,
  };
}

/**
 * Other stalls' dishes, one per stall, never the same dish by name (that is the "Other <dish>
 * stalls nearby" rail) and never a dish whose taste is unknown.
 */
export function pickMoreLikeThis(
  candidates: readonly DishDetail[],
  current: Pick<DishDetail, "id" | "venueId" | "name">,
  options: { excludeDishIds?: ReadonlySet<string>; limit?: number } = {},
): DishDetail[] {
  const sameName = similarDishQuery(current.name);
  const seenVenues = new Set<string>([current.venueId]);
  const picks: DishDetail[] = [];
  for (const dish of candidates) {
    if (dish.id === current.id || seenVenues.has(dish.venueId)) continue;
    if (options.excludeDishIds?.has(dish.id)) continue;
    if (tasteTrust(dish) === "unknown") continue;
    if (sameName.length >= 2 && dishNameMatchesQuery(dish.name, sameName)) continue;
    seenVenues.add(dish.venueId);
    picks.push(dish);
    if (picks.length >= (options.limit ?? MORE_LIKE_THIS_LIMIT)) break;
  }
  return picks;
}

/** Stalls whose food tastes like this stall's lead dish: one dish stands for each stall. */
export function pickSimilarStalls(
  candidates: readonly DishDetail[],
  currentVenueId: string,
  limit = MORE_LIKE_THIS_LIMIT,
): DishDetail[] {
  const seenVenues = new Set<string>([currentVenueId]);
  const picks: DishDetail[] = [];
  for (const dish of candidates) {
    if (seenVenues.has(dish.venueId) || tasteTrust(dish) === "unknown") continue;
    seenVenues.add(dish.venueId);
    picks.push(dish);
    if (picks.length >= limit) break;
  }
  return picks;
}

export async function loadMoreLikeThis(
  service: SlateSource,
  dish: SourceDish,
  point: Coordinate | undefined,
  options: { dietaryFlags?: DietaryFlag[]; excludeDishIds?: ReadonlySet<string> } = {},
): Promise<DishDetail[]> {
  const request = moreLikeThisRequest(dish, point, options.dietaryFlags);
  if (!request) return [];
  const slate = await service.getSlate(request);
  return pickMoreLikeThis(
    slate.items.map((item) => item.dish),
    dish,
    { excludeDishIds: options.excludeDishIds },
  );
}

export async function loadSimilarStalls(
  service: SlateSource,
  leadDish: SourceDish,
  point: Coordinate | undefined,
  dietaryFlags: DietaryFlag[] = [],
): Promise<DishDetail[]> {
  const request = moreLikeThisRequest(leadDish, point, dietaryFlags);
  if (!request) return [];
  const slate = await service.getSlate(request);
  return pickSimilarStalls(
    slate.items.map((item) => item.dish),
    leadDish.venueId,
  );
}

function useSlatePicks(
  key: string | undefined,
  load: () => Promise<DishDetail[]>,
  screen: string,
): DishDetail[] {
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
      .catch((error) => {
        // The rail just stays hidden.
        reportError(error, { screen, action: "load_more_like_this" });
      });
    return () => {
      active = false;
    };
    // `key` holds everything `load` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return items;
}

const pointKey = (point: Coordinate | undefined) =>
  point ? `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}` : "";

/** Dishes like `dish` at other stalls nearby (dish page). */
export function useMoreLikeThis(
  dish: SourceDish | undefined,
  point: Coordinate | undefined,
  options: { dietaryFlags?: DietaryFlag[]; excludeDishIds?: readonly string[] } = {},
): DishDetail[] {
  const exclude = options.excludeDishIds ?? [];
  const key =
    dish && point
      ? [dish.id, pointKey(point), (options.dietaryFlags ?? []).join(","), exclude.join(",")].join(
          "|",
        )
      : undefined;
  return useSlatePicks(
    key,
    () =>
      dish
        ? loadMoreLikeThis(getHungryService().recommendations, dish, point, {
            dietaryFlags: options.dietaryFlags,
            excludeDishIds: new Set(exclude),
          })
        : Promise.resolve([]),
    "DishDetail",
  );
}

/** Stalls whose food tastes like this stall's (stall page). */
export function useSimilarStalls(
  leadDish: SourceDish | undefined,
  point: Coordinate | undefined,
  dietaryFlags: DietaryFlag[] = [],
): DishDetail[] {
  const key =
    leadDish && point
      ? [leadDish.id, pointKey(point), dietaryFlags.join(",")].join("|")
      : undefined;
  return useSlatePicks(
    key,
    () =>
      leadDish
        ? loadSimilarStalls(getHungryService().recommendations, leadDish, point, dietaryFlags)
        : Promise.resolve([]),
    "StallDetail",
  );
}
