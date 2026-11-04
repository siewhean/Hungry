// A changing number rolls its changed digits (the numeric-text transition), the direction following
// the value; the first value just appears and Reduce Motion swaps at once. Run with
// `node scripts/test-render.mjs src/components/ui/NumericText.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { NumericText } from "@/components/ui";
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

test("only the digits that changed roll; the old digit is hidden from screen readers", async () => {
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
  assert.ok(view.findByText("9"), "the old units digit is still rolling out");
  await settle();
});

test("under Reduce Motion the value is swapped with nothing left behind", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const view = await render(<NumericText value="12" variant="micro" />);
  await view.rerender(<NumericText value="40" variant="micro" />);
  assert.equal(view.text(), "40");
});
