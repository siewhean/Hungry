/**
 * "Loved by people you follow": stalls the diner's follows reviewed 4+ or posted from lately
 * (get_network_stall_picks), and the small lift they give the "Just for you" rail. When the
 * diner follows nobody with recent activity, the picks come from diners with a palate like
 * theirs instead. Pure: the screen passes what it already holds.
 */
import type { Bite, NetworkStallPick } from "@/lib/services/types";

/** At most this many "Just for you" dishes are lifted for coming from a network pick. */
export const NETWORK_BOOST_MAX = 2;
/** The slots (0-based) a lifted dish moves into: never the first, so taste still leads. */
export const NETWORK_BOOST_SLOTS: readonly number[] = [1, 3];

export function networkSectionTitle(picks: readonly NetworkStallPick[]): string {
  return picks.length > 0 && picks.every((pick) => pick.source === "taste_twin")
    ? "Loved by diners with your taste"
    : "Loved by people you follow";
}

/** "Mei loved this", "Mei and Arun loved this", "Mei and 3 others you follow loved this". */
export function networkPickReason(pick: NetworkStallPick): string {
  const first = pick.people[0]?.displayName;
  if (pick.source === "taste_twin") {
    if (pick.peopleCount > 1) return `${pick.peopleCount} diners with your taste loved this`;
    return "A diner with your taste loved this";
  }
  if (!first) {
    return pick.peopleCount > 1
      ? `${pick.peopleCount} people you follow loved this`
      : "Someone you follow loved this";
  }
  if (pick.peopleCount <= 1) return `${first} loved this`;
  const second = pick.people[1]?.displayName;
  if (pick.peopleCount === 2 && second) return `${first} and ${second} loved this`;
  const others = pick.peopleCount - 1;
  return `${first} and ${others} ${others === 1 ? "other" : "others"} you follow loved this`;
}

/**
 * Lifts up to two dishes from stalls the diner's follows loved into "Just for you" slots 2 and
 * 4, with a reason line naming who. Only following picks count (taste twins already shape the
 * palate order); dishes already in the top four stay where they are. Nothing is dropped.
 */
export function boostNetworkBites(
  bites: readonly Bite[],
  reasons: ReadonlyMap<string, string>,
  picks: readonly NetworkStallPick[],
): { bites: Bite[]; reasons: Map<string, string> } {
  const nextReasons = new Map(reasons);
  const pickByVenue = new Map(
    picks
      .filter((pick) => pick.source === "following")
      .map((pick) => [pick.venueId, pick] as const),
  );
  if (pickByVenue.size === 0 || bites.length < 2)
    return { bites: [...bites], reasons: nextReasons };

  const topSlots = Math.max(...NETWORK_BOOST_SLOTS) + 1;
  const usedVenues = new Set<string>();
  const lifted: Bite[] = [];
  bites.forEach((bite, index) => {
    if (lifted.length >= NETWORK_BOOST_MAX) return;
    const pick = pickByVenue.get(bite.venueId);
    if (!pick || usedVenues.has(bite.venueId)) return;
    usedVenues.add(bite.venueId);
    nextReasons.set(bite.dishId, networkPickReason(pick));
    if (index >= topSlots) lifted.push(bite);
  });
  if (lifted.length === 0) return { bites: [...bites], reasons: nextReasons };

  const liftedIds = new Set(lifted.map((bite) => bite.id));
  const rest = bites.filter((bite) => !liftedIds.has(bite.id));
  NETWORK_BOOST_SLOTS.slice(0, lifted.length).forEach((slot, index) => {
    rest.splice(Math.min(slot, rest.length), 0, lifted[index]);
  });
  return { bites: rest, reasons: nextReasons };
}
