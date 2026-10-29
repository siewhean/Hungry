import assert from "node:assert/strict";
import test from "node:test";

import { formatDateOnlyRange, formatPromotionRange } from "@/features/merchant/dateRange";

const now = new Date("2026-10-27T04:00:00Z");

test("a range in the current year shows day and month only", () => {
  assert.equal(formatDateOnlyRange("2026-10-27", "2026-11-03", now), "27 Oct – 3 Nov");
});

test("a one-day range shows one date", () => {
  assert.equal(formatDateOnlyRange("2026-10-27", "2026-10-27", now), "27 Oct");
});

test("the year shows when the range leaves the current year", () => {
  assert.equal(formatDateOnlyRange("2026-12-27", "2027-01-03", now), "27 Dec 2026 – 3 Jan 2027");
  assert.equal(formatDateOnlyRange("2025-10-27", "2025-11-03", now), "27 Oct – 3 Nov 2025");
});

test("an unreadable date gives an empty string, not a broken label", () => {
  assert.equal(formatDateOnlyRange("soon", "2026-11-03", now), "");
  assert.equal(formatDateOnlyRange("2026-13-01", "2026-11-03", now), "");
});

test("a stored promotion range reads the Singapore day, not the UTC day", () => {
  // Start of 27 Oct and end of 3 Nov in Singapore are the previous evening / same night in UTC.
  assert.equal(
    formatPromotionRange("2026-10-26T16:00:00.000Z", "2026-11-03T15:59:59.999Z", now),
    "27 Oct – 3 Nov",
  );
});
