import { useEffect, useMemo, useState } from "react";

import { buildCoverPhotos, pickCoverDishIds } from "@/features/saved/savedCovers";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { usePortfolioStore } from "@/store/usePortfolioStore";

/**
 * Cover photos for a set of lists: the items of every list in one read, then one `getItemDetails`
 * for the photos of their first dishes. Reads the server, not the local catalog cache, which is
 * empty for most dishes in production. A failed read leaves the covers empty (the tile shows its
 * placeholder) and is reported.
 */
export function useListCovers(listIds: readonly string[]): ReadonlyMap<string, string[]> {
  const itemsByList = usePortfolioStore((state) => state.items);
  const loadItemsForPortfolios = usePortfolioStore((state) => state.loadItemsForPortfolios);
  const key = listIds.join(",");
  const [images, setImages] = useState<ReadonlyMap<string, string>>(new Map());

  // Items of all lists, in one batched read.
  useEffect(() => {
    if (key === "") return;
    loadItemsForPortfolios(key.split(",")).catch((error: unknown) =>
      reportError(error, { screen: "Favourites", action: "load_list_items" }),
    );
  }, [key, loadItemsForPortfolios]);

  const picked = useMemo(
    () => pickCoverDishIds(listIds, itemsByList),
    // listIds is read through its key.

    [itemsByList, key],
  );
  const dishKey = picked.dishIds.join(",");

  useEffect(() => {
    if (dishKey === "") return undefined;
    let active = true;
    getHungryService()
      .discovery.getItemDetails({ dishIds: dishKey.split(","), stallIds: [] })
      .then((rows) => {
        if (!active) return;
        const byId = new Map<string, string>();
        for (const row of rows) if (row.dishId && row.imageUrl) byId.set(row.dishId, row.imageUrl);
        setImages(byId);
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "Favourites", action: "load_list_covers" });
      });
    return () => {
      active = false;
    };
  }, [dishKey]);

  return useMemo(() => buildCoverPhotos(picked.perList, images), [images, picked.perList]);
}
