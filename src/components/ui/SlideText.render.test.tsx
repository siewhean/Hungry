// A changing number or label slides sideways instead of jumping; the first value just appears and
// Reduce Motion swaps it at once. Run with `node scripts/test-render.mjs src/components/ui/SlideText.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { SlideText } from "@/components/ui";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render, settle } from "@/test/render";

afterEach(async () => {
  await cleanup();
  useUIStore.setState({ reducedMotionEnabled: false });
});

test("the first value just appears, with nothing sliding out", async () => {
  const view = await render(<SlideText value="12" variant="micro" />);
  assert.ok(view.findByText("12"));
  assert.equal(view.text(), "12");
});

test("a changed value shows the new text and hides the old one from screen readers", async () => {
  const view = await render(<SlideText value="12" variant="micro" />);
  await view.rerender(<SlideText value="40" variant="micro" />);
  assert.ok(view.findByText("40"), "the new value is on screen at once");
  const leaving = view.findByText("12");
  assert.ok(leaving, "the old value is still sliding out");
  assert.equal(
    leaving.closest("[aria-hidden='true']") !== null,
    true,
    "and is hidden from VoiceOver",
  );
  await settle();
});

test("under Reduce Motion the value is swapped with nothing left behind", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const view = await render(<SlideText value="12" variant="micro" />);
  await view.rerender(<SlideText value="40" variant="micro" />);
  assert.equal(view.text(), "40");
});
