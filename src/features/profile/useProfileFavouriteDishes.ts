import { useCallback, useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";

/** A profile pins at most this many dishes (the server enforces the same cap). */
export const PROFILE_FAVOURITE_DISHES_MAX = 4;

/**
 * The dishes pinned on a profile. A failed read shows nothing rather than an error: the row is
 * a bonus. `supported` is false on an older backend without the table: nothing can be pinned
 * there yet, so the row is hidden rather than offering a save that would fail.
 */
export function useProfileFavouriteDishes(userId: string | undefined, enabled = true) {
  const [dishIds, setDishIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!enabled || !userId) {
      setDishIds([]);
      setIsLoaded(false);
      setSupported(true);
      return;
    }
    let active = true;
    setIsLoaded(false);
    void getHungryService()
      .profile.listFavouriteDishIds(userId)
      .then((ids) => {
        if (!active) return;
        setSupported(ids !== null);
        setDishIds(ids ?? []);
      })
      .catch((error) => {
        reportError(error, { screen: "Profile", action: "load_favourite_dishes" });
        if (active) setDishIds([]);
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [enabled, userId]);

  /** Replaces your pinned dishes; resolves true when the server stored them. */
  const save = useCallback(async (ids: string[]) => {
    try {
      const stored = await getHungryService().profile.setFavouriteDishes(
        ids.slice(0, PROFILE_FAVOURITE_DISHES_MAX),
      );
      setDishIds(stored);
      return true;
    } catch (error) {
      reportError(error, { screen: "Profile", action: "save_favourite_dishes" });
      return false;
    }
  }, []);

  return { dishIds, isLoaded, supported, save };
}
