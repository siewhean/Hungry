// The report / block sheet: what its heading says, and that the reasons flow to onReport.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach } from "node:test";

import { SafetyActionsSheet } from "@/features/safety/SafetyActionsSheet";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

afterEach(async () => {
  await cleanup();
  useUIStore.setState({ safetyMenu: null });
});

const menu = (over: Record<string, unknown> = {}) => ({
  label: "review",
  authorName: "Mei",
  canHide: false,
  canBlock: true,
  onReport: () => undefined,
  onHide: () => undefined,
  onBlock: () => undefined,
  ...over,
});

async function open(over: Record<string, unknown> = {}) {
  const view = await render(createElement(SafetyActionsSheet));
  await act(async () => {
    useUIStore.getState().openSafetyMenu(menu(over) as never);
  });
  await view.settle();
  return view;
}

test("someone else's review that can be blocked is titled 'Report or block'", async () => {
  const view = await open();
  assert.ok(view.findByText("Report or block"));
  assert.ok(view.findByText("Report this review"));
  assert.ok(view.findByText("Block Mei"));
});

test("your own content is titled 'Manage' and offers Hide", async () => {
  const view = await open({ canHide: true, canBlock: false });
  assert.ok(view.findByText("Manage review"));
  assert.ok(view.findByText("Hide this review"));
  assert.equal(view.findByText(/^Block /), null);
});

test("with nothing but Report, the title does not repeat the button", async () => {
  const view = await open({ canBlock: false });
  const matches = (view.container.textContent ?? "").match(/Report this review/g) ?? [];
  assert.equal(matches.length, 1, "the words appear once, on the button");
  assert.ok(view.findByText("Tell us what's wrong with this review."));
});

test("choosing Report then a reason sends it", async () => {
  const reasons: string[] = [];
  const view = await open({ onReport: (reason: string) => reasons.push(reason) });
  await view.press(view.findByText("Report this review"));
  assert.ok(view.findByText("Why are you reporting this review?"));
  const [firstReason] = Array.from(
    view.container.querySelectorAll('[role="button"]'),
  ) as HTMLElement[];
  assert.ok(firstReason);
  await view.press(firstReason);
  assert.equal(reasons.length, 1);
});
