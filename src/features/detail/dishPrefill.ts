import { sanitizeCatalogImageUrl } from "@/lib/services/catalog/media";

/**
 * What a card already knows about a dish, passed as a route param so the dish page can paint
 * its name, price and photo at once and start the stall reads before the dish read lands.
 */
export type DishPrefill = {
  name: string;
  imageUrl?: string;
  price?: number;
  priceRange?: string;
  venueId?: string;
  venueName?: string;
};

type PrefillSource = {
  name?: string;
  imageUrl?: string;
  price?: number;
  priceRange?: string;
  venueId?: string;
  venueName?: string;
};

/** A prefill from any dish-shaped object; undefined when it has no name to show. */
export function dishPrefillFrom(source: PrefillSource | undefined): DishPrefill | undefined {
  const name = source?.name?.trim();
  if (!source || !name) return undefined;
  const imageUrl = sanitizeCatalogImageUrl(source.imageUrl);
  return {
    name,
    ...(imageUrl ? { imageUrl } : {}),
    ...(typeof source.price === "number" ? { price: source.price } : {}),
    ...(source.priceRange ? { priceRange: source.priceRange } : {}),
    ...(source.venueId ? { venueId: source.venueId } : {}),
    ...(source.venueName ? { venueName: source.venueName } : {}),
  };
}
