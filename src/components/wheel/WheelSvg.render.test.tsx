// The wheel drawing: labels never upside down, in the app font, and neighbouring slices differ.
// Run with `node scripts/test-render.mjs src/components/wheel/WheelSvg.render.test.tsx`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { afterEach } from "node:test";
import { createElement } from "react";

import { WheelSvg, getWheelSliceColors, wheelLabelRotation } from "@/components/wheel/WheelSvg";
import { cleanup, render } from "@/test/render";
import type { WheelEntry } from "@/types/domain";

afterEach(cleanup);

const entry = (index: number, label: string): WheelEntry => ({
  id: `e${index}`,
  partyId: "p",
  addedByMemberId: "m",
  venueId: `v${index}`,
  buildingId: "b",
  label,
  imageUrl: "",
  isEliminated: false,
  position: index,
  addedAt: new Date().toISOString(),
});

test("MD-W5 no label is turned upside down, whichever slice it is on", () => {
  for (let mid = 5; mid < 360; mid += 5) {
    const angle = ((wheelLabelRotation(mid) % 360) + 360) % 360;
    assert.ok(angle <= 90 || angle >= 270, `slice at ${mid} degrees reads at ${angle}`);
  }
});

test("MD-W5 neighbouring slices never share a colour, including the last and the first", () => {
  const palette = {
    orange: "#f60",
    orangeLight: "#fed",
    surface: "#fff",
    text: "#111",
    textOnOrange: "#000",
  };
  for (const count of [2, 3, 4, 5, 7, 8, 11, 12]) {
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      assert.notEqual(
        getWheelSliceColors(palette, index, count).fill,
        getWheelSliceColors(palette, next, count).fill,
        `${count} slices: ${index} and ${next}`,
      );
    }
  }
});

test("MD-W5 labels run along the slice, so a typical name is shown whole", async () => {
  const labels = ["Ah Tai", "Hill Street Tai Hwa Pork Noodle", "Mei", "Tian Tian Chicken Rice"];
  const view = await render(
    createElement(WheelSvg as never, { entries: labels.map((label, i) => entry(i, label)) }),
  );
  const texts = Array.from(
    view.container.querySelectorAll('[data-stub="react-native-svg.Text"]'),
  ).map((node) => node.textContent);
  assert.equal(texts[0], "Ah Tai");
  assert.equal(texts[2], "Mei");
  assert.ok((texts[1] ?? "").endsWith("…"), "a very long name is cut with an ellipsis");
  assert.ok(
    (texts[3] ?? "").length >= 15,
    `a 22 letter name keeps most of its letters: ${texts[3]}`,
  );
});

test("MD-W5 labels are set in the app font, not the browser's serif", () => {
  // react-native-svg is stubbed in render tests, which drops props, so read the source.
  const source = readFileSync(
    path.join(process.cwd(), "src/components/wheel/WheelSvg.tsx"),
    "utf8",
  );
  assert.match(source, /fontFamily=\{typography\.bodySmallBold\.fontFamily\}/);
});
