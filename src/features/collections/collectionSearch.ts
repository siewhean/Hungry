import { nearestAreaName } from "@/features/location/areaSearch";
import { SORTED_SINGAPORE_AREAS } from "@/app/screens/onboarding/singaporeAreas";
import type { PortfolioItemDetailRow } from "@/lib/services/types";
import type { BuildingSummary, Portfolio, PortfolioItem } from "@/types/domain";

/** One food or stall saved in one of the diner's collections, with what it can be searched by. */
export type CollectionFood = {
  key: string;
  collectionId: string;
  collectionName: string;
  itemType: "dish" | "stall";
  /** Set for dishes. */
  dishId?: string;
  /** Set for stalls. */
  stallId?: string;
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

/** Where a dish is, when the app knows it (the server detail rows carry no building yet). */
export type CollectionPlace = { placeName?: string; areaName?: string; description?: string };

/** The planning area of a building: its own when known, else the nearest one. */
export function buildingAreaName(building: BuildingSummary | undefined): string | undefined {
  if (!building) return undefined;
  return building.planningArea ?? nearestAreaName(building.coordinate, SORTED_SINGAPORE_AREAS);
}

export const detailKey = (itemType: "dish" | "stall", id: string) => `${itemType}:${id}`;

/** Detail rows from get_item_details, keyed by `dish:<id>` / `stall:<id>`. */
export function indexItemDetails(rows: readonly PortfolioItemDetailRow[]) {
  const byKey = new Map<string, PortfolioItemDetailRow>();
  for (const row of rows) {
    if (row.dishId) byKey.set(detailKey("dish", row.dishId), row);
    else if (row.stallId) byKey.set(detailKey("stall", row.stallId), row);
  }
  return byKey;
}

/** Every dish and stall id across Want to try and the given lists, for one detail read. */
export function collectCollectionItemIds(input: {
  savedDishIds: readonly string[];
  portfolios: readonly Portfolio[];
  itemsByPortfolio: Record<string, readonly PortfolioItem[] | undefined>;
}): { dishIds: string[]; stallIds: string[] } {
  const dishIds = new Set(input.savedDishIds);
  const stallIds = new Set<string>();
  for (const portfolio of input.portfolios) {
    for (const item of input.itemsByPortfolio[portfolio.id] ?? []) {
      if (item.itemType === "stall" && item.stallId) stallIds.add(item.stallId);
      else if (item.dishId) dishIds.add(item.dishId);
    }
  }
  return { dishIds: [...dishIds].sort(), stallIds: [...stallIds].sort() };
}

/**
 * Every food and stall across the diner's collections: "Want to try" first, then each list in
 * order. Names come from server detail rows, so items outside the app's local cache are found
 * too; items with no row (gone, or not loaded yet) are left out.
 */
export function buildCollectionFoods(input: {
  savedDishIds: readonly string[];
  portfolios: readonly Portfolio[];
  itemsByPortfolio: Record<string, readonly PortfolioItem[] | undefined>;
  getDetail: (itemType: "dish" | "stall", id: string) => PortfolioItemDetailRow | undefined;
  /** Building and area for a dish, when known locally. */
  getPlace?: (dishId: string) => CollectionPlace | undefined;
}): CollectionFood[] {
  const toFood = (
    collectionId: string,
    collectionName: string,
    itemType: "dish" | "stall",
    id: string,
    note?: string,
  ): CollectionFood | undefined => {
    const detail = input.getDetail(itemType, id);
    if (!detail?.name) return undefined;
    const place = itemType === "dish" ? input.getPlace?.(id) : undefined;
    return {
      key: `${collectionId}:${itemType}:${id}`,
      collectionId,
      collectionName,
      itemType,
      dishId: itemType === "dish" ? id : undefined,
      stallId: itemType === "stall" ? id : undefined,
      dishName: detail.name,
      venueName: detail.stallName ?? detail.name,
      imageUrl: detail.imageUrl || undefined,
      caption: note?.trim() || place?.description?.trim() || undefined,
      placeName: place?.placeName,
      areaName: place?.areaName,
    };
  };

  const foods: (CollectionFood | undefined)[] = input.savedDishIds.map((dishId) =>
    toFood(WANT_TO_TRY_COLLECTION_ID, "Want to try", "dish", dishId),
  );
  for (const portfolio of input.portfolios) {
    for (const item of input.itemsByPortfolio[portfolio.id] ?? []) {
      const note = item.publicNotes ?? item.privateNotes;
      if (item.itemType === "stall" && item.stallId) {
        foods.push(toFood(portfolio.id, portfolio.name, "stall", item.stallId, note));
      } else if (item.dishId) {
        foods.push(toFood(portfolio.id, portfolio.name, "dish", item.dishId, note));
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
