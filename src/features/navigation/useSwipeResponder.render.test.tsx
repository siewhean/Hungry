import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { cleanup, render } from "@/test/render";
import { useSwipeResponder, type SwipeMode } from "@/features/navigation/useSwipeResponder";
import type { SwipeIntent } from "@/features/navigation/swipeIntent";

afterEach(cleanup);

type Handlers = ReturnType<typeof useSwipeResponder>;
type Handler = (event: unknown) => unknown;

/** A one-finger touch event the way the responder system hands it over. */
function touch(x: number, y: number, t: number, startX: number, startY: number, startT: number) {
  return {
    nativeEvent: { pageX: x, pageY: y, timestamp: t, touches: [{ pageX: x, pageY: y }] },
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: t,
      touchBank: [
        {
          touchActive: true,
          startPageX: startX,
          startPageY: startY,
          startTimeStamp: startT,
          currentPageX: x,
          currentPageY: y,
          currentTimeStamp: t,
          previousPageX: x,
          previousPageY: y,
          previousTimeStamp: t,
        },
      ],
    },
  };
}

async function mountResponder(mode: SwipeMode) {
  const intents: SwipeIntent[] = [];
  let handlers: Handlers | undefined;
  function Probe() {
    handlers = useSwipeResponder(mode, (intent) => intents.push(intent));
    return null;
  }
  await render(<Probe />);
  const call = (name: string, event: unknown): unknown =>
    (handlers as unknown as Record<string, Handler>)[name](event);
  /** Puts a finger down at startX and drags it to endX over 150 ms; returns whether it was taken. */
  function swipe(startX: number, endX: number, dy = 0): boolean {
    const y0 = 400;
    call("onStartShouldSetResponderCapture", touch(startX, y0, 0, startX, y0, 0));
    call("onStartShouldSetResponder", touch(startX, y0, 0, startX, y0, 0));
    const mid = touch((startX + endX) / 2, y0 + dy / 2, 80, startX, y0, 0);
    const moveShould =
      mode === "edge" ? "onMoveShouldSetResponderCapture" : "onMoveShouldSetResponder";
    const taken = Boolean(call(moveShould, mid));
    if (taken) {
      call("onResponderGrant", mid);
      call("onResponderMove", touch(endX, y0 + dy, 150, startX, y0, 0));
      call("onResponderRelease", touch(endX, y0 + dy, 150, startX, y0, 0));
    }
    return taken;
  }
  return { intents, swipe };
}

test("an edge swipe from the left edge goes back, from the right edge goes forward", async () => {
  const { intents, swipe } = await mountResponder("edge");
  assert.equal(swipe(8, 200), true);
  assert.equal(swipe(380, 150), true);
  assert.deepEqual(intents, ["edge-from-left", "edge-from-right"]);
});

test("an edge swipe ignores touches that start away from the edge, and scrolls", async () => {
  const { intents, swipe } = await mountResponder("edge");
  assert.equal(swipe(150, 300), false, "mid-screen swipes are not edge swipes");
  assert.equal(swipe(8, 20, 90), false, "a mostly vertical drag is a scroll");
  assert.deepEqual(intents, []);
});

test("a content swipe changes section, and leaves the edges to page navigation", async () => {
  const { intents, swipe } = await mountResponder("content");
  assert.equal(swipe(300, 120), true);
  assert.equal(swipe(100, 300), true);
  assert.equal(swipe(6, 200), false, "the left edge stays the system's back swipe");
  assert.equal(swipe(385, 150), false, "the right edge belongs to page navigation");
  assert.deepEqual(intents, ["content-left", "content-right"]);
});
