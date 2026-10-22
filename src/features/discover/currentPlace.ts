import { useEffect, useRef, useState } from "react";

import { calculateDistanceMeters } from "@/lib/geo/distance";
import { CATALOG_PLACE_ENTER_RADIUS_METERS, type CatalogPlace } from "@/lib/services/catalog";
import { getCatalogRawService } from "@/lib/services/serviceProvider";
import type { Coordinate } from "@/types/domain";

/** Once inside a place the phone stays "in" it until it is this far from the place's centre. */
export const CURRENT_PLACE_LEAVE_RADIUS_METERS = 160;
/** A slow lookup must not hold Discover back: after this the area feed loads without a place. */
export const CURRENT_PLACE_LOOKUP_TIMEOUT_MS = 3_000;
/** ~11 m, so GPS jitter inside a building does not repeat the lookup. */
const COORDINATE_DECIMALS = 4;

function roundCoordinate(value: number) {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * Whether the phone is still inside a place it was already found in. Entering takes a stall
 * within CATALOG_PLACE_ENTER_RADIUS_METERS; leaving needs the larger radius, so the label does
 * not flicker between "JEM" and the area at the edge.
 */
export function isStillInPlace(place: CatalogPlace, coordinate: Coordinate): boolean {
  if (place.latitude === undefined || place.longitude === undefined) return false;
  return (
    calculateDistanceMeters(coordinate, {
      latitude: place.latitude,
      longitude: place.longitude,
    }) <= CURRENT_PLACE_LEAVE_RADIUS_METERS
  );
}

/**
 * The mall, hawker centre or food court the phone is inside, or undefined. Pass null when the
 * position is not a real fix (no permission, or a manually picked area).
 */
export function useCurrentPlace(coordinate: Coordinate | null) {
  const latitude = coordinate ? roundCoordinate(coordinate.latitude) : null;
  const longitude = coordinate ? roundCoordinate(coordinate.longitude) : null;
  const [place, setPlace] = useState<CatalogPlace | undefined>();
  // The coordinate the current `place` answer is for; null while a lookup is pending.
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const placeRef = useRef<CatalogPlace | undefined>(undefined);
  placeRef.current = place;

  const key = latitude === null || longitude === null ? null : `${latitude},${longitude}`;

  useEffect(() => {
    if (latitude === null || longitude === null) {
      setPlace(undefined);
      setResolvedFor(null);
      return;
    }
    const here = { latitude, longitude };
    const known = placeRef.current;
    if (known && isStillInPlace(known, here)) {
      setResolvedFor(`${latitude},${longitude}`);
      return;
    }

    let active = true;
    const finish = (next: CatalogPlace | undefined) => {
      if (!active) return;
      setPlace(next);
      setResolvedFor(`${latitude},${longitude}`);
    };
    const timer = setTimeout(() => finish(undefined), CURRENT_PLACE_LOOKUP_TIMEOUT_MS);
    getCatalogRawService()
      .listPlaces({
        coordinate: here,
        radiusMeters: CATALOG_PLACE_ENTER_RADIUS_METERS,
        limit: 1,
      })
      .then((places) => finish(places[0]))
      .catch(() => finish(undefined))
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [latitude, longitude]);

  return {
    place: key === null ? undefined : place,
    /** True while the lookup for the current position has not answered yet. */
    isResolving: key !== null && resolvedFor !== key,
  };
}
