import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { confirmUntickTried } from "./confirmUntickTried";
import { useChoiceSheetStore } from "@/store/useChoiceSheetStore";

// No sheet host runs here: leave the store closed so later askChoice callers are not held.
afterEach(() => useChoiceSheetStore.setState({ request: null, sheetOpen: false }));

test("confirming the untick resolves true and says the review stays", async () => {
  const pending = confirmUntickTried("Chicken rice", true);
  const request = useChoiceSheetStore.getState().request;
  assert.ok(request);
  assert.match(request.title, /Chicken rice/);
  assert.match(request.message ?? "", /Your review stays/);
  assert.match(request.message ?? "", /count one fewer/);
  useChoiceSheetStore.setState({ sheetOpen: false });
  useChoiceSheetStore.getState().settle("untick");
  assert.equal(await pending, true);
});

test("dismissing the sheet keeps the dish tried", async () => {
  const pending = confirmUntickTried("Laksa", false);
  assert.doesNotMatch(useChoiceSheetStore.getState().request?.message ?? "", /review/);
  useChoiceSheetStore.setState({ sheetOpen: false });
  useChoiceSheetStore.getState().settle(null);
  assert.equal(await pending, false);
});
