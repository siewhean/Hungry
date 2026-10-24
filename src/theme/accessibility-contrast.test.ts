import assert from "node:assert/strict";
import test from "node:test";

import { colors, contrastRatios } from "@/theme/tokens";
import { getBadgeToneStyles, type BadgeTone } from "@/components/ui/badgeTones";

type HexColor = `#${string}`;
type RgbaColor = `rgba(${number}, ${number}, ${number}, ${number})`;

function parseHex(color: string): [number, number, number] {
  assert.match(color, /^#[0-9a-fA-F]{6}$/);
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance(color: HexColor): number {
  const [r, g, b] = parseHex(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: HexColor, background: HexColor): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgba(color: string): [number, number, number, number] {
  const match = color.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*(0?\.\d+|1(?:\.0)?)\)$/);
  assert.ok(match, `Expected rgba color, got ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function compositeRgbaOverBackground(foreground: RgbaColor, background: HexColor): HexColor {
  const [r, g, b, alpha] = parseRgba(foreground);
  const [bgR, bgG, bgB] = parseHex(background);
  const channelToHex = (value: number) =>
    Math.round(value).toString(16).padStart(2, "0").toUpperCase();
  return `#${channelToHex(r * alpha + bgR * (1 - alpha))}${channelToHex(
    g * alpha + bgG * (1 - alpha),
  )}${channelToHex(b * alpha + bgB * (1 - alpha))}`;
}

function roundedContrast(foreground: HexColor, background: HexColor): number {
  return Number(contrast(foreground, background).toFixed(2));
}

const badgeTones: BadgeTone[] = [
  "orange",
  "amber",
  "success",
  "warning",
  "error",
  "info",
  "neutral",
];
const badgeRatioKey = (tone: BadgeTone, mode: "light" | "dark") => {
  const label = tone.charAt(0).toUpperCase() + tone.slice(1);
  return `badge${label}TextOn${mode === "light" ? "Bg" : "Surface"}` as const;
};

const computedContrastRatios = {
  light: {
    textOnBg: roundedContrast(colors.light.text, colors.light.bg),
    textSecondaryOnBg: roundedContrast(colors.light.textSecondary, colors.light.bg),
    textMutedOnBg: roundedContrast(colors.light.textMuted, colors.light.bg),
    accentTextOnBg: roundedContrast(colors.light.accentText, colors.light.bg),
    accentTextOnOrangeLight: roundedContrast(colors.light.accentText, colors.light.orangeLight),
    textOnOrangeControl: roundedContrast(colors.light.textOnPrimary, colors.light.orangeControl),
    textOnBrandOrange: roundedContrast(colors.light.textOnOrange, colors.light.orange),
    textOnDestructive: roundedContrast(colors.light.textOnDestructive, colors.light.destructive),
    statusFastOnBg: roundedContrast(colors.light.statusFast, colors.light.bg),
    statusModerateOnBg: roundedContrast(colors.light.statusModerate, colors.light.bg),
    statusBusyOnBg: roundedContrast(colors.light.statusBusy, colors.light.bg),
    successTextOnSuccessSoft: roundedContrast(colors.light.successText, colors.light.successSoft),
    warningTextOnWarningSoft: roundedContrast(colors.light.warningText, colors.light.warningSoft),
    errorTextOnErrorSoft: roundedContrast(colors.light.errorText, colors.light.errorSoft),
    infoTextOnInfoSoft: roundedContrast(colors.light.infoText, colors.light.infoSoft),
    ...Object.fromEntries(
      badgeTones.map((tone) => {
        const styles = getBadgeToneStyles(colors.light, tone);
        return [
          badgeRatioKey(tone, "light"),
          roundedContrast(styles.text as HexColor, styles.bg as HexColor),
        ];
      }),
    ),
  },
  dark: {
    textOnBg: roundedContrast(colors.dark.text, colors.dark.bg),
    textSecondaryOnBg: roundedContrast(colors.dark.textSecondary, colors.dark.bg),
    textMutedOnBg: roundedContrast(colors.dark.textMuted, colors.dark.bg),
    textMutedOnSurface: roundedContrast(colors.dark.textMuted, colors.dark.surface),
    accentTextOnBg: roundedContrast(colors.dark.accentText, colors.dark.bg),
    textOnOrangeControl: roundedContrast(colors.dark.textOnPrimary, colors.dark.orangeControl),
    textOnBrandOrange: roundedContrast(colors.dark.textOnOrange, colors.dark.orange),
    textOnDestructive: roundedContrast(colors.dark.textOnDestructive, colors.dark.destructive),
    statusFastOnBg: roundedContrast(colors.dark.statusFast, colors.dark.bg),
    statusModerateOnBg: roundedContrast(colors.dark.statusModerate, colors.dark.bg),
    statusBusyOnBg: roundedContrast(colors.dark.statusBusy, colors.dark.bg),
    successTextOnBg: roundedContrast(colors.dark.successText, colors.dark.bg),
    warningTextOnBg: roundedContrast(colors.dark.warningText, colors.dark.bg),
    errorTextOnBg: roundedContrast(colors.dark.errorText, colors.dark.bg),
    infoTextOnBg: roundedContrast(colors.dark.infoText, colors.dark.bg),
    ...Object.fromEntries(
      badgeTones.map((tone) => {
        const styles = getBadgeToneStyles(colors.dark, tone);
        const background = styles.bg.startsWith("rgba(")
          ? compositeRgbaOverBackground(styles.bg as RgbaColor, colors.dark.surface)
          : (styles.bg as HexColor);
        return [badgeRatioKey(tone, "dark"), roundedContrast(styles.text as HexColor, background)];
      }),
    ),
  },
} as const;

// Labels on brand-orange buttons are bold, so they use the AA large-text minimum (3:1).
const BOLD_LABEL_PAIRS = new Set(["light.textOnBrandOrange"]);

test("documented Hungry theme text pairs meet WCAG AA contrast", () => {
  for (const [mode, ratios] of Object.entries(computedContrastRatios)) {
    for (const [pair, ratio] of Object.entries(ratios)) {
      const minimum = BOLD_LABEL_PAIRS.has(`${mode}.${pair}`) ? 3 : 4.5;
      assert.ok(ratio >= minimum, `${mode}.${pair} ratio must meet AA`);
    }
  }
});

test("theme exposes computed contrast ratios for audit traceability", () => {
  assert.deepEqual(contrastRatios, computedContrastRatios);
});

test("bottom tab active label and create icon meet contrast targets", () => {
  for (const mode of ["light", "dark"] as const) {
    const palette = colors[mode];
    // Active tab labels are 10px text, so they need 4.5:1 against the tab bar background.
    assert.ok(
      contrast(palette.orangeText as HexColor, palette.bg as HexColor) >= 4.5,
      `${mode} orangeText on bg should pass 4.5:1`,
    );
  }
  // Dark-mode create button uses the dark on-orange ink instead of white.
  assert.ok(contrast(colors.dark.textOnOrange as HexColor, colors.dark.orange as HexColor) >= 4.5);
  assert.ok(contrast(colors.dark.white as HexColor, colors.dark.orange as HexColor) < 3);
});

test("rating stars and orange CTA labels meet contrast targets", () => {
  for (const mode of ["light", "dark"] as const) {
    const palette = colors[mode];
    // Stars are non-text graphics: 3:1 against the card surface.
    assert.ok(
      contrast(palette.ratingStar as HexColor, palette.surface as HexColor) >= 3,
      `${mode} ratingStar on surface should pass 3:1`,
    );
    // Yellow star icons are edged so the shape still reads on the card.
    assert.ok(
      contrast(palette.starStroke as HexColor, palette.surface as HexColor) >= 3,
      `${mode} starStroke on surface should pass 3:1`,
    );
  }
  // Orange CTAs: bold white labels in light mode (3:1 large-text minimum), dark ink in dark mode.
  assert.ok(contrast(colors.light.textOnOrange as HexColor, colors.light.orange as HexColor) >= 3);
  assert.ok(contrast(colors.dark.textOnOrange as HexColor, colors.dark.orange as HexColor) >= 4.5);
  // "Fast" badges: white ink on the light-mode green, dark ink on the dark-mode green.
  assert.ok(contrast(colors.light.white as HexColor, colors.light.statusFast as HexColor) >= 4.5);
  assert.ok(
    contrast(colors.dark.textOnOrange as HexColor, colors.dark.statusFast as HexColor) >= 4.5,
  );
  // Discover "VALUE" badge: white on the light-mode success fill, dark ink in dark mode.
  assert.ok(contrast(colors.light.white as HexColor, colors.light.success as HexColor) >= 4.5);
  assert.ok(contrast(colors.dark.textOnOrange as HexColor, colors.dark.success as HexColor) >= 4.5);
});
