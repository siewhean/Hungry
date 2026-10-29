import type { SavedDishCard } from "@/lib/services/types";

export type CatalogFavouritesLoadResult =
  | {
      status: "loaded";
      /** The saved dish ids, in the order the server returned them (newest save first). */
      savedIds: string[];
      /** Cards for the saved ids and the extra ids, in no particular order. */
      cards: SavedDishCard[];
      /** Saved ids with no card (gone or hidden). */
      unavailableCount: number;
    }
  | { status: "error"; message: string };

const LOAD_ERROR = "We couldn't load your saved dishes.";

/**
 * Resolves the signed-in user's saved dish ids into cards with one batched read for all of them
 * (never one request per dish). The saved ids are read from the server so a failed read is
 * reported as an error rather than an empty list; a failed card read is also an error with
 * retry, not a short list. `extraDishIds` (the dishes marked tried) ride in the same batch.
 */
export async function loadCatalogFavourites(deps: {
  getFavouriteDishIds: () => Promise<string[]>;
  getSavedDishCards: (dishIds: string[]) => Promise<SavedDishCard[]>;
  extraDishIds?: readonly string[];
  /** Called with the cause of a failed read, for error tracking. */
  onError?: (error: unknown, step: "read_saved_ids" | "read_cards") => void;
}): Promise<CatalogFavouritesLoadResult> {
  let savedIds: string[];
  try {
    savedIds = [...new Set(await deps.getFavouriteDishIds())];
  } catch (error) {
    deps.onError?.(error, "read_saved_ids");
    return { status: "error", message: LOAD_ERROR };
  }
  const wanted = [...new Set([...savedIds, ...(deps.extraDishIds ?? [])])];
  if (wanted.length === 0) return { status: "loaded", savedIds, cards: [], unavailableCount: 0 };
  let cards: SavedDishCard[];
  try {
    cards = await deps.getSavedDishCards(wanted);
  } catch (error) {
    deps.onError?.(error, "read_cards");
    return { status: "error", message: LOAD_ERROR };
  }
  const found = new Set(cards.map((card) => card.id));
  return {
    status: "loaded",
    savedIds,
    cards,
    unavailableCount: savedIds.filter((id) => !found.has(id)).length,
  };
}
