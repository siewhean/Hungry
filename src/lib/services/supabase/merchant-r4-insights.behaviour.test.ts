// Merchant Insights (MERCH-R4-3) against the real Supabase service with a fake client: the tips
// come from get_merchant_insight_facts, the 7-day analytics and the outlet's opening hours.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OUTLET = "44444444-4444-4444-8444-444444444444";

type ServiceModule = typeof import("./supabaseService");
let service: ServiceModule["supabaseService"];

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

const facts = {
  dishCount: 5,
  dishesWithoutPhoto: 3,
  soldOutCount: 1,
  soldOutNames: ["Mee Siam"],
  unrepliedReviews: 2,
  oldestUnrepliedAt: "2026-10-20T00:00:00Z",
  reviewsLast7Days: 3,
  ratingLast7Days: 3.3,
  reviewsPrevious7Days: 4,
  ratingPrevious7Days: 4.6,
};

function setUp(outletRow: Record<string, unknown>, peakHours: number[]) {
  fake.rpc = {
    get_merchant_insight_facts: () => ({ data: facts, error: null }),
    get_merchant_analytics: () => ({
      data: {
        profileVisits: 40,
        reviewCount: 3,
        averageRating: 3.3,
        peakDiscoveryHours: peakHours,
      },
      error: null,
    }),
  };
  fake.tables = {
    merchant_outlets: () => ({
      data: { id: OUTLET, venue_id: "venue-1", ...outletRow },
      error: null,
    }),
  };
}

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  auth.userId = ME;
});

test("R4-3: insights come from one facts call plus the analytics, not one read per rule", async () => {
  setUp({}, [20]);
  const insights = await service.merchant.getAIInsights(OUTLET);
  assert.equal(fake.callsTo("get_merchant_insight_facts").length, 1);
  assert.equal(fake.callsTo("get_merchant_analytics").length, 1);

  const byPrefix = (prefix: string) => insights.find((insight) => insight.id.startsWith(prefix));
  assert.match(byPrefix("weekly-")?.body ?? "", /40 profile visits and 3 customer reviews/);
  assert.equal(byPrefix("unreplied-")?.title, "2 reviews waiting for a reply");
  assert.equal(byPrefix("photos-")?.title, "3 of 5 dishes have no photo");
  assert.equal(byPrefix("soldout-")?.title, "1 dish marked sold out");
  assert.match(byPrefix("rating-")?.title ?? "", /dipped/);
  // No opening hours on the outlet: the tip asks for them instead of guessing a peak.
  assert.equal(byPrefix("hours-missing")?.actionTarget, "BusinessProfileEditor");
});

test("R5-1: hours kept only as text turn the tip into set-hours-for-each-day", async () => {
  setUp({ operating_hours: "7:00 AM – 3:00 PM" }, [20]);
  const insights = await service.merchant.getAIInsights(OUTLET);
  assert.equal(
    insights.find((insight) => insight.id.startsWith("hours-text-only"))?.title,
    "Set hours for each day",
  );
  assert.ok(!insights.some((insight) => insight.id.startsWith("hours-missing")));
});

test("R4-3: a busiest discovery hour outside the opening hours is called out", async () => {
  setUp({ opening_schedule: { weekly: { mon: [{ open: "08:00", close: "15:00" }] } } }, [20]);
  const insights = await service.merchant.getAIInsights(OUTLET);
  const peak = insights.find((insight) => insight.id.startsWith("hours-peak-20"));
  assert.equal(peak?.title, "Diners look for you around 8 pm");
  assert.ok(!insights.some((insight) => insight.id.startsWith("hours-missing")));
});

test("R4-3: a busiest hour inside the opening hours produces no hours tip", async () => {
  setUp({ opening_schedule: { weekly: { mon: [{ open: "08:00", close: "22:00" }] } } }, [12]);
  const insights = await service.merchant.getAIInsights(OUTLET);
  assert.ok(!insights.some((insight) => insight.id.startsWith("hours-")));
});

test("R4-3: a failed facts read rejects instead of showing an empty page", async () => {
  setUp({}, []);
  fake.rpc.get_merchant_insight_facts = () => ({ data: null, error: new Error("denied") });
  await assert.rejects(() => service.merchant.getAIInsights(OUTLET), /denied/);
});

test("R4-3: before the facts migration is on the database the analytics tips still show", async () => {
  setUp({ opening_schedule: { weekly: { mon: [{ open: "08:00", close: "15:00" }] } } }, [20]);
  fake.rpc.get_merchant_insight_facts = () => ({
    data: null,
    error: Object.assign(new Error("function does not exist"), { code: "42883" }),
  });
  const insights = await service.merchant.getAIInsights(OUTLET);
  assert.ok(insights.some((insight) => insight.id.startsWith("weekly-")));
  assert.ok(insights.some((insight) => insight.id.startsWith("hours-peak-20")));
  assert.ok(!insights.some((insight) => insight.id.startsWith("unreplied-")));
});
