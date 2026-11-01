import type { DiscoveryLocationFeed } from "@/lib/services/types";

/**
 * Home draws the first few stalls as soon as a small read lands, then the full read replaces the
 * list. The cards already on screen keep their places and the rest follow them, so nothing jumps.
 * The full read decides everything else (fallback state, the stalls it holds that the first read
 * did not).
 */
export function mergeDiscoverFeeds(
  firstPage: DiscoveryLocationFeed,
  full: DiscoveryLocationFeed,
): DiscoveryLocationFeed {
  // A fallback (offline copy) is not a real answer: it never sits behind live stalls.
  if (full.isFallback) return full;
  const firstVenueIds = new Set(firstPage.venues.map((venue) => venue.id));
  const venues = [
    ...firstPage.venues,
    ...full.venues.filter((venue) => !firstVenueIds.has(venue.id)),
  ];
  const results = [
    ...firstPage.results,
    ...full.results.filter((result) => !firstVenueIds.has(result.dish.venueId)),
  ];
  return { ...full, venues, results };
}
