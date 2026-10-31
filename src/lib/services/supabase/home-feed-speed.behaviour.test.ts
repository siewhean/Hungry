// Home's feed read against the real Supabase service with a fake client: the follow-up reads
// (taste vectors, paused stalls) go out together, not one after the other.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

type ServiceModule = typeof import("./supabaseService");
let service: ServiceModule["supabaseService"];

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
});

test("the paused-stall read is already out while the taste read is still waiting", async () => {
  fake.rpc.get_discovery_feed_by_location = () => ({
    data: [
      {
        venue_id: "venue-1",
        building_id: "b1",
        venue_name: "Ah Seng",
        is_open: true,
        top_dish_id: "dish-1",
        top_dish_name: "Laksa",
        top_dish_price: 4.5,
        top_dish_dietary_flags: [],
      },
    ],
    error: null,
  });
  let closuresAsked!: () => void;
  const closuresSeen = new Promise<void>((resolve) => {
    closuresAsked = resolve;
  });
  fake.rpc.get_venue_closures = () => {
    closuresAsked();
    return { data: [], error: null };
  };
  let closuresAskedBeforeTasteAnswered = false;
  fake.tables.dish_taste_vectors = async () => {
    // A sequential read would never reach get_venue_closures while this waits.
    closuresAskedBeforeTasteAnswered = await Promise.race([
      closuresSeen.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);
    return { data: [], error: null };
  };

  const feed = await service.discovery.listDiscoveryFeedByLocation({ areaName: "Tampines" });
  assert.equal(feed?.venues.length, 1);
  assert.equal(closuresAskedBeforeTasteAnswered, true);
  assert.equal(fake.callsTo("get_venue_closures").length, 1, "still one call for the whole page");
});
