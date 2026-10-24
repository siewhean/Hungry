import assert from "node:assert/strict";
import test from "node:test";

import { isUsableDiscoverImageUrl } from "@/features/discover/bites";
import { excelCatalogFallbackService } from "@/lib/services/catalog/excelFallback";
import { getExcelCatalogMetadata } from "@/lib/services/excel/repositories";

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
