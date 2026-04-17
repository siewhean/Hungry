import test from "node:test";
import assert from "node:assert/strict";

import { colors } from "../../theme/tokens";
import { getBadgeToneStyles } from "./badgeTones";

test("orange tone is distinct from neutral tone", () => {
  const palette = colors.light;
  const orange = getBadgeToneStyles(palette, "orange");
  const neutral = getBadgeToneStyles(palette, "neutral");

  assert.notDeepEqual(orange, neutral);
  assert.equal(orange.bg, palette.orangeLight);
  assert.equal(orange.border, palette.orange);
  assert.equal(orange.text, palette.orange);
});

test("neutral tone stays tied to neutral surface tokens", () => {
  const palette = colors.light;
  const neutral = getBadgeToneStyles(palette, "neutral");

  assert.equal(neutral.bg, palette.surface);
  assert.equal(neutral.border, palette.border);
  assert.equal(neutral.text, palette.textSecondary);
});
