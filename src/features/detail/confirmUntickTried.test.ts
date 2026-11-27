import assert from "node:assert/strict";
import test from "node:test";

import { confirmUntickTried } from "./confirmUntickTried";
import { useChoiceSheetStore } from "@/store/useChoiceSheetStore";

test("confirming the untick resolves true and says the review stays", async () => {
  const pending = confirmUntickTried("Chicken rice", true);
  const request = useChoiceSheetStore.getState().request;
  assert.ok(request);
  assert.match(request.title, /Chicken rice/);
  assert.match(request.message ?? "", /Your review stays/);
  assert.match(request.message ?? "", /count one fewer/);
  useChoiceSheetStore.getState().settle("untick");
  assert.equal(await pending, true);
});

test("dismissing the sheet keeps the dish tried", async () => {
  const pending = confirmUntickTried("Laksa", false);
  assert.doesNotMatch(useChoiceSheetStore.getState().request?.message ?? "", /review/);
  useChoiceSheetStore.getState().settle(null);
  assert.equal(await pending, false);
});
