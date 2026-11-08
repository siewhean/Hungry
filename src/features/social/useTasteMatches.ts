import { useEffect, useMemo, useRef, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";

/**
 * Taste match for every person on a list, in one call per new batch of ids (never one per row).
 * Ids already scored are not asked for again as the list pages in. A failed read leaves the
 * scores out; it is reported, and the rows simply show no match.
 */
export function useTasteMatches(
  userIds: readonly string[],
  enabled: boolean,
): Record<string, number> {
  const [scores, setScores] = useState<Record<string, number>>({});
  // Ids already asked for: a later page asks only for its new people.
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const key = useMemo(() => [...new Set(userIds.filter(Boolean))].sort().join(","), [userIds]);

  useEffect(() => {
    if (!enabled || !key) return;
    // The RPC takes 200 ids; any more are asked for on the next change (lists page 100 at a time).
    const missing = key
      .split(",")
      .filter((id) => !asked.current.has(id))
      .slice(0, 200);
    if (missing.length === 0) return;
    missing.forEach((id) => asked.current.add(id));
    // A batch that lands after the list grew still merges in: its scores are still right.
    void getHungryService()
      .social.getTasteMatches(missing)
      .then((next) => {
        if (mounted.current) setScores((current) => ({ ...current, ...next }));
      })
      .catch((error) => {
        missing.forEach((id) => asked.current.delete(id));
        reportError(error, { screen: "ProfileConnections", action: "load_taste_matches" });
      });
  }, [enabled, key]);

  return scores;
}
