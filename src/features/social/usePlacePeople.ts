import { useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { PlacePeople, PlaceRef } from "@/lib/services/types";

const NOBODY: PlacePeople = { people: [], totalPeople: 0 };

export type PlacePeopleState = PlacePeople & { status: "loading" | "ready" | "failed" };

/**
 * Who reviewed or posted at a stall or a dish (get_place_people), read once per place. Nobody
 * while loading, when switched off, or when the read fails (reported with `screen`), so a caller
 * can leave its row out. `reloadKey` reads again.
 */
export function usePlacePeople(
  place: PlaceRef | null,
  {
    enabled,
    limit = 5,
    screen,
    reloadKey = 0,
  }: {
    enabled: boolean;
    limit?: number;
    screen: string;
    reloadKey?: unknown;
  },
): PlacePeopleState {
  const venueId = place?.venueId;
  const dishId = place?.dishId;
  const [state, setState] = useState<PlacePeopleState>({ ...NOBODY, status: "loading" });

  useEffect(() => {
    if (!enabled || (!venueId && !dishId)) {
      setState({ ...NOBODY, status: "ready" });
      return;
    }
    let isActive = true;
    setState({ ...NOBODY, status: "loading" });
    const ref: PlaceRef = venueId ? { venueId } : { dishId: dishId as string };
    void getHungryService()
      .social.getPlacePeople(ref, limit)
      .then((result) => {
        if (isActive) setState({ ...result, status: "ready" });
      })
      .catch((error) => {
        if (!isActive) return;
        setState({ ...NOBODY, status: "failed" });
        reportError(error, { screen, action: "load_place_people" });
      });
    return () => {
      isActive = false;
    };
  }, [dishId, enabled, limit, reloadKey, screen, venueId]);

  return state;
}

/** "2 you follow, 6 in all", or "6 people reviewed or posted here". */
export function placePeopleSummary(people: PlacePeople["people"], totalPeople: number): string {
  const total = Math.max(totalPeople, people.length);
  const followed = people.filter((person) => person.isFollowed).length;
  if (followed > 0 && followed >= total) {
    return followed === 1 ? "1 person you follow" : `${followed} people you follow`;
  }
  if (followed > 0) return `${followed} you follow, ${total} in all`;
  return total === 1
    ? "1 person reviewed or posted here"
    : `${total} people reviewed or posted here`;
}
