/**
 * The one way Map, Decide for me and the Wheel write a distance: "210 m", "1.2 km", with a space
 * before the unit. `away: true` adds the word for a line that stands on its own ("210 m away").
 * Undefined for a distance that is missing or not positive, so no label is better than "0 m".
 */
export function formatDistanceLabel(
  distanceMeters: number | undefined,
  options: { away?: boolean } = {},
): string | undefined {
  if (distanceMeters === undefined || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return undefined;
  }
  const label =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceMeters)} m`;
  return options.away ? `${label} away` : label;
}
