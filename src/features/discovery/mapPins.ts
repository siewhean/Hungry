import type { CatalogMapItem } from "@/lib/services/catalog";

/** Stalls whose coordinates match to this many decimals (about a metre) sit on one spot. */
const COLOCATED_PRECISION = 5;

/** Cluster ids made here start with this, so a tap knows the stalls cannot be pulled apart by zoom. */
export const COLOCATED_CLUSTER_PREFIX = "here-";

export function isColocatedCluster(item: CatalogMapItem): boolean {
  return item.kind === "cluster" && item.id.startsWith(COLOCATED_CLUSTER_PREFIX);
}

/**
 * Stalls on the same spot (a food court's units, a mall level) draw on top of each other, and only
 * the top pin can be tapped. Each such spot becomes one count pin instead, which opens the list of
 * its stalls. Single stalls and the server's own clusters pass through untouched.
 */
export function groupColocatedVenues(items: readonly CatalogMapItem[]): CatalogMapItem[] {
  const keyOf = (item: { latitude: number; longitude: number }) =>
    `${item.latitude.toFixed(COLOCATED_PRECISION)},${item.longitude.toFixed(COLOCATED_PRECISION)}`;
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind === "venue") counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
  }
  const emitted = new Set<string>();
  const result: CatalogMapItem[] = [];
  for (const item of items) {
    if (item.kind !== "venue" || (counts.get(keyOf(item)) ?? 0) < 2) {
      result.push(item);
      continue;
    }
    const key = keyOf(item);
    if (emitted.has(key)) continue;
    emitted.add(key);
    result.push({
      kind: "cluster",
      id: `${COLOCATED_CLUSTER_PREFIX}${key}`,
      latitude: item.latitude,
      longitude: item.longitude,
      count: counts.get(key) ?? 2,
    });
  }
  return result;
}

/**
 * Stalls with dishes first, each group in the order it came (the server's nearest or top rated
 * order). A stall without a menu still shows, below the ones with one.
 */
export function menuStallsFirst<T extends { menuCount: number }>(stalls: readonly T[]): T[] {
  return [...stalls].sort((a, b) => Number(a.menuCount <= 0) - Number(b.menuCount <= 0));
}
