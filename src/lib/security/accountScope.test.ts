import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceAccountGeneration,
  assertAccountGeneration,
  getAccountGeneration,
} from "./accountScope";
test("a gallery or upload callback from before a subject transition cannot apply private state", async () => {
  const captured = getAccountGeneration();
  let resolveSelection: (value: string) => void = () => {};
  const selection = new Promise<string>((resolve) => {
    resolveSelection = resolve;
  });
  const applied: string[] = [];
  const callback = selection.then((uri) => {
    assertAccountGeneration(captured);
    applied.push(uri);
  });
  advanceAccountGeneration();
  resolveSelection("private-selected-photo");
  await assert.rejects(callback, /account changed/);
  assert.deepEqual(applied, []);
  const current = getAccountGeneration();
  assert.doesNotThrow(() => assertAccountGeneration(current));
  advanceAccountGeneration();
  advanceAccountGeneration();
  assert.throws(() => assertAccountGeneration(current), /account changed/);
});
