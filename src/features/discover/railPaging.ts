/**
 * Paging for Home's sideways rows. A row opens on its first few cards and shows more as the diner
 * nears the end, like the rows on Netflix or Grab: the cards come from the feed Home already read,
 * so scrolling asks the server for nothing.
 */

/** Cards a row adds each time the diner nears its end. */
export const RAIL_PAGE_SIZE = 8;
/** The most cards one row ever holds. */
export const RAIL_POOL_SIZE = 40;
/** Start showing the next page once less than this many screens of cards are left ahead. */
const RAIL_LOOKAHEAD_SCREENS = 1;

/**
 * The row's first cards, then the rest of its candidates (in their own order) that are not
 * already among them, up to `limit`. A dish never repeats inside one row.
 */
export function appendRailTail<T>(
  first: readonly T[],
  candidates: readonly T[],
  keyOf: (item: T) => string,
  limit = RAIL_POOL_SIZE,
): T[] {
  const seen = new Set(first.map(keyOf));
  const rail = [...first];
  for (const item of candidates) {
    if (rail.length >= limit) break;
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    rail.push(item);
  }
  return rail;
}

/** True when the row is scrolled close enough to its end to show the next page. */
export function isNearRailEnd(scroll: {
  offset: number;
  viewportWidth: number;
  contentWidth: number;
}): boolean {
  if (scroll.viewportWidth <= 0 || scroll.contentWidth <= 0) return false;
  const remaining = scroll.contentWidth - (scroll.offset + scroll.viewportWidth);
  return remaining < scroll.viewportWidth * RAIL_LOOKAHEAD_SCREENS;
}

/** How many cards to show after the next page, never past the cards there are. */
export function nextRailCount(shown: number, total: number, pageSize = RAIL_PAGE_SIZE): number {
  return Math.min(total, shown + pageSize);
}
