import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";

export const DISCOVER_AREA_RADIUS_METERS = 3000;
/** Location off: picks from the whole island, read around the built-in default point. */
export const DISCOVER_ISLAND_RADIUS_METERS = 30_000;
/** 500 steps per degree ≈ a 220m grid: small GPS moves keep the same Discover read. */
const DISCOVER_GEOCELL_STEPS_PER_DEGREE = 500;

type DiscoverLocationInput = Pick<
  ReturnType<typeof useLocationStore.getState>,
  "permission" | "currentLocation" | "manualCoordinate" | "manualLocation"
>;

/**
 * The place and size of the read Home makes for a diner, from where they are. Home and the
 * Splash screen both build their read from this, so the read Splash starts is the same request
 * Home then joins instead of repeating.
 */
export function getDiscoverReadArgs(location: DiscoverLocationInput) {
  const { coordinate, isApproximate } = getEffectiveLocation(location);
  const needsAreaChoice = isApproximate && !location.manualLocation;
  return {
    // GPS jitter must not refetch Discover: reads are keyed on a ~200m grid cell.
    geoCellLatitude:
      Math.round(coordinate.latitude * DISCOVER_GEOCELL_STEPS_PER_DEGREE) /
      DISCOVER_GEOCELL_STEPS_PER_DEGREE,
    geoCellLongitude:
      Math.round(coordinate.longitude * DISCOVER_GEOCELL_STEPS_PER_DEGREE) /
      DISCOVER_GEOCELL_STEPS_PER_DEGREE,
    // Only a manual area pick asks the server for that planning area.
    areaName: location.manualLocation,
    radiusMeters: needsAreaChoice ? DISCOVER_ISLAND_RADIUS_METERS : DISCOVER_AREA_RADIUS_METERS,
    needsAreaChoice,
  };
}
