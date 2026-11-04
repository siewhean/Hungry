import assert from "node:assert/strict";
import test from "node:test";

import { firstInvalidSection } from "@/features/merchant/profileEditorSections";

test("the first error is the topmost section that has one", () => {
  assert.equal(firstInvalidSection(["contactEmail", "name"]), "basic");
  assert.equal(firstInvalidSection(["contactPhone", "openingSchedule"]), "hours");
  assert.equal(firstInvalidSection(["contactPhone"]), "contact");
  assert.equal(firstInvalidSection(["postalCode", "contactEmail"]), "location");
});

test("fields that are not on the map, and no errors at all, scroll nowhere", () => {
  assert.equal(firstInvalidSection(["somethingElse"]), undefined);
  assert.equal(firstInvalidSection([]), undefined);
});
