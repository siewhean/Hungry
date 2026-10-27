// The animated welcome: a phone that cycles through Hungry screens over a drifting backdrop.
// Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { WelcomeScreen } from "@/app/screens/onboarding/WelcomeScreen";
import { WelcomeBackdrop } from "@/components/onboarding/WelcomeBackdrop";
import { WELCOME_SLIDE_MS, WelcomePhoneMockup } from "@/components/onboarding/WelcomePhoneMockup";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => useUIStore.setState({ reducedMotionEnabled: false }));
afterEach(async () => {
  await cleanup();
  useUIStore.setState({ reducedMotionEnabled: false });
});

test("the phone holds three Hungry screens and is hidden from screen readers", async () => {
  const view = await render(createElement(WelcomePhoneMockup, { width: 200 }));
  for (const text of ["Near you", "Laksa", "Nasi lemak", "I tried this", "Your taste"]) {
    assert.ok(view.findByText(text), `${text} is drawn in the phone`);
  }
  const phone = view.findByTestId("welcome-phone-mockup");
  assert.equal(phone?.getAttribute("aria-hidden"), "true");
});

test("the phone moves to the next screen on a timer and stops when it unmounts", async () => {
  const seen: number[] = [];
  const view = await render(
    createElement(WelcomePhoneMockup, { width: 200, onSlideChange: (i: number) => seen.push(i) }),
  );
  assert.deepEqual(seen, [0]);
  await wait(WELCOME_SLIDE_MS + 300);
  await view.settle();
  assert.deepEqual(seen, [0, 1]);

  await view.unmount();
  await wait(WELCOME_SLIDE_MS + 300);
  assert.deepEqual(seen, [0, 1], "no timer is left running after unmount");
});

test("Reduce Motion keeps the phone on its first screen", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const seen: number[] = [];
  const view = await render(
    createElement(WelcomePhoneMockup, { width: 200, onSlideChange: (i: number) => seen.push(i) }),
  );
  await wait(WELCOME_SLIDE_MS + 300);
  await view.settle();
  assert.deepEqual(seen, [0]);
});

test("the backdrop is decorative: hidden from screen readers", async () => {
  const view = await render(createElement(WelcomeBackdrop));
  const hidden = view.container.querySelector('[aria-hidden="true"]');
  assert.ok(hidden, "the backdrop is hidden from screen readers");
});

test("Welcome reads every promise to screen readers and lists them all under Reduce Motion", async () => {
  const animated = await render(createElement(WelcomeScreen as never), {
    route: { name: "OnboardingWelcome" },
  });
  const label = animated.findByLabel(/Ranked by people who ate it/);
  assert.match(label?.getAttribute("aria-label") ?? "", /Personalised to your taste/);
  assert.equal(animated.findByText("Find the best hawker stalls near you"), null);
  await animated.unmount();

  useUIStore.setState({ reducedMotionEnabled: true });
  const still = await render(createElement(WelcomeScreen as never), {
    route: { name: "OnboardingWelcome" },
  });
  for (const line of [
    "Ranked by people who ate it",
    "Find the best hawker stalls near you",
    "Personalised to your taste",
  ]) {
    assert.ok(still.findByText(line), `${line} is shown`);
  }
  assert.ok(still.findByText("Get started"));
});
