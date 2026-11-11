import assert from "node:assert/strict";
import test from "node:test";

import {
  LOGO_IMAGE_UNITS,
  LOGO_LOCKUP_UNITS,
  LOGO_SPLASH_DURATION_MS,
  LOGO_SPLASH_FINAL_FRAME,
  logoSplashFrame,
  logoSplashLayout,
  logoSplashLockupWidth,
} from "./logoSplash";

const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );

const samples = Array.from({ length: LOGO_SPLASH_DURATION_MS + 1 }, (_, ms) => ms);

test("the icon starts at 20% of its size, centred on screen, and overshoots to about 110%", () => {
  const start = logoSplashFrame(0);
  near(start.iconScaleX, 0.2, 0.001, "start scale x");
  near(start.iconScaleY, 0.2, 0.001, "start scale y");
  assert.equal(
    start.iconTranslateY,
    140,
    "starts at the screen centre, below its place in the lockup",
  );
  assert.equal(start.wordmarkOpacity, 0, "wordmark not shown yet");

  const peak = Math.max(
    ...samples.filter((ms) => ms <= 500).map((ms) => logoSplashFrame(ms).iconScaleX),
  );
  near(peak, 1.1, 0.01, "overshoot");
  const peakAt = samples.find((ms) => logoSplashFrame(ms).iconScaleX === peak) ?? 0;
  assert.ok(
    peakAt > 200 && peakAt < 400,
    `overshoot lands inside the first half second (${peakAt} ms)`,
  );
});

test("the icon stretches while it pops up and squashes as it falls back, never by much", () => {
  const rising = logoSplashFrame(100);
  assert.ok(rising.iconScaleY / rising.iconScaleX > 1.05, "taller than wide while growing fast");
  const falling = logoSplashFrame(420);
  assert.ok(falling.iconScaleY / falling.iconScaleX < 1, "squashed on the way back");
  for (const ms of samples) {
    const frame = logoSplashFrame(ms);
    const ratio = frame.iconScaleY / frame.iconScaleX;
    assert.ok(
      ratio > 0.85 && ratio < 1.2,
      `squash and stretch stays subtle at ${ms} ms (${ratio})`,
    );
  }
});

test("the icon bounces up into its place with smaller and smaller rebounds", () => {
  const offsets = samples
    .filter((ms) => ms >= 500 && ms <= 1000)
    .map((ms) => logoSplashFrame(ms).iconTranslateY);
  const above = Math.min(...offsets);
  assert.ok(above < -10 && above > -60, `rebounds above its final place (${above} units)`);
  // After the first rebound each swing is smaller than the one before.
  let previousSwing = Infinity;
  let last = offsets[0];
  let direction = Math.sign(offsets[1] - offsets[0]);
  let extreme = offsets[0];
  for (const offset of offsets.slice(1)) {
    const next = Math.sign(offset - last);
    if (next !== 0 && next !== direction) {
      const swing = Math.abs(extreme - last);
      if (previousSwing !== Infinity) assert.ok(swing < previousSwing, "each rebound is smaller");
      if (previousSwing === Infinity) previousSwing = swing;
      else previousSwing = swing;
      extreme = last;
      direction = next;
    }
    last = offset;
  }
});

test("the wordmark fades and rises in from 85% scale with a slight overshoot, after the icon", () => {
  const before = logoSplashFrame(890);
  assert.equal(before.wordmarkOpacity, 0);
  near(before.wordmarkScale, 0.85, 0.001, "wordmark scale before its reveal");
  const peak = Math.max(...samples.map((ms) => logoSplashFrame(ms).wordmarkScale));
  assert.ok(peak > 1.01 && peak < 1.06, `slight overshoot (${peak})`);
  assert.ok(logoSplashFrame(1300).wordmarkOpacity > 0.99, "fully visible by 1.3 s");
  for (let ms = 891; ms <= 1300; ms++) {
    assert.ok(
      logoSplashFrame(ms).wordmarkOpacity >= logoSplashFrame(ms - 1).wordmarkOpacity,
      "opacity never flickers back",
    );
  }
});

test("the lockup gives one small hop at 1.5 s and is still from 1.9 s on", () => {
  assert.equal(logoSplashFrame(1500).groupTranslateY, 0);
  const hopTop = Math.min(...samples.map((ms) => logoSplashFrame(ms).groupTranslateY));
  near(hopTop, -20, 0.5, "hop height");
  const hopAt = samples.find((ms) => logoSplashFrame(ms).groupTranslateY === hopTop) ?? 0;
  assert.ok(hopAt > 1550 && hopAt < 1700, `hop peaks between 1.55 and 1.7 s (${hopAt} ms)`);
  for (let ms = 1900; ms <= LOGO_SPLASH_DURATION_MS; ms += 10) {
    const frame = logoSplashFrame(ms);
    assert.ok(Math.abs(frame.groupTranslateY) < 1, `hold is still at ${ms} ms`);
    near(frame.groupScale, 1, 0.002, `hold scale at ${ms} ms`);
  }
});

test("the last frame is exactly the official logo, and nothing moves in the final hold", () => {
  assert.deepEqual(logoSplashFrame(LOGO_SPLASH_DURATION_MS), LOGO_SPLASH_FINAL_FRAME);
  assert.deepEqual(logoSplashFrame(LOGO_SPLASH_DURATION_MS + 5000), LOGO_SPLASH_FINAL_FRAME);
  for (let ms = 2000; ms <= LOGO_SPLASH_DURATION_MS; ms += 20) {
    const frame = logoSplashFrame(ms);
    near(frame.iconScaleX, 1, 0.001, "icon scale x");
    near(frame.iconScaleY, 1, 0.001, "icon scale y");
    near(frame.iconTranslateY, 0, 0.05, "icon position");
    near(frame.wordmarkScale, 1, 0.001, "wordmark scale");
    near(frame.wordmarkTranslateY, 0, 0.05, "wordmark position");
  }
});

test("the motion is smooth: no frame jumps (60 fps steps stay small)", () => {
  const keys = Object.keys(LOGO_SPLASH_FINAL_FRAME) as (keyof typeof LOGO_SPLASH_FINAL_FRAME)[];
  for (let ms = 17; ms <= LOGO_SPLASH_DURATION_MS; ms++) {
    const now = logoSplashFrame(ms);
    const before = logoSplashFrame(ms - 1);
    for (const key of keys) {
      const limit = key.includes("Translate") ? 8 : 0.08; // per millisecond: units or scale
      assert.ok(
        Math.abs(now[key] - before[key]) < limit,
        `${key} jumps by ${Math.abs(now[key] - before[key])} at ${ms} ms`,
      );
    }
  }
});

test("the same time always gives the same frame, and out-of-range times are clamped", () => {
  assert.deepEqual(logoSplashFrame(777), logoSplashFrame(777));
  assert.deepEqual(logoSplashFrame(-50), logoSplashFrame(0));
});

test("the artwork sits where it does in the official logo (820 x 746 lockup)", () => {
  // Tight artwork bounds inside the PNG files, measured from the files themselves.
  const iconInFile = { left: 85, top: 80, right: 541, bottom: 546 };
  const wordmarkInFile = { left: 129, top: 53, right: 1871, bottom: 577 };
  const wordmarkScale = LOGO_IMAGE_UNITS.wordmark.width / 2000;
  const tolerance = 3.5; // logo units (about 1 dp)

  const { icon, wordmark } = LOGO_IMAGE_UNITS;
  // Official logo, measured from the file: icon at x 166..621, y 0..465; wordmark at x 0..820, y 500..746.
  near(icon.left + iconInFile.left, 166, tolerance, "icon left");
  near(icon.top + iconInFile.top, 0, tolerance, "icon top");
  near(icon.left + iconInFile.right, 621, tolerance, "icon right");
  near(icon.top + iconInFile.bottom, 465, tolerance, "icon bottom");
  near(wordmark.left + wordmarkInFile.left * wordmarkScale, 0, tolerance, "wordmark left");
  near(wordmark.left + wordmarkInFile.right * wordmarkScale, 820, tolerance, "wordmark right");
  near(wordmark.top + wordmarkInFile.top * wordmarkScale, 500, tolerance, "wordmark top");
  near(wordmark.top + wordmarkInFile.bottom * wordmarkScale, 746, tolerance, "wordmark bottom");
});

test("the layout scales with the screen and never changes the logo's proportions", () => {
  const small = logoSplashLayout(200);
  const large = logoSplashLayout(300);
  near(
    small.lockup.height / small.lockup.width,
    LOGO_LOCKUP_UNITS.height / LOGO_LOCKUP_UNITS.width,
    1e-9,
    "lockup ratio",
  );
  near(large.icon.size / small.icon.size, 1.5, 1e-9, "icon scales with the lockup");
  near(large.wordmark.width / small.wordmark.width, 1.5, 1e-9, "wordmark scales with the lockup");
  near(
    large.wordmark.top - large.icon.top,
    (small.wordmark.top - small.icon.top) * 1.5,
    1e-9,
    "gap between icon and wordmark scales with the lockup",
  );
});

test("the lockup fits phones and tablets without cropping", () => {
  for (const [width, height] of [
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1024, 768],
  ] as const) {
    const lockupWidth = logoSplashLockupWidth(width, height);
    const layout = logoSplashLayout(lockupWidth);
    assert.ok(layout.lockup.width <= width * 0.6, `${width}x${height}: width fits`);
    assert.ok(layout.lockup.height <= height / 3 + 1, `${width}x${height}: height fits`);
    assert.ok(lockupWidth >= 150, `${width}x${height}: still legible`);
    // Even at its peak hop and bounce the icon stays on screen.
    const topOfIcon = (height - layout.lockup.height) / 2 + (-30 - 20) * layout.unit;
    assert.ok(topOfIcon > 0, `${width}x${height}: bounce stays on screen`);
  }
});
