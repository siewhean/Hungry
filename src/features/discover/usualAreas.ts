/**
 * The areas a diner said they eat around most (onboarding), as places Home can show food for.
 * Unknown ids (an area renamed since) are dropped; the order the diner picked is kept.
 */
import {
  SORTED_SINGAPORE_AREAS,
  type SingaporeArea,
} from "@/app/screens/onboarding/singaporeAreas";

const AREAS_BY_ID = new Map(SORTED_SINGAPORE_AREAS.map((area) => [area.id, area]));

export function usualAreasFor(ids: readonly string[]): SingaporeArea[] {
  const seen = new Set<string>();
  return ids.flatMap((id) => {
    const area = AREAS_BY_ID.get(id);
    if (!area || seen.has(id)) return [];
    seen.add(id);
    return [area];
  });
}
