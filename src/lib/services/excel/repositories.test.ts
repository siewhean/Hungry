import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  getHungryService,
  resetServiceProvider,
  setExcelServiceProvider,
} from "@/lib/services/serviceProvider";
import { excelRepository, getExcelCatalogMetadata } from "./repositories";

test("Excel repository exposes workbook-scale local venues and dishes", () => {
  const metadata = getExcelCatalogMetadata();

  assert.ok(metadata.sourceRows > 0);
  assert.ok(metadata.venueCount > 4_000);
  assert.ok(metadata.dishCount > 20_000);
  assert.equal(excelRepository.listBuildings().length, metadata.buildingCount);
  assert.ok(excelRepository.listPopularNearby().length > 0);
});

test("Excel repository exposes only rights-authorized workbook images to app dishes", () => {
  const metadata = getExcelCatalogMetadata() as ReturnType<typeof getExcelCatalogMetadata> & {
    dishImageCount: number;
    dishImagesFromSourceEvidence: number;
    sourceDirectImageRows: number;
    sourceImageEvidenceRows: number;
  };
  const popular = excelRepository.listPopularNearby();

  assert.equal(metadata.sourceImageEvidenceRows, 0);
  assert.equal(metadata.sourceDirectImageRows, 0);
  assert.ok(metadata.dishImageCount > 0);
  assert.equal(metadata.dishImagesFromSourceEvidence, 0);
  assert.ok(popular.length > 0);
  assert.ok(popular.every((dish) => dish.imageUrl));
});

test("Excel repository searches parsed workbook menu items", () => {
  const results = excelRepository.searchDishes(
    {
      query: "chicken",
      categories: [],
      dietaryFlags: [],
      tasteValues: NEUTRAL_TASTE_VECTOR,
      radius: 3000,
    },
    NEUTRAL_TASTE_VECTOR,
  );

  assert.ok(results.length > 0);
  assert.ok(results.some((dish) => dish.name.toLowerCase().includes("chicken")));
  assert.ok(results[0].venueName.length > 0);
});

test("Excel discovery feed returns local rows with prioritized image-backed dishes", async () => {
  setExcelServiceProvider();
  try {
    const feed = await getHungryService().discovery.listDiscoveryFeedByLocation({
      areaName: "Pasir Ris",
      lat: 1.3721,
      lng: 103.9474,
      radiusMeters: 5000,
      limit: 1200,
    });

    assert.ok(feed);
    assert.ok(feed.venues.length > 0);
    assert.ok(feed.results.length > 0);
    assert.ok(feed.results.some((result) => result.dish.imageUrl));
    assert.notEqual(feed.results[0]?.dish.distanceMeters, 0);
  } finally {
    resetServiceProvider();
  }
});
