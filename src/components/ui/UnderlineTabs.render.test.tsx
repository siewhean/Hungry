// The shared underline tabs: the chosen tab is marked, a tap on another one reports it.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { UnderlineTabs } from "@/components/ui";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

const TABS = [
  { value: "dishes", label: "Dishes", accessibilityLabel: "Show dishes" },
  { value: "stalls", label: "Stalls", accessibilityLabel: "Show stalls" },
] as const;

test("the chosen tab is selected and the other is not", async () => {
  const view = await render(
    createElement(UnderlineTabs, {
      tabs: TABS,
      value: "stalls",
      onChange: () => undefined,
      accessibilityLabel: "Search results",
    }),
  );
  const tabs = Array.from(view.container.querySelectorAll('[role="tab"]'));
  assert.equal(tabs.length, 2);
  assert.equal(tabs[0]?.getAttribute("aria-selected"), "false");
  assert.equal(tabs[1]?.getAttribute("aria-selected"), "true");
  assert.ok(view.container.querySelector('[role="tablist"]'));
});

test("tapping the other tab reports it, tapping the chosen one does not", async () => {
  const changes: string[] = [];
  const view = await render(
    createElement(UnderlineTabs, {
      tabs: TABS,
      value: "dishes",
      onChange: (next: string) => changes.push(next),
      accessibilityLabel: "Search results",
      fill: true,
    }),
  );
  const [dishes, stalls] = Array.from(
    view.container.querySelectorAll('[role="tab"]'),
  ) as HTMLElement[];
  dishes?.click();
  assert.deepEqual(changes, []);
  stalls?.click();
  assert.deepEqual(changes, ["stalls"]);
});
