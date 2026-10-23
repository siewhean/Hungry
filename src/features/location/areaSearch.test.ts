import assert from "node:assert/strict";
import test from "node:test";

import type { SingaporeArea } from "@/app/screens/onboarding/singaporeAreas";
import {
  buildAreaSearchResults,
  formatAddress,
  matchAreas,
  nearestAreaName,
  placeTypeLabel,
} from "@/features/location/areaSearch";
import {
  lookupPostalCode,
  parseOneMapAddressResults,
  searchOneMapAddresses,
} from "@/lib/geo/oneMap";

const AREAS: SingaporeArea[] = [
  { id: "bedok", name: "Bedok", coordinate: { latitude: 1.324, longitude: 103.93 } },
  {
    id: "outram",
    name: "Outram",
    keywords: ["outram", "tanjong pagar"],
    coordinate: { latitude: 1.28, longitude: 103.84 },
  },
  { id: "bishan", name: "Bishan", coordinate: { latitude: 1.35, longitude: 103.848 } },
];

const areaFor = (coordinate: { latitude: number; longitude: number }) =>
  nearestAreaName(coordinate, AREAS);

test("areas match by prefix first, then by name or keyword, and need two characters", () => {
  assert.deepEqual(matchAreas("b", AREAS), []);
  assert.deepEqual(
    matchAreas("bi", AREAS).map((area) => area.id),
    ["bishan"],
  );
  assert.deepEqual(
    matchAreas("tanjong", AREAS).map((area) => area.id),
    ["outram"],
  );
});

test("malls and food centres come first and remember the place name", () => {
  const results = buildAreaSearchResults({
    query: "bedok",
    areas: AREAS,
    places: [
      {
        id: "b1",
        name: "Bedok Interchange Hawker Centre",
        buildingType: "hawker_centre",
        venueCount: 40,
        latitude: 1.325,
        longitude: 103.931,
      },
      { id: "no-pin", name: "Unpinned", venueCount: 2 },
    ],
    addresses: [],
    areaForCoordinate: areaFor,
  });
  assert.deepEqual(
    results.map((result) => result.kind),
    ["place", "area"],
  );
  assert.equal(results[0].placeName, "Bedok Interchange Hawker Centre");
  assert.equal(results[0].areaName, "Bedok");
  assert.match(results[0].subtitle, /Hawker centre · Bedok · 40 stalls/);
});

test("an address shows its area, once per area, never the street as the title", () => {
  const results = buildAreaSearchResults({
    query: "bishan st",
    areas: AREAS,
    places: [],
    addresses: [
      {
        postalCode: "570123",
        address: "123 BISHAN STREET 12 SINGAPORE 570123",
        coordinate: { latitude: 1.351, longitude: 103.849 },
      },
      {
        postalCode: "570124",
        address: "124 BISHAN STREET 12 SINGAPORE 570124",
        coordinate: { latitude: 1.352, longitude: 103.849 },
      },
    ],
    areaForCoordinate: areaFor,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Bishan");
  assert.equal(results[0].subtitle, "Near 123 Bishan Street 12 Singapore 570123");
  assert.equal(results[0].placeName, undefined);
});

test("labels and addresses read naturally", () => {
  assert.equal(placeTypeLabel("food_court"), "Food court");
  assert.equal(placeTypeLabel(undefined), "Food place");
  assert.equal(formatAddress("1 KADAYANALLUR ST"), "1 Kadayanallur St");
  assert.equal(nearestAreaName({ latitude: 1.281, longitude: 103.841 }, AREAS), "Outram");
  assert.equal(nearestAreaName({ latitude: 1.3, longitude: 103.8 }, []), "Singapore");
});

test("OneMap address search parses Singapore results and skips short or failed lookups", async () => {
  const body = {
    results: [
      { ADDRESS: "1 MAXWELL ROAD", POSTAL: "069111", LATITUDE: "1.2803", LONGITUDE: "103.8447" },
      { ADDRESS: "SOMEWHERE ELSE", POSTAL: "000000", LATITUDE: "40.7", LONGITUDE: "-74" },
    ],
  };
  const parsed = parseOneMapAddressResults(body);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].address, "1 MAXWELL ROAD");
  assert.deepEqual(parseOneMapAddressResults(null), []);

  let calls = 0;
  const okFetch = (async () => {
    calls += 1;
    return { ok: true, json: async () => body } as Response;
  }) as typeof fetch;
  assert.deepEqual(await searchOneMapAddresses("ab", okFetch), []);
  assert.equal(calls, 0);
  assert.equal((await searchOneMapAddresses("maxwell", okFetch)).length, 1);
  const failedFetch = (async () => ({ ok: false }) as Response) as typeof fetch;
  assert.deepEqual(await searchOneMapAddresses("maxwell", failedFetch), []);
});

test("postal code lookup checks the code, reports an outage and parses a hit", async () => {
  await assert.rejects(() => lookupPostalCode("12"), /6-digit/);
  const down = (async () => ({ ok: false }) as Response) as typeof fetch;
  await assert.rejects(() => lookupPostalCode("069111", down), /unavailable/);
  const up = (async () =>
    ({
      ok: true,
      json: async () => ({
        results: [
          {
            ADDRESS: "1 KADAYANALLUR STREET",
            POSTAL: "069111",
            LATITUDE: "1.2803",
            LONGITUDE: "103.8447",
          },
        ],
      }),
    }) as Response) as typeof fetch;
  const hit = await lookupPostalCode("069111", up);
  assert.equal(hit?.postalCode, "069111");
});
