import test from "node:test";
import assert from "node:assert/strict";

import { getDirectoryDescriptor } from "./venueDescriptor";

test("uses operating hours when available", () => {
  assert.equal(
    getDirectoryDescriptor({ operatingHours: "10:00 AM - 8:00 PM", isFacility: false }),
    "10:00 AM - 8:00 PM",
  );
});

test("uses facility fallback label when no operating hours", () => {
  assert.equal(
    getDirectoryDescriptor({ operatingHours: undefined, isFacility: true }),
    "Facility / seating",
  );
});

test("descriptor never injects hygiene wording", () => {
  const descriptor = getDirectoryDescriptor({
    operatingHours: "11:00 AM - 9:00 PM",
    isFacility: false,
  });
  assert.equal(descriptor.includes("Hygiene"), false);
});
