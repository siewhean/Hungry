import assert from "node:assert/strict";
import { act } from "react";
import type { ScrollView, View } from "react-native";
import test, { afterEach, beforeEach } from "node:test";

import { useDetailPaint } from "@/features/detail/useDetailPaint";
import { useCatalogHomeVisibility } from "@/features/discover/catalogHomeVisibility";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { markCatalogTap } from "@/lib/monitoring/catalogPerformance";
import { cleanup, createFakeNavigation, render } from "@/test/render";

beforeEach(clearTrackedAnalyticsEvents);
afterEach(cleanup);

function milestones() {
  return getTrackedAnalyticsEvents()
    .filter(({ event }) => event === "catalog_performance")
    .map(({ properties }) => [properties.milestone, properties.outcome, properties.timing_origin]);
}

test("detail layout, empty menu and image each record once from the matching tap", async () => {
  let paint!: ReturnType<typeof useDetailPaint>;
  function Probe() {
    paint = useDetailPaint("stall", "fixture-stall");
    return null;
  }
  markCatalogTap("stall", "fixture-stall");
  await render(<Probe />);
  await act(async () => {
    paint.headerLayout();
    paint.menuLayout(true);
  });
  await act(async () => {
    paint.headerLayout();
    paint.menuLayout(true);
    paint.imageDisplayed();
    paint.imageDisplayed();
  });
  assert.deepEqual(milestones(), [
    ["actionable", "success", "tap"],
    ["menu", "empty", "tap"],
    ["image", "success", "tap"],
  ]);
});

test("returning to the same detail route starts a fresh timing attempt", async () => {
  const listeners = new Map<string, Set<() => void>>();
  let focused = true;
  const navigation = Object.assign(createFakeNavigation(), {
    isFocused: () => focused,
    addListener(event: string, callback: () => void) {
      const callbacks = listeners.get(event) ?? new Set<() => void>();
      callbacks.add(callback);
      listeners.set(event, callbacks);
      return () => {
        callbacks.delete(callback);
      };
    },
  });
  const setFocus = (next: boolean) =>
    act(async () => {
      focused = next;
      for (const notify of [...(listeners.get(next ? "focus" : "blur") ?? [])]) notify();
    });

  let paint!: ReturnType<typeof useDetailPaint>;
  function Probe() {
    paint = useDetailPaint("stall", "same-stall");
    return null;
  }

  markCatalogTap("stall", "same-stall");
  await render(<Probe />, { navigation });
  await act(async () => {
    paint.headerLayout();
    paint.menuLayout(false);
  });
  await act(async () => paint.imageDisplayed());

  await setFocus(false);
  await act(async () => paint.imageDisplayed());
  assert.equal(milestones().length, 3);
  await setFocus(true);
  await act(async () => {
    paint.imageDisplayed();
    paint.imageDisplayed();
    paint.headerLayout();
    paint.menuLayout(false);
  });

  assert.deepEqual(milestones(), [
    ["actionable", "success", "tap"],
    ["menu", "success", "tap"],
    ["image", "success", "tap"],
    ["actionable", "success", "focus"],
    ["menu", "success", "focus"],
    ["image", "success", "focus"],
  ]);
});

test("Home records cards only inside its viewport and measures displayed images independently", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
  const frames: FrameRequestCallback[] = [];
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (frame: FrameRequestCallback) => frames.push(frame),
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "requestAnimationFrame", original);
    else Reflect.deleteProperty(globalThis, "requestAnimationFrame");
  });

  type Box = [number, number, number, number];
  const measure = (box: Box) => ({
    measureInWindow: (callback: (...size: Box) => void) => callback(...box),
  });
  const viewport = {
    current: { getNativeScrollRef: () => measure([0, 0, 300, 350]) } as unknown as ScrollView,
  };
  let visibility!: ReturnType<typeof useCatalogHomeVisibility>;
  function Probe() {
    visibility = useCatalogHomeVisibility({ focused: true, scope: "area", viewport, stale: false });
    return null;
  }
  await render(<Probe />);
  const flushFrames = () => {
    for (const frame of frames.splice(0)) frame(0);
  };
  visibility.observe(measure([0, 351, 125, 100]) as unknown as View, true);
  flushFrames();
  assert.deepEqual(milestones(), []);

  const visible = measure([0, 250, 125, 100]) as unknown as View;
  visibility.observe(visible, false);
  flushFrames();
  assert.deepEqual(milestones(), [["actionable", "success", "mount"]]);
  visibility.observe(visible, true);
  flushFrames();
  assert.deepEqual(milestones(), [
    ["actionable", "success", "mount"],
    ["image", "success", "mount"],
  ]);
});
