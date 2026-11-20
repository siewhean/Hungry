import assert from "node:assert/strict";
import test from "node:test";

import { getScheduleOpenState, parseHoursTextToSchedule } from "./openingSchedule";

// 2026-10-19 is a Monday. SGT = UTC+8.
const mondayAt = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 19, hour - 8, minute));
const wednesdayAt = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 21, hour - 8, minute));

// Real hours lines from the catalog (zone stalls on staging).
const EVERY_DAY_6_TO_10 =
  "Friday: 6 am–10 pm; Monday: 6 am–10 pm; Saturday: 6 am–10 pm; Sunday: 6 am–10 pm; Thursday: 6 am–10 pm; Tuesday: 6 am–10 pm; Wednesday: 6 am–10 pm";
const SPLIT_SHIFT_MON_CLOSED =
  "Friday: 11 am–2 pm, 5–8 pm; Monday: Closed; Saturday: 11 am–2 pm, 5–8 pm; Sunday: 11 am–2 pm, 5–8 pm; Thursday: 11 am–2 pm, 5–8 pm; Tuesday: 11 am–2 pm, 5–8 pm; Wednesday: 11 am–2 pm, 5–8 pm";
const OPEN_24 =
  "Friday: Open 24 hours; Monday: Open 24 hours; Saturday: Open 24 hours; Sunday: Open 24 hours; Thursday: Open 24 hours; Tuesday: Open 24 hours; Wednesday: Open 24 hours";
const TO_MIDNIGHT =
  "Monday: 5:30 am–12 am; Tuesday: 5:30 am–12 am; Wednesday: 5:30 am–12 am; Thursday: 5:30 am–12 am; Friday: 5:30 am–12 am; Saturday: 5:30 am–12 am; Sunday: 5:30 am–12 am";

test("a plain weekly line becomes a schedule the app can read", () => {
  const schedule = parseHoursTextToSchedule(EVERY_DAY_6_TO_10);
  assert.ok(schedule);
  assert.deepEqual(schedule.weekly.mon, [{ open: "06:00", close: "22:00" }]);
  assert.deepEqual(schedule.weekly.sun, [{ open: "06:00", close: "22:00" }]);
  assert.deepEqual(getScheduleOpenState(schedule, true, mondayAt(12)), {
    status: "open",
    detail: "Closes 10pm",
  });
  assert.equal(getScheduleOpenState(schedule, true, mondayAt(23)).status, "closed");
});

test("split shifts keep both ranges and a closed day stays closed", () => {
  const schedule = parseHoursTextToSchedule(SPLIT_SHIFT_MON_CLOSED);
  assert.ok(schedule);
  assert.deepEqual(schedule.weekly.tue, [
    { open: "11:00", close: "14:00" },
    { open: "17:00", close: "20:00" },
  ]);
  assert.deepEqual(schedule.weekly.mon, []);
  assert.equal(getScheduleOpenState(schedule, true, mondayAt(12)).status, "closed");
  assert.equal(getScheduleOpenState(schedule, true, wednesdayAt(15)).status, "closed");
  assert.equal(getScheduleOpenState(schedule, true, wednesdayAt(18)).status, "open");
});

test("open 24 hours and a 12 am close read as whole days", () => {
  const open24 = parseHoursTextToSchedule(OPEN_24);
  assert.deepEqual(open24?.weekly.mon, [{ open: "00:00", close: "24:00" }]);
  assert.equal(getScheduleOpenState(open24!, true, mondayAt(3)).status, "open");

  const midnight = parseHoursTextToSchedule(TO_MIDNIGHT);
  assert.deepEqual(midnight?.weekly.mon, [{ open: "05:30", close: "24:00" }]);
  assert.equal(getScheduleOpenState(midnight!, true, mondayAt(23, 30)).status, "open");
});

test("'Daily', 'Mon:' short names and ' | ' separators are read", () => {
  assert.deepEqual(parseHoursTextToSchedule("Daily 8:00 AM – 9:00 PM")?.weekly.sat, [
    { open: "08:00", close: "21:00" },
  ]);
  const piped =
    "Mon: Closed | Tue: 12–9 pm | Wed: 12–9 pm | Thu: 12–9 pm | Fri: 12–9 pm | Sat: 12–9 pm | Sun: 12–9 pm";
  const schedule = parseHoursTextToSchedule(piped);
  assert.deepEqual(schedule?.weekly.mon, []);
  assert.deepEqual(schedule?.weekly.tue, [{ open: "12:00", close: "21:00" }]);
});

test("a line with no days and no spaces before am/pm is every day", () => {
  assert.deepEqual(parseHoursTextToSchedule("9am to 10pm")?.weekly.thu, [
    { open: "09:00", close: "22:00" },
  ]);
});

test("a line that is not clear is not turned into a schedule", () => {
  // Noon or midnight? Not guessed.
  assert.equal(
    parseHoursTextToSchedule(
      "Friday: 12–11 am, 6 pm–12 am; Monday: 12–11 am, 6 pm–12 am; Saturday: 12–11 am, 6 pm–12 am; Sunday: 12–11 am, 6 pm–12 am; Thursday: 12–11 am, 6 pm–12 am; Tuesday: 12–11 am, 6 pm–12 am; Wednesday: 12–11 am, 6 pm–12 am",
    ),
    null,
  );
  assert.equal(parseHoursTextToSchedule("Mon-Fri 9am-6pm"), null); // weekend missing
  assert.equal(parseHoursTextToSchedule(""), null);
  assert.equal(parseHoursTextToSchedule(undefined), null);
  assert.equal(parseHoursTextToSchedule("Daily 9am-6pm, closed on PH, call to confirm"), null);
  assert.equal(parseHoursTextToSchedule("Daily 9am-9am"), null);
});
