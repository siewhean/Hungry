import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";

import { createScreenTracker, getActiveScreenName } from "./screenTracking";

beforeEach(() => clearTrackedAnalyticsEvents());

const tabs = (tab: string) => ({
  index: 0,
  routes: [{ name: "MainTabs", state: { index: 1, routes: [{ name: "Search" }, { name: tab }] } }],
});

test("the active screen is the deepest focused route, not the container", () => {
  assert.equal(getActiveScreenName(tabs("Profile")), "Profile");
  assert.equal(getActiveScreenName({ index: 1, routes: [{ name: "A" }, { name: "B" }] }), "B");
  assert.equal(getActiveScreenName(undefined), undefined);
  assert.equal(getActiveScreenName({ routes: [] }), undefined);
});

test("each change of screen is tracked once, with the previous screen and how long it was open", () => {
  let clock = 1_000;
  const track = createScreenTracker(() => clock);
  track(tabs("Home"));
  clock += 4_000;
  track(tabs("Home"));
  track(tabs("Profile"));

  const events = getTrackedAnalyticsEvents().filter((event) => event.event === "screen_viewed");
  assert.deepEqual(
    events.map((event) => event.properties),
    [
      { screen: "Home" },
      { screen: "Profile", previous_screen: "Home", previous_duration_ms: 4_000 },
    ],
  );
});

test("only the route name is sent, never route params", () => {
  const track = createScreenTracker();
  track({
    index: 0,
    routes: [{ name: "DishDetail", params: { dishId: "d1", q: "me@example.com" } } as never],
  });
  const [event] = getTrackedAnalyticsEvents();
  assert.deepEqual(event?.properties, { screen: "DishDetail" });
});
