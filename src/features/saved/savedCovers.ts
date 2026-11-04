import type { PortfolioItem } from "@/types/domain";

/** How many photos make a list's cover mosaic. */
export const LIST_COVER_PHOTOS = 4;

/** The first dishes of each list, for one batched read of their photos (never one per list). */
export function pickCoverDishIds(
  listIds: readonly string[],
  itemsByList: Readonly<Record<string, readonly PortfolioItem[] | undefined>>,
): { perList: Map<string, string[]>; dishIds: string[] } {
  const perList = new Map<string, string[]>();
  const all = new Set<string>();
  for (const listId of listIds) {
    const ids = [
      ...new Set(
        (itemsByList[listId] ?? [])
          .filter((item) => item.itemType !== "stall" && Boolean(item.dishId))
          .map((item) => item.dishId as string),
      ),
    ].slice(0, LIST_COVER_PHOTOS);
    perList.set(listId, ids);
    for (const id of ids) all.add(id);
  }
  return { perList, dishIds: [...all].sort() };
}

/** Photo urls per list, in item order, skipping dishes that have no photo. */
export function buildCoverPhotos(
  perList: ReadonlyMap<string, readonly string[]>,
  imageByDishId: ReadonlyMap<string, string>,
): Map<string, string[]> {
  const covers = new Map<string, string[]>();
  for (const [listId, dishIds] of perList) {
    covers.set(
      listId,
      dishIds.flatMap((id) => imageByDishId.get(id) ?? []),
    );
  }
  return covers;
}
