// Merchant round-five Performance chart against the real Supabase service with a fake client:
// the previous-period series is one more call for the same number of days, ending where the
// current range starts.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const OUTLET = "44444444-4444-4444-8444-444444444444";

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
  fake.rpc = { get_merchant_daily_series: () => ({ data: [], error: null }) };
  fake.tables = {
    merchant_outlets: () => ({
      data: {
        id: OUTLET,
        merchant_account_id: ACCOUNT,
        venue_id: "venue-1",
        building_id: "building-1",
        name: "Uncle Tan",
        business_type: "hawker_stall",
        is_live: true,
      },
      error: null,
    }),
  };
  auth.userId = ME;
});

const DAY_MS = 86_400_000;

test("R5-7: the previous period ends where this one starts and is as long", async () => {
  for (const [range, days] of [
    ["7d", 7],
    ["30d", 30],
  ] as const) {
    fake.rpcCalls.length = 0;
    await service.merchant.getDailySeries(OUTLET, range);
    await service.merchant.getDailySeries(OUTLET, range, "previous");
    const [current, previous] = fake.callsTo("get_merchant_daily_series").map((call) => call.args);
    assert.equal(previous.p_until, current.p_since, `${range}: the two periods touch`);
    const length =
      (new Date(String(previous.p_until)).getTime() -
        new Date(String(previous.p_since)).getTime()) /
      DAY_MS;
    assert.equal(Math.round(length), days);
    // The database refuses a range over 31 days, so a 30-day comparison must fit.
    assert.ok(length <= 31);
    assert.match(String(previous.p_since), /T16:00:00\.000Z$/, "whole Singapore days");
  }
});

test("R5-7: asking for the current period is the same call as before", async () => {
  await service.merchant.getDailySeries(OUTLET, "7d");
  await service.merchant.getDailySeries(OUTLET, "7d", "current");
  const [first, second] = fake.callsTo("get_merchant_daily_series").map((call) => call.args);
  assert.deepEqual(first, second);
  assert.equal(first.p_until, null);
});
