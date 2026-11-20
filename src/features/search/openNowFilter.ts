import type { BrowseItem, BrowseMode } from "@/features/search/browseGrid";
import { getVenueOpenStateNow } from "@/features/discovery/decideForMeCandidates";
import type { CatalogRawDishCard } from "@/lib/services/catalog";
import type { VenueSummary } from "@/types/domain";

/** The stall behind a result: a dish card names it, a stall card is it. */
export function venueIdOfResult(mode: BrowseMode, item: BrowseItem): string {
  return mode === "dishes" ? (item as CatalogRawDishCard).venueId : item.id;
}

/** Stall ids whose hours have not been read yet, each once, at most `limit` of them. */
export function venueIdsToRead(
  mode: BrowseMode,
  items: readonly BrowseItem[],
  known: ReadonlyMap<string, VenueSummary>,
  limit = 100,
): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    const id = venueIdOfResult(mode, item);
    if (id && !known.has(id)) ids.add(id);
    if (ids.size >= limit) break;
  }
  return [...ids];
}

/**
 * The "Open now" filter on search results, in Singapore time and by the stall page's rule (the
 * structured schedule first, then listed hours, a merchant's closure over both). Only stalls whose
 * hours say open are kept, as on the map. A stall whose hours have not been read yet stays until
 * they are, so the list does not blank while they load.
 */
export function filterOpenNow(
  mode: BrowseMode,
  items: readonly BrowseItem[],
  venues: ReadonlyMap<string, VenueSummary>,
  now: Date = new Date(),
): BrowseItem[] {
  return items.filter((item) => {
    const venueId = venueIdOfResult(mode, item);
    // A dish with no stall behind it cannot be open.
    if (!venueId) return false;
    const venue = venues.get(venueId);
    if (!venue) return true;
    // As on Home and the stall page, a false flag with no closure notice is a stale default.
    const isOpen = venue.isOpen || !venue.closureNotice?.trim();
    return getVenueOpenStateNow({ ...venue, isOpen }, now).status === "open";
  });
}
