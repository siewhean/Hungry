import type { FoodOpenness } from "@/types/domain";

/**
 * Orders the Home "Hawker classics" rail by how open the user is to new food:
 * "favourites" puts dishes they already saved or reviewed first, "adventurous" puts
 * ones they have not had first, and "mix" (the default) alternates the two.
 */
export function orderHawkerClassics<T>(
  classics: readonly T[],
  options: {
    openness: FoodOpenness | undefined;
    /** True when the user has saved or reviewed a dish of this classic. */
    isFamiliar: (classic: T) => boolean;
  },
): T[] {
  const familiar = classics.filter(options.isFamiliar);
  const fresh = classics.filter((classic) => !options.isFamiliar(classic));
  if (options.openness === "favourites") return [...familiar, ...fresh];
  if (options.openness === "adventurous") return [...fresh, ...familiar];
  const mixed: T[] = [];
  for (let index = 0; index < Math.max(familiar.length, fresh.length); index += 1) {
    if (index < familiar.length) mixed.push(familiar[index]);
    if (index < fresh.length) mixed.push(fresh[index]);
  }
  return mixed;
}
