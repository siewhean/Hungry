import { getHungryService } from "@/lib/services/serviceProvider";
import type { VenueSummary } from "@/types/domain";

/** get_venue_summaries reads at most this many ids per call. */
export const VENUE_LOOKUP_CHUNK_SIZE = 50;

/**
 * Stall summaries for saved or followed stall ids from the server, in id order. The local
 * catalog cache only holds part of the catalog, so looking ids up there dropped stalls.
 * `missingCount` is how many ids came back with no stall (removed or hidden).
 */
export async function loadVenuesByIds(
  ids: readonly string[],
  fetchChunk: (chunk: string[]) => Promise<VenueSummary[]> = (chunk) =>
    getHungryService().discovery.getVenuesByIds(chunk),
): Promise<{ venues: VenueSummary[]; missingCount: number }> {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += VENUE_LOOKUP_CHUNK_SIZE) {
    chunks.push(unique.slice(index, index + VENUE_LOOKUP_CHUNK_SIZE));
  }
  const pages = await Promise.all(
    // n-plus-one-ok: get_venue_summaries caps 50 ids per call, so larger sets go in chunks.
    chunks.map((chunk) => fetchChunk(chunk)),
  );
  const byId = new Map(pages.flat().map((venue) => [venue.id, venue]));
  const venues = unique.flatMap((id) => byId.get(id) ?? []);
  return { venues, missingCount: unique.length - venues.length };
}
