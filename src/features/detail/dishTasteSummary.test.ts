import assert from "node:assert/strict";
import test from "node:test";

import {
  blendDinerTaste,
  dinerTasteFromSummary,
  dinerTasteLabel,
} from "@/features/detail/dishTasteSummary";
import type { TasteVector } from "@/types/domain";

const estimate: TasteVector = { sweet: 2, spicy: 8, sour: 1, salty: 5, rich: 6, aromatic: 3 };

test("no summary, or one with no axis, leaves the estimate alone", () => {
  assert.equal(dinerTasteFromSummary(undefined), undefined);
  assert.equal(dinerTasteFromSummary({}), undefined);
  assert.equal(blendDinerTaste(estimate, undefined), estimate);
});

test("diner averages replace the estimate axis by axis and the count is the largest axis", () => {
  const diners = dinerTasteFromSummary({
    spicy: { average: 4.5, raters: 3 },
    rich: { average: 9, raters: 11 },
  });
  assert.deepEqual(diners, { levels: { spicy: 4.5, rich: 9 }, raters: 11 });
  assert.deepEqual(blendDinerTaste(estimate, diners), { ...estimate, spicy: 4.5, rich: 9 });
});

test("averages outside 0-10 are clamped and non-finite rows are ignored", () => {
  const diners = dinerTasteFromSummary({
    sweet: { average: 14, raters: 4 },
    salty: { average: Number.NaN, raters: 9 },
  });
  assert.deepEqual(diners, { levels: { sweet: 10 }, raters: 4 });
});

test("the legend says diner or diners", () => {
  assert.equal(dinerTasteLabel(1), "From 1 diner");
  assert.equal(dinerTasteLabel(12), "From 12 diners");
});
