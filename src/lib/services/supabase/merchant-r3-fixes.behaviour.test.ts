// Merchant round-three fixes, against the real Supabase service with a fake client: verification
// resubmission payload, keyset paging, retry-safe Featured, the weekly summary, archived dishes.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OUTLET = "44444444-4444-4444-8444-444444444444";
const VENUE = "venue-1";

type ServiceModule = typeof import("./supabaseService");
let service: ServiceModule["supabaseService"];
let buildVerificationSubmitPayload: ServiceModule["buildVerificationSubmitPayload"];
let buildWeeklySummaryFromAnalytics: ServiceModule["buildWeeklySummaryFromAnalytics"];
let isCatalogMenuDisplayable: typeof import("./supabaseRepository").isCatalogMenuDisplayable;

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  const mod = await import("./supabaseService");
  service = mod.supabaseService;
  buildVerificationSubmitPayload = mod.buildVerificationSubmitPayload;
  buildWeeklySummaryFromAnalytics = mod.buildWeeklySummaryFromAnalytics;
  isCatalogMenuDisplayable = (await import("./supabaseRepository")).isCatalogMenuDisplayable;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {
    merchant_outlets: () => ({ data: { id: OUTLET, venue_id: VENUE }, error: null }),
  };
  auth.userId = ME;
});

test("MERCH-X1: a (re)submission never writes the ops decision fields the guard trigger protects", () => {
  const payload = buildVerificationSubmitPayload(OUTLET, "photo", new Date("2026-10-24T00:00:00Z"));
  assert.deepEqual(payload, {
    outlet_id: OUTLET,
    status: "submitted",
    method: "photo",
    submitted_at: "2026-10-24T00:00:00.000Z",
  });
  for (const field of ["rejected_at", "rejection_reason", "verified_at", "expires_at"]) {
    assert.ok(!(field in payload), `${field} must not be sent by a merchant`);
  }
});

test("MERCH-23: inbox pages use a (created_at, id) keyset so rows sharing a timestamp are kept", async () => {
  fake.tables.reviews = () => ({ data: [], error: null });
  await service.merchant.getInbox(OUTLET, {
    type: "review",
    limit: 30,
    unrepliedOnly: true,
    before: "2026-10-01T10:00:00Z",
    beforeId: "review-50",
  });
  const ops = fake.queriesOn("reviews")[0].ops;
  assert.deepEqual(
    ops.filter(([op]) => op === "order").map(([, args]) => args[0]),
    ["created_at", "id"],
  );
  assert.deepEqual(ops.find(([op]) => op === "or")?.[1], [
    'created_at.lt."2026-10-01T10:00:00Z",and(created_at.eq."2026-10-01T10:00:00Z",id.lt."review-50")',
  ]);
  assert.ok(!ops.some(([op]) => op === "lt"), "no plain created_at < before that skips ties");
  assert.deepEqual(ops.find(([op]) => op === "is")?.[1], ["merchant_reply_text", null]);
});

test("MERCH-23: Featured visitor candidates page on the same keyset", async () => {
  fake.tables.reviews = () => ({ data: [], error: null });
  fake.tables.popular_visitor_pins = () => ({ data: [], error: null });
  await service.merchant.listPopularVisitorCandidates(OUTLET, {
    limit: 20,
    before: "2026-10-01T10:00:00Z",
    beforeId: "review-9",
  });
  const ops = fake.queriesOn("reviews")[0].ops;
  assert.match(String(ops.find(([op]) => op === "or")?.[1]), /id\.lt\."review-9"/);
});

test("MERCH-X6: Featured sends the explicit target state, so a retry cannot flip it back", async () => {
  fake.rpc.merchant_set_dish_availability_flag = (args) => ({ data: args.p_enabled, error: null });
  assert.equal(await service.merchant.toggleFeatured(OUTLET, "dish-1", true), true);
  assert.equal(await service.merchant.toggleFeatured(OUTLET, "dish-1", true), true);
  const calls = fake.callsTo("merchant_set_dish_availability_flag");
  assert.deepEqual(
    calls.map((call) => call.args.p_enabled),
    [true, true],
  );
  assert.equal(calls[0].args.p_flag, "featured");
});

test("MERCH-5: the weekly card counts this week's reviews, not an all-time inbox page", () => {
  const analytics = {
    reviewCount: 0,
    averageRating: 0,
    profileVisits: 12,
    menuViews: 3,
    dishViews: 5,
    topDishes: [],
    previousPeriodComparison: { averageRating: 4.2 },
  } as unknown as Parameters<typeof buildWeeklySummaryFromAnalytics>[1];
  const summary = buildWeeklySummaryFromAnalytics(OUTLET, analytics, 120, []);
  assert.equal(summary.newReviews, 0, "120 old reviews and none this week reads as 0");
  assert.equal(summary.unrepliedReviews, 120);
  assert.equal(summary.totalViews, 20);
});

test("MERCH-5: getWeeklySummaryStats makes no unbounded inbox read", async () => {
  fake.rpc = new Proxy({}, { get: () => () => ({ data: [], error: null }) }) as typeof fake.rpc;
  fake.tables.reviews = () => ({ data: [], error: null });
  const summary = await service.merchant.getWeeklySummaryStats(OUTLET);
  assert.equal(typeof summary.newReviews, "number");
  const inboxReads = fake
    .queriesOn("reviews")
    .filter((query) =>
      query.ops.some(
        ([op, args]) => op === "select" && String(args[0]).includes("merchant_reply_text"),
      ),
    );
  assert.equal(inboxReads.length, 0);
});

test("MERCH-1: archived dishes are left out of the diner catalog cache", () => {
  const live = {
    menu_approved_for_display: true,
    menu_rights_status: "merchant_owned",
    menu_source_url: "",
    archived_at: null,
  };
  assert.equal(isCatalogMenuDisplayable(live), true);
  assert.equal(isCatalogMenuDisplayable({ ...live, archived_at: "2026-10-20T00:00:00Z" }), false);
});
