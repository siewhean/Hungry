import assert from "node:assert/strict";
import test from "node:test";

import { singaporeDateOnly } from "@/features/merchant/closure";
import { hungryService } from "@/lib/services/mock/mockService";

const OUTLET = "outlet-wonton-mee";

test("R5-7: the previous period is the same number of days, ending the day before the range", async () => {
  for (const range of ["7d", "30d"] as const) {
    const [now, before] = await Promise.all([
      hungryService.merchant.getDailySeries(OUTLET, range),
      hungryService.merchant.getDailySeries(OUTLET, range, "previous"),
    ]);
    assert.equal(before.length, now.length);
    assert.equal(before[before.length - 1].date, singaporeDateOnly(new Date(now[0].date), -1));
  }
});

test("R5-7: the previous days add up to the comparison totals on the Performance cards", async () => {
  const [analytics, before] = await Promise.all([
    hungryService.merchant.getAnalytics(OUTLET, "7d"),
    hungryService.merchant.getDailySeries(OUTLET, "7d", "previous"),
  ]);
  assert.equal(
    before.reduce((total, point) => total + point.profileVisits, 0),
    analytics.previousPeriodComparison.profileVisits,
  );
  assert.equal(
    before.reduce((total, point) => total + point.menuViews, 0),
    analytics.previousPeriodComparison.menuViews,
  );
});
