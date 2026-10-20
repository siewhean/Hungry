import { calculateDistanceMeters } from "@/lib/geo/distance";
import type { Coordinate } from "@/types/domain";

/** With location in use, "Surprise me" picks at random among this many closest stalls. */
export const SURPRISE_NEAREST_POOL = 8;

export interface SurpriseCandidate<T> {
  item: T;
  coordinate?: Coordinate;
}

/**
 * Picks a stall for "Surprise me". With an origin (location permission granted) it picks
 * at random among the closest stalls; without one it keeps the uniform random pick.
 */
export function pickSurpriseCandidate<T>(
  candidates: SurpriseCandidate<T>[],
  origin: Coordinate | undefined,
  random: () => number = Math.random,
): T | undefined {
  if (candidates.length === 0) return undefined;
  let pool = candidates;
  if (origin) {
    const located = candidates
      .filter((candidate) => candidate.coordinate)
      .map((candidate) => ({
        candidate,
        distance: calculateDistanceMeters(origin, candidate.coordinate as Coordinate),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, SURPRISE_NEAREST_POOL)
      .map(({ candidate }) => candidate);
    if (located.length > 0) pool = located;
  }
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index]?.item;
}
