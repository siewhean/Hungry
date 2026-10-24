// profile.addFavourites against a fake Supabase client: one multi-row write (ONB-4 / ONB-V6).

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
  fake.queries.length = 0;
  fake.tables = {};
  auth.userId = ME;
});

test("addFavourites writes every dish in one idempotent upsert", async () => {
  await service.profile.addFavourites(["dish-1", "dish-2", "dish-1"], ME);
  const queries = fake.queriesOn("user_favourite_dishes");
  assert.equal(queries.length, 1);
  const [op, [rows, options]] = queries[0].ops[0] as [string, [unknown, unknown]];
  assert.equal(op, "upsert");
  assert.deepEqual(rows, [
    { user_id: ME, dish_id: "dish-1" },
    { user_id: ME, dish_id: "dish-2" },
  ]);
  assert.deepEqual(options, { onConflict: "user_id,dish_id", ignoreDuplicates: true });
});

test("addFavourites refuses another account and writes nothing for no dishes", async () => {
  await assert.rejects(service.profile.addFavourites(["dish-1"], "someone-else"), /Account changed/);
  await service.profile.addFavourites([]);
  assert.equal(fake.queriesOn("user_favourite_dishes").length, 0);
});
