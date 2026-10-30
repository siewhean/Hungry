/** Cuisines a merchant can pick for the stall; diner filters match on these exact labels. */
export const CUISINE_OPTIONS = [
  "Chinese",
  "Malay",
  "Indian",
  "Peranakan",
  "Western",
  "Japanese",
  "Korean",
  "Thai",
  "Vietnamese",
  "Indonesian",
  "Middle Eastern",
  "Seafood",
  "Noodles",
  "Rice dishes",
  "Desserts",
  "Drinks and coffee",
  "Bakery",
  "Vegetarian",
] as const;

export const MAX_CUISINES = 3;

/** A stall saved before the picker may carry a label that is not in the list: keep showing it. */
export function getCuisineChoices(selected: readonly string[]): string[] {
  const known = new Set<string>(CUISINE_OPTIONS);
  return [...CUISINE_OPTIONS, ...selected.filter((value) => !known.has(value))];
}

/**
 * Taps a cuisine on or off. At the cap a new cuisine is ignored (the merchant removes one first);
 * removing is always allowed, so an older stall with more than the cap can trim down.
 */
export function toggleCuisine(selected: readonly string[], cuisine: string): string[] {
  if (selected.includes(cuisine)) return selected.filter((value) => value !== cuisine);
  if (selected.length >= MAX_CUISINES) return [...selected];
  return [...selected, cuisine];
}
