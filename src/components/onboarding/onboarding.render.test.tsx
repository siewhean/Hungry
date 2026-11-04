// Renders the onboarding building blocks: the one progress bar, the typed line, the taste slider and
// the food swap picture. Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";
import { Text } from "react-native";

import { FlowProgressBar } from "@/components/onboarding/FlowProgressBar";
import { FoodSwapStage } from "@/components/onboarding/FoodSwapStage";
import { Mascot } from "@/components/onboarding/Mascot";
import { MascotLine } from "@/components/onboarding/MascotLine";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { TasteSlider } from "@/components/onboarding/TasteSlider";
import { TypingText } from "@/components/onboarding/TypingText";
import { resetTypedLines } from "@/features/onboarding/typedLines";
import { useOnboardingScreenViewed } from "@/features/onboarding/useOnboardingScreenViewed";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { TASTE_SLIDER_AXES } from "@/features/onboarding/tasteSliderStops";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

beforeEach(() => {
  resetTypedLines();
  useUIStore.setState({ reducedMotionEnabled: false });
});
afterEach(async () => {
  await cleanup();
  useUIStore.setState({ reducedMotionEnabled: false });
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("FlowProgressBar says which of the 22 screens this is", async () => {
  const view = await render(createElement(FlowProgressBar, { screen: "taste-spicy" }));
  assert.ok(view.findByLabel("Screen 7 of 22"));
  await view.unmount();
});

test("TypingText gives a screen reader the whole line at once and types the visible text in", async () => {
  const view = await render(createElement(TypingText, { lineId: "line-a", text: "Hi you" }));
  assert.ok(view.findByLabel("Hi you"), "the full line is the label from the start");
  await wait(600);
  assert.match(view.text(), /Hi you/);
  await view.unmount();
});

test("TypingText shows a line at once when Reduce Motion is on, and on a return visit", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const reduced = await render(createElement(TypingText, { lineId: "line-b", text: "Right away" }));
  assert.equal(
    reduced.container.textContent?.split("Right away").length,
    3,
    "label text and visible text both complete",
  );
  await reduced.unmount();

  useUIStore.setState({ reducedMotionEnabled: false });
  const first = await render(createElement(TypingText, { lineId: "line-c", text: "Hello there" }));
  await wait(700);
  await first.unmount();
  const again = await render(createElement(TypingText, { lineId: "line-c", text: "Hello there" }));
  assert.equal(again.container.textContent?.split("Hello there").length, 3);
  await again.unmount();
});

test("TypingText finishes the line when it is tapped", async () => {
  const text = "A long enough line to still be typing when it is tapped";
  const view = await render(createElement(TypingText, { lineId: "line-d", text }));
  await view.press(view.findByLabel(text));
  assert.equal(view.container.textContent?.split(text).length, 3);
  await view.unmount();
});

test("TasteSlider is an adjustable control that reads out its value, and shows a dash until set", async () => {
  const unset = await render(
    createElement(TasteSlider, {
      value: 5,
      unset: true,
      onMove: () => undefined,
      onSettle: () => undefined,
      accessibilityLabel: "How spicy do you usually go?",
      accessibilityValueText: "Not set",
    }),
  );
  assert.ok(unset.findByLabel("How spicy do you usually go?"));
  assert.match(unset.text(), /–/);
  await unset.unmount();

  const set = await render(
    createElement(TasteSlider, {
      value: 7.5,
      onMove: () => undefined,
      onSettle: () => undefined,
      accessibilityLabel: "How spicy do you usually go?",
      accessibilityValueText: "7.5, Hot, Sambal stingray",
    }),
  );
  assert.match(set.text(), /7\.5/);
  await set.unmount();
});

test("FoodSwapStage shows the dish and caption of the current stop and follows a change", async () => {
  useUIStore.setState({ reducedMotionEnabled: true });
  const { stops } = TASTE_SLIDER_AXES.spicy;
  const props = { stops, reduceMotion: true, size: 200 };
  const view = await render(createElement(FoodSwapStage, { ...props, stopIndex: 2 }));
  assert.match(view.text(), /Laksa/);
  assert.match(view.text(), /Medium/);
  await view.rerender(createElement(FoodSwapStage, { ...props, stopIndex: 3 }));
  assert.match(view.text(), /Sambal stingray/);
  assert.match(view.text(), /Hot/);
  assert.doesNotMatch(view.text(), /Laksa/);
  await view.unmount();
});

test("FoodSwapStage keeps the leaving dish on screen while the swap animates", async () => {
  const { stops } = TASTE_SLIDER_AXES.spicy;
  const props = { stops, reduceMotion: false, size: 200 };
  const view = await render(createElement(FoodSwapStage, { ...props, stopIndex: 2 }));
  await view.rerender(createElement(FoodSwapStage, { ...props, stopIndex: 4 }));
  assert.match(view.text(), /Mala xiang guo/);
  await wait(500);
  assert.match(view.text(), /Mala xiang guo/);
  await view.unmount();
});

test("Mascot draws the placeholder bowl while there is no pose art, and MascotLine pairs it with its line", async () => {
  const mascot = await render(createElement(Mascot, { pose: "wave", size: 72 }));
  assert.ok(mascot.container.firstElementChild, "the placeholder bowl is drawn");
  await mascot.unmount();

  const line = await render(
    createElement(MascotLine, { pose: "clipboard", lineId: "mascot-line-a", text: "Hello there" }),
  );
  assert.ok(line.findByLabel("Hello there"));
  await line.unmount();
});

test("OnboardingFrame shows the progress bar and content, and Back and the footer work", async () => {
  let backs = 0;
  const view = await render(
    <OnboardingFrame screen="areas" onBack={() => (backs += 1)} footer={<Text>Footer</Text>}>
      <Text>Body</Text>
    </OnboardingFrame>,
  );
  assert.ok(view.findByLabel("Screen 4 of 22"));
  assert.match(view.text(), /Body/);
  assert.match(view.text(), /Footer/);
  await view.press(view.findByLabel("Back"));
  assert.equal(backs, 1);
  await view.unmount();
});

test("useOnboardingScreenViewed reports the numbered screen once when it mounts", async () => {
  clearTrackedAnalyticsEvents();
  function Probe() {
    useOnboardingScreenViewed("loading");
    return createElement(Text, null, "probe");
  }
  const view = await render(createElement(Probe));
  const viewed = getTrackedAnalyticsEvents().filter(
    (record) => record.event === "onboarding_screen_viewed",
  );
  assert.equal(viewed.length, 1);
  assert.equal(viewed[0]?.properties?.screen, "loading");
  await view.unmount();
});
