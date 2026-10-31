import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CLOSURE_DAYS,
  endOfSingaporeDay,
  getClosureLabel,
  isClosureActive,
  resolveClosedUntil,
  singaporeDateOnly,
  startOfSingaporeDate,
} from "@/features/merchant/closure";

// 2026-10-29 10:00 in Singapore is 02:00 UTC.
const NOW = new Date("2026-10-29T02:00:00Z");

test("a Singapore day ends at 16:00 UTC", () => {
  assert.equal(endOfSingaporeDay(NOW).toISOString(), "2026-10-29T16:00:00.000Z");
  // 00:30 on the 30th in Singapore is still the 30th.
  assert.equal(
    endOfSingaporeDay(new Date("2026-10-29T16:30:00Z")).toISOString(),
    "2026-10-30T16:00:00.000Z",
  );
});

test("singaporeDateOnly follows Singapore, not UTC, and can look ahead", () => {
  assert.equal(singaporeDateOnly(new Date("2026-10-29T17:00:00Z")), "2026-10-30");
  assert.equal(singaporeDateOnly(NOW, 2), "2026-10-31");
});

test("startOfSingaporeDate is midnight there, and refuses impossible dates", () => {
  assert.equal(startOfSingaporeDate("2026-11-03")?.toISOString(), "2026-11-02T16:00:00.000Z");
  assert.equal(startOfSingaporeDate("2026-02-30"), null);
  assert.equal(startOfSingaporeDate("3 Nov"), null);
});

test("a closure is active until its instant passes", () => {
  assert.equal(isClosureActive("2026-10-29T16:00:00.000Z", NOW), true);
  assert.equal(isClosureActive("2026-10-29T01:00:00.000Z", NOW), false);
  assert.equal(isClosureActive(null, NOW), false);
  assert.equal(isClosureActive("not a date", NOW), false);
});

test("the label is Closed today, Reopens <date>, or nothing once it has passed", () => {
  assert.equal(getClosureLabel("2026-10-29T16:00:00.000Z", NOW), "Closed today");
  assert.equal(getClosureLabel("2026-11-02T16:00:00.000Z", NOW), "Reopens 3 Nov");
  assert.equal(getClosureLabel("2026-10-28T16:00:00.000Z", NOW), undefined);
  assert.equal(getClosureLabel(undefined, NOW), undefined);
});

test("resolveClosedUntil takes a later date and explains why it refuses one", () => {
  assert.deepEqual(resolveClosedUntil("2026-11-03", NOW), {
    closedUntil: "2026-11-02T16:00:00.000Z",
  });
  assert.deepEqual(resolveClosedUntil("3 Nov", NOW), { error: "Enter the date as YYYY-MM-DD." });
  assert.match((resolveClosedUntil("2026-10-29", NOW) as { error: string }).error, /after today/);
  assert.match(
    (resolveClosedUntil("2027-06-01", NOW) as { error: string }).error,
    new RegExp(String(MAX_CLOSURE_DAYS)),
  );
});
