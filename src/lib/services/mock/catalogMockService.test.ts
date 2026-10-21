import assert from "node:assert/strict";
import test from "node:test";

import { CatalogAccessError } from "@/lib/services/catalog";
import { getCatalogRawService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { createLocalCatalogService } from "./catalogMockService";
import { buildings, dishes, venues } from "./data";
import { dataRepositoryMock } from "./repositories";

const catalog = createLocalCatalogService(dataRepositoryMock);
const maxwell = buildings.find((building) => building.name === "Maxwell Food Centre")!;

test("mock mode serves the catalog contract instead of a null service", () => {
  setMockServiceProvider();
  const service = getCatalogRawService();
  assert.ok(service);
  assert.equal(typeof service.listDishes, "function");
  assert.equal(getCatalogRawService(), service, "one local catalog per provider");
});

test("local catalog pages dishes with a cursor and stable totals", async () => {
  const first = await catalog.listDishes({ limit: 2, sort: "quality" });
  assert.equal(first.items.length, 2);
  assert.equal(first.totals.dishes > 0, true);
  assert.ok(first.nextCursor);
  const second = await catalog.listDishes({ limit: 2, sort: "quality", cursor: first.nextCursor });
  assert.equal(
    second.items.some((item) => first.items.some((seen) => seen.id === item.id)),
    false,
  );
  assert.ok((first.items[0].rating ?? 0) >= (first.items[1].rating ?? 0));
});

test("local catalog filters by query, cuisine tag and halal like the RPCs", async () => {
  const laksa = await catalog.listDishes({ query: "laksa" });
  assert.ok(laksa.items.length > 0);
  assert.ok(
    laksa.items.every(
      (item) =>
        /laksa/i.test(`${item.name} ${item.venueName}`) ||
        item.cuisineTags.includes("laksa") ||
        /laksa/i.test(item.description ?? ""),
    ),
  );

  const halal = await catalog.listDishes({ dietaryFlags: ["halal"], limit: 50 });
  assert.ok(halal.items.every((item) => item.dietaryFlags.includes("halal")));

  const none = await catalog.listDishes({ query: "no dish is called this" });
  assert.deepEqual(none.items, []);
  assert.equal(none.nextCursor, undefined);
});

test("local catalog sorts stalls nearest first and limits to the radius", async () => {
  const page = await catalog.listVenues({
    coordinate: maxwell.coordinate,
    radiusMeters: 300,
    sort: "nearby",
    limit: 50,
  });
  assert.ok(page.items.length > 0);
  assert.ok(page.items.every((venue) => (venue.distanceMeters ?? Infinity) <= 300));
  const distances = page.items.map((venue) => venue.distanceMeters ?? 0);
  assert.deepEqual(
    distances,
    [...distances].sort((left, right) => left - right),
  );
});

test("local catalog map clusters a building when zoomed out and splits stalls when zoomed in", async () => {
  const bounds = {
    minLatitude: maxwell.coordinate.latitude - 0.01,
    maxLatitude: maxwell.coordinate.latitude + 0.01,
    minLongitude: maxwell.coordinate.longitude - 0.01,
    maxLongitude: maxwell.coordinate.longitude + 0.01,
  };
  const maxwellVenueCount = venues.filter((venue) => venue.buildingId === maxwell.id).length;
  const zoomedOut = await catalog.getMapViewport({ ...bounds, zoom: 14 });
  const zoomedIn = await catalog.getMapViewport({ ...bounds, zoom: 17 });

  assert.ok(maxwellVenueCount > 1, "fixture needs a multi-stall building");
  assert.ok(
    zoomedOut.items.some((item) => item.kind === "cluster" && item.count === maxwellVenueCount),
  );
  assert.ok(zoomedIn.items.every((item) => item.kind === "venue"));
  assert.ok(zoomedIn.items.length >= maxwellVenueCount);
});

test("local catalog detail reads match the list cards and unknown ids fail cleanly", async () => {
  const dish = dishes[0];
  const detail = await catalog.getDish(dish.id);
  assert.equal(detail.name, dish.name);
  assert.equal(detail.media[0]?.url, dish.imageUrl);

  const venue = await catalog.getVenue(dish.venueId);
  assert.equal(venue.id, dish.venueId);
  const menu = await catalog.listVenueMenu(dish.venueId);
  assert.ok(menu.items.some((item) => item.id === dish.id));

  await assert.rejects(() => catalog.getDish("missing-dish"), CatalogAccessError);
  await assert.rejects(() => catalog.getVenue("missing-venue"), CatalogAccessError);
});

test("local catalog finds dishes and stalls by their building name (r2 H23)", async () => {
  const dishesThere = await catalog.listDishes({ query: "Maxwell", limit: 50 });
  assert.ok(dishesThere.items.some((item) => item.buildingName === maxwell.name));
  const stallsThere = await catalog.listVenues({ query: "Maxwell", limit: 50 });
  assert.ok(stallsThere.items.length > 0);
  assert.ok(
    stallsThere.items.every(
      (item) => item.buildingName === maxwell.name || /maxwell/i.test(item.name),
    ),
  );
});

test("local catalog suggests places and stalls by word start, food types when empty (r2 H24)", async () => {
  const suggestions = await catalog.suggest("max");
  assert.ok(suggestions.length > 0 && suggestions.length <= 8);
  assert.deepEqual(suggestions[0], { kind: "place", label: maxwell.name });
  const wordStart = await catalog.suggest("food cen");
  assert.ok(wordStart.some((item) => item.kind === "place" && item.label === maxwell.name));
  const midWord = await catalog.suggest("axwell");
  assert.equal(
    midWord.some((item) => item.label === maxwell.name),
    false,
  );
  const empty = await catalog.suggest("m");
  assert.ok(empty.every((item) => item.kind === "food_type"));
});
