type StallRouteLike = { name: string; params?: object };

export type StallNavigationLike = {
  getState: () => { index: number; routes: readonly StallRouteLike[] } | undefined;
  goBack: () => void;
  push: (name: "StallDetail", params: { venueId: string }) => void;
};

/**
 * Open a stall from a dish detail.
 *
 * - If the screen directly underneath is the same stall, go back to it instead
 *   of stacking a duplicate (Stall -> Dish -> same Stall).
 * - Otherwise always push. `navigate` is not used because React Navigation 7
 *   can resolve it to a preloaded StallDetail entry (no getId on the
 *   route), which made the tap look unresponsive when that stall was already
 *   further back in the stack.
 */
export function openStallFromDish(navigation: StallNavigationLike, venueId: string) {
  const state = navigation.getState();
  const previous = state && state.index > 0 ? state.routes[state.index - 1] : undefined;
  const previousVenueId =
    previous?.params && "venueId" in previous.params
      ? (previous.params as { venueId?: unknown }).venueId
      : undefined;
  if (previous?.name === "StallDetail" && previousVenueId === venueId) {
    navigation.goBack();
    return;
  }
  navigation.push("StallDetail", { venueId });
}
