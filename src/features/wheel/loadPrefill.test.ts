import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { loadWheelPrefill } from "./loadPrefill";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { DishDetail, SearchFilters, TasteVector } from "@/types/domain";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const discovery = getHungryService().discovery;
const originals = {
  searchDishes: discovery.searchDishes,
  getVenuesByIds: discovery.getVenuesByIds,
};
afterEach(() => Object.assign(discovery, originals));

function dish(id: string, venueId: string, distanceMeters: number): DishDetail {
  return {
    id,
    venueId,
    buildingId: "b",
    venueName: `Stall ${venueId}`,
    name: id,
    imageUrl: "",
    distanceMeters,
    rating: 4,
  } as DishDetail;
}

test("the search is from the diner, within 1.5 km, with their dietary needs, and hours are read once", async () => {
  const searches: SearchFilters[] = [];
  const hourReads: string[][] = [];
  discovery.searchDishes = (async (filters: SearchFilters) => {
    searches.push(filters);
    return [dish("d1", "v1", 200), dish("d2", "v2", 300), dish("d3", "v3", 9000)].map((item) => ({
      dish: item,
      score: 1,
    }));
  }) as typeof discovery.searchDishes;
  discovery.getVenuesByIds = (async (ids: string[]) => {
    hourReads.push(ids);
    return ids.map((id) => ({
      id,
      buildingId: "b",
      name: `Venue ${id}`,
      unitNumber: "",
      floor: "",
      isOpen: true,
      topDishId: "",
      operatingHours: "Daily 12am-11:59pm",
      deliveryLinks: [],
    }));
  }) as typeof discovery.getVenuesByIds;

  const stalls = await loadWheelPrefill({
    origin: { latitude: 1.3, longitude: 103.8 },
    dietaryFlags: ["halal"],
    tasteVector: NEUTRAL,
  });

  assert.equal(searches.length, 1);
  assert.equal(searches[0].radius, 1500);
  assert.deepEqual(searches[0].dietaryFlags, ["halal"]);
  assert.equal(searches[0].latitude, 1.3);
  assert.deepEqual(hourReads, [["v1", "v2"]], "a dish beyond the radius is not asked about");
  assert.deepEqual(
    stalls.map((stall) => stall.label),
    ["Venue v1", "Venue v2"],
  );
});

test("a failed hours read rejects, so the lobby can report it instead of showing a wrong wheel", async () => {
  discovery.searchDishes = (async () => [
    { dish: dish("d1", "v1", 100), score: 1 },
  ]) as typeof discovery.searchDishes;
  discovery.getVenuesByIds = (async () => {
    throw new Error("offline");
  }) as typeof discovery.getVenuesByIds;
  await assert.rejects(
    loadWheelPrefill({
      origin: { latitude: 1.3, longitude: 103.8 },
      dietaryFlags: [],
      tasteVector: NEUTRAL,
    }),
    /offline/,
  );
});
