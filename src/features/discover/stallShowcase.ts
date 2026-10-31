import type { ImageSourcePropType } from "react-native";

import { getDiscoverCardImage, getDishImageCandidates } from "@/features/discover/bites";
import type { DataRepository } from "@/lib/services/types";
import type { DishDetail, VenueSummary } from "@/types/domain";

export type DiscoverStallShowcaseCard = {
  id: string;
  venue: VenueSummary;
  heroDish: DishDetail;
  /** The stall's or hero dish's own photo; null shows the stall logo instead, never another dish. */
  imageSource: ImageSourcePropType | null;
  products: DishDetail[];
};

export type DiscoverRepositoryLookup = Pick<
  DataRepository,
  "getDishById" | "listDishesByVenue" | "listVenuesByBuilding"
>;

export const STALL_SHOWCASE_CARD_LIMIT = 30;

export function buildStallShowcaseCardsFromVenues(
  venues: VenueSummary[],
  repositoryLookup: Pick<DiscoverRepositoryLookup, "getDishById" | "listDishesByVenue">,
): DiscoverStallShowcaseCard[] {
  const uniqueVenues = Array.from(new Map(venues.map((venue) => [venue.id, venue])).values());

  // One card per stall: the stall's top dish (or first listed dish) is the hero.
  return uniqueVenues.flatMap((venue) => {
    const venueDishes = repositoryLookup.listDishesByVenue(venue.id);
    const heroDish = repositoryLookup.getDishById(venue.topDishId) ?? venueDishes[0];
    if (!heroDish) {
      return [];
    }

    const products = [heroDish, ...venueDishes.filter((dish) => dish.id !== heroDish.id)].slice(
      0,
      4,
    );
    const image = getDiscoverCardImage([
      ...getDishImageCandidates(heroDish),
      { imageUrl: venue.imageUrl, imageSourceType: "venue" },
    ]);

    return [
      {
        id: venue.id,
        venue,
        heroDish,
        imageSource: image.imageUrl ? { uri: image.imageUrl } : null,
        products,
      },
    ];
  });
}
