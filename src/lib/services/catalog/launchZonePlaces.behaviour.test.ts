// The launch zone list (Jurong West Hawker Centre, Pioneer Mall, Block 651): the service asks the
// get_launch_zone_places RPC, maps its rows to places in the server's order, keeps one copy for
// ten minutes, and an empty or malformed answer is an empty list.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let service: typeof import("./index").catalogRawService;

before(async () => {
  const { setConfiguredDataSource } = await import("@/lib/services/supabase/client");
  setConfiguredDataSource("supabase");
  service = (await import("./index")).catalogRawService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.rpc = {};
  service.clearCache();
});

const ROWS = [
  {
    id: "bld-hawker",
    slug: "jurong-west-hawker-centre",
    name: "Jurong West Hawker Centre",
    building_type: "hawker_centre",
    venue_count: 45,
    latitude: 1.3412,
    longitude: 103.6972,
  },
  {
    id: "bld-pioneer",
    slug: "pioneer-mall",
    name: "Pioneer Mall",
    building_type: "mall",
    venue_count: 25,
    latitude: 1.342,
    longitude: 103.6976,
  },
  { id: "bld-651", slug: "block-651", name: "Block 651", venue_count: 16 },
];

test("the zone list maps the server's rows to places, in order", async () => {
  fake.rpc.get_launch_zone_places = () => ({ data: ROWS, error: null });
  const places = await service.listLaunchZonePlaces();
  assert.deepEqual(
    places.map((place) => [place.id, place.name, place.venueCount]),
    [
      ["bld-hawker", "Jurong West Hawker Centre", 45],
      ["bld-pioneer", "Pioneer Mall", 25],
      ["bld-651", "Block 651", 16],
    ],
  );
  assert.equal(places[0].buildingType, "hawker_centre");
  assert.equal(places[0].latitude, 1.3412);
  assert.equal(places[2].buildingType, undefined);
  assert.equal(fake.callsTo("get_launch_zone_places").length, 1);
});

test("a second read inside ten minutes does not ask the server again", async () => {
  fake.rpc.get_launch_zone_places = () => ({ data: ROWS, error: null });
  await service.listLaunchZonePlaces();
  await service.listLaunchZonePlaces();
  assert.equal(fake.callsTo("get_launch_zone_places").length, 1);
});

test("rows without an id or a name are dropped and a non-list answer is an empty list", async () => {
  fake.rpc.get_launch_zone_places = () => ({
    data: [{ name: "No id" }, { id: "x" }, ROWS[1]],
    error: null,
  });
  assert.deepEqual(
    (await service.listLaunchZonePlaces()).map((place) => place.id),
    ["bld-pioneer"],
  );
  service.clearCache();
  fake.rpc.get_launch_zone_places = () => ({ data: null, error: null });
  assert.deepEqual(await service.listLaunchZonePlaces(), []);
});
