import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASE_01_GOLDEN_DISH_QUERIES,
  RELEASE_01_PILOT,
  isRelease01BlockedImageUrl,
  isSingaporeCoordinate,
} from "@/constants/release01";
import {
  getExcelVenueCoordinate,
  listExcelDishes,
  listExcelVenues,
} from "@/lib/services/excel/repositories";
import { excelCatalogFallbackService } from "@/lib/services/catalog/excelFallback";
import { isDeliveryAppImageUrl } from "@/lib/services/catalog/media";
import { calculateDistanceMeters } from "@/lib/geo/distance";

const venues = listExcelVenues();
const dishes = listExcelDishes();
const pilotVenues = venues.filter((venue) => {
  const coordinate = getExcelVenueCoordinate(venue.id);
  return (
    coordinate !== undefined &&
    isSingaporeCoordinate(coordinate.latitude, coordinate.longitude) &&
    calculateDistanceMeters(RELEASE_01_PILOT.coordinate, coordinate) <=
      RELEASE_01_PILOT.radiusMeters
  );
});
const pilotVenueIds = new Set(pilotVenues.map((venue) => venue.id));
const pilotDishes = dishes.filter((dish) => pilotVenueIds.has(dish.venueId));

function validImage(value: string | null | undefined): boolean {
  if (!value || isRelease01BlockedImageUrl(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

test("Release 0.1 Jurong East pilot has enough reachable catalog records", () => {
  const coordinateBacked = pilotVenues.filter((venue) => {
    const coordinate = getExcelVenueCoordinate(venue.id);
    return coordinate && isSingaporeCoordinate(coordinate.latitude, coordinate.longitude);
  });
  const coordinateCoverage = pilotVenues.length ? coordinateBacked.length / pilotVenues.length : 0;

  assert.ok(
    pilotVenues.length >= RELEASE_01_PILOT.minimumVenueCount,
    `Expected at least ${RELEASE_01_PILOT.minimumVenueCount} Jurong East venues, found ${pilotVenues.length}`,
  );
  assert.ok(
    pilotDishes.length >= RELEASE_01_PILOT.minimumDishCount,
    `Expected at least ${RELEASE_01_PILOT.minimumDishCount} Jurong East dishes, found ${pilotDishes.length}`,
  );
  // The bundled copy's pilot photos were Grab CMS images, which the server withholds (no licence),
  // so the offline copy no longer counts toward RELEASE_01_PILOT's image minimums: those are
  // met by the online catalog's licensed photos. What the offline copy must never do is show one.
  const deliveryAppImages = [
    ...pilotVenues.flatMap((venue) => [venue.logoUrl, venue.imageUrl]),
    ...pilotDishes.map((dish) => dish.imageUrl),
  ].filter((url) => validImage(url) && isDeliveryAppImageUrl(url));
  assert.deepEqual(deliveryAppImages, []);
  assert.ok(
    coordinateCoverage >= RELEASE_01_PILOT.minimumCoordinateCoverage,
    `Expected Jurong East coordinate coverage >= ${RELEASE_01_PILOT.minimumCoordinateCoverage}, found ${coordinateCoverage.toFixed(3)}`,
  );
});

test("Release 0.1 golden food intents are searchable in the bundled catalog", async () => {
  for (const query of RELEASE_01_GOLDEN_DISH_QUERIES) {
    const page = await excelCatalogFallbackService.listDishes({
      query,
      limit: 5,
      sort: "relevance",
    });
    assert.ok(page.items.length > 0, `Expected a bundled-catalog match for ${query}`);
    assert.equal(page.releaseId, "excel-fallback-v1");
    for (const item of page.items) {
      assert.equal(isRelease01BlockedImageUrl(item.imageUrl), false);
    }
  }
});

test("Release 0.1 fallback preserves legitimate no-results and distinct cursor pages", async () => {
  const noResults = await excelCatalogFallbackService.listDishes({
    query: "hungry-no-such-dish-8f7247d2",
    limit: 5,
  });
  assert.deepEqual(noResults.items, []);
  assert.equal(noResults.nextCursor, undefined);

  const first = await excelCatalogFallbackService.listVenues({ limit: 10, sort: "quality" });
  assert.ok(first.items.length > 0);
  assert.ok(first.nextCursor);
  const second = await excelCatalogFallbackService.listVenues({
    cursor: first.nextCursor,
    limit: 10,
    releaseId: first.releaseId,
    sort: "quality",
  });
  const firstIds = new Set(first.items.map((item) => item.id));
  assert.ok(second.items.every((item) => !firstIds.has(item.id)));
});
