import { useEffect, useState } from "react";

import { formatDishPrice } from "@/features/detail/dishPrice";
import type { CatalogRawDishCard } from "@/lib/services/catalog";
import { reportError } from "@/lib/monitoring/reportError";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type { Coordinate } from "@/types/domain";

/** How far around the stall to look for the same kind of dish. */
export const SIMILAR_DISH_RADIUS_METERS = 3_000;
export const SIMILAR_DISH_LIMIT = 6;
/**
 * Rows read per lookup. The current stall's own matches and its hawker-centre neighbours sort
 * first and are dropped (one pick per other stall), so a 12-row page often left 0-2 tiles.
 */
export const SIMILAR_DISH_FETCH_LIMIT = 40;

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

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/**
 * True when the dish's own name holds every word of the query. The catalog search also matches
 * stall and building names, so "Barley" at "Ah Seng Chicken Rice" would otherwise count as
 * chicken rice.
 */
export function dishNameMatchesQuery(name: string, query: string): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return false;
  const words = queryTokens(similarDishQuery(name));
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
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

/**
 * What a screen reader says for a nearby tile: the tile's own label replaces its children's, so
 * the price and rating the tile shows are spoken here too.
 */
export function similarDishTileLabel(
  item: Pick<
    CatalogRawDishCard,
    "name" | "venueName" | "price" | "priceRange" | "rating" | "reviewCount" | "distanceMeters"
  >,
): string {
  const price = formatDishPrice({ price: item.price ?? 0, priceRange: item.priceRange ?? "" });
  const rated =
    item.reviewCount && item.rating
      ? `rated ${item.rating.toFixed(1)} from ${item.reviewCount} ${item.reviewCount === 1 ? "review" : "reviews"}`
      : undefined;
  return [
    `Open ${item.name} at ${item.venueName}`,
    price,
    rated,
    formatAwayLabel(item.distanceMeters),
  ]
    .filter(Boolean)
    .join(", ");
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

/**
 * One catalog read for the same kind of dish around `coordinate`, then one pick per stall.
 * Needs a coordinate: without one there is no "nearby".
 */
export async function loadSimilarDishes(
  service: SimilarDishSource,
  dish: { id: string; venueId: string; name: string },
  coordinate: Coordinate | undefined,
): Promise<CatalogRawDishCard[]> {
  const query = similarDishQuery(dish.name);
  // With no point the RPC drops the radius and "nearby" order is arbitrary: show nothing.
  if (query.length < 2 || !coordinate) return [];
  const page = await service.listDishes({
    query,
    sort: "nearby",
    limit: SIMILAR_DISH_FETCH_LIMIT,
    coordinate,
    radiusMeters: SIMILAR_DISH_RADIUS_METERS,
  });
  return pickSimilarDishes(
    page.items.filter((item) => dishNameMatchesQuery(item.name, query)),
    dish,
  );
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
      .catch((error) => {
        // The section just stays hidden.
        reportError(error, { screen: "DishDetail", action: "load_similar", dishId });
      });
    return () => {
      active = false;
    };
  }, [dishId, latitude, longitude, name, venueId]);

  return items;
}
