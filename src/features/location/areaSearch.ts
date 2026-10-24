/**
 * Area search for Discover: the diner types an area, a mall / hawker centre / food court,
 * or an address, and every result resolves to a planning area (an address shows its area,
 * never the street). Pure, so the screen only fetches and renders.
 */
import type { OneMapAddress } from "@/lib/geo/oneMap";
import type { SingaporeArea } from "@/app/screens/onboarding/singaporeAreas";
import type { Coordinate } from "@/types/domain";

import { planningAreasFor } from "./singaporeAreaMap";

export type AreaSearchPlace = {
  id: string;
  name: string;
  buildingType?: string;
  venueCount: number;
  latitude?: number;
  longitude?: number;
};

export type AreaSearchResult = {
  key: string;
  kind: "area" | "place" | "address";
  title: string;
  subtitle: string;
  /** Planning area stored as the manual location. */
  areaName: string;
  coordinate: Coordinate;
  /** Set for a mall or food centre, so Discover can say "You are at <place>". */
  placeName?: string;
};

export const AREA_SEARCH_MIN_CHARS = 2;
const MAX_AREAS = 5;

const PLACE_TYPE_LABELS: Record<string, string> = {
  hawker_centre: "Hawker centre",
  food_court: "Food court",
  kopitiam: "Coffee shop",
  mall: "Mall",
  market: "Market",
};

export function placeTypeLabel(buildingType?: string): string {
  return (buildingType && PLACE_TYPE_LABELS[buildingType]) ?? "Food place";
}

export function matchAreas(query: string, areas: readonly SingaporeArea[]): SingaporeArea[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < AREA_SEARCH_MIN_CHARS) return [];
  const starts: SingaporeArea[] = [];
  const contains: SingaporeArea[] = [];
  for (const area of areas) {
    const name = area.name.toLowerCase();
    if (name.startsWith(needle)) starts.push(area);
    else if (name.includes(needle) || area.keywords?.some((keyword) => keyword.includes(needle))) {
      contains.push(area);
    }
  }
  return [...starts, ...contains].slice(0, MAX_AREAS);
}

/** Title-cases OneMap's upper-case addresses ("1 KADAYANALLUR ST" -> "1 Kadayanallur St"). */
export function formatAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\bSingapore (\d{6})$/, "Singapore $1");
}

/** A mall / hawker centre / food court as a result; null without a position. */
export function placeSearchResult(
  place: AreaSearchPlace,
  areaForCoordinate: (coordinate: Coordinate) => string,
): AreaSearchResult | null {
  if (place.latitude === undefined || place.longitude === undefined) return null;
  const coordinate = { latitude: place.latitude, longitude: place.longitude };
  const areaName = areaForCoordinate(coordinate);
  return {
    key: `place:${place.id}`,
    kind: "place",
    title: place.name,
    subtitle: `${placeTypeLabel(place.buildingType)} · ${areaName} · ${place.venueCount} stalls`,
    areaName,
    coordinate,
    placeName: place.name,
  };
}

/**
 * An area tapped on the map. The app's own area wins when it covers that planning area
 * (so Discover keeps its usual names); otherwise the planning area itself, at the tap.
 */
export function mapAreaSearchResult(
  planningArea: string,
  tapped: Coordinate,
  areas: readonly SingaporeArea[],
): AreaSearchResult {
  const appArea =
    areas.find((area) => area.name.toLowerCase() === planningArea.toLowerCase()) ??
    areas.find((area) => planningAreasFor(area.name, area.coordinate).includes(planningArea));
  return {
    key: `area:${appArea?.id ?? planningArea}`,
    kind: "area",
    title: appArea?.name ?? planningArea,
    subtitle: "Area",
    areaName: appArea?.name ?? planningArea,
    coordinate: appArea?.coordinate ?? tapped,
  };
}

export function buildAreaSearchResults(input: {
  query: string;
  areas: readonly SingaporeArea[];
  places: readonly AreaSearchPlace[];
  addresses: readonly OneMapAddress[];
  areaForCoordinate: (coordinate: Coordinate) => string;
}): AreaSearchResult[] {
  const results: AreaSearchResult[] = [];
  for (const place of input.places) {
    const result = placeSearchResult(place, input.areaForCoordinate);
    if (result) results.push(result);
  }
  for (const area of matchAreas(input.query, input.areas)) {
    results.push({
      key: `area:${area.id}`,
      kind: "area",
      title: area.name,
      subtitle: "Area",
      areaName: area.name,
      coordinate: area.coordinate,
    });
  }
  // An address shows as its area: one row per area, the address only as context.
  const seenAreas = new Set(results.filter((r) => r.kind === "area").map((r) => r.areaName));
  for (const address of input.addresses) {
    const areaName = input.areaForCoordinate(address.coordinate);
    if (seenAreas.has(areaName)) continue;
    seenAreas.add(areaName);
    results.push({
      key: `address:${areaName}`,
      kind: "address",
      title: areaName,
      subtitle: `Near ${formatAddress(address.address)}`,
      areaName,
      coordinate: address.coordinate,
    });
  }
  return results;
}

/** The closest listed area to a point (straight-line), so every result maps to a known area. */
export function nearestAreaName(coordinate: Coordinate, areas: readonly SingaporeArea[]): string {
  let best: SingaporeArea | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  const cosLat = Math.cos((coordinate.latitude * Math.PI) / 180);
  for (const area of areas) {
    const dLat = area.coordinate.latitude - coordinate.latitude;
    const dLng = (area.coordinate.longitude - coordinate.longitude) * cosLat;
    const distance = dLat * dLat + dLng * dLng;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = area;
    }
  }
  return best?.name ?? "Singapore";
}
