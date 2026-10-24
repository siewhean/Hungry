// Saved and Lists service methods against a fake Supabase client: the calls they make.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";

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
  auth.userId = ME;
});

const opsOn = (table: string) => fake.queriesOn(table).map((query) => query.ops.map(([op]) => op));

test("SAVED-8: setFavourite(false) only deletes; it never reads first or upserts", async () => {
  // A read that would say "saved" (or fail) must not matter any more.
  fake.tables.user_favourite_dishes = () => ({ data: null, error: null });
  assert.equal(await service.profile.setFavourite("dish-1", false), false);
  const ops = opsOn("user_favourite_dishes");
  assert.equal(ops.length, 1);
  assert.equal(ops[0][0], "delete");
  assert.ok(!ops.flat().includes("select"));
  assert.ok(!ops.flat().includes("upsert"));
});

test("SAVED-8: setFavourite(true) is one idempotent upsert, and checks the account", async () => {
  assert.equal(await service.profile.setFavourite("dish-1", true, ME), true);
  const ops = opsOn("user_favourite_dishes");
  assert.deepEqual(ops, [["upsert"]]);

  await assert.rejects(
    service.profile.setFavourite("dish-1", true, "someone-else"),
    /Account changed/,
  );
  auth.userId = null;
  await assert.rejects(service.profile.setFavourite("dish-1", true), /signed in/);
});

test("SAVED-7: items for three lists come from one portfolio_items read", async () => {
  fake.tables.portfolio_items = () => ({
    data: [
      { id: "i1", portfolio_id: "p1", item_type: "dish", dish_id: "d1", position: 0 },
      { id: "i2", portfolio_id: "p3", item_type: "stall", stall_id: "s1", position: 0 },
    ],
    error: null,
  });
  fake.rpc.get_portfolio_private_notes = () => ({ data: [], error: null });
  const byList = await service.portfolio.getPortfolioItemsForPortfolios(["p1", "p2", "p3", "p1"]);
  const reads = fake.queriesOn("portfolio_items");
  assert.equal(reads.length, 1);
  const inOp = reads[0].ops.find(([op]) => op === "in");
  assert.deepEqual(inOp?.[1], ["portfolio_id", ["p1", "p2", "p3"]]);
  assert.deepEqual(Object.keys(byList).sort(), ["p1", "p2", "p3"]);
  assert.equal(byList.p1[0].dishId, "d1");
  assert.deepEqual(byList.p2, []);
  assert.equal(byList.p3[0].stallId, "s1");
});

test("getPortfolioItemsForPortfolios with no ids makes no call", async () => {
  assert.deepEqual(await service.portfolio.getPortfolioItemsForPortfolios([]), {});
  assert.equal(fake.queries.length, 0);
});
