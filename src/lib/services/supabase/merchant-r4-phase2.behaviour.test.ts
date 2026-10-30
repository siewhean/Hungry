// Merchant round-four phase 2 against the real Supabase service with a fake client: the daily
// series, the Performance windows, the closure column and the one-pass dish save.

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

const outletRow = {
  id: OUTLET,
  merchant_account_id: ACCOUNT,
  venue_id: "venue-1",
  building_id: "building-1",
  name: "Uncle Tan",
  business_type: "hawker_stall",
  is_live: true,
};

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = { merchant_outlets: () => ({ data: outletRow, error: null }) };
  auth.userId = ME;
});

const SERIES_ROW = {
  date: "2026-10-28",
  profileVisits: 12,
  menuViews: 5,
  dishViews: 9,
  directionTaps: 2,
  saves: 1,
};

test("R4-5: the daily series is one rpc call and maps each day", async () => {
  fake.rpc.get_merchant_daily_series = () => ({
    data: [SERIES_ROW, { date: "2026-10-29" }],
    error: null,
  });
  const series = await service.merchant.getDailySeries(OUTLET, "7d");
  assert.equal(fake.callsTo("get_merchant_daily_series").length, 1);
  assert.deepEqual(series[0], SERIES_ROW);
  // A day the database sent without counts reads as zero, never undefined.
  assert.deepEqual(series[1], {
    date: "2026-10-29",
    profileVisits: 0,
    menuViews: 0,
    dishViews: 0,
    directionTaps: 0,
    saves: 0,
  });
});

test("R4-5: the chart and the totals cover the same whole Singapore days", async () => {
  fake.rpc.get_merchant_daily_series = () => ({ data: [], error: null });
  fake.rpc.get_merchant_analytics = () => ({ data: { profileVisits: 0 }, error: null });
  await service.merchant.getDailySeries(OUTLET, "30d");
  await service.merchant.getAnalytics(OUTLET, "30d");
  const seriesSince = fake.callsTo("get_merchant_daily_series")[0].args.p_since;
  const totalsSince = fake.callsTo("get_merchant_analytics")[0].args.p_since;
  assert.equal(seriesSince, totalsSince);
  // Midnight in Singapore is 16:00 UTC the evening before.
  assert.match(String(seriesSince), /T16:00:00\.000Z$/);
  assert.equal(fake.callsTo("get_merchant_daily_series")[0].args.p_until, null);
});

test("R4-5: 7 days starts six days before today, 30 days twenty-nine", async () => {
  fake.rpc.get_merchant_daily_series = () => ({ data: [], error: null });
  await service.merchant.getDailySeries(OUTLET, "7d");
  await service.merchant.getDailySeries(OUTLET, "30d");
  const [week, month] = fake
    .callsTo("get_merchant_daily_series")
    .map((call) => new Date(String(call.args.p_since)).getTime());
  assert.equal(Math.round((month - week) / 86_400_000), -23);
});

test("R4-5: a failed series read rejects so the chart can say so", async () => {
  fake.rpc.get_merchant_daily_series = () => ({ data: null, error: new Error("denied") });
  await assert.rejects(() => service.merchant.getDailySeries(OUTLET, "7d"), /denied/);
});

test("R4-4: closed_until is written as its own column and read back", async () => {
  const closedUntil = new Date(Date.now() + 2 * 86_400_000).toISOString();
  fake.tables.merchant_outlets = (call) => {
    const isUpdate = call.ops.some(([method]) => method === "update");
    return {
      data: isUpdate ? { ...outletRow, closed_until: closedUntil } : outletRow,
      error: null,
    };
  };
  const updated = await service.merchant.updateBusinessProfile(OUTLET, {
    closedUntil,
    temporaryClosure: "",
  });
  const update = fake
    .queriesOn("merchant_outlets")
    .flatMap((query) => query.ops)
    .find(([method]) => method === "update");
  assert.ok(update, "the outlet is updated");
  assert.equal((update[1][0] as Record<string, unknown>).closed_until, closedUntil);
  assert.equal(updated.closedUntil, closedUntil);
});

test("R4-4: reopening sends null, and a past date is refused before any write", async () => {
  fake.tables.merchant_outlets = () => ({ data: outletRow, error: null });
  await service.merchant.updateBusinessProfile(OUTLET, { closedUntil: null });
  const update = fake
    .queriesOn("merchant_outlets")
    .flatMap((query) => query.ops)
    .find(([method]) => method === "update");
  assert.equal((update?.[1][0] as Record<string, unknown>).closed_until, null);

  fake.queries.length = 0;
  await assert.rejects(
    () =>
      service.merchant.updateBusinessProfile(OUTLET, {
        closedUntil: new Date(Date.now() - 60_000).toISOString(),
      }),
    /future/,
  );
  assert.equal(
    fake
      .queriesOn("merchant_outlets")
      .flatMap((query) => query.ops)
      .some(([m]) => m === "update"),
    false,
  );
});

test("R4-17: a dish edit saves once and returns the saved row", async () => {
  const dishRow = {
    id: "dish-1",
    venue_id: "venue-1",
    building_id: "building-1",
    name: "Wonton Mee",
    price: 6,
    price_range: "S$6.00",
    taste_tags: [],
    availability_flags: [],
  };
  fake.rpc.merchant_save_dish = () => ({ data: "dish-1", error: null });
  fake.tables = {
    merchant_outlets: () => ({ data: outletRow, error: null }),
    dishes: (call) => ({
      data: call.ops.some(([method]) => method === "single") ? dishRow : [dishRow],
      error: null,
    }),
    venues: () => ({
      data: { id: "venue-1", building_id: "building-1", name: "Uncle Tan" },
      error: null,
    }),
  };
  const saved = await service.merchant.editDish(OUTLET, "dish-1", {
    price: 6,
    priceRange: "S$6.00",
  });
  assert.equal(fake.callsTo("merchant_save_dish").length, 1);
  assert.equal(saved.id, "dish-1");
  assert.equal(saved.price, 6);
  assert.equal(saved.name, "Wonton Mee");
});

test("R4-17: a save the database refuses never reads anything back", async () => {
  fake.rpc.merchant_save_dish = () => ({
    data: null,
    error: new Error("Verify your stall to change dishes diners can already see."),
  });
  await assert.rejects(
    () => service.merchant.editDish(OUTLET, "dish-1", { price: 7, priceRange: "S$7.00" }),
    /Verify your stall/,
  );
  assert.equal(fake.queriesOn("dishes").length, 0);
});

test("R4-4: a full profile update writes every field to its own column", async () => {
  fake.tables.merchant_outlets = () => ({ data: outletRow, error: null });
  await service.merchant.updateBusinessProfile(OUTLET, {
    name: "Uncle Tan Noodles",
    businessType: "hawker_stall",
    buildingId: "building-2",
    unitNumber: "#01-23",
    floor: "01",
    locationPrivacy: "exact",
    description: "Wonton mee since 1980.",
    operatingHours: "7am - 3pm",
    address: "1 Smith Street",
    postalCode: "050001",
    coordinate: { latitude: 1.28, longitude: 103.84 },
    temporaryClosure: "",
    closedUntil: null,
    contactPhone: "+65 6123 4567",
    contactEmail: "tan@example.sg",
    cuisineCategories: ["Noodles"],
    socialLinks: [],
    profilePhotoUrl: "https://cdn.example.sg/profile.jpg",
    coverPhotoUrl: "https://cdn.example.sg/cover.jpg",
    isLive: true,
  });
  const update = fake
    .queriesOn("merchant_outlets")
    .flatMap((query) => query.ops)
    .find(([method]) => method === "update");
  const payload = update?.[1][0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload).sort(), [
    "address",
    "building_id",
    "business_type",
    "closed_until",
    "contact_email",
    "contact_phone",
    "cover_photo_url",
    "cuisine_categories",
    "description",
    "floor",
    "is_live",
    "latitude",
    "location_privacy",
    "longitude",
    "name",
    "operating_hours",
    "postal_code",
    "profile_photo_url",
    "social_links",
    "temporary_closure",
    "unit_number",
  ]);
  assert.equal(payload.temporary_closure, null, "an empty notice is stored as no notice");
});

test("R4-17: a full dish edit sends every field the editor can change", async () => {
  fake.rpc.merchant_save_dish = () => ({ data: "dish-1", error: null });
  fake.tables = {
    merchant_outlets: () => ({ data: outletRow, error: null }),
    dishes: () => ({
      data: { id: "dish-1", venue_id: "venue-1", name: "Wonton Mee", price: 7, taste_tags: [] },
      error: null,
    }),
    venues: () => ({ data: { id: "venue-1", building_id: "building-1" }, error: null }),
  };
  await service.merchant.editDish(OUTLET, "dish-1", {
    name: "Wonton Mee",
    description: "Springy noodles",
    price: 7,
    tasteTags: ["springy"],
    mustOrder: true,
    availabilityFlags: ["featured", "section:Noodles"],
    dietaryFlags: ["halal"],
    blurhash: "LEHV6nWB2yk8",
  });
  const call = fake.callsTo("merchant_save_dish")[0];
  assert.equal(call.args.p_dish_id, "dish-1");
  const fields = call.args.p_fields as Record<string, unknown>;
  assert.equal(fields.price, 7);
  assert.equal(fields.price_range, "S$7.00");
  assert.deepEqual(fields.availability_flags, ["featured", "section:Noodles"]);
  assert.deepEqual(call.args.p_dietary_slugs, ["halal"]);
});

test("R4-17: if the saved dish cannot be read back, the edit reports it", async () => {
  fake.rpc.merchant_save_dish = () => ({ data: "dish-1", error: null });
  fake.tables = {
    merchant_outlets: () => ({ data: outletRow, error: null }),
    dishes: () => ({ data: null, error: new Error("row not visible") }),
    venues: () => ({ data: { id: "venue-1", building_id: "building-1" }, error: null }),
  };
  await assert.rejects(
    () => service.merchant.editDish(OUTLET, "dish-1", { price: 7 }),
    /row not visible/,
  );
});
