import type { DishDetail } from "@/types/domain";

export const DISH_DETAIL_PAGE_SIZE = 100;
export const MAX_DISH_DETAIL_READ_IDS = 1_000;

export function getBoundedUniqueDishDetailIds(ids: string[]): string[] {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length > MAX_DISH_DETAIL_READ_IDS) {
    throw new Error("Too many dish details requested.");
  }
  return uniqueIds;
}

export async function loadDishDetailsInPages(
  ids: string[],
  loadPage: (pageIds: string[]) => Promise<DishDetail[] | undefined>,
): Promise<DishDetail[]> {
  const uniqueIds = getBoundedUniqueDishDetailIds(ids);
  const dishes: DishDetail[] = [];

  for (let offset = 0; offset < uniqueIds.length; offset += DISH_DETAIL_PAGE_SIZE) {
    const page = await loadPage(uniqueIds.slice(offset, offset + DISH_DETAIL_PAGE_SIZE));
    if (!page) throw new Error("Dish details are temporarily unavailable.");
    dishes.push(...page);
  }

  return dishes;
}

export function requireSupabaseRows<Row>(
  data: unknown,
  error: unknown,
  invalidResponseMessage: string,
): Row[] {
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error(invalidResponseMessage);
  return data as Row[];
}
