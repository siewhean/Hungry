import type { DishDetail } from "@/types/domain";

export function isDishDetail(dish: DishDetail | undefined): dish is DishDetail {
  return Boolean(dish);
}
