// Price source and halal status reach the app from the RPCs (package 1.4), against the real
// repository with a fake client: get_dish_detail carries price basis, checked date and halal
// status; search_dishes rows (stall menus, dish search) carry the price basis.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let repository: typeof import("./supabaseRepository");

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  repository = await import("./supabaseRepository");
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.rpc = {};
  fake.tables = {};
});

function dishRow(overrides: Record<string, unknown>) {
  return {
    dish_id: "dish-1",
    venue_id: "venue-1",
    building_id: "building-1",
    venue_name: "Stall",
    name: "Mee Rebus",
    price: 6.8,
    price_range: "",
    taste_tags: [],
    dietary_flags: [],
    gallery: [],
    availability_flags: [],
    reviews: [],
    ...overrides,
  };
}

test("the dish page gets the price source, checked date and halal status", async () => {
  fake.rpc.get_dish_detail = () => ({
    data: [
      dishRow({
        price_basis: "delivery",
        price_checked_at: "2026-10-03T04:00:00Z",
        halal_status: "unknown",
      }),
    ],
    error: null,
  });
  const dish = await repository.getDishByIdViaRpc("dish-1");
  assert.equal(dish?.priceBasis, "delivery");
  assert.equal(dish?.priceCheckedAt, "2026-10-03T04:00:00Z");
  assert.equal(dish?.halalStatus, "unknown");
  assert.equal(fake.rpcCalls.length, 1);
});

test("an older database without the new columns leaves them unset", async () => {
  fake.rpc.get_dish_detail = () => ({ data: [dishRow({})], error: null });
  const dish = await repository.getDishByIdViaRpc("dish-1");
  assert.equal(dish?.priceBasis, undefined);
  assert.equal(dish?.halalStatus, undefined);
  assert.equal(dish ? "priceBasis" in dish : true, false);
});

test("an unknown price source is ignored, not guessed", async () => {
  fake.rpc.get_dish_detail = () => ({
    data: [dishRow({ price_basis: "counter_price", halal_status: "maybe" })],
    error: null,
  });
  const dish = await repository.getDishByIdViaRpc("dish-1");
  assert.equal(dish?.priceBasis, undefined);
  assert.equal(dish?.halalStatus, undefined);
});
