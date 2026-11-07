import { useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { NetworkStallPick } from "@/lib/services/types";

/** How many picks Home asks for: enough for a rail and the "Just for you" lift. */
export const NETWORK_PICKS_LIMIT = 12;

const NO_PICKS: NetworkStallPick[] = [];

/**
 * Stalls the diner's follows loved lately, for Home (get_network_stall_picks), read once per
 * sign-in. [] while loading, signed out, or when the read fails (reported): Home then simply
 * leaves the section and the lift out. `reloadKey` re-reads on pull to refresh.
 */
export function useNetworkStallPicks(enabled: boolean, reloadKey: unknown = 0): NetworkStallPick[] {
  const [picks, setPicks] = useState<NetworkStallPick[]>(NO_PICKS);

  useEffect(() => {
    if (!enabled) {
      setPicks(NO_PICKS);
      return;
    }
    let isActive = true;
    void getHungryService()
      .social.listNetworkStallPicks(NETWORK_PICKS_LIMIT)
      .then((rows) => {
        if (isActive) setPicks(rows);
      })
      .catch((error) => {
        reportError(error, { screen: "DiscoverHome", action: "load_network_stall_picks" });
      });
    return () => {
      isActive = false;
    };
  }, [enabled, reloadKey]);

  return enabled ? picks : NO_PICKS;
}
