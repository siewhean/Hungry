import type { DishDetail, SearchCategory } from "@/types/domain";

/**
 * Whether a dish belongs to a browse category. Matches the first word of the
 * category ("noodles", "late", "local") against the dish name, taste tags and
 * food type, the same needle the repositories' searchDishes uses, but only as a
 * whole word so "late" does not match "plate" or "chocolate" and "rice" does not
 * match "price". Exact tag equality never matched the shipped catalog, whose
 * tags are words like "Local", "Aromatic" or "Savoury".
 */
export function dishMatchesSearchCategory(
  dish: Pick<DishDetail, "name" | "tasteTags"> & { foodTypeTag?: string },
  category: SearchCategory | string,
): boolean {
  const needle = category.split(" ")[0]?.toLowerCase().replace(/s$/, "");
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}s?\\b`).test(
    `${dish.name} ${dish.tasteTags.join(" ")} ${dish.foodTypeTag ?? ""}`.toLowerCase(),
  );
}
