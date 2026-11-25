import type { DiscoveryLocationFeed } from "@/lib/services/types";

/** Keep the position of retained cards, using only the rows the latest live read authorizes. */
export function mergeDiscoverFeeds(
  firstPage: DiscoveryLocationFeed,
  full: DiscoveryLocationFeed,
  buildingId?: string,
): DiscoveryLocationFeed {
  if (full.isFallback) return full;
  const firstPositions = new Map(firstPage.venues.map(({ id }, index) => [id, index]));
  const position = (venueId: string) => firstPositions.get(venueId) ?? Infinity;
  const inCurrentBuilding = new Set(
    buildingId
      ? full.venues.filter((venue) => venue.buildingId === buildingId).map(({ id }) => id)
      : [],
  );
  const compare = (left: string, right: string) =>
    Number(inCurrentBuilding.has(right)) - Number(inCurrentBuilding.has(left)) ||
    position(left) - position(right);
  return {
    ...full,
    venues: [...full.venues].sort((left, right) => compare(left.id, right.id)),
    results: [...full.results].sort((left, right) =>
      compare(left.dish.venueId, right.dish.venueId),
    ),
  };
}
