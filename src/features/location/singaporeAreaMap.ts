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

/** The coordinate under a point of the map's viewBox (the inverse of projectCoordinate). */
export function unprojectPoint(x: number, y: number): Coordinate {
  return {
    latitude: PROJECTION.maxLat - y / PROJECTION.latScale,
    longitude: x / PROJECTION.lonScale + PROJECTION.minLon,
  };
}

/** The part of the map on screen: its centre in viewBox units and a zoom of 1 or more. */
export type MapView = { centerX: number; centerY: number; zoom: number };

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 8;
/** Malls, food courts and hawker centres show as dots from this zoom in. */
export const MAP_PLACE_DOTS_ZOOM = 2.5;

export const FULL_MAP_VIEW: MapView = {
  centerX: PROJECTION.width / 2,
  centerY: PROJECTION.height / 2,
  zoom: MAP_MIN_ZOOM,
};

/** Keeps the zoom in range and the view inside the map's edges. */
export function clampMapView(view: MapView): MapView {
  const zoom = Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, view.zoom));
  const halfWidth = PROJECTION.width / zoom / 2;
  const halfHeight = PROJECTION.height / zoom / 2;
  return {
    zoom,
    centerX: Math.max(halfWidth, Math.min(PROJECTION.width - halfWidth, view.centerX)),
    centerY: Math.max(halfHeight, Math.min(PROJECTION.height - halfHeight, view.centerY)),
  };
}

/** The SVG viewBox for a view: "minX minY width height". */
export function mapViewBox(view: MapView): string {
  const width = PROJECTION.width / view.zoom;
  const height = PROJECTION.height / view.zoom;
  return `${view.centerX - width / 2} ${view.centerY - height / 2} ${width} ${height}`;
}

/** The view's centre as a coordinate and the radius, in metres, that covers what is on screen. */
export function mapViewArea(view: MapView): { center: Coordinate; radiusMeters: number } {
  const halfWidthDegrees = PROJECTION.width / view.zoom / 2 / PROJECTION.lonScale;
  const halfHeightDegrees = PROJECTION.height / view.zoom / 2 / PROJECTION.latScale;
  // Near the equator a degree is about 111 km both ways.
  const radiusMeters = Math.round(Math.hypot(halfWidthDegrees, halfHeightDegrees) * 111_320);
  return { center: unprojectPoint(view.centerX, view.centerY), radiusMeters };
}
