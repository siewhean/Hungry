// Saved dishes load in a few batched reads (SAVED4-3), against the real Supabase service with a
// fake client: names/photos/prices from get_item_details, each dish's stall and rating from one
// table read per 200, the stalls' places from get_venue_summaries per 50. Never one per dish.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";

let service: typeof import("./supabaseService").supabaseService;
let repository: typeof import("./supabaseRepository");

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
  repository = await import("./supabaseRepository");
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  auth.userId = ME;
});

/** Wires the three reads for ids `dish-0 … dish-(n-1)`, spread over `stalls` stalls. */
function wireReads(count: number, stalls = 120) {
  fake.rpc.get_item_details = (args) => ({
    data: (args.p_dish_ids as string[]).map((dishId) => ({
      dish_id: dishId,
      stall_id: null,
      name: `Name ${dishId}`,
      stall_name: `Stall of ${dishId}`,
      price: "4.50",
      image_url: `https://img.example/${dishId}.jpg`,
    })),
    error: null,
  });
  fake.tables.dishes = (call) => {
    const ids = (call.ops.find(([op]) => op === "in")?.[1][1] ?? []) as string[];
    return {
      data: ids.map((id) => {
        const index = Number(id.replace("dish-", ""));
        return {
          id,
          venue_id: `venue-${index % stalls}`,
          rating_avg: index % 2 === 0 ? 4.5 : 0,
          review_count: index % 2 === 0 ? 10 : 0,
        };
      }),
      error: null,
    };
  };
  fake.rpc.get_venue_summaries = (args) => ({
    data: (args.p_venue_ids as string[]).map((venueId) => ({
      venue_id: venueId,
      building_id: "b1",
      name: `Venue ${venueId}`,
      unit_number: "#01-02",
      is_open: true,
      building: {
        name: "Maxwell Food Centre",
        address: "1 Kadayanallur Street",
        postalCode: "069184",
        latitude: 1.28,
        longitude: 103.84,
      },
      latitude: null,
      longitude: null,
    })),
    error: null,
  });
  return Array.from({ length: count }, (_, index) => `dish-${index}`);
}

test("450 saved dishes take 3 + 3 + 3 batched reads and come back as full cards", async () => {
  const ids = wireReads(450);
  const cards = await service.discovery.getSavedDishCards(ids);

  assert.equal(cards.length, 450);
  assert.equal(fake.callsTo("get_item_details").length, 3);
  assert.equal(fake.queriesOn("dishes").length, 3);
  // 120 stalls at 50 per call.
  assert.deepEqual(
    fake.callsTo("get_venue_summaries").map((call) => (call.args.p_venue_ids as string[]).length),
    [50, 50, 20],
  );
  // Nothing asks for one dish or one stall at a time.
  assert.equal(fake.callsTo("get_dish_detail").length, 0);
  assert.equal(fake.callsTo("catalog_raw_dish_detail").length, 0);

  const first = cards.find((card) => card.id === "dish-0");
  assert.equal(first?.name, "Name dish-0");
  assert.equal(first?.price, 4.5);
  assert.equal(first?.venueId, "venue-0");
  assert.equal(first?.venueName, "Stall of dish-0");
  assert.equal(first?.unitNumber, "#01-02");
  assert.equal(first?.buildingName, "Maxwell Food Centre");
  assert.equal(first?.address, "1 Kadayanallur Street");
  assert.equal(first?.postalCode, "069184");
  assert.equal(first?.rating, 4.5);
  assert.equal(first?.reviewCount, 10);
  // The stall has no point of its own, so the building's is used for distance.
  assert.equal(first?.latitude, 1.28);
  assert.equal(first?.longitude, 103.84);
  // A dish with no reviews carries no rating.
  assert.equal(cards.find((card) => card.id === "dish-1")?.rating, undefined);
});

test("a dish that is gone is left out, and no ids make no calls", async () => {
  const ids = wireReads(3);
  fake.tables.dishes = () => ({
    data: [{ id: "dish-0", venue_id: "venue-0", rating_avg: 0, review_count: 0 }],
    error: null,
  });
  const cards = await service.discovery.getSavedDishCards(ids);
  assert.deepEqual(
    cards.map((card) => card.id),
    ["dish-0"],
  );

  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  assert.deepEqual(await service.discovery.getSavedDishCards([]), []);
  assert.equal(fake.rpcCalls.length + fake.queries.length, 0);
});

test("any failed read fails the whole load, so the page shows Retry instead of a short list", async () => {
  const ids = wireReads(10);
  fake.rpc.get_venue_summaries = () => ({ data: null, error: { message: "timeout" } });
  await assert.rejects(() => service.discovery.getSavedDishCards(ids), /Couldn't load/);

  wireReads(10);
  fake.tables.dishes = () => ({ data: null, error: { message: "permission denied" } });
  assert.equal(await repository.getSavedDishCardsViaRpc(ids), undefined);

  wireReads(10);
  fake.rpc.get_item_details = () => ({ data: null, error: { message: "timeout" } });
  assert.equal(await repository.getSavedDishCardsViaRpc(ids), undefined);
});

test("saved ids are read newest save first", async () => {
  fake.tables.user_favourite_dishes = () => ({
    data: [{ dish_id: "newest" }, { dish_id: "older" }],
    error: null,
  });
  assert.deepEqual(await service.profile.getFavouriteDishIds(), ["newest", "older"]);
  const ops = fake.queriesOn("user_favourite_dishes")[0]?.ops ?? [];
  assert.deepEqual(
    ops.find(([op]) => op === "order"),
    ["order", ["created_at", { ascending: false }]],
  );
});
