import assert from "node:assert/strict";
import test from "node:test";

import { sectionScrollOffset } from "@/features/detail/scrollToSection";

test("the offset adds the body's place under the hero to the section's place in the body", () => {
  assert.equal(sectionScrollOffset({ y: 190, height: 900 }, { y: 600, height: 300 }, 70), 720);
});

test("it never scrolls above the top, and does nothing before layout", () => {
  assert.equal(sectionScrollOffset({ y: 0, height: 10 }, { y: 20, height: 5 }, 70), 0);
  assert.equal(sectionScrollOffset(null, { y: 20, height: 5 }, 70), undefined);
  assert.equal(sectionScrollOffset({ y: 190, height: 900 }, undefined, 70), undefined);
});
