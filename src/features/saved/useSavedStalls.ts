import { useCallback, useEffect, useMemo, useState } from "react";

import { loadVenuesByIds } from "@/features/profile/loadVenuesByIds";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { reportError } from "@/lib/monitoring/reportError";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import type { VenueSummary } from "@/types/domain";

export type SavedStallsState = {
  status: "loading" | "error" | "ready";
  /** Saved stalls, newest save first. */
  stalls: VenueSummary[];
  /** Saved ids that came back with no stall (closed or hidden). */
  missingCount: number;
  retry: () => void;
};

/**
 * The diner's saved stalls (`user_stall_interactions.is_saved`), newest first. The stall rows
 * come from the server in 50-id batches (`loadVenuesByIds`), so a saved stall that is not in the
 * cached directory still shows, and so does the 51st. Shared by the Stalls section, the Saved
 * map and the Saved search, so all three read one list.
 */
export function useSavedStalls(enabled = true): SavedStallsState {
  const userId = useProfileStore((state) => state.profile.id);
  const interactions = useStallInteractionStore((state) => state.interactions);
  const isLoaded = useStallInteractionStore((state) => state.isLoaded);
  const loadInteractions = useStallInteractionStore((state) => state.loadInteractions);
  const loadSavedStalls = useCallback(async () => {
    if (enabled) await loadInteractions(userId);
  }, [enabled, loadInteractions, userId]);
  const { failed: loadFailed, retry: retryInteractions } = useRetryableLoad(
    loadSavedStalls,
    "saved stalls",
  );
  const [venues, setVenues] = useState<Map<string, VenueSummary> | null>(null);
  const [missingCount, setMissingCount] = useState(0);
  const [venuesFailed, setVenuesFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const savedStallIds = useMemo(
    () =>
      Object.values(interactions)
        .filter((interaction) => interaction.isSaved)
        .sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""))
        .map((interaction) => interaction.stallId),
    [interactions],
  );
  const savedKey = savedStallIds.join(",");

  useEffect(() => {
    if (!enabled || !isLoaded) return undefined;
    const ids = savedKey ? savedKey.split(",") : [];
    if (ids.length === 0) {
      setVenues(new Map());
      setMissingCount(0);
      return undefined;
    }
    let active = true;
    setVenuesFailed(false);
    loadVenuesByIds(ids)
      .then((result) => {
        if (!active) return;
        setVenues(new Map(result.venues.map((row) => [row.id, row])));
        setMissingCount(result.missingCount);
      })
      .catch((error) => {
        reportError(error, { screen: "Favourites", action: "load_saved_stalls" });
        if (active) setVenuesFailed(true);
      });
    return () => {
      active = false;
    };
  }, [enabled, isLoaded, reloadKey, savedKey]);

  const stalls = useMemo(
    () => (venues ? savedStallIds.flatMap((id) => venues.get(id) ?? []) : []),
    [savedStallIds, venues],
  );

  const retry = useCallback(() => {
    retryInteractions();
    setReloadKey((key) => key + 1);
  }, [retryInteractions]);

  const status =
    loadFailed || venuesFailed ? "error" : !isLoaded || venues === null ? "loading" : "ready";
  return { status, stalls, missingCount, retry };
}
