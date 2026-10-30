import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyBars,
  buildPeakHourStrip,
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

test("R5-7: a previous period is drawn on the same scale as this one", () => {
  const now = [point("2026-10-27", 4), point("2026-10-28", 8)];
  const before = [point("2026-10-20", 16), point("2026-10-21", 2)];
  const bars = buildDailyBars(now, before);
  assert.deepEqual(
    bars.map((bar) => bar.ratio),
    [0.25, 0.5],
  );
  assert.deepEqual(
    bars.map((bar) => bar.previousRatio),
    [1, 0.125],
  );
  assert.equal(bars[0].previousValue, 16);
  assert.match(
    bars[0].accessibilityLabel,
    /Tue 27 Oct: 4 profile visits\. 16 on the same day before/,
  );
});

test("R5-7: a previous period of a different length, or none, is ignored", () => {
  const now = [point("2026-10-27", 4), point("2026-10-28", 8)];
  for (const previous of [null, undefined, [point("2026-10-20", 99)]]) {
    const bars = buildDailyBars(now, previous);
    assert.deepEqual(
      bars.map((bar) => bar.ratio),
      [0.5, 1],
    );
    assert.equal(bars[0].previousValue, undefined);
    assert.equal(bars[0].previousRatio, 0);
    assert.doesNotMatch(bars[0].accessibilityLabel, /before/);
  }
});

test("R5-7: the peak-hour strip covers 24 hours and marks the busiest in order", () => {
  const strip = buildPeakHourStrip([13, 12, 13, 25, -1]);
  assert.equal(strip.length, 24);
  assert.deepEqual(
    strip.filter((cell) => cell.isPeak).map((cell) => [cell.hour, cell.rank]),
    [
      [12, 2],
      [13, 1],
    ],
  );
  assert.equal(
    buildPeakHourStrip([]).every((cell) => !cell.isPeak && cell.rank === null),
    true,
  );
});
