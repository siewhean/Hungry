import assert from "node:assert/strict";
import type { ScrollView, View } from "react-native";
import test, { afterEach, beforeEach } from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { cleanup, render } from "@/test/render";
import {
  CatalogHomeVisibility,
  useCatalogHomeCardVisibility,
  useCatalogHomeVisibility,
} from "./catalogHomeVisibility";

beforeEach(clearTrackedAnalyticsEvents);
afterEach(cleanup);

test("Home forgets displayed images when the same card changes source or shows a placeholder", async (t) => {
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
  const flushFrames = () => {
    for (const frame of frames.splice(0)) frame(0);
  };

  type Box = [number, number, number, number];
  const measure = (box: Box) => ({
    measureInWindow: (callback: (...size: Box) => void) => callback(...box),
  });
  const viewport = {
    current: { getNativeScrollRef: () => measure([0, 0, 300, 350]) } as unknown as ScrollView,
  };
  const card = measure([0, 0, 100, 100]) as unknown as View;
  let paint!: NonNullable<ReturnType<typeof useCatalogHomeCardVisibility>>;
  function Card() {
    paint = useCatalogHomeCardVisibility(true)!;
    return null;
  }
  function Home({ focused }: { focused: boolean }) {
    const observer = useCatalogHomeVisibility({ focused, scope: "area", viewport, stale: false });
    return (
      <CatalogHomeVisibility.Provider value={observer}>
        <Card />
      </CatalogHomeVisibility.Provider>
    );
  }
  function milestones() {
    return getTrackedAnalyticsEvents()
      .filter(({ event }) => event === "catalog_performance")
      .map(({ properties }) => properties.milestone);
  }

  const view = await render(<Home focused />);
  paint.ref(card);
  paint.onImageSourceChange("first");
  paint.onImageDisplay("first");
  paint.onLayout();
  flushFrames();
  assert.deepEqual(milestones(), ["actionable", "image"]);

  await view.rerender(<Home focused={false} />);
  clearTrackedAnalyticsEvents();
  paint.onImageSourceChange("replacement");
  paint.onImageError("replacement");
  paint.onImageDisplay("first");
  paint.onLayout();
  await view.rerender(<Home focused />);
  flushFrames();
  assert.deepEqual(milestones(), ["actionable"]);

  paint.onImageSourceChange("working");
  paint.onImageDisplay("working");
  paint.onLayout();
  flushFrames();
  assert.deepEqual(milestones(), ["actionable", "image"]);
});
