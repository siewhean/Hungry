export type FoodStyleOption = {
  id: "add" | "remove" | "earlier" | "later";
  label: string;
};

/**
 * What holding a popular dish offers: pin it, or (when it is already pinned) move it earlier or
 * later among the favourites, or unpin it. Earlier and later are left out at the ends.
 */
export function getFoodStyleOptions(
  pinnedIds: readonly string[],
  styleId: string,
): { message: string; options: FoodStyleOption[] } {
  const index = pinnedIds.indexOf(styleId);
  if (index < 0) {
    return {
      message: "Pin it to the top of Home.",
      options: [{ id: "add", label: "Add to favourites" }],
    };
  }
  return {
    message: "One of your favourites on Home.",
    options: [
      ...(index > 0 ? [{ id: "earlier" as const, label: "Move earlier" }] : []),
      ...(index < pinnedIds.length - 1 ? [{ id: "later" as const, label: "Move later" }] : []),
      { id: "remove", label: "Remove from favourites" },
    ],
  };
}
