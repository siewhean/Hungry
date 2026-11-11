// The launch logo: official icon and wordmark, animated or (Reduce Motion) already at rest. Run with
// `node scripts/test-render.mjs src/components/ui/AnimatedHungryLogo.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { cleanup, render, settle } from "@/test/render";

import { AnimatedHungryLogo } from "./AnimatedHungryLogo";

afterEach(cleanup);

const images = () => logo().querySelectorAll('[data-stub="expo-image.Image"]');
const logo = () => document.body.querySelector('[data-testid="logo"]') as HTMLElement;

test("AnimatedHungryLogo is one labelled image made of the official icon and wordmark", async () => {
  await render(<AnimatedHungryLogo testID="logo" animated={false} />);
  await settle();
  assert.ok(logo(), "the logo is on screen");
  assert.equal(logo().getAttribute("aria-label"), "Hungry logo");
  assert.equal(logo().getAttribute("role"), "img");
  assert.equal(images().length, 2, "the icon and the wordmark");
});

test("AnimatedHungryLogo draws the same logo whether it animates or not", async () => {
  for (const animated of [true, false]) {
    await render(<AnimatedHungryLogo testID="logo" animated={animated} />);
    await settle();
    assert.equal(images().length, 2, `animated=${animated}: icon and wordmark`);
    assert.equal(logo().style.width, "218px", `animated=${animated}: same size`);
    await cleanup();
  }
});

test("AnimatedHungryLogo keeps its lockup in the official 820 : 746 shape", async () => {
  await render(<AnimatedHungryLogo testID="logo" animated={false} />);
  await settle();
  const width = parseFloat(logo().style.width);
  const height = parseFloat(logo().style.height);
  assert.ok(width > 0 && height > 0);
  assert.ok(Math.abs(height / width - 746 / 820) < 0.005, "same proportions as the official logo");
});
