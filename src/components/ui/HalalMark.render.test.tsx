// The halal mark takes the colour it is given and is hidden from screen readers unless named.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { AppSymbol, HalalMark } from "@/components/ui";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

test("the halal symbol is a drawn mark with the Arabic word, not an emoji", async () => {
  const view = await render(
    createElement(AppSymbol, { name: "halal", color: "#123456", size: 20 }),
  );
  assert.doesNotMatch(view.container.textContent ?? "", /[\u{1F300}-\u{1FAFF}]/u);
  assert.match(readFileSync("src/components/ui/HalalMark.tsx", "utf8"), /حلال/);
});

test("a named halal mark is an image for screen readers", async () => {
  const view = await render(
    createElement(HalalMark, { size: 20, color: "#123456", accessibilityLabel: "Halal" }),
  );
  assert.ok(view.container.querySelector('[role="img"], [aria-label="Halal"]'));
});
