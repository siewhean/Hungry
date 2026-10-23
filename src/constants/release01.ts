export const RELEASE_01_VERSION = "0.1.0";

export const RELEASE_01_PILOT = {
  name: "Jurong East",
  coordinate: { latitude: 1.3331, longitude: 103.7421 },
  radiusMeters: 3_500,
  minimumVenueCount: 10,
  minimumDishCount: 20,
  minimumImageBackedVenueCount: 5,
  minimumImageBackedDishCount: 10,
  minimumCoordinateCoverage: 0.95,
} as const;

/** Stable food-intent probes used by the Week 2 catalog release gate. */
export const RELEASE_01_GOLDEN_DISH_QUERIES = [
  "chicken rice",
  "laksa",
  "nasi lemak",
  "char kway teow",
  "roti prata",
  "fish soup",
  "wanton mee",
  "yong tau foo",
  "bak kut teh",
  "curry puff",
] as const;

export const RELEASE_01_BLOCKED_IMAGE_MARKERS = [
  "images.unsplash.com",
  "unsplash.com",
  "picsum.photos",
  "placeholder.com",
  "via.placeholder.com",
  "placehold.co",
  "social-hero",
] as const;

export function isRelease01BlockedImageUrl(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return RELEASE_01_BLOCKED_IMAGE_MARKERS.some((marker) => normalized.includes(marker));
}

export function isSingaporeCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= 1.1 && latitude <= 1.5 && longitude >= 103.6 && longitude <= 104.1;
}
