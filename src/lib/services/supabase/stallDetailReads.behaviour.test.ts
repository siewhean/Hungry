// Stall page reads against a fake Supabase client (round-three STALL-7 and STALL-8): the menu
// comes a page at a time and a failed page is an error, and the side reads throw instead of
// hiding a failure behind "nothing there".

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();
const VENUE = "44444444-4444-4444-8444-444444444444";

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

const hasMessage = (pattern: RegExp) => (error: { message?: string }) =>
  pattern.test(error.message ?? "");

function dishRows(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    dish_id: `dish-${offset + index}`,
    name: `Dish ${offset + index}`,
    venue_id: VENUE,
    price: 5,
    cursor_score: 100 - (offset + index),
    cursor_id: `dish-${offset + index}`,
  }));
}

test("the first menu page comes with the venue detail and says more may exist", async () => {
  fake.rpc.get_venue_detail = () => ({
    data: [{ id: VENUE, name: "Big Stall", dishes: dishRows(50) }],
  });
  const page = await service.discovery.listDishesByVenuePage!(VENUE);
  assert.equal(page.dishes.length, 50);
  assert.equal(page.nextCursor?.id, "dish-49");
  // No search_dishes call until the page asks for more.
  assert.equal(fake.callsTo("search_dishes").length, 0);
});

test("a short menu has no next page", async () => {
  fake.rpc.get_venue_detail = () => ({
    data: [{ id: `${VENUE.slice(0, -1)}5`, name: "Small Stall", dishes: dishRows(3) }],
  });
  const page = await service.discovery.listDishesByVenuePage!(`${VENUE.slice(0, -1)}5`);
  assert.equal(page.dishes.length, 3);
  assert.equal(page.nextCursor, undefined);
});

test("a failed later page throws instead of looking like the end of the menu", async () => {
  fake.rpc.search_dishes = () => ({ error: { message: "rate limited", code: "P0001" } });
  await assert.rejects(
    service.discovery.listDishesByVenuePage!(VENUE, { score: 51, id: "dish-49" }),
    hasMessage(/rate limited/),
  );
  fake.rpc.search_dishes = () => ({ data: dishRows(20, 50) });
  const page = await service.discovery.listDishesByVenuePage!(VENUE, { score: 51, id: "dish-49" });
  assert.equal(page.dishes.length, 20);
  assert.equal(page.nextCursor, undefined);
  assert.deepEqual(
    {
      cursorId: fake.callsTo("search_dishes").at(-1)?.args.p_cursor_id,
      venueId: fake.callsTo("search_dishes").at(-1)?.args.p_venue_id,
    },
    { cursorId: "dish-49", venueId: VENUE },
  );
});

test("merchant profile, promotions and opening schedule reads throw on a server error", async () => {
  fake.rpc.get_public_merchant_profile = () => ({ error: { message: "profile down" } });
  fake.rpc.list_customer_active_promotions = () => ({ error: { message: "promos down" } });
  fake.tables.venues = () => ({ error: { message: "schedule down" } });
  await assert.rejects(
    service.discovery.getPublicMerchantProfile(VENUE),
    hasMessage(/profile down/),
  );
  await assert.rejects(
    service.discovery.listActivePromotionsForTarget({ venueId: VENUE }),
    hasMessage(/promos down/),
  );
  await assert.rejects(
    service.discovery.getVenueOpeningSchedule(VENUE),
    hasMessage(/schedule down/),
  );
});

test("no merchant profile and no schedule are still plain empty answers", async () => {
  fake.rpc.get_public_merchant_profile = () => ({ data: [] });
  fake.tables.venues = () => ({ data: null });
  assert.equal(await service.discovery.getPublicMerchantProfile(VENUE), undefined);
  assert.equal(await service.discovery.getVenueOpeningSchedule(VENUE), undefined);
});
