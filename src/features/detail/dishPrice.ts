import type { DishDetail } from "@/types/domain";

/** A missing price maps to 0: show the listed range or "Price not listed", never "S$0.00". */
export function formatDishPrice(dish: Pick<DishDetail, "price" | "priceRange">) {
  if (dish.price > 0) return `S$${dish.price.toFixed(2)}`;
  const range = dish.priceRange?.trim();
  return range && !/^S?\$?\s*0(?:\.0+)?$/.test(range) ? range : "Price not listed";
}
