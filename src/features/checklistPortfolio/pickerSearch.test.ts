import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { searchPickerStalls } from "./pickerSearch";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { DishDetail, VenueSummary } from "@/types/domain";

const discovery = getHungryService().discovery;
const originals = {
  searchDishes: discovery.searchDishes,
  searchVenuesByLocation: discovery.searchVenuesByLocation,
  getVenuesByIds: discovery.getVenuesByIds,
};
afterEach(() => Object.assign(discovery, originals));

const venue = (id: string, name = `Stall ${id}`): VenueSummary => ({
  id,
  buildingId: "b",
  name,
  unitNumber: "01-01",
  floor: "L1",
  isOpen: true,
  topDishId: "",
  operatingHours: "",
  deliveryLinks: [],
});
const dish = (id: string, venueId: string) => ({ id, venueId, name: id }) as DishDetail;

function stub(options: {
  venues: VenueSummary[];
  dishes: DishDetail[] | Error;
  byId?: (ids: string[]) => VenueSummary[];
}) {
  const idReads: string[][] = [];
  discovery.searchVenuesByLocation = (async () =>
    options.venues) as typeof discovery.searchVenuesByLocation;
  discovery.searchDishes = (async () => {
    if (options.dishes instanceof Error) throw options.dishes;
    return options.dishes.map((item) => ({ dish: item, score: 1 }));
  }) as typeof discovery.searchDishes;
  discovery.getVenuesByIds = (async (ids: string[]) => {
    idReads.push(ids);
    return (options.byId ?? ((wanted) => wanted.map((id) => venue(id))))(ids);
  }) as typeof discovery.getVenuesByIds;
  return idReads;
}

test("R5-4 a dish search adds the stalls that serve the dish after the stalls named for it", async () => {
  const reads = stub({
    venues: [venue("named", "Laksa House")],
    dishes: [dish("laksa-1", "serves-a"), dish("laksa-2", "serves-b"), dish("laksa-3", "serves-a")],
  });
  const stalls = await searchPickerStalls("laksa", 30);
  assert.deepEqual(
    stalls.map((item) => item.id),
    ["named", "serves-a", "serves-b"],
  );
  assert.deepEqual(reads, [["serves-a", "serves-b"]], "one batched read, each stall once");
});

test("R5-4 a stall found by name and by dish is listed once, and no read is made when nothing is new", async () => {
  const reads = stub({
    venues: [venue("named", "Laksa House")],
    dishes: [dish("laksa-1", "named")],
  });
  const stalls = await searchPickerStalls("laksa", 30);
  assert.deepEqual(
    stalls.map((item) => item.id),
    ["named"],
  );
  assert.deepEqual(reads, []);
});

test("R5-4 the result is capped at the limit", async () => {
  stub({
    venues: [venue("a"), venue("b")],
    dishes: [dish("d1", "c"), dish("d2", "d")],
  });
  const stalls = await searchPickerStalls("x", 3);
  assert.deepEqual(
    stalls.map((item) => item.id),
    ["a", "b", "c"],
  );
});

test("R5-4 a failed dish search keeps the stalls matched by name", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    stub({ venues: [venue("named")], dishes: new Error("dish search down") });
    const stalls = await searchPickerStalls("laksa", 30);
    assert.deepEqual(
      stalls.map((item) => item.id),
      ["named"],
    );
  } finally {
    console.error = originalConsoleError;
  }
});
