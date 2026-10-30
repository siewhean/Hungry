import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyBars,
  describeDailySeries,
  formatChartDate,
  formatCount,
  formatShare,
} from "@/features/merchant/performanceFormat";
import type { MerchantDailyPoint } from "@/types/domain";

function point(date: string, profileVisits: number): MerchantDailyPoint {
  return { date, profileVisits, menuViews: 0, dishViews: 0, directionTaps: 0, saves: 0 };
}

test("counts get thousands separators", () => {
  assert.equal(formatCount(8420), "8,420");
  assert.equal(formatCount(7), "7");
});

test("a share is shown only when it is a real percentage of visits", () => {
  assert.equal(formatShare(37, 100), "37%");
  assert.equal(formatShare(5, 0), undefined);
  assert.equal(formatShare(120, 100), undefined);
});

test("chart dates read like Mon 27 Oct", () => {
  assert.equal(formatChartDate("2026-10-27"), "Tue 27 Oct");
  assert.equal(formatChartDate("soon"), "soon");
});

test("bars scale against the tallest day and carry spoken labels", () => {
  const bars = buildDailyBars([
    point("2026-10-26", 0),
    point("2026-10-27", 4),
    point("2026-10-28", 8),
  ]);
  assert.deepEqual(
    bars.map((bar) => bar.ratio),
    [0, 0.5, 1],
  );
  assert.equal(bars[1].accessibilityLabel, "Tue 27 Oct: 4 profile visits");
  assert.equal(
    buildDailyBars([point("2026-10-27", 1)])[0].accessibilityLabel,
    "Tue 27 Oct: 1 profile visit",
  );
  assert.equal(bars[0].axisLabel, "Mo");
});

test("a month of bars labels only every fifth day, and all-zero days have no height", () => {
  const month = Array.from({ length: 30 }, (_, i) =>
    point(`2026-10-${String(i + 1).padStart(2, "0")}`, 0),
  );
  const bars = buildDailyBars(month);
  assert.equal(bars.filter((bar) => bar.axisLabel).length, 7);
  assert.ok(bars.every((bar) => bar.ratio === 0));
});

test("the summary names the busiest day, and says so when there are no visits", () => {
  assert.equal(describeDailySeries([]), "No daily data yet.");
  assert.equal(
    describeDailySeries([point("2026-10-27", 0)]),
    "No profile visits in this range yet.",
  );
  assert.equal(
    describeDailySeries([point("2026-10-27", 3), point("2026-10-28", 9)]),
    "12 profile visits. Busiest day: Wed 28 Oct with 9.",
  );
});
