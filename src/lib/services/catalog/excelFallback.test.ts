import assert from "node:assert/strict";
import test from "node:test";

import { isUsableDiscoverImageUrl } from "@/features/discover/bites";
import { excelCatalogFallbackService } from "@/lib/services/catalog/excelFallback";
import {
  getExcelCatalogMetadata,
  listExcelDishes,
  listExcelVenues,
} from "@/lib/services/excel/repositories";

test("Excel catalog fallback exposes workbook totals through paged dish and venue reads", async () => {
  const metadata = getExcelCatalogMetadata();
  const [dishPage, venuePage] = await Promise.all([
    excelCatalogFallbackService.listDishes({ limit: 24, sort: "quality" }),
    excelCatalogFallbackService.listVenues({ limit: 24, sort: "quality" }),
  ]);

  assert.equal(dishPage.releaseId, "excel-fallback-v1");
  assert.equal(venuePage.releaseId, "excel-fallback-v1");
  assert.equal(dishPage.totals.dishes, metadata.dishCount);
  assert.equal(venuePage.totals.venues, metadata.venueCount);
  assert.ok(dishPage.items.length > 0);
  assert.ok(venuePage.items.length > 0);
  assert.ok(dishPage.nextCursor);
  assert.ok(venuePage.nextCursor);
});

async function threePages<T extends { id: string }>(
  list: (request: {
    cursor?: string;
    limit: number;
    releaseId?: string;
    sort: "quality";
  }) => Promise<{
    items: T[];
    nextCursor?: string;
    releaseId: string;
  }>,
) {
  const first = await list({ limit: 12, sort: "quality" });
  assert.ok(first.nextCursor, "Expected a cursor after the first page");
  const second = await list({
    cursor: first.nextCursor,
    limit: 12,
    releaseId: first.releaseId,
    sort: "quality",
  });
  assert.ok(second.nextCursor, "Expected a cursor after the second page");
  const third = await list({
    cursor: second.nextCursor,
    limit: 12,
    releaseId: second.releaseId,
    sort: "quality",
  });
  const pages = [first, second, third];
  const ids = pages.flatMap((page) => page.items.map((item) => item.id));

  assert.ok(third.items.length > 0, "Expected a non-empty third page");
  assert.equal(new Set(ids).size, ids.length, "Stable IDs must not repeat across pages");
  assert.ok(
    pages.every((page) => page.releaseId === first.releaseId),
    "A cursor chain must stay on its originating Excel release",
  );
  return pages;
}

test("Excel fallback serves three distinct, release-bound pages for dishes and venues", async () => {
  const [dishPages, venuePages] = await Promise.all([
    threePages((request) => excelCatalogFallbackService.listDishes(request)),
    threePages((request) => excelCatalogFallbackService.listVenues(request)),
  ]);

  assert.equal(dishPages[0].releaseId, "excel-fallback-v1");
  assert.equal(venuePages[0].releaseId, "excel-fallback-v1");
});

test("Excel fallback starts a fresh cursor chain when a query or filter changes", async () => {
  const unfiltered = await excelCatalogFallbackService.listDishes({ limit: 12, sort: "quality" });
  assert.ok(unfiltered.nextCursor);

  const queryRequest = { query: "chicken", limit: 12, sort: "relevance" as const };
  const firstQueryPage = await excelCatalogFallbackService.listDishes(queryRequest);
  const resetQueryPage = await excelCatalogFallbackService.listDishes(queryRequest);
  assert.deepEqual(
    resetQueryPage.items.map((item) => item.id),
    firstQueryPage.items.map((item) => item.id),
    "A query reset must request the first matching page, not reuse an old cursor",
  );
  assert.equal(resetQueryPage.releaseId, firstQueryPage.releaseId);

  const filterRequest = { maxPrice: 8, limit: 12, sort: "quality" as const };
  const firstFilteredPage = await excelCatalogFallbackService.listDishes(filterRequest);
  const resetFilteredPage = await excelCatalogFallbackService.listDishes(filterRequest);
  assert.deepEqual(
    resetFilteredPage.items.map((item) => item.id),
    firstFilteredPage.items.map((item) => item.id),
    "A filter reset must request the first matching page, not reuse an old cursor",
  );
  assert.equal(resetFilteredPage.releaseId, firstFilteredPage.releaseId);
});

test("Excel fallback preserves source and release through venue detail and menu paging", async () => {
  const venuePage = await excelCatalogFallbackService.listVenues({ limit: 50, sort: "quality" });
  const venue = venuePage.items.find((item) => item.menuCount >= 3);
  assert.ok(venue, "Expected an Excel venue with a paged menu");

  const detail = await excelCatalogFallbackService.getVenue(venue.id);
  assert.equal(detail.id, venue.id);
  const firstMenu = await excelCatalogFallbackService.listVenueMenu(venue.id, {
    limit: 1,
    releaseId: venuePage.releaseId,
  });
  assert.ok(firstMenu.nextCursor);
  const secondMenu = await excelCatalogFallbackService.listVenueMenu(venue.id, {
    cursor: firstMenu.nextCursor,
    limit: 1,
    releaseId: firstMenu.releaseId,
  });
  assert.equal(firstMenu.releaseId, venuePage.releaseId);
  assert.equal(secondMenu.releaseId, venuePage.releaseId);
  assert.notEqual(firstMenu.items[0]?.id, secondMenu.items[0]?.id);
  const dishDetail = await excelCatalogFallbackService.getDish(firstMenu.items[0]?.id ?? "");
  assert.equal(dishDetail.venueId, venue.id);
});

test("Excel fallback dish cards use menu image URLs rather than blocked placeholders", async () => {
  const page = await excelCatalogFallbackService.listDishes({ limit: 50, sort: "quality" });
  const imageCards = page.items.filter((item) => Boolean(item.imageUrl));

  assert.ok(imageCards.length > 0);
  imageCards.forEach((item) => {
    assert.equal(isUsableDiscoverImageUrl(item.imageUrl), true);
    assert.equal(item.mediaRightsStatus, "approved");
  });
});

test("Excel fallback venue cards expose stall imagery or a representative menu image", async () => {
  const page = await excelCatalogFallbackService.listVenues({ limit: 50, sort: "quality" });
  const visualCards = page.items.filter(
    (item) => Boolean(item.imageUrl) || Boolean(item.representativeDish?.imageUrl),
  );

  assert.ok(visualCards.length > 0);
  visualCards.forEach((item) => {
    const imageUrl = item.imageUrl ?? item.representativeDish?.imageUrl;
    assert.equal(isUsableDiscoverImageUrl(imageUrl), true);
  });
});

test("Excel fallback supplies visible paged Discover data without Supabase", async () => {
  const [dishes, venues] = await Promise.all([
    excelCatalogFallbackService.listDishes({ limit: 8, sort: "nearby" }),
    excelCatalogFallbackService.listVenues({ limit: 8, sort: "nearby" }),
  ]);

  assert.equal(dishes.releaseId, "excel-fallback-v1");
  assert.equal(venues.releaseId, "excel-fallback-v1");
  assert.ok(dishes.items.length > 0);
  assert.ok(venues.items.length > 0);
  assert.ok(dishes.items.some((item) => Boolean(item.imageUrl)));
});

test("Excel fallback honours a place (buildingId) for dishes and stalls (SEARCH-4)", async () => {
  const first = await excelCatalogFallbackService.listDishes({ limit: 1, sort: "quality" });
  const buildingId = first.items[0]?.buildingId;
  assert.ok(buildingId);
  const [dishes, venues] = await Promise.all([
    excelCatalogFallbackService.listDishes({ limit: 50, sort: "quality", buildingId }),
    excelCatalogFallbackService.listVenues({ limit: 50, sort: "quality", buildingId }),
  ]);
  assert.ok(dishes.items.length > 0);
  assert.ok(dishes.items.every((item) => item.buildingId === buildingId));
  assert.ok(venues.items.every((item) => item.buildingId === buildingId));
});

test("Excel fallback honours the Noodles keywords (SEARCH-4)", async () => {
  const keywords = ["noodle", "mee", "laksa"];
  const page = await excelCatalogFallbackService.listDishes({
    limit: 50,
    sort: "quality",
    foodKeywords: keywords,
  });
  assert.ok(page.items.length > 0);
  assert.ok(
    page.items.every((item) =>
      keywords.some((keyword) => item.name.toLowerCase().includes(keyword)),
    ),
  );
});

test("SEARCH-V1: the offline copy never shows a Grab, foodpanda or Deliveroo photo", async () => {
  const isDeliveryApp = (url: string | undefined) =>
    Boolean(url && /grab\.com|foodpanda\.|deliveroo\./i.test(url));
  const dishes = listExcelDishes();
  const venues = listExcelVenues();
  const repositoryUrls = [
    ...dishes.flatMap((dish) => [dish.imageUrl, ...(dish.gallery ?? [])]),
    ...venues.flatMap((venue) => [venue.imageUrl, venue.logoUrl]),
  ];
  assert.deepEqual(repositoryUrls.filter(isDeliveryApp), []);

  const [dishPage, venuePage] = await Promise.all([
    excelCatalogFallbackService.listDishes({ limit: 50, sort: "quality" }),
    excelCatalogFallbackService.listVenues({ limit: 50, sort: "quality" }),
  ]);
  const details = await Promise.all(
    dishPage.items.slice(0, 20).map((item) => excelCatalogFallbackService.getDish(item.id)),
  );
  const fallbackUrls = [
    ...dishPage.items.map((item) => item.imageUrl),
    ...venuePage.items.flatMap((item) => [item.imageUrl, item.representativeDish?.imageUrl]),
    ...details.flatMap((detail) => [detail.imageUrl, ...detail.media.map((media) => media.url)]),
  ];
  assert.deepEqual(fallbackUrls.filter(isDeliveryApp), []);
});

const singapore = { latitude: 1.3, longitude: 103.85 };

test("Excel fallback sorts by distance, and an exact name match leads a typed search", async () => {
  const nearby = await excelCatalogFallbackService.listDishes({
    limit: 50,
    sort: "nearby",
    coordinate: singapore,
  });
  const distances = nearby.items.map((item) => item.distanceMeters ?? Number.MAX_SAFE_INTEGER);
  assert.deepEqual(
    distances,
    [...distances].sort((a, b) => a - b),
  );
  const stalls = await excelCatalogFallbackService.listVenues({
    limit: 50,
    sort: "nearby",
    coordinate: singapore,
  });
  const stallDistances = stalls.items.map((item) => item.distanceMeters ?? Number.MAX_SAFE_INTEGER);
  assert.deepEqual(
    stallDistances,
    [...stallDistances].sort((a, b) => a - b),
  );

  const sample = (await excelCatalogFallbackService.listDishes({ limit: 1, sort: "quality" }))
    .items[0];
  assert.ok(sample);
  const typed = await excelCatalogFallbackService.listDishes({
    limit: 50,
    sort: "relevance",
    query: `  ${sample.name.toUpperCase()} `,
    coordinate: singapore,
  });
  assert.equal(typed.items[0]?.name.toLowerCase(), sample.name.toLowerCase());
});

test("Excel fallback honours radius, price, open, building type, cuisine and dietary filters", async () => {
  const tight = await excelCatalogFallbackService.listDishes({
    limit: 50,
    sort: "quality",
    coordinate: singapore,
    radiusMeters: 1,
  });
  assert.ok(
    tight.items.every((item) => item.distanceMeters === undefined || item.distanceMeters <= 1),
  );
  const cheap = await excelCatalogFallbackService.listDishes({
    limit: 50,
    sort: "quality",
    maxPrice: 3,
  });
  assert.ok(cheap.items.every((item) => (item.price ?? 0) <= 3));
  const [everyStall, budgetStalls] = await Promise.all([
    excelCatalogFallbackService.listVenues({ limit: 50, sort: "quality" }),
    excelCatalogFallbackService.listVenues({ limit: 50, sort: "quality", maxPrice: 3 }),
  ]);
  assert.ok(budgetStalls.totals.venues > 0);
  assert.ok(
    budgetStalls.totals.venues < everyStall.totals.venues,
    "only stalls with a dish at or under the price are kept",
  );

  const open = await excelCatalogFallbackService.listDishes({
    limit: 50,
    sort: "quality",
    openOnly: true,
  });
  assert.ok(open.items.every((item) => item.isOpen !== false));
  const openStalls = await excelCatalogFallbackService.listVenues({
    limit: 50,
    sort: "quality",
    openOnly: true,
  });
  assert.ok(openStalls.items.every((item) => item.isOpen !== false));

  for (const list of [
    excelCatalogFallbackService.listDishes,
    excelCatalogFallbackService.listVenues,
  ]) {
    const none = await list({
      limit: 50,
      sort: "quality",
      buildingTypes: ["no-such-building-type"],
    });
    assert.equal(none.items.length, 0);
    const noCuisine = await list({ limit: 50, sort: "quality", cuisineTags: ["zz-no-cuisine"] });
    assert.equal(noCuisine.items.length, 0);
    const noDiet = await list({ limit: 50, sort: "quality", dietaryFlags: ["zz-no-flag"] });
    assert.equal(noDiet.items.length, 0);
    const noKeyword = await list({ limit: 50, sort: "quality", foodKeywords: ["zzzz-no-food"] });
    assert.equal(noKeyword.items.length, 0);
    const blankKeyword = await list({ limit: 1, sort: "quality", foodKeywords: ["  "] });
    assert.equal(blankKeyword.items.length, 1, "a blank keyword filters nothing");
  }
});

test("Excel fallback refuses an online or malformed cursor, and unknown ids", async () => {
  await assert.rejects(
    excelCatalogFallbackService.listDishes({ cursor: "rpc:abc" }),
    /online catalog cursor/,
  );
  await assert.rejects(
    excelCatalogFallbackService.listVenues({ cursor: "excel:-4" }),
    /cursor is invalid/,
  );
  const clamped = await excelCatalogFallbackService.listDishes({ limit: 500 });
  assert.equal(clamped.items.length, 50, "a page is at most 50");
  await assert.rejects(excelCatalogFallbackService.getDish("no-such-dish"), /Dish not found/);
  await assert.rejects(excelCatalogFallbackService.getVenue("no-such-venue"), /Venue not found/);
});
