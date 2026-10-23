import { CatalogAccessError, type CatalogRawDishDetail } from "@/lib/services/catalog";
import { settleWithConcurrency } from "@/lib/services/catalog/paging";

/** No batch catalog read exists; cap parallel dish-detail requests instead. */
const FAVOURITE_DETAIL_CONCURRENCY = 4;

export type CatalogFavouritesLoadResult =
  | { status: "loaded"; dishes: CatalogRawDishDetail[]; unavailableCount: number }
  | { status: "error"; message: string };

/**
 * Resolves the signed-in user's saved dish ids into catalog records. The saved
 * ids are read from the server so a failed read is reported as an error rather
 * than an empty list. If no saved dish resolves and any failure was a
 * classified access failure (session, network, outage), that is also an error
 * with retry; plain not-found results are reported as unavailable records.
 */
export async function loadCatalogFavourites(deps: {
  getFavouriteDishIds: () => Promise<string[]>;
  getDish: (id: string) => Promise<CatalogRawDishDetail>;
  concurrency?: number;
}): Promise<CatalogFavouritesLoadResult> {
  let ids: string[];
  try {
    ids = [...new Set(await deps.getFavouriteDishIds())];
  } catch {
    return { status: "error", message: "We couldn't load your saved dishes." };
  }
  if (ids.length === 0) return { status: "loaded", dishes: [], unavailableCount: 0 };
  const results = await settleWithConcurrency(
    ids,
    deps.concurrency ?? FAVOURITE_DETAIL_CONCURRENCY,
    deps.getDish,
  );
  const dishes = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const hasAccessFailure = results.some(
    (result) => result.status === "rejected" && result.reason instanceof CatalogAccessError,
  );
  if (dishes.length === 0 && hasAccessFailure) {
    return { status: "error", message: "We couldn't load your saved dishes." };
  }
  return { status: "loaded", dishes, unavailableCount: results.length - dishes.length };
}
