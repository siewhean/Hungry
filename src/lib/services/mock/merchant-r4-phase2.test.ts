import assert from "node:assert/strict";
import test from "node:test";

import { singaporeDateOnly } from "@/features/merchant/closure";
import { hungryService } from "@/lib/services/mock/mockService";

const OUTLET = "outlet-wonton-mee";

test("R4-5: the daily series has one point per day, oldest first, ending today", async () => {
  const week = await hungryService.merchant.getDailySeries(OUTLET, "7d");
  const month = await hungryService.merchant.getDailySeries(OUTLET, "30d");
  assert.equal(week.length, 7);
  assert.equal(month.length, 30);
  assert.equal(week[6].date, singaporeDateOnly(new Date()));
  assert.deepEqual(
    week.map((point) => point.date),
    [...week.map((point) => point.date)].sort(),
  );
});

test("R4-5: the days add up to the totals the Performance cards show", async () => {
  const [analytics, series] = await Promise.all([
    hungryService.merchant.getAnalytics(OUTLET, "7d"),
    hungryService.merchant.getDailySeries(OUTLET, "7d"),
  ]);
  const sum = (pick: (point: (typeof series)[number]) => number) =>
    series.reduce((total, point) => total + pick(point), 0);
  assert.equal(
    sum((p) => p.profileVisits),
    analytics.profileVisits,
  );
  assert.equal(
    sum((p) => p.menuViews),
    analytics.menuViews,
  );
  assert.equal(
    sum((p) => p.dishViews),
    analytics.dishViews,
  );
  assert.equal(
    sum((p) => p.directionTaps),
    analytics.directionTaps,
  );
  assert.equal(
    sum((p) => p.saves),
    analytics.saves,
  );
});

test("R4-5: an outlet that does not exist has no series", async () => {
  await assert.rejects(() => hungryService.merchant.getDailySeries("no-such-outlet", "7d"));
});

test("R4-4: a closure the merchant sets reaches the diner's stall profile, and reopening clears it", async () => {
  const merchant = hungryService.merchant;
  const venueId = `mock-venue-${OUTLET}`;
  const until = new Date(Date.now() + 5 * 86_400_000).toISOString();

  await merchant.updateBusinessProfile(OUTLET, { closedUntil: until, temporaryClosure: "" });
  const closed = await hungryService.discovery.getPublicMerchantProfile(venueId);
  assert.match(closed?.temporaryClosure ?? "", /^Reopens \d{1,2} \w{3}$/);
  // Decide for me and the map read the stall through getVenuesByIds: the pause is on it too.
  const [pausedVenue] = await hungryService.discovery.getVenuesByIds([venueId]);
  assert.equal(pausedVenue?.closedUntil, until);

  await merchant.updateBusinessProfile(OUTLET, { closedUntil: null });
  const reopened = await hungryService.discovery.getPublicMerchantProfile(venueId);
  assert.equal(reopened?.temporaryClosure, undefined);
  const [reopenedVenue] = await hungryService.discovery.getVenuesByIds([venueId]);
  assert.equal(reopenedVenue?.closedUntil, undefined);
});
