/**
 * Geometry for the Singapore area map on the area search page: projects coordinates into the
 * map's viewBox, turns outline rings into SVG paths, and finds which planning areas to
 * highlight for a chosen area or place.
 */
import type { Coordinate } from "@/types/domain";

import {
  SINGAPORE_MAP_PROJECTION as PROJECTION,
  SINGAPORE_PLANNING_AREAS,
} from "./singaporeAreaMap.generated";

export const SINGAPORE_MAP_WIDTH = PROJECTION.width;
export const SINGAPORE_MAP_HEIGHT = PROJECTION.height;
export { SINGAPORE_PLANNING_AREAS };

/** App areas that span several planning areas, or carry a different name. */
const AREA_PARTS: Record<string, readonly string[]> = {
  "central area": [
    "Downtown Core",
    "Marina East",
    "Marina South",
    "Museum",
    "Newton",
    "River Valley",
    "Singapore River",
    "Straits View",
  ],
  chinatown: ["Outram"],
  "jalan besar": ["Rochor", "Kallang"],
  "potong pasir": ["Toa Payoh"],
  sentosa: ["Southern Islands"],
  "sungei road": ["Rochor"],
};

export function projectCoordinate(coordinate: Coordinate): { x: number; y: number } {
  return {
    x: (coordinate.longitude - PROJECTION.minLon) * PROJECTION.lonScale,
    y: (PROJECTION.maxLat - coordinate.latitude) * PROJECTION.latScale,
  };
}

export function ringsToPath(rings: readonly (readonly number[])[]): string {
  return rings
    .map((ring) => {
      let d = "";
      for (let i = 0; i + 1 < ring.length; i += 2)
        d += `${i === 0 ? "M" : "L"}${ring[i]} ${ring[i + 1]}`;
      return `${d}Z`;
    })
    .join("");
}

/** Even-odd ray cast over a flat [x0, y0, x1, y1, ...] ring. */
export function pointInRing(x: number, y: number, ring: readonly number[]): boolean {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2];
    const yi = ring[i * 2 + 1];
    const xj = ring[j * 2];
    const yj = ring[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The planning area a coordinate falls in, if any. */
export function planningAreaAt(coordinate: Coordinate): string | undefined {
  const { x, y } = projectCoordinate(coordinate);
  return SINGAPORE_PLANNING_AREAS.find((area) => area.rings.some((ring) => pointInRing(x, y, ring)))
    ?.name;
}

/** Planning areas to highlight for an area the diner picked (by name, then by its centre). */
export function planningAreasFor(areaName: string, coordinate?: Coordinate): string[] {
  const key = areaName.trim().toLowerCase();
  const parts = AREA_PARTS[key];
  if (parts) return [...parts];
  const byName = SINGAPORE_PLANNING_AREAS.find((area) => area.name.toLowerCase() === key);
  if (byName) return [byName.name];
  const containing = coordinate ? planningAreaAt(coordinate) : undefined;
  return containing ? [containing] : [];
}
