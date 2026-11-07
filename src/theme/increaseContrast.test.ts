import assert from "node:assert/strict";
import test from "node:test";

import { applyIncreaseContrast } from "@/theme/increaseContrast";
import { colors } from "@/theme/tokens";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("Increase Contrast in light mode darkens the brand orange so white button text clears 4.5:1", () => {
  const light: Record<string, string> = applyIncreaseContrast(colors.light, "light");
  assert.ok(contrast(colors.light.textOnOrange, colors.light.orange) < 4.5);
  assert.equal(light.orange, colors.light.orangeControl);
  assert.ok(contrast(light.textOnOrange, light.orange) >= 4.5);
  // Orange icons and active tabs on the page background read at least 4.5:1 too.
  assert.ok(contrast(light.orange, light.bg) >= 4.5);
});

test("Increase Contrast lifts muted text to the secondary text colour in both appearances", () => {
  for (const scheme of ["light", "dark"] as const) {
    const palette: Record<string, string> = applyIncreaseContrast(colors[scheme], scheme);
    assert.equal(palette.textMuted, colors[scheme].textSecondary);
    assert.ok(
      contrast(palette.textMuted, palette.bg) > contrast(colors[scheme].textMuted, palette.bg),
    );
    assert.ok(contrast(palette.textMuted, palette.surface) >= 4.5);
  }
});

test("Increase Contrast keeps the dark orange, whose buttons already carry dark text", () => {
  const dark: Record<string, string> = applyIncreaseContrast(colors.dark, "dark");
  assert.equal(dark.orange, colors.dark.orange);
  assert.ok(contrast(dark.textOnOrange, dark.orange) >= 4.5);
});

test("Increase Contrast leaves every other colour as it was", () => {
  const light: Record<string, string> = applyIncreaseContrast(colors.light, "light");
  for (const key of Object.keys(colors.light) as (keyof typeof colors.light)[]) {
    if (key === "orange" || key === "textMuted") continue;
    assert.equal(light[key], colors.light[key], key);
  }
});
