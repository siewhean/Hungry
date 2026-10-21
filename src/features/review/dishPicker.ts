import { getDistanceMetersFromCoordinates } from "@/lib/geo/distance";
import type { Coordinate } from "@/types/domain";

export type PickerVenue = {
  id: string;
  name: string;
  unitNumber: string;
  buildingId?: string;
};

export type PickerDish = {
  id: string;
  name: string;
  venueId: string;
  venueName: string;
};

export type PickerRow =
  | { kind: "venue"; key: string; venue: PickerVenue; distanceMeters?: number }
  | { kind: "dish"; key: string; dish: PickerDish; venue?: PickerVenue; distanceMeters?: number };

const MAX_PICKER_ROWS = 40;

export function formatPickerDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function byDistanceThenName<T extends { distanceMeters?: number }>(
  getName: (row: T) => string,
): (a: T, b: T) => number {
  return (a, b) => {
    const da = a.distanceMeters ?? Number.POSITIVE_INFINITY;
    const db = b.distanceMeters ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return getName(a).localeCompare(getName(b));
  };
}

/**
 * Rows for the review dish picker. With no search, every stall, nearest first when the
 * viewer's location is known. With a search, matching stalls and matching dishes together
 * (so a dish can be found without knowing its stall), nearest first.
 */
export function buildDishPickerRows(input: {
  venues: PickerVenue[];
  dishes: PickerDish[];
  query: string;
  /** The viewer's position; leave undefined when it is only an approximate default. */
  origin?: Coordinate;
  buildingCoordinates?: ReadonlyMap<string, Coordinate>;
}): PickerRow[] {
  const { venues, dishes, origin, buildingCoordinates } = input;
  const query = input.query.trim().toLowerCase();
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));

  const distanceOf = (venue: PickerVenue | undefined): number | undefined => {
    if (!origin || !venue?.buildingId) return undefined;
    return getDistanceMetersFromCoordinates(origin, buildingCoordinates?.get(venue.buildingId));
  };

  const venueRows = venues
    .filter((venue) => !query || `${venue.name} ${venue.unitNumber}`.toLowerCase().includes(query))
    .map(
      (venue): PickerRow => ({
        kind: "venue",
        key: `venue:${venue.id}`,
        venue,
        distanceMeters: distanceOf(venue),
      }),
    )
    .sort(byDistanceThenName((row) => (row.kind === "venue" ? row.venue.name : "")));
  if (!query) return venueRows;

  const dishRows = dishes
    .filter((dish) => dish.name.toLowerCase().includes(query))
    .map((dish): PickerRow => {
      const venue = venueById.get(dish.venueId);
      return {
        kind: "dish",
        key: `dish:${dish.id}`,
        dish,
        venue,
        distanceMeters: distanceOf(venue),
      };
    })
    .sort(byDistanceThenName((row) => (row.kind === "dish" ? row.dish.name : "")));

  return [...venueRows, ...dishRows].slice(0, MAX_PICKER_ROWS);
}
