import type { ListRecentReviewsOptions, RecentReviewFeedEntry } from "@/lib/services/types";

export function normalizeReviewFeedOptions(options?: ListRecentReviewsOptions) {
  const requested = options?.limit ?? 50;
  if (!Number.isFinite(requested)) throw new Error("Invalid review page size.");
  const sort = options?.sort ?? "recent";
  if (sort !== "recent" && sort !== "top_rated") throw new Error("Invalid review sort.");
  const cursor = options?.cursor;
  if (
    cursor &&
    (!cursor.id ||
      !Number.isFinite(Date.parse(cursor.createdAt)) ||
      (sort === "top_rated" &&
        (!Number.isFinite(cursor.rating) || cursor.rating! < 0 || cursor.rating! > 5)))
  ) {
    throw new Error("Invalid review cursor.");
  }
  if (options?.before && !Number.isFinite(Date.parse(options.before)))
    throw new Error("Invalid review date.");
  return {
    limit: Math.min(Math.max(Math.floor(requested), 1), 100),
    sort,
    query: options?.query?.trim() ?? "",
    venueId: options?.venueId,
    cursor: cursor ? { ...cursor, createdAt: cursor.createdAt } : undefined,
    before: !cursor ? options?.before : undefined,
  };
}

/** Preserve PostgreSQL microseconds; Date alone collapses distinct cursor boundaries. */
function timestampKey(value: string): bigint {
  const seconds = Math.floor(Date.parse(value) / 1000);
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/i)?.[1] ?? "";
  return BigInt(seconds) * 1_000_000_000n + BigInt(fraction.slice(0, 9).padEnd(9, "0"));
}

/** Mock parity for the server's filter-before-limit and descending composite tuple. */
export function selectReviewFeedEntries(
  entries: RecentReviewFeedEntry[],
  options?: ListRecentReviewsOptions,
) {
  const normalized = normalizeReviewFeedOptions(options);
  const query = normalized.query.toLocaleLowerCase();
  const cursor = normalized.cursor;
  return entries
    .filter((entry) => {
      if (normalized.venueId && entry.venueId !== normalized.venueId) return false;
      if (
        query &&
        ![entry.dishName, entry.venueName, entry.review.text, ...entry.review.tags].some((value) =>
          value.toLocaleLowerCase().includes(query),
        )
      )
        return false;
      const time = timestampKey(entry.review.createdAt);
      if (cursor) {
        if (normalized.sort === "top_rated" && entry.review.rating !== cursor.rating)
          return entry.review.rating < cursor.rating!;
        const boundary = timestampKey(cursor.createdAt);
        return time < boundary || (time === boundary && entry.review.id < cursor.id);
      }
      return !normalized.before || time < timestampKey(normalized.before);
    })
    .sort((a, b) => {
      if (normalized.sort === "top_rated" && a.review.rating !== b.review.rating)
        return b.review.rating - a.review.rating;
      const time = timestampKey(b.review.createdAt) - timestampKey(a.review.createdAt);
      return (
        (time > 0n ? 1 : time < 0n ? -1 : 0) ||
        (a.review.id < b.review.id ? 1 : a.review.id > b.review.id ? -1 : 0)
      );
    })
    .slice(0, normalized.limit);
}
