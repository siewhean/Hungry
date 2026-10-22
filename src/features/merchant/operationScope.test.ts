import assert from "node:assert/strict";
import test from "node:test";
import { createMerchantOperationScope } from "./operationScope";
import { runMerchantBatch } from "./workflowSafety";
import { dishes } from "@/lib/services/mock/data";

test("late merchant settlements are invalid after account/outlet switch away and back", async () => {
  const scope = createMerchantOperationScope("account-a:outlet-a");
  const captured = scope.capture();
  scope.update("account-a:outlet-b");
  scope.update("account-a:outlet-a");
  assert.equal(captured(), false);
  const accountCaptured = scope.capture();
  scope.update("account-b:outlet-a");
  assert.equal(accountCaptured(), false);
  const unmounted = scope.capture();
  scope.close();
  scope.open();
  assert.equal(unmounted(), false);
  assert.equal(scope.capture()(), true);
});
test("batch stops issuing remaining writes after outlet changes mid-first mutation", async () => {
  const scope = createMerchantOperationScope("account-a:outlet-a");
  const current = scope.capture();
  const calls: string[] = [];
  const result = await runMerchantBatch(
    dishes.slice(0, 3),
    async (dish) => {
      calls.push(dish.id);
      scope.update("account-a:outlet-b");
    },
    current,
  );
  assert.deepEqual(calls, [dishes[0].id]);
  assert.deepEqual(
    result.failed.map((dish) => dish.id),
    dishes.slice(1, 3).map((dish) => dish.id),
  );
});
