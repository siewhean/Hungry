import { formatDishPrice } from "@/features/detail/dishPrice";
import { formatDistanceLabel } from "@/features/discovery/distanceLabel";
import type { CatalogRawVenueCard } from "@/lib/services/catalog";
import type { OpenState } from "@/utils/operatingHours";

/** The dish a search matched at a stall, when the map is showing search results. */
export interface MapCardMatchedDish {
  name: string;
  price?: number;
}

/** "Open" or "Closed" for a card; nothing when the hours cannot be read. */
export function shortOpenLabel(state: OpenState | undefined): string | undefined {
  if (!state || state.status === "unknown") return undefined;
  return state.status === "open" ? "Open" : "Closed";
}

/**
 * The dish line of a map card: the dish a search matched when there is one, otherwise the stall's
 * representative dish, with its listed price. A stall with no menu has no line (never "0 dishes").
 */
export function formatMapCardDish(
  venue: CatalogRawVenueCard,
  matched?: MapCardMatchedDish,
): string | undefined {
  const dish = matched ?? venue.representativeDish;
  if (!dish) return venue.menuCount > 0 ? `${venue.menuCount} dishes` : undefined;
  return dish.price && dish.price > 0
    ? `${dish.name} · ${formatDishPrice({ price: dish.price, priceRange: "" })}`
    : dish.name;
}

/** The stall's rating for a card: "4.6 (23)" beside a star symbol, and what a screen reader says. */
export function formatMapCardRating(
  venue: CatalogRawVenueCard,
): { text: string; spoken: string } | undefined {
  if (!venue.qualityRating || venue.qualityRating <= 0 || !(venue.qualityReviewCount ?? 0)) {
    return undefined;
  }
  const rating = venue.qualityRating.toFixed(1);
  const reviews = venue.qualityReviewCount ?? 0;
  return {
    text: `${rating} (${reviews})`,
    spoken: `Rated ${rating} from ${reviews} ${reviews === 1 ? "review" : "reviews"}`,
  };
}

/** "Open · 450 m · Maxwell Food Centre": the rest of the detail line, after the rating. */
export function formatMapCardDetail(venue: CatalogRawVenueCard, openLabel?: string): string {
  return [openLabel, formatDistanceLabel(venue.distanceMeters), venue.buildingName]
    .filter(Boolean)
    .join(" · ");
}

/** What a screen reader says for a card or row: the stall, its dish and the detail line. */
export function mapCardAccessibilityLabel(
  venue: CatalogRawVenueCard,
  dishLine: string | undefined,
  detail: string,
  ratingSpoken?: string,
): string {
  return [`Open ${venue.name}`, dishLine, ratingSpoken, detail].filter(Boolean).join(". ");
}
