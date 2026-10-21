import assert from "node:assert/strict";
import test from "node:test";

import type { OpeningSchedule, TasteVector } from "@/types/domain";
import { computeStallStatus } from "@/utils/stallStatus";
import { formatScheduleToday } from "@/utils/openingSchedule";

import { formatDishPrice } from "./dishPrice";
import { resolveStallOpenInfo } from "./stallOpenState";
import { buildMapsSearchUrl, getStallPin } from "./stallLocation";
import { tasteMatchLabel, tasteMatchPercent } from "./tasteMatch";

// 2026-10-19 is a Monday. SGT = UTC+8.
const mondayAt = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 19, hour - 8, minute));

const taste = (overrides: Partial<TasteVector> = {}): TasteVector => ({
  sweet: 5,
  spicy: 5,
  sour: 5,
  salty: 5,
  rich: 5,
  aromatic: 5,
  ...overrides,
});

const weekdaySchedule: OpeningSchedule = {
  weekly: {
    mon: [{ open: "10:00", close: "20:00" }],
    tue: [{ open: "10:00", close: "20:00" }],
  },
};

test("detail-M4: taste match is centred on the neutral 5 and described in words", () => {
  const spicy = taste({ spicy: 9, sweet: 2 });
  assert.equal(tasteMatchPercent(spicy, spicy), 100);
  assert.equal(tasteMatchPercent(taste({ spicy: 9, sweet: 1 }), taste({ spicy: 1, sweet: 9 })), 0);
  // A neutral vector says nothing, so it never reads as a strong match.
  assert.equal(tasteMatchPercent(taste(), spicy), 50);
  assert.equal(tasteMatchLabel(100), "Close to your taste");
  assert.equal(tasteMatchLabel(50), "Some overlap");
  assert.equal(tasteMatchLabel(10), "Different from your usual");
});

test("detail-M2: special hours close the stall on the stall page and the dish page alike", () => {
  const schedule: OpeningSchedule = {
    ...weekdaySchedule,
    special: [{ date: "2026-10-19", ranges: [] }],
  };
  const venue = { isOpen: true, operatingHours: "10am - 8pm" };
  const info = resolveStallOpenInfo({ venue, schedule, now: mondayAt(12) });
  assert.equal(info.openState.status, "closed");
  assert.equal(info.isOpen, false);
  assert.equal(info.todayRows[0]?.text, "Closed");

  const regular = resolveStallOpenInfo({ venue, schedule: weekdaySchedule, now: mondayAt(12) });
  assert.equal(regular.isOpen, true);
  assert.match(regular.statusLabel, /^Open now/);
});

test("detail-M2: the owner's temporary closure wins over open hours", () => {
  const info = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "10am - 8pm" },
    temporaryClosure: "Closed for renovation until Friday",
    now: mondayAt(12),
  });
  assert.equal(info.isOpen, false);
  assert.equal(info.statusLabel, "Closed for renovation until Friday");
  assert.equal(info.closureNotice, "Closed for renovation until Friday");
});

test("detail-M2: unreadable listed hours are shown as written, never as open", () => {
  const info = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Ask the aunty" },
    now: mondayAt(12),
  });
  assert.equal(info.openState.status, "unknown");
  assert.deepEqual(info.weekRows, [{ label: "Hours", text: "Ask the aunty" }]);
  const none = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "" },
    now: mondayAt(12),
  });
  assert.equal(none.statusLabel, "Hours not listed");
  assert.deepEqual(none.weekRows, []);
});

test("formatScheduleToday reads Singapore time and prefers special hours", () => {
  assert.equal(formatScheduleToday(weekdaySchedule, mondayAt(9)), "10am-8pm");
  // 23:30 UTC Sunday is already Monday in Singapore.
  assert.equal(
    formatScheduleToday(weekdaySchedule, new Date(Date.UTC(2026, 9, 18, 23, 30))),
    "10am-8pm",
  );
  assert.equal(
    formatScheduleToday(
      { ...weekdaySchedule, special: [{ date: "2026-10-19", ranges: [] }] },
      mondayAt(9),
    ),
    "Closed",
  );
  assert.equal(formatScheduleToday({ weekly: {} }, mondayAt(9)), "Closed");
});

test("detail-L21: computeStallStatus reads Singapore time, not the device zone", () => {
  const hours = { open: "10:00", close: "20:00" };
  assert.equal(computeStallStatus(hours, mondayAt(12)), "open");
  assert.equal(computeStallStatus(hours, mondayAt(19, 30)), "closing_soon");
  assert.equal(computeStallStatus(hours, mondayAt(21)), "closed");
  // 02:00 UTC is 10:00 in Singapore whatever zone the device is in.
  assert.equal(computeStallStatus(hours, new Date(Date.UTC(2026, 9, 19, 2, 0))), "open");
  assert.equal(computeStallStatus(undefined, mondayAt(12)), "unknown");
});

test("detail-L7: directions use the stall's own pin only when it differs from the building", () => {
  const building = { latitude: 1.3, longitude: 103.85 };
  assert.equal(getStallPin({}, building), undefined);
  assert.equal(getStallPin({ latitude: 1.3, longitude: 103.85 }, building), undefined);
  const pin = getStallPin({ latitude: 1.3101, longitude: 103.8601 }, building);
  assert.deepEqual(pin, { latitude: 1.3101, longitude: 103.8601 });
  // With no building point to compare against, the stall's own pin is used.
  assert.deepEqual(getStallPin({ latitude: 1.31, longitude: 103.86 }), {
    latitude: 1.31,
    longitude: 103.86,
  });

  assert.match(buildMapsSearchUrl("Maxwell Food Centre"), /query=Maxwell%20Food%20Centre$/);
  assert.match(buildMapsSearchUrl("Maxwell", pin), /query=1\.3101%2C103\.8601$/);
});

test("detail-M17: a dish with no price shows its range or 'Price not listed', never S$0.00", () => {
  assert.equal(formatDishPrice({ price: 4.5, priceRange: "" }), "S$4.50");
  assert.equal(formatDishPrice({ price: 0, priceRange: "S$4-S$6" }), "S$4-S$6");
  assert.equal(formatDishPrice({ price: 0, priceRange: "S$0" }), "Price not listed");
  assert.equal(formatDishPrice({ price: 0, priceRange: "" }), "Price not listed");
});
