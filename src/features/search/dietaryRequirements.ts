import type { DietaryFlag, DishDetail } from "@/types/domain";

/** Unknown metadata never certifies a selected dietary requirement. */
export function satisfiesDietaryRequirements(
  dish: Pick<DishDetail, "dietaryFlags"> | undefined,
  requirements: readonly DietaryFlag[],
): boolean {
  return (
    requirements.length === 0 ||
    Boolean(dish && requirements.every((flag) => dish.dietaryFlags.includes(flag)))
  );
}
