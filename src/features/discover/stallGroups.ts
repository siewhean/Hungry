import type { Bite } from "@/lib/services/types";

/** One stall behind a collection's dishes, for the Stalls tab. */
export type QuickBiteStallItem = {
  id: string;
  venueId: string;
  venueName: string;
  buildingName: string;
  photoUrl: string;
  distance?: number;
};

/** The stalls behind a list of dishes, in the dishes' order, with the nearest distance of each. */
export function groupBitesByStall(
  bites: readonly (Bite & { distance?: number })[],
): QuickBiteStallItem[] {
  const stalls = new Map<string, QuickBiteStallItem>();
  for (const bite of bites) {
    const found = stalls.get(bite.venueId);
    if (!found) {
      stalls.set(bite.venueId, {
        id: bite.venueId,
        venueId: bite.venueId,
        venueName: bite.venueName,
        buildingName: bite.buildingName,
        photoUrl: bite.photoUrl,
        distance: bite.distance,
      });
      continue;
    }
    if (!found.photoUrl.trim() && bite.photoUrl.trim()) found.photoUrl = bite.photoUrl;
    if (
      bite.distance !== undefined &&
      (found.distance === undefined || bite.distance < found.distance)
    ) {
      found.distance = bite.distance;
    }
  }
  return [...stalls.values()];
}
