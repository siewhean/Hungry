import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = (file) => readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), "utf8");
const tokens = source("src/styles/tokens.css");
const token = (name) => {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(match, `Missing ${name}`);
  return match[1];
};
const luminance = (hex) => {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
for (const bg of ["color-bg", "color-bg-soft", "color-bg-warm", "color-surface", "color-surface-warm", "color-orange-light"]) {
  for (const fg of ["color-primary", "color-text-primary", "color-text-secondary", "color-text-muted"]) {
    assert.ok(contrast(token(fg), token(bg)) >= 4.5, `${fg} on ${bg} must meet 4.5:1`);
  }
}
for (const bg of ["color-primary", "color-primary-dark"]) {
  assert.ok(contrast(token("color-white"), token(bg)) >= 4.5, `white labels on ${bg}`);
}
assert.ok(contrast(token("color-ink-deep"), token("color-bg")) >= 3, "focus on warm surface");
const mockup = source("src/components/home/DiscoveryPhoneMockup.tsx");
assert.doesNotMatch(mockup, /const reviewCards|Mei Lin|Arjun|Rice was fragrant|Good wok hei|4\.7 ★|4\.8 ★/);
assert.match(mockup, /No customer reviews are shown in this preview/);
for (const page of ["src/components/sections/Hero.tsx", "src/app/for-foodies/page.tsx", "src/components/sections/StickyShowcase.tsx"]) {
  assert.match(source(page), /[Pp]roduct preview[\s\S]*illustrative/, `${page} discloses examples`);
}
const carousel = source("src/components/home/HawkerCultureCarousel.tsx");
for (const marker of ['tabIndex={0}', 'role="region"', 'aria-label="Singapore food culture cards"', 'event.key === "ArrowLeft"', 'event.key === "Home"', 'prefers-reduced-motion']) {
  assert.ok(carousel.includes(marker), `carousel keyboard contract: ${marker}`);
}
console.log("Consumer accessibility contracts passed: 24 text pairs, 2 button pairs, focus contrast, truthful previews and keyboard controls.");
