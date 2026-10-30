/**
 * The one spoken label for a dish card or row on Home, so every rail reads the same:
 * "Chicken Rice, Tian Tian, S$4.50, rated 4.5 from 12 reviews, 350 m away".
 * Parts the dish does not have are left out.
 */
import type { Bite } from "@/lib/services/types";

/** "350 m" / "1.2 km"; nothing when the distance is unknown or zero. */
export function formatBiteDistance(meters: number | undefined): string | undefined {
  if (meters === undefined || !Number.isFinite(meters) || meters <= 0) return undefined;
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function buildBiteLabel(
  bite: Pick<Bite, "dishName" | "venueName" | "price" | "rating" | "cravingCount"> & {
    distanceMeters?: number;
  },
): string {
  const distance = formatBiteDistance(bite.distanceMeters);
  const reviews = bite.cravingCount;
  return [
    bite.dishName,
    bite.venueName,
    bite.price > 0 ? `S$${bite.price.toFixed(2)}` : undefined,
    reviews > 0 && bite.rating > 0
      ? `rated ${bite.rating.toFixed(1)} from ${reviews} ${reviews === 1 ? "review" : "reviews"}`
      : undefined,
    distance ? `${distance} away` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}
