#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const catalogPath = resolve(process.cwd(), "src/lib/services/excel/excelCatalog.generated.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const PILOT = {
  name: "Jurong East",
  latitude: 1.3331,
  longitude: 103.7421,
  radiusMeters: 3500,
};
const THRESHOLDS = {
  venues: 10,
  dishes: 20,
  imageBackedVenues: 5,
  imageBackedDishes: 10,
  coordinateCoverage: 0.95,
};
const GOLDEN_QUERIES = [
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
];
const BLOCKED_IMAGE_MARKERS = [
  "images.unsplash.com",
  "unsplash.com",
  "picsum.photos",
  "placeholder.com",
  "via.placeholder.com",
  "placehold.co",
  "social-hero",
];

function asRecord(columns, row) {
  return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
}

function text(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalized(value) {
  return text(value).toLowerCase();
}

function validCoordinate(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < 1.1 || lat > 1.5 || lng < 103.6 || lng > 104.1) return false;
  // The exporter uses this Singapore-centre pair only when source coordinates
  // are absent. It is not acceptable as pilot-area location proof.
  return !(Math.abs(lat - 1.3521) < 0.000001 && Math.abs(lng - 103.8198) < 0.000001);
}

function distanceMeters(latitude, longitude) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(PILOT.latitude);
  const lat2 = toRadians(Number(latitude));
  const deltaLat = toRadians(Number(latitude) - PILOT.latitude);
  const deltaLng = toRadians(Number(longitude) - PILOT.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function blockedImage(url) {
  const value = normalized(url);
  return Boolean(value) && BLOCKED_IMAGE_MARKERS.some((marker) => value.includes(marker));
}

function validImage(url) {
  const value = text(url);
  if (!value || blockedImage(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

const buildings = catalog.buildings.map((row) => asRecord(catalog.buildingColumns, row));
const venues = catalog.venues.map((row) => asRecord(catalog.venueColumns, row));
const dishes = catalog.dishes.map((row) => asRecord(catalog.dishColumns, row));
const venueById = new Map(venues.map((venue) => [text(venue.id), venue]));
const dishesByVenue = new Map();

for (const dish of dishes) {
  const venueId = text(dish.venueId);
  const current = dishesByVenue.get(venueId) ?? [];
  current.push(dish);
  dishesByVenue.set(venueId, current);
}

const pilotVenues = venues.filter(
  (venue) =>
    validCoordinate(venue.latitude, venue.longitude) &&
    distanceMeters(venue.latitude, venue.longitude) <= PILOT.radiusMeters,
);
const pilotVenueIds = new Set(pilotVenues.map((venue) => text(venue.id)));
const pilotDishes = dishes.filter((dish) => pilotVenueIds.has(text(dish.venueId)));
const coordinateBackedVenues = pilotVenues.filter((venue) =>
  validCoordinate(venue.latitude, venue.longitude),
);
const imageBackedDishes = pilotDishes.filter((dish) => validImage(dish.imageUrl));
const imageBackedVenues = pilotVenues.filter((venue) => {
  if (validImage(venue.logoUrl) || validImage(venue.imageUrl)) return true;
  return (dishesByVenue.get(text(venue.id)) ?? []).some((dish) => validImage(dish.imageUrl));
});
const blockedPilotImageUrls = [
  ...pilotVenues.flatMap((venue) => [text(venue.logoUrl), text(venue.imageUrl)]),
  ...pilotDishes.map((dish) => text(dish.imageUrl)),
].filter((url) => blockedImage(url));

const goldenQueries = GOLDEN_QUERIES.map((query) => {
  const matches = dishes.filter((dish) => {
    const venue = venueById.get(text(dish.venueId));
    const haystack = normalized(
      [
        dish.name,
        dish.foodTypeTag,
        dish.description,
        venue?.name,
        venue?.planningArea,
        venue?.buildingName,
      ].join(" "),
    );
    return haystack.includes(query);
  });
  return { query, count: matches.length, firstDish: text(matches[0]?.name) || null };
});

const coordinateCoverage = pilotVenues.length
  ? coordinateBackedVenues.length / pilotVenues.length
  : 0;
const failures = [];

if (pilotVenues.length < THRESHOLDS.venues) {
  failures.push(`Pilot venues ${pilotVenues.length} < ${THRESHOLDS.venues}`);
}
if (pilotDishes.length < THRESHOLDS.dishes) {
  failures.push(`Pilot dishes ${pilotDishes.length} < ${THRESHOLDS.dishes}`);
}
if (imageBackedVenues.length < THRESHOLDS.imageBackedVenues) {
  failures.push(
    `Image-backed pilot venues ${imageBackedVenues.length} < ${THRESHOLDS.imageBackedVenues}`,
  );
}
if (imageBackedDishes.length < THRESHOLDS.imageBackedDishes) {
  failures.push(
    `Image-backed pilot dishes ${imageBackedDishes.length} < ${THRESHOLDS.imageBackedDishes}`,
  );
}
if (coordinateCoverage < THRESHOLDS.coordinateCoverage) {
  failures.push(
    `Pilot coordinate coverage ${coordinateCoverage.toFixed(3)} < ${THRESHOLDS.coordinateCoverage}`,
  );
}
const missingGoldenQueries = goldenQueries.filter((result) => result.count === 0);
if (missingGoldenQueries.length) {
  failures.push(
    `Missing golden queries: ${missingGoldenQueries.map((item) => item.query).join(", ")}`,
  );
}
if (blockedPilotImageUrls.length) {
  failures.push(`Pilot contains ${blockedPilotImageUrls.length} blocked placeholder image URLs`);
}

const report = {
  status: failures.length ? "failed" : "passed",
  release: "0.1.0",
  generatedAt: new Date().toISOString(),
  source: {
    catalogPath,
    sourceWorkbook: catalog.metadata?.sourceWorkbook ?? null,
    sourceSha256: catalog.metadata?.sourceSha256 ?? null,
    catalogGeneratedAt: catalog.metadata?.generatedAt ?? null,
  },
  catalogTotals: {
    buildings: buildings.length,
    venues: venues.length,
    dishes: dishes.length,
    dishImages: catalog.metadata?.dishImageCount ?? null,
  },
  pilot: {
    area: PILOT.name,
    coordinate: { latitude: PILOT.latitude, longitude: PILOT.longitude },
    radiusMeters: PILOT.radiusMeters,
    venues: pilotVenues.length,
    dishes: pilotDishes.length,
    coordinateBackedVenues: coordinateBackedVenues.length,
    coordinateCoverage,
    imageBackedVenues: imageBackedVenues.length,
    imageBackedDishes: imageBackedDishes.length,
    blockedImageUrlCount: blockedPilotImageUrls.length,
  },
  goldenQueries,
  thresholds: THRESHOLDS,
  failures,
};

const outputPath = process.env.HUNGRY_RELEASE_AUDIT_OUTPUT?.trim();
if (outputPath) {
  const resolvedOutput = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
