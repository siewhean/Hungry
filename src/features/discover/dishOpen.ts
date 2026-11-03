import type { TasteInteractionEvent } from "@/types/domain";

/** A dish page must stay open this long (ms) before the open counts as interest, not a mis-tap. */
export const DISH_OPEN_DWELL_MS = 1500;
/** A click recorded by the list the diner came from, this recent (ms), already counts as this open. */
export const DISH_OPEN_DEDUPE_MS = 15_000;

const OPEN_TYPES = new Set<TasteInteractionEvent["type"]>([
  "dish_result_click",
  "food_button_click",
]);

/**
 * True when the dish page should record its own open: no list or card has just recorded a click on
 * this dish (Home, Search and Decide do), so each open counts once and every other way in
 * (stall menus, saved lists, a shared link) counts too.
 */
export function shouldRecordDishOpen(
  events: readonly TasteInteractionEvent[],
  dishId: string,
  now = Date.now(),
): boolean {
  return !events.some(
    (event) =>
      event.dishId === dishId &&
      OPEN_TYPES.has(event.type) &&
      now - Date.parse(event.createdAt) <= DISH_OPEN_DEDUPE_MS,
  );
}
