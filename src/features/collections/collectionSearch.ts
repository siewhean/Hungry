import { nearestAreaName } from "@/features/location/areaSearch";
import { SORTED_SINGAPORE_AREAS } from "@/app/screens/onboarding/singaporeAreas";
import type { BuildingSummary, DishDetail, Portfolio, PortfolioItem } from "@/types/domain";

/** One food saved in one of the diner's collections, with what it can be searched by. */
export type CollectionFood = {
  key: string;
  collectionId: string;
  collectionName: string;
  dishId: string;
  dishName: string;
  venueName: string;
  imageUrl?: string;
  /** The diner's own note on the item, or the dish's description. */
  caption?: string;
  /** The hawker centre, mall or building. */
  placeName?: string;
  /** The planning area, e.g. Tampines. */
  areaName?: string;
};

export const WANT_TO_TRY_COLLECTION_ID = "want-to-try";

/** The planning area of a building: its own when known, else the nearest one. */
export function buildingAreaName(building: BuildingSummary | undefined): string | undefined {
  if (!building) return undefined;
  return building.planningArea ?? nearestAreaName(building.coordinate, SORTED_SINGAPORE_AREAS);
}

/**
 * Every food across the diner's collections: "Want to try" first, then each list in order.
 * Dishes the app has not loaded are left out, since there is nothing to show or search.
 */
export function buildCollectionFoods(input: {
  savedDishIds: readonly string[];
  portfolios: readonly Portfolio[];
  itemsByPortfolio: Record<string, readonly PortfolioItem[] | undefined>;
  getDish: (dishId: string) => DishDetail | undefined;
  getBuilding: (buildingId: string) => BuildingSummary | undefined;
}): CollectionFood[] {
  const toFood = (
    collectionId: string,
    collectionName: string,
    dishId: string,
    note?: string,
  ): CollectionFood | undefined => {
    const dish = input.getDish(dishId);
    if (!dish) return undefined;
    const building = input.getBuilding(dish.buildingId);
    return {
      key: `${collectionId}:${dishId}`,
      collectionId,
      collectionName,
      dishId,
      dishName: dish.name,
      venueName: dish.venueName,
      imageUrl: dish.imageUrl || undefined,
      caption: note?.trim() || dish.description?.trim() || undefined,
      placeName: building?.name,
      areaName: buildingAreaName(building),
    };
  };

  const foods: (CollectionFood | undefined)[] = input.savedDishIds.map((dishId) =>
    toFood(WANT_TO_TRY_COLLECTION_ID, "Want to try", dishId),
  );
  for (const portfolio of input.portfolios) {
    for (const item of input.itemsByPortfolio[portfolio.id] ?? []) {
      if (item.dishId) {
        foods.push(
          toFood(portfolio.id, portfolio.name, item.dishId, item.publicNotes ?? item.privateNotes),
        );
      }
    }
  }
  return foods.filter((food): food is CollectionFood => food !== undefined);
}

/**
 * Foods matching every word of the query in the dish name, caption, stall, place or area,
 * so "laksa tampines" finds laksa saved in Tampines.
 */
export function searchCollectionFoods(
  foods: readonly CollectionFood[],
  query: string,
): CollectionFood[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...foods];
  return foods.filter((food) => {
    const haystack = [food.dishName, food.caption, food.venueName, food.placeName, food.areaName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
