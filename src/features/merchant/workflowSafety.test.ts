import test from "node:test";
import assert from "node:assert/strict";
import {
  parseMerchantPrice,
  updateMerchantAvailability,
  singaporeCalendarDate,
  singaporeDateBoundary,
  runMerchantBatch,
} from "./workflowSafety";
import { dishes } from "@/lib/services/mock/data";

test("merchant price rejects missing/malformed inputs instead of turning them into free", () => {
  for (const value of ["", " ", "5abc", "-1", "1.234", "Infinity", "01"])
    assert.throws(() => parseMerchantPrice(value));
  assert.equal(parseMerchantPrice("0"), 0);
  assert.equal(parseMerchantPrice("5.20"), 5.2);
});
test("availability edits preserve unknown flags", () => {
  assert.deepEqual(updateMerchantAvailability(["seasonal", "sold-out", "featured"], true, false), [
    "seasonal",
  ]);
});
test("promotion calendar dates use Singapore midnight", () => {
  assert.equal(singaporeCalendarDate("2026-10-19T17:00:00Z"), "2026-10-20");
  assert.equal(
    new Date(singaporeDateBoundary("2026-10-20", "start")).toISOString(),
    "2026-10-19T16:00:00.000Z",
  );
});
test("batch result retains failed canonical fixture items", async () => {
  const menu = dishes;
  assert.ok(menu.length > 1);
  const result = await runMerchantBatch(menu.slice(0, 2), async (dish) => {
    if (dish.id === menu[1].id) throw new Error("rejected");
  });
  assert.deepEqual(
    result.succeeded.map((d) => d.id),
    [menu[0].id],
  );
  assert.deepEqual(
    result.failed.map((d) => d.id),
    [menu[1].id],
  );
});

test("OCR acceptance applies corrections before publication and repeated acceptance returns same dish", async () => {
  const { hungryService } = await import("@/lib/services/mock/mockService");
  const outlets = await hungryService.merchant.getOutlets();
  const draftLists = await Promise.all(
    outlets.map((outlet) => hungryService.merchant.getOCRDrafts(outlet.id)),
  );
  const draft = draftLists.flat().find((item) => item.status === "pending");
  assert.ok(draft, "canonical fixture needs a pending OCR draft");
  const accepted = await hungryService.merchant.acceptOCRDraft(draft.id, {
    name: draft.name,
    price: 1.1,
    description: draft.suggestedDescription,
  });
  assert.equal(accepted.price, 1.1);
  const retry = await hungryService.merchant.acceptOCRDraft(draft.id);
  assert.equal(retry.id, accepted.id);
  assert.equal(
    (await hungryService.merchant.getMenu(draft.outletId)).filter((item) => item.id === accepted.id)
      .length,
    1,
  );
});
