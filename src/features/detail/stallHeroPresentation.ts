import { isUsableDiscoverImageUrl } from "@/features/discover/bites";
import {
  getDishFallbackImageKey,
  type DishFallbackImageKey,
} from "@/features/discover/presentation";

type StallHeroFallbackSource = {
  cuisineTags?: readonly string[];
  foodTypeTag?: string;
  name?: string;
  venueName?: string;
};

type StallHeroSelection =
  | {
      kind: "venue";
      imageUrl: string;
    }
  | {
      kind: "representative";
      fallbackKey: DishFallbackImageKey;
    };

/**
 * A stall hero can be presented as source-backed only when it comes from the
 * venue/storefront media field. Dish and social images are not silently reused
 * as stall photography; when venue media is absent or blocked, the caller must
 * render a visibly disclosed representative asset.
 */
export function getStallHeroSelection({
  venueImageUrl,
  fallback,
}: {
  venueImageUrl?: string;
  fallback: StallHeroFallbackSource;
}): StallHeroSelection {
  const trimmedVenueImageUrl = venueImageUrl?.trim();
  if (isUsableDiscoverImageUrl(trimmedVenueImageUrl)) {
    return {
      kind: "venue",
      imageUrl: trimmedVenueImageUrl as string,
    };
  }

  return {
    kind: "representative",
    fallbackKey: getDishFallbackImageKey(fallback),
  };
}
