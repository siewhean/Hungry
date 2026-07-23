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

test("Excel fallback pagination has three distinct release-bound pages", async () => {
  const firstPage = await excelCatalogFallbackService.listVenues({ limit: 12, sort: "quality" });
  assert.ok(firstPage.nextCursor);
  const secondPage = await excelCatalogFallbackService.listVenues({
    cursor: firstPage.nextCursor,
    limit: 12,
    releaseId: firstPage.releaseId,
    sort: "quality",
  });
  assert.ok(secondPage.nextCursor);
  const thirdPage = await excelCatalogFallbackService.listVenues({
    cursor: secondPage.nextCursor,
    limit: 12,
    releaseId: secondPage.releaseId,
    sort: "quality",
  });

  const ids = [firstPage, secondPage, thirdPage].flatMap((page) =>
    page.items.map((item) => item.id),
  );
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(thirdPage.items.length > 0);
  assert.ok(
    [firstPage, secondPage, thirdPage].every((page) => page.releaseId === firstPage.releaseId),
  );
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
