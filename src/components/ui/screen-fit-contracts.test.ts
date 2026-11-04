import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve(process.cwd(), "src/components/ui/Screen.tsx"), "utf8");

test("a page whose content fits does not scroll or rubber-band, unless it pulls to refresh", () => {
  assert.match(source, /onLayout=\{\(event\) => setViewportHeight/);
  assert.match(source, /onContentSizeChange=\{\(_width, height\) => setContentHeight\(height\)\}/);
  assert.match(source, /contentHeight <= viewportHeight \+ 1 &&\s*!refreshControl/);
  assert.match(source, /alwaysBounceVertical=\{!contentFits\}/);
  assert.match(source, /bounces=\{!contentFits\}/);
  assert.match(source, /overScrollMode=\{contentFits \? "never" : "auto"\}/);
});
