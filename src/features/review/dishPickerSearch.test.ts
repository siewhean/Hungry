import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  getServiceProvider,
  setServiceProvider,
  type ServiceProvider,
} from "@/lib/services/serviceProvider";
import { PICKER_MIN_QUERY_LENGTH, searchServerPickerRows } from "./dishPickerSearch";
import { pickerRowSubtitle } from "./dishPicker";

const original = getServiceProvider();
afterEach(() => setServiceProvider(original));

function withDiscovery(discovery: Partial<ServiceProvider["service"]["discovery"]>) {
  setServiceProvider({
    ...original,
    service: { ...original.service, discovery: { ...original.service.discovery, ...discovery } },
  });
}

const venue = {
  id: "v1",
  buildingId: "b1",
  buildingName: "Maxwell Food Centre",
  name: "Tian Tian",
  unitNumber: "#01-10",
  floor: "1",
  isOpen: true,
  topDishId: "",
  operatingHours: "",
  deliveryLinks: [],
  logoUrl: "https://example.com/logo.png",
};

test("a search shorter than the minimum is never sent", async () => {
  let calls = 0;
  withDiscovery({
    searchVenuesByLocation: async () => {
      calls += 1;
      return [];
    },
  });
  const rows = await searchServerPickerRows({ query: "a".repeat(PICKER_MIN_QUERY_LENGTH - 1) });
  assert.deepEqual(rows, []);
  assert.equal(calls, 0);
});

test("stalls and dishes from the server carry their building, thumbnail and distance", async () => {
  withDiscovery({
    searchVenuesByLocation: async () => [venue],
    searchDishes: async () =>
      [
        {
          score: 1,
          dish: {
            id: "d1",
            name: "Chicken Rice",
            venueId: "v1",
            venueName: "Tian Tian",
            buildingId: "b1",
            imageUrl: "https://example.com/rice.jpg",
          },
        },
      ] as never,
  });
  const rows = await searchServerPickerRows({
    query: "chicken",
    origin: { latitude: 1.28, longitude: 103.845 },
    buildingCoordinates: new Map([["b1", { latitude: 1.2801, longitude: 103.8451 }]]),
  });
  assert.deepEqual(
    rows.map((row) => row.key),
    ["venue:v1", "dish:d1"],
  );
  assert.equal(rows[0].kind === "venue" && rows[0].venue.imageUrl, venue.logoUrl);
  assert.match(pickerRowSubtitle(rows[0]), /^Maxwell Food Centre · #01-10 · \d+ m$/);
  assert.match(pickerRowSubtitle(rows[1]), /^Tian Tian · Maxwell Food Centre · \d+ m$/);
});

test("a failed server search throws so the caller can use the cached catalog", async () => {
  withDiscovery({
    searchVenuesByLocation: async () => {
      throw new Error("offline");
    },
  });
  await assert.rejects(searchServerPickerRows({ query: "laksa" }), /offline/);
});
