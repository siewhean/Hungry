import type { Coordinate } from "@/types/domain";

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function calculateDistanceMeters(from: Coordinate, to: Coordinate) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  const c =
    2 *
    Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(1 - Math.min(1, Math.max(0, a))));
  return Math.round(Math.max(0, EARTH_RADIUS_METERS * c));
}

export function getDistanceMetersFromCoordinates(
  source: Coordinate | undefined,
  target: Coordinate | undefined,
): number | undefined {
  if (!source || !target) {
    return undefined;
  }

  const distance = calculateDistanceMeters(source, target);
  return Number.isFinite(distance) ? distance : undefined;
}

export function getDistanceMetersFromBuildingId(
  source: Coordinate | undefined,
  buildingId: string | undefined,
  buildingCoordinatesById: ReadonlyMap<string, Coordinate>,
  fallbackDistanceMeters: number,
): number {
  const target = buildingId ? buildingCoordinatesById.get(buildingId) : undefined;
  return getDistanceMetersFromCoordinates(source, target) ?? fallbackDistanceMeters;
}
