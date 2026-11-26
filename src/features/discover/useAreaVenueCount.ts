import { useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";

type AreaCountArgs = {
  areaName?: string | null;
  geoCellLatitude: number;
  geoCellLongitude: number;
  radiusMeters: number;
};

/**
 * The real number of stalls in Home's area, read only when the feed came back full (so the
 * list alone would say "100+"). One count per area; null until it arrives or when it fails,
 * in which case the label keeps its "100+".
 */
export function useAreaVenueCount(args: AreaCountArgs, enabled: boolean): number | null {
  const { areaName, geoCellLatitude, geoCellLongitude, radiusMeters } = args;
  const [counted, setCounted] = useState<{ key: string; count: number } | null>(null);
  const key = `${geoCellLatitude}:${geoCellLongitude}:${radiusMeters}:${areaName ?? ""}`;

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    void getHungryService()
      .discovery.countVenuesInArea(
        geoCellLatitude,
        geoCellLongitude,
        radiusMeters,
        areaName ?? undefined,
      )
      .then((count) => {
        if (active && typeof count === "number") setCounted({ key, count });
      })
      .catch((error: unknown) => {
        reportError(error, { surface: "discover_home_area_count" });
      });
    return () => {
      active = false;
    };
  }, [areaName, enabled, geoCellLatitude, geoCellLongitude, key, radiusMeters]);

  return counted?.key === key ? counted.count : null;
}
