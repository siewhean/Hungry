// DetailCollapsingHeader: the stall and dish pages' title bar. Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import { Animated } from "react-native";
import test, { afterEach } from "node:test";

import { DetailCollapsingHeader } from "@/components/detail/DetailCollapsingHeader";
import { cleanup, render } from "@/test/render";
import { readRepoFile } from "@/test/sourceContracts";

afterEach(cleanup);

test("R4-STALL-2: Back and Share sit inside the bar's wrapper, with the name in the bar", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(DetailCollapsingHeader, {
      scrollY: new Animated.Value(0),
      heroHeight: 190,
      title: "Tian Tian Chicken Rice",
      onBack: () => pressed.push("back"),
      onShare: () => pressed.push("share"),
      shareLabel: "Share stall",
      chromeTestID: "chrome",
    }),
  );
  const chrome = view.container.querySelector('[data-testid="chrome"]') as HTMLElement | null;
  assert.ok(chrome, "the wrapper renders");
  const bar = chrome.querySelector('[data-testid="detail-collapsing-header"]');
  assert.ok(bar, "the bar is inside the wrapper");
  assert.match(bar.textContent ?? "", /Tian Tian Chicken Rice/);
  assert.ok(chrome.contains(view.findByLabel("Go back")), "Back is inside the header");
  assert.ok(chrome.contains(view.findByLabel("Share stall")), "Share is inside the header");
  await view.press(view.findByLabel("Go back"));
  await view.press(view.findByLabel("Share stall"));
  assert.deepEqual(pressed, ["back", "share"]);
  // Back is first in the tree, so a screen reader reaches it first.
  const labelled = Array.from(chrome.querySelectorAll("[aria-label]"));
  assert.equal(labelled[0]?.getAttribute("aria-label"), "Go back");
});

test("R4-STALL-2: the bar's name is hidden from screen readers until the bar shows, then a heading", async () => {
  const scrollY = new Animated.Value(0);
  const view = await render(
    createElement(DetailCollapsingHeader, {
      scrollY,
      heroHeight: 200,
      title: "Laksa",
      onBack: () => undefined,
    }),
  );
  const title = () =>
    Array.from(view.container.querySelectorAll("[role='heading']")).find((node) =>
      /Laksa/.test(node.textContent ?? ""),
    ) as HTMLElement | undefined;
  assert.ok(title(), "the name renders");
  assert.equal(title()?.getAttribute("aria-hidden"), "true", "hidden while the page's own title shows");
  const { act } = await import("react");
  await act(async () => {
    scrollY.setValue(400);
  });
  assert.notEqual(title()?.getAttribute("aria-hidden"), "true", "read as a heading once collapsed");
});

test("R4-STALL-2: the bar's opacity is driven by the scroll value (source contract)", () => {
  const source = readRepoFile("src/components/detail/DetailCollapsingHeader.tsx");
  assert.match(source, /scrollY\.interpolate\(/);
  assert.match(source, /opacity: barOpacity/);
  assert.match(source, /heroHeight \* 0\.6/);
  assert.match(source, /accessibilityRole="header"/);
});
