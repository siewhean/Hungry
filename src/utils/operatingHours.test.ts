import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHoursRows,
  getHoursForDay,
  getSingaporeDay,
  getVenueOpenState,
  parseOperatingHours,
} from "./operatingHours";
import { isVenueOpenFromHours } from "./stallStatus";

// 2026-10-19 is a Monday. SGT = UTC+8.
const mondayAt = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 19, hour - 8, minute));
const sundayAt = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 18, hour - 8, minute));

test("reads the weekday in Singapore time, not device time", () => {
  // 23:30 UTC Sunday is 07:30 Monday in Singapore.
  assert.equal(getSingaporeDay(new Date(Date.UTC(2026, 9, 18, 23, 30))), "Mon");
});

test("'Closed Sun' only closes Sundays", () => {
  const hours = "10am - 9pm, Closed Sun";
  assert.equal(getVenueOpenState(hours, true, mondayAt(12)).status, "open");
  assert.equal(getVenueOpenState(hours, true, sundayAt(12)).status, "closed");
});

test("a comma-separated day list keeps every day", () => {
  const rows = parseOperatingHours("Mon, Wed 10am-8pm");
  assert.deepEqual(rows[0]?.days, ["Mon", "Wed"]);
  assert.equal(getHoursForDay(rows, "Tue"), undefined);
});

test("a second time range stays with the same days", () => {
  const rows = parseOperatingHours("Mon-Fri 10am-2pm, 5pm-9pm; Sat 10am-2pm");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.ranges.length, 2);
  assert.deepEqual(rows[1]?.days, ["Sat"]);
});

test("unknown day tokens are not read as Monday", () => {
  const rows = parseOperatingHours("Lunch 10am-8pm");
  assert.equal(rows[0]?.days, null);
  assert.deepEqual(parseOperatingHours("Weekdays 10am-8pm")[0]?.days, [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
  ]);
});

test("Add Stall's one-line-per-day format merges split shifts", () => {
  const hours = "Mon 10:00 AM - 2:00 PM; Mon 5:00 PM - 9:00 PM; Tue 10:00 AM - 2:00 PM";
  assert.equal(getHoursForDay(parseOperatingHours(hours), "Mon")?.ranges.length, 2);
  assert.equal(getVenueOpenState(hours, true, mondayAt(18)).status, "open");
  assert.equal(getVenueOpenState(hours, true, mondayAt(15)).status, "closed");
});

test("empty or unreadable hours are unknown, never open", () => {
  assert.equal(getVenueOpenState("", true).status, "unknown");
  assert.equal(getVenueOpenState("Call to check", true).status, "unknown");
  assert.equal(getVenueOpenState("10am-8pm", false).status, "closed");
});

test("open state names the next change", () => {
  assert.deepEqual(getVenueOpenState("10am-9pm", true, mondayAt(12)), {
    status: "open",
    detail: "Closes 9pm",
  });
  assert.deepEqual(getVenueOpenState("10am-9pm", true, mondayAt(8)), {
    status: "closed",
    detail: "Opens 10am",
  });
});

test("overnight hours stay open after midnight", () => {
  assert.equal(getVenueOpenState("6pm-2am", true, mondayAt(1)).status, "open");
});

test("public-holiday notes do not close the whole week", () => {
  assert.equal(getVenueOpenState("10am-9pm, Closed on PH", true, mondayAt(12)).status, "open");
});

test("display rows do not invent per-day hours", () => {
  assert.deepEqual(formatHoursRows(parseOperatingHours("7am-2pm")), [
    { label: "Hours", text: "7am-2pm" },
  ]);
  assert.deepEqual(formatHoursRows(parseOperatingHours("Mon-Fri 9am-5pm")), [
    { label: "Mon–Fri", text: "9am-5pm" },
  ]);
});

test("isVenueOpenFromHours keeps the stored flag only when hours are unknown", () => {
  assert.equal(isVenueOpenFromHours("", true), true);
  assert.equal(isVenueOpenFromHours("", false), false);
});
