// Filter chips for the search results and browse grids, kept free of service imports so the
// deep-link parser can share the same allowlist.

// The price cap maps onto p_max_price in the catalog RPCs. There is no Open now chip:
// release cards only carry venues.is_open, which tracks temporary closures, not opening
// hours, so it would list every stall at 3 am. It returns once open status is computed
// from the weekly schedule at query time (decision 25).
export const BUDGET_FILTER = "Under S$6";
export const BUDGET_MAX_PRICE = 6;
export const BROWSE_ALL_FILTER = "All";

/** The filter chips, in display order. Chips combine: Halal + Under S$6 + Noodles. */
export const BROWSE_FILTER_IDS = [
  BUDGET_FILTER,
  "Halal",
  "Japanese",
  "Western",
  "Noodles",
  "Rice",
] as const;
export type BrowseFilterId = (typeof BROWSE_FILTER_IDS)[number];

export const CUISINE_FILTERS: ReadonlySet<string> = new Set(["Japanese", "Western"]);

export function isBrowseFilterId(value: string): value is BrowseFilterId {
  return (BROWSE_FILTER_IDS as readonly string[]).includes(value);
}

/**
 * Reads chip ids from a route or link value. One id or a comma-separated list; matching is
 * case-insensitive; anything that is not a chip (the old "Local" open-now chip, "Spicy") is
 * dropped, so only real chips are ever selected.
 */
export function parseFilterIds(value?: string): BrowseFilterId[] {
  if (!value) return [];
  const found: BrowseFilterId[] = [];
  for (const part of value.split(",")) {
    const id = BROWSE_FILTER_IDS.find(
      (option) => option.toLowerCase() === part.trim().toLowerCase(),
    );
    if (id && !found.includes(id)) found.push(id);
  }
  return found;
}

/** Tapping a chip adds or removes it; "All" clears every chip. */
export function toggleFilterId(
  selected: readonly BrowseFilterId[],
  id: string,
): readonly BrowseFilterId[] {
  if (id === BROWSE_ALL_FILTER) return [];
  if (!isBrowseFilterId(id)) return selected;
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}
