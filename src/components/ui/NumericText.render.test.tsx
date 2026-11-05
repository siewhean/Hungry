// A changing number rolls its changed digits (the numeric-text transition), the direction following
// the value; the first value just appears and Reduce Motion swaps at once. Run with
// `node scripts/test-render.mjs src/components/ui/NumericText.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { NumericText } from "@/components/ui";
import { digitStrip } from "@/components/ui/NumericText";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, settle } from "@/test/render";

afterEach(async () => {
  await cleanup();
  useUIStore.setState({ reducedMotionEnabled: false });
});

test("the first value just appears as one piece of text", async () => {
  const view = await render(<NumericText value="12" variant="micro" />);
  assert.ok(view.findByText("12"));
  assert.equal(view.text(), "12");
});

test("only the digits that changed roll; the turning digits are hidden from screen readers", async () => {
  const view = await render(<NumericText value="12" variant="micro" />);
  await view.rerender(<NumericText value="13" variant="micro" />);
  assert.ok(view.findByText("1"), "the unchanged digit stays put");
  assert.ok(view.findByText("3"), "the new digit is on screen at once");
  const leaving = view.findByText("2");
  assert.ok(leaving, "the old digit is still rolling out");
  assert.equal(leaving.closest("[aria-hidden='true']") !== null, true);
  await settle();
});

test("a number that gains a digit lines up from the right", async () => {
  const view = await render(<NumericText value="99" variant="micro" />);
  await view.rerender(<NumericText value="100" variant="micro" />);
  assert.ok(view.findByText("1"), "the new leading digit appears");
  assert.ok(view.findByText("9"), "the old units digit is still turning");
  await settle();
});

test("a digit turns through every value between the old and the new one", async () => {
  const view = await render(<NumericText value="1" variant="micro" />);
  await view.rerender(<NumericText value="5" variant="micro" />);
  const strip = view.findByText("3")?.closest("[aria-hidden='true']");
  assert.ok(strip, "the in-between digits sit in a hidden stack");
  assert.equal(strip.textContent, "12345", "1, 2, 3, 4, 5 stacked in order");
  await settle();
});

test("digitStrip counts up through the digits, wrapping 9 to 0", () => {
  assert.deepEqual(digitStrip("1", "5", false), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(digitStrip("8", "2", false), ["8", "9", "0", "1", "2"]);
});

test("digitStrip counting down is stacked new to old, so the column slides down", () => {
  assert.deepEqual(digitStrip("5", "1", true), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(digitStrip("2", "8", true), ["8", "9", "0", "1", "2"]);
});

test("a falling number stacks its digits new to old, so they slide down", async () => {
  const falling = await render(<NumericText value="5" variant="micro" />);
  await falling.rerender(<NumericText value="2" variant="micro" />);
  assert.equal(falling.findByText("3")?.closest("[aria-hidden='true']")?.textContent, "2345");
  await settle();
});

test("under Reduce Motion the value is swapped with nothing left behind", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const view = await render(<NumericText value="12" variant="micro" />);
  await view.rerender(<NumericText value="40" variant="micro" />);
  assert.equal(view.text(), "40");
});
