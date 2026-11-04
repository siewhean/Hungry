// Dish page "How it tastes": the diner averages come from one RPC, turned into per-axis
// averages and rater counts; a failed read throws so the page can report it.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let service: typeof import("./supabaseService").supabaseService;

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

test("getDishTasteRatingSummary maps each axis row to an average and a rater count", async () => {
  fake.rpc.get_dish_taste_rating_summary = () => ({
    data: [
      { axis: "spicy", average: 7.5, rater_count: 12 },
      { axis: "sweet", average: "2", rater_count: "4" },
    ],
  });
  const summary = await service.discovery.getDishTasteRatingSummary("dish-1");
  assert.deepEqual(summary, {
    spicy: { average: 7.5, raters: 12 },
    sweet: { average: 2, raters: 4 },
  });
  assert.deepEqual(fake.rpcCalls[0]?.args, { p_dish_id: "dish-1" });
});

test("getDishTasteRatingSummary skips unknown axes and rows with no numbers", async () => {
  fake.rpc.get_dish_taste_rating_summary = () => ({
    data: [
      { axis: "umami", average: 5, rater_count: 9 },
      { axis: "sour", average: null, rater_count: 3 },
      { axis: "salty", average: 4, rater_count: null },
      { axis: "rich", average: 6, rater_count: 5 },
    ],
  });
  assert.deepEqual(await service.discovery.getDishTasteRatingSummary("dish-1"), {
    rich: { average: 6, raters: 5 },
  });
});

test("getDishTasteRatingSummary gives nothing for a dish with no ratings or no id", async () => {
  fake.rpc.get_dish_taste_rating_summary = () => ({ data: [] });
  assert.deepEqual(await service.discovery.getDishTasteRatingSummary("dish-1"), {});
  fake.rpcCalls.length = 0;
  assert.deepEqual(await service.discovery.getDishTasteRatingSummary(""), {});
  assert.equal(fake.rpcCalls.length, 0, "no id, no read");
});

test("getDishTasteRatingSummary throws a failed read instead of hiding it", async () => {
  fake.rpc.get_dish_taste_rating_summary = () => ({ error: { message: "taste down" } });
  await assert.rejects(
    service.discovery.getDishTasteRatingSummary("dish-1"),
    (error: { message?: string }) => /taste down/.test(error.message ?? ""),
  );
});
