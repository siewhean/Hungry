/** The words a review search looks at: dish name, stall name, review text and taste tags. */
export function reviewMatchesQuery(
  item: { dishName: string; venueName: string; review: { text: string; tags: readonly string[] } },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.dishName.toLowerCase().includes(q) ||
    item.venueName.toLowerCase().includes(q) ||
    item.review.text.toLowerCase().includes(q) ||
    item.review.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

/** Shortest search the server answers; one letter would match nearly every review. */
export const REVIEW_SEARCH_MIN_LENGTH = 2;
