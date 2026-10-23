import { useEffect, useState } from "react";

import type { CatalogRawDishCard } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type { Coordinate } from "@/types/domain";

/** How far around the stall to look for the same kind of dish. */
export const SIMILAR_DISH_RADIUS_METERS = 3_000;
export const SIMILAR_DISH_LIMIT = 6;

const NOISE_WORDS = /\b(set|special|signature|combo|meal|large|small|regular|portion|plate)\b/gi;

/** "Chicken Satay (10 sticks)" -> "Chicken Satay"; "Signature Laksa Set" -> "Laksa". */
export function similarDishQuery(name: string): string {
  return name
    .replace(/\(.*?\)/g, " ")
    .replace(NOISE_WORDS, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Other stalls' versions of a dish: never the same dish or another dish from the same stall. */
export function pickSimilarDishes(
  items: readonly CatalogRawDishCard[],
  current: { id: string; venueId: string },
  limit = SIMILAR_DISH_LIMIT,
): CatalogRawDishCard[] {
  const seenVenues = new Set<string>([current.venueId]);
  const picks: CatalogRawDishCard[] = [];
  for (const item of items) {
    if (item.id === current.id || seenVenues.has(item.venueId)) continue;
    seenVenues.add(item.venueId);
    picks.push(item);
    if (picks.length >= limit) break;
  }
  return picks;
}

/** "120 m away" / "1.4 km away". */
export function formatAwayLabel(distanceMeters: number | undefined): string | undefined {
  if (distanceMeters === undefined || !Number.isFinite(distanceMeters)) return undefined;
  if (distanceMeters < 1000) return `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

type SimilarDishSource = {
  listDishes: (input: {
    query: string;
    sort: "nearby";
    limit: number;
    coordinate?: Coordinate;
    radiusMeters?: number;
  }) => Promise<{ items: CatalogRawDishCard[] }>;
};

/** One catalog read for the same kind of dish around `coordinate`, then one pick per stall. */
export async function loadSimilarDishes(
  service: SimilarDishSource,
  dish: { id: string; venueId: string; name: string },
  coordinate: Coordinate | undefined,
): Promise<CatalogRawDishCard[]> {
  const query = similarDishQuery(dish.name);
  if (query.length < 2) return [];
  const page = await service.listDishes({
    query,
    sort: "nearby",
    limit: 12,
    ...(coordinate ? { coordinate, radiusMeters: SIMILAR_DISH_RADIUS_METERS } : {}),
  });
  return pickSimilarDishes(page.items, dish);
}

/** The same kind of dish at other stalls near `coordinate`, nearest first. */
export function useSimilarDishesNearby(
  dish: { id: string; venueId: string; name: string } | undefined,
  coordinate: Coordinate | undefined,
) {
  const [items, setItems] = useState<CatalogRawDishCard[]>([]);
  const dishId = dish?.id;
  const venueId = dish?.venueId;
  const name = dish?.name ?? "";
  const latitude = coordinate?.latitude;
  const longitude = coordinate?.longitude;

  useEffect(() => {
    let active = true;
    setItems([]);
    if (!dishId || !venueId) {
      return () => {
        active = false;
      };
    }
    const point =
      latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined;
    loadSimilarDishes(getCatalogRawService(), { id: dishId, venueId, name }, point)
      .then((picks) => {
        if (active) setItems(picks);
      })
      .catch(() => undefined); // The section just stays hidden.
    return () => {
      active = false;
    };
  }, [dishId, latitude, longitude, name, venueId]);

  return items;
}
