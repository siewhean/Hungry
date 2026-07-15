import type { DiscoveryLocationFeed } from "@/lib/services/types";
import type { DishDetail, StallPost, VenueSummary } from "@/types/domain";

export interface BoundedDiscoverStallCollection {
  venue: VenueSummary;
  location: string;
  posts: StallPost[];
  topDishes: DishDetail[];
  affinity: number;
}

export function buildBoundedDiscoverStallCollections(
  feed: DiscoveryLocationFeed,
  query: string,
  limit = 4,
): BoundedDiscoverStallCollection[] {
  const normalizedQuery = query.trim().toLowerCase();
  const resultsByVenue = new Map<string, typeof feed.results>();

  feed.results.forEach((result) => {
    const venueResults = resultsByVenue.get(result.dish.venueId) ?? [];
    venueResults.push(result);
    resultsByVenue.set(result.dish.venueId, venueResults);
  });

  return Array.from(new Map(feed.venues.map((venue) => [venue.id, venue])).values())
    .map((venue) => {
      const venueResults = resultsByVenue.get(venue.id) ?? [];
      const topDishes = venueResults.map((result) => result.dish);
      return {
        venue,
        location:
          venue.buildingName ?? venue.planningArea ?? venue.address ?? "Location unavailable",
        posts: [],
        topDishes,
        affinity: venueResults.reduce((best, result) => Math.max(best, result.score), 0),
      };
    })
    .filter((collection) => collection.topDishes.length > 0)
    .filter((collection) => {
      if (!normalizedQuery) return true;
      const haystack = [
        collection.venue.name,
        collection.location,
        ...collection.topDishes.map((dish) => dish.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (right.affinity !== left.affinity) return right.affinity - left.affinity;
      return (
        (left.topDishes[0]?.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
        (right.topDishes[0]?.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, limit);
}
