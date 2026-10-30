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

// R4-STALL-13: the three merchant reads ride along with get_venue_detail.

const withMerchantColumns = (id: string, extra: Record<string, unknown>) => ({
  id,
  name: "Merchant Stall",
  dishes: dishRows(2),
  ...extra,
});

test("R4-STALL-13: opening a stall makes one request; the merchant reads come back with it", async () => {
  const venue = "55555555-5555-4555-8555-555555555551";
  fake.rpc.get_venue_detail = () => ({
    data: [
      withMerchantColumns(venue, {
        merchant_profile: {
          outlet_id: "o1",
          contact_phone: "+6591234567",
          temporary_closure: "Closed for renovation",
          is_verified: true,
        },
        active_promotions: [],
        claim_status: "contacted",
      }),
    ],
  });
  await service.discovery.getVenue(venue);
  const profile = await service.discovery.getPublicMerchantProfile(venue);
  const promotions = await service.discovery.listActivePromotionsForTarget({ venueId: venue });
  const claim = await service.supply.getMerchantClaimStatus(venue);
  assert.equal(profile?.contactPhone, "+6591234567");
  assert.equal(profile?.temporaryClosure, "Closed for renovation");
  assert.deepEqual(promotions, []);
  assert.equal(claim, "in_review");
  assert.equal(fake.rpcCalls.length, 1, "one request for the stall, profile, promotions and claim");
  assert.equal(fake.callsTo("get_venue_detail").length, 1);
  assert.equal(fake.queries.length, 0, "no separate claim-status query");
});

test("R4-STALL-13: a stall with no verified owner and no claim reads as empty answers", async () => {
  const venue = "55555555-5555-4555-8555-555555555552";
  fake.rpc.get_venue_detail = () => ({
    data: [
      withMerchantColumns(venue, {
        merchant_profile: null,
        active_promotions: [],
        claim_status: null,
      }),
    ],
  });
  await service.discovery.getVenue(venue);
  assert.equal(await service.discovery.getPublicMerchantProfile(venue), undefined);
  assert.equal(await service.supply.getMerchantClaimStatus(venue), "none");
  assert.equal(fake.rpcCalls.length, 1);
});

test("R4-STALL-13: a database without the new columns falls back to the separate reads", async () => {
  const venue = "55555555-5555-4555-8555-555555555553";
  fake.rpc.get_venue_detail = () => ({ data: [withMerchantColumns(venue, {})] });
  fake.rpc.get_public_merchant_profile = () => ({
    data: [{ outlet_id: "o2", contact_phone: "+6580000000", is_verified: true }],
  });
  await service.discovery.getVenue(venue);
  const profile = await service.discovery.getPublicMerchantProfile(venue);
  assert.equal(profile?.contactPhone, "+6580000000");
  assert.equal(fake.callsTo("get_public_merchant_profile").length, 1);
});

test("R4-STALL-13: a dish page's promotion read and a read with no stall call keep their own RPCs", async () => {
  const venue = "55555555-5555-4555-8555-555555555554";
  fake.rpc.list_customer_active_promotions = () => ({ data: [] });
  fake.rpc.get_public_merchant_profile = () => ({ data: [] });
  // No get_venue_detail has run for this stall: the profile read must not start one.
  await service.discovery.getPublicMerchantProfile(venue);
  assert.equal(fake.callsTo("get_venue_detail").length, 0);
  assert.equal(fake.callsTo("get_public_merchant_profile").length, 1);

  fake.rpc.get_venue_detail = () => ({
    data: [
      withMerchantColumns(venue, {
        merchant_profile: null,
        active_promotions: [],
        claim_status: null,
      }),
    ],
  });
  await service.discovery.getVenue(venue);
  await service.discovery.listActivePromotionsForTarget({ venueId: venue, dishId: "dish-1" });
  assert.equal(fake.callsTo("list_customer_active_promotions").length, 1);
});
