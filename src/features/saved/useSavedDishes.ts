import { useCallback, useEffect, useRef, useState } from "react";

import { loadCatalogFavourites } from "@/lib/services/catalog/favourites";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService, getServiceProvider } from "@/lib/services/serviceProvider";
import type { SavedDishCard } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";

export type SavedDishesState = {
  status: "loading" | "error" | "ready";
  errorMessage?: string;
  /** Saved dish ids, newest save first. */
  savedIds: string[];
  /** Tried dish ids, most recently tried first. */
  triedIds: string[];
  cards: ReadonlyMap<string, SavedDishCard>;
  /** Ids whose dish is gone or hidden, so no card can be shown. */
  goneIds: ReadonlySet<string>;
  /** Re-reads the saved ids and every card from the server. */
  reload: () => Promise<void>;
};

/** Ids in `current` that `previous` did not have, and the other way round. */
function diffIds(previous: readonly string[], current: readonly string[]) {
  const before = new Set(previous);
  const after = new Set(current);
  return {
    added: current.filter((id) => !before.has(id)),
    removed: previous.filter((id) => !after.has(id)),
  };
}

/**
 * The Saved page's dishes. The first load reads the saved ids from the server and every card in
 * one batched read (saved and tried dishes together). After that the store drives it: a dish
 * saved or un-saved elsewhere moves the list at once, and only ids with no card yet are fetched,
 * so removing a dish (or undoing a remove) never re-reads the whole list. `userKey` names the
 * signed-in account: a different one starts from a fresh load.
 */
export function useSavedDishes(userKey: string): SavedDishesState {
  const favouriteDishIds = useProfileStore((state) => state.profile.favouriteDishIds);
  const reviewedDishIds = useProfileStore((state) => state.profile.reviewedDishIds);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [cards, setCards] = useState<ReadonlyMap<string, SavedDishCard>>(new Map());
  const [goneIds, setGoneIds] = useState<ReadonlySet<string>>(new Set());
  const loadVersion = useRef(0);
  const previousFavourites = useRef(favouriteDishIds);

  const reload = useCallback(async () => {
    // userKey: a different account reloads its own saved dishes.
    void userKey;
    const version = ++loadVersion.current;
    const { favouriteDishIds: storeSaved, reviewedDishIds: storeTried } =
      useProfileStore.getState().profile;
    const isLive = getServiceProvider().mode === "supabase";
    const discovery = getHungryService().discovery;
    const result = await loadCatalogFavourites({
      // The mock backend never receives favourite toggles, so the store is its source of truth.
      getFavouriteDishIds: isLive
        ? () => getHungryService().profile.getFavouriteDishIds()
        : async () => [...storeSaved].reverse(),
      getSavedDishCards: (ids) => discovery.getSavedDishCards(ids),
      extraDishIds: storeTried,
      onError: (error, step) => reportError(error, { screen: "Favourites", action: step }),
    });
    if (loadVersion.current !== version) return;
    if (result.status === "error") {
      setErrorMessage(result.message);
      setStatus("error");
      return;
    }
    const found = new Map(result.cards.map((card) => [card.id, card]));
    setCards(found);
    setGoneIds(new Set([...result.savedIds, ...storeTried].filter((id) => !found.has(id))));
    setSavedIds(result.savedIds);
    previousFavourites.current = useProfileStore.getState().profile.favouriteDishIds;
    setErrorMessage(undefined);
    setStatus("ready");
  }, [userKey]);

  useEffect(() => {
    setStatus("loading");
    void reload();
    return () => {
      loadVersion.current += 1;
    };
  }, [reload]);

  // A dish saved or removed elsewhere (or by this page) moves the list without a re-read.
  const favouriteKey = favouriteDishIds.join(",");
  useEffect(() => {
    if (status !== "ready") return;
    const { added, removed } = diffIds(previousFavourites.current, favouriteDishIds);
    previousFavourites.current = favouriteDishIds;
    if (added.length === 0 && removed.length === 0) return;
    setSavedIds((current) => [
      ...[...added].reverse().filter((id) => !current.includes(id)),
      ...current.filter((id) => !removed.includes(id)),
    ]);
    // favouriteDishIds is read through its key.
  }, [favouriteKey, status]);

  // Fetch only the cards the page does not have yet (a dish just saved, or tried from elsewhere).
  const wantedKey = `${favouriteKey}|${reviewedDishIds.join(",")}`;
  useEffect(() => {
    if (status !== "ready") return;
    const missing = [...new Set([...favouriteDishIds, ...reviewedDishIds])].filter(
      (id) => !cards.has(id) && !goneIds.has(id),
    );
    if (missing.length === 0) return;
    const version = loadVersion.current;
    getHungryService()
      .discovery.getSavedDishCards(missing)
      .then((fetched) => {
        if (loadVersion.current !== version) return;
        const byId = new Map(fetched.map((card) => [card.id, card]));
        setCards((current) => new Map([...current, ...byId]));
        setGoneIds((current) => new Set([...current, ...missing.filter((id) => !byId.has(id))]));
      })
      .catch((error: unknown) => {
        reportError(error, { screen: "Favourites", action: "load_new_saved_dishes" });
        if (loadVersion.current !== version) return;
        setErrorMessage("We couldn't load your saved dishes.");
        setStatus("error");
      });
    // The cards and gone ids only change when this effect fills them.
  }, [wantedKey, status]);

  return {
    status,
    errorMessage,
    savedIds,
    triedIds: [...reviewedDishIds].reverse(),
    cards,
    goneIds,
    reload,
  };
}
