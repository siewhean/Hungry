import assert from "node:assert/strict";
import test from "node:test";

import { resolveStallOpenInfo } from "./stallOpenState";

// 2026-10-19 is a Monday; noon in Singapore.
const mondayNoon = new Date(Date.UTC(2026, 9, 19, 4, 0));

test("STALL-14: a temporary closure is shown once, as the hours status, not again under the header", () => {
  const info = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "10am - 8pm" },
    temporaryClosure: "Closed for renovation until 3 Nov",
    now: mondayNoon,
  });
  assert.equal(info.statusLabel, "Closed for renovation until 3 Nov");
  assert.equal(info.extraNotice, undefined);
});

test("STALL-14: a stored notice the status does not say still shows under the header", () => {
  const info = resolveStallOpenInfo({
    venue: {
      isOpen: true,
      operatingHours: "Mon-Sun 10am - 8pm",
      closureNotice: "Closed on 3 Nov for Deepavali.",
    },
    now: mondayNoon,
  });
  assert.notEqual(info.statusLabel, info.closureNotice);
  assert.equal(info.extraNotice, "Closed on 3 Nov for Deepavali.");
});

// 2026-10-25 is a Sunday; noon in Singapore.
const sundayNoon = new Date(Date.UTC(2026, 9, 25, 4, 0));

test("the status line says open or closed with the next change, from the listed hours", () => {
  const open = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Mon-Sun 10am - 8pm" },
    now: mondayNoon,
  });
  assert.equal(open.statusLabel, "Open now · Closes 8pm");
  assert.equal(open.isOpen, true);
  assert.deepEqual(open.todayRows, [{ label: "Today", text: "10am - 8pm" }]);
  const later = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Mon-Sun 6pm - 8pm" },
    now: mondayNoon,
  });
  assert.equal(later.statusLabel, "Closed now · Opens 6pm");
  const sunday = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Mon-Fri 10am - 8pm" },
    now: sundayNoon,
  });
  assert.deepEqual(sunday.todayRows, [{ label: "Today", text: "Closed today" }]);
  const notice = resolveStallOpenInfo({
    venue: { isOpen: false, operatingHours: "Mon-Sun 6pm - 8pm", closureNotice: "Back on Friday" },
    now: mondayNoon,
  });
  assert.equal(notice.statusLabel, "Back on Friday");
  assert.equal(notice.extraNotice, undefined, "the notice is not shown twice");
});

test("unreadable or missing hours are shown as written, never guessed", () => {
  const unreadable = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Ask the uncle" },
    now: mondayNoon,
  });
  assert.equal(unreadable.statusLabel, "Check listed hours");
  assert.deepEqual(unreadable.weekRows, [{ label: "Hours", text: "Ask the uncle" }]);
  assert.deepEqual(unreadable.todayRows, unreadable.weekRows);
  const none = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "" },
    now: mondayNoon,
  });
  assert.equal(none.statusLabel, "Hours not listed");
  assert.deepEqual(none.weekRows, []);
});

// R4-STALL-7 / DISH4-18: after the last range ends, the line says when the stall opens next.
// 2026-10-19 is a Monday: 21:09 in Singapore is 13:09 UTC.
const mondayLate = new Date(Date.UTC(2026, 9, 19, 13, 9));

test("R4-STALL-7: after closing, the status says it opens tomorrow, not 'Closed for today'", () => {
  const listed = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Mon-Sun 10am - 8pm" },
    now: mondayLate,
  });
  assert.equal(listed.statusLabel, "Closed now · Opens 10am tomorrow");
  assert.equal(listed.isOpen, false);

  const schedule = {
    timezone: "Asia/Singapore",
    weekly: { mon: [{ open: "10:00", close: "20:00" }], tue: [{ open: "09:30", close: "20:00" }] },
  } as never;
  const structured = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "", openingSchedule: schedule },
    now: mondayLate,
  });
  assert.equal(structured.statusLabel, "Closed now · Opens 9:30am tomorrow");
});

test("R4-STALL-7: on a closed day the status names the next day it opens", () => {
  // Sunday noon: open Mon-Fri only.
  const listed = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Mon-Fri 10am - 8pm" },
    now: sundayNoon,
  });
  assert.equal(listed.statusLabel, "Closed now · Opens 10am tomorrow");

  // Friday evening after closing, open Mon-Fri only: Monday is three days ahead.
  const fridayLate = new Date(Date.UTC(2026, 9, 23, 13, 9));
  const weekend = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Mon-Fri 10am - 8pm" },
    now: fridayLate,
  });
  assert.equal(weekend.statusLabel, "Closed now · Opens 10am Mon");

  // Open on Wednesdays only, looked at on a Thursday: next Wednesday, six days ahead.
  const thursdayNoon = new Date(Date.UTC(2026, 9, 22, 4, 0));
  const wednesdaysOnly = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "Wed 10am - 8pm" },
    now: thursdayNoon,
  });
  assert.equal(wednesdaysOnly.statusLabel, "Closed now · Opens 10am Wed");
});

test("R4-STALL-7: a stall with no readable hours still says 'Hours not listed'", () => {
  const info = resolveStallOpenInfo({
    venue: { isOpen: true, operatingHours: "" },
    now: mondayLate,
  });
  assert.equal(info.statusLabel, "Hours not listed");
});

test("R5-STALL-13: a false is_open flag with no closure notice lets the listed hours decide", () => {
  // Noon on a Monday in Singapore, hours say open.
  const info = resolveStallOpenInfo({
    venue: { isOpen: false, operatingHours: "Mon-Sun 10am - 11pm" },
    now: mondayNoon,
  });
  assert.equal(info.isOpen, true);
  assert.match(info.statusLabel, /^Open now/);
  // The hours still win when they say closed.
  const closedByHours = resolveStallOpenInfo({
    venue: { isOpen: false, operatingHours: "Mon-Sun 6pm - 8pm" },
    now: mondayNoon,
  });
  assert.equal(closedByHours.isOpen, false);
  assert.match(closedByHours.statusLabel, /^Closed now/);
});

test("R5-STALL-13: a false is_open flag with a closure notice stays closed", () => {
  const info = resolveStallOpenInfo({
    venue: { isOpen: false, operatingHours: "Mon-Sun 10am - 11pm", closureNotice: "Renovating" },
    now: mondayNoon,
  });
  assert.equal(info.isOpen, false);
  assert.equal(info.statusLabel, "Renovating");
});
