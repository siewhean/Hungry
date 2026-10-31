import type { SavedDishCard } from "@/lib/services/types";
import type { Portfolio, PortfolioItem, Review, VenueSummary } from "@/types/domain";

/** A name for a dish or stall id, from the one batched detail read. */
export type SavedNameLookup = (itemType: "dish" | "stall", id: string) => string | undefined;

export type SavedListMatch = {
  portfolio: Portfolio;
  /** The names of the items in the list that matched, empty when the list name matched. */
  matchedItems: string[];
  itemCount: number;
};

export type SavedReviewMatch = {
  review: Review;
  dishName?: string;
  venueName?: string;
};

export type SavedSearchResults = {
  dishes: SavedDishCard[];
  stalls: VenueSummary[];
  lists: SavedListMatch[];
  reviews: SavedReviewMatch[];
  total: number;
};

export type SavedSearchGroup = "dishes" | "stalls" | "lists" | "reviews";

export const SAVED_SEARCH_GROUP_LABELS: Record<SavedSearchGroup, string> = {
  dishes: "Dishes",
  stalls: "Stalls",
  lists: "Lists",
  reviews: "Reviews",
};

/** Words of a query, lower-cased. Every word must be found for a row to match. */
export function savedQueryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function matchesAll(words: readonly string[], ...parts: (string | undefined)[]): boolean {
  if (words.length === 0) return false;
  const haystack = parts.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * Everything the diner saved or wrote that matches the query, grouped by kind: saved dishes
 * (dish or stall name), saved stalls (name or place), lists (by list name, or by the items in
 * them) and the diner's own reviews (by the dish or stall reviewed, or the review text). Pure, so
 * the one batched read happens before this runs and no row costs a call.
 */
export function searchSaved(input: {
  query: string;
  dishes: readonly SavedDishCard[];
  stalls: readonly VenueSummary[];
  lists: readonly Portfolio[];
  itemsByList: Readonly<Record<string, readonly PortfolioItem[] | undefined>>;
  reviews: readonly Review[];
  getName: SavedNameLookup;
}): SavedSearchResults {
  const words = savedQueryWords(input.query);
  if (words.length === 0) return { dishes: [], stalls: [], lists: [], reviews: [], total: 0 };

  const dishes = input.dishes.filter((dish) =>
    matchesAll(words, dish.name, dish.venueName, dish.buildingName),
  );
  const stalls = input.stalls.filter((venue) =>
    matchesAll(words, venue.name, venue.buildingName, venue.unitNumber),
  );

  const lists: SavedListMatch[] = [];
  for (const portfolio of input.lists) {
    const items = input.itemsByList[portfolio.id] ?? [];
    const names = items.flatMap((item) => {
      const id = item.itemType === "stall" ? item.stallId : item.dishId;
      const name = id ? input.getName(item.itemType === "stall" ? "stall" : "dish", id) : undefined;
      return name ? [name] : [];
    });
    if (matchesAll(words, portfolio.name)) {
      lists.push({ portfolio, matchedItems: [], itemCount: items.length });
      continue;
    }
    const matchedItems = names.filter((name) => matchesAll(words, name));
    if (matchedItems.length > 0) {
      lists.push({ portfolio, matchedItems, itemCount: items.length });
    }
  }

  const reviews: SavedReviewMatch[] = [];
  for (const review of input.reviews) {
    const dishName = review.dishId ? input.getName("dish", review.dishId) : undefined;
    const venueName = review.venueId ? input.getName("stall", review.venueId) : undefined;
    if (matchesAll(words, dishName, venueName, review.text)) {
      reviews.push({ review, dishName, venueName });
    }
  }

  return {
    dishes,
    stalls,
    lists,
    reviews,
    total: dishes.length + stalls.length + lists.length + reviews.length,
  };
}

/** Ids of every dish and stall a search needs a name for, for one `getItemDetails` read. */
export function collectSearchNameIds(input: {
  lists: readonly Portfolio[];
  itemsByList: Readonly<Record<string, readonly PortfolioItem[] | undefined>>;
  reviews: readonly Review[];
}): { dishIds: string[]; stallIds: string[] } {
  const dishIds = new Set<string>();
  const stallIds = new Set<string>();
  for (const portfolio of input.lists) {
    for (const item of input.itemsByList[portfolio.id] ?? []) {
      if (item.itemType === "stall" && item.stallId) stallIds.add(item.stallId);
      else if (item.dishId) dishIds.add(item.dishId);
    }
  }
  for (const review of input.reviews) {
    if (review.dishId) dishIds.add(review.dishId);
    if (review.venueId) stallIds.add(review.venueId);
  }
  return { dishIds: [...dishIds].sort(), stallIds: [...stallIds].sort() };
}

/** "3 results" / "No results", for the search summary line. */
export function formatSavedSearchCount(total: number): string {
  return total === 0 ? "No results" : `${total} ${total === 1 ? "result" : "results"}`;
}
