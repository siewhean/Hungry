/**
 * Popular dishes the diner pinned come first, in the order they pinned them; the rest keep
 * their order. A pinned id that is no longer offered is skipped.
 */
export function putFavouritesFirst<T extends { id: string }>(
  items: readonly T[],
  favouriteIds: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const pinned = favouriteIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
  const pinnedIds = new Set(pinned.map((item) => item.id));
  return [...pinned, ...items.filter((item) => !pinnedIds.has(item.id))];
}
