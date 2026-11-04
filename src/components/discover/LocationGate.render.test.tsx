// The ask before a "near you" screen: device location first, a place search as the fallback.
// Run with `node scripts/test-render.mjs src/components/discover/LocationGate.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { LocationGate } from "@/components/discover/LocationGate";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import { useLocationStore } from "@/store/useLocationStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const originalGrant = useLocationStore.getState().grantLocation;

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});

afterEach(async () => {
  await cleanup();
  useLocationStore.setState({ grantLocation: originalGrant });
});

const gate = (props: { compact?: boolean } = {}) =>
  function Gate() {
    return (
      <LocationGate
        source="decide"
        title="Where are you eating?"
        body="Needs a place."
        {...props}
      />
    );
  };
const choices = () =>
  getTrackedAnalyticsEvents()
    .filter((record) => record.event === "location_gate_choice")
    .map((record) => record.properties.choice);

test("Use my location asks the store once and says nothing when it works", async () => {
  let asked = 0;
  useLocationStore.setState({
    grantLocation: async () => {
      asked += 1;
      return true;
    },
  });
  const view = await renderScreen(gate() as never, { name: "Gate" });
  assert.match(view.text(), /Where are you eating\?/);
  await view.press(view.findByText("Use my location"));
  await view.settle();
  assert.equal(asked, 1);
  assert.equal(view.findByText(/couldn't get your location/i), null);
  assert.deepEqual(choices(), ["use_my_location"]);
});

test("a refused or failed location read says so and keeps the place search one tap away", async () => {
  useLocationStore.setState({ grantLocation: async () => false });
  const navigation = createFakeNavigation();
  const view = await renderScreen(gate() as never, { name: "Gate", navigation });
  await view.press(view.findByText("Use my location"));
  await view.settle();
  assert.match(view.text(), /couldn't get your location/i);

  await view.press(view.findByText("Search for a place"));
  assert.deepEqual(navigation.calls.at(-1), {
    method: "navigate",
    args: ["OnboardingStack", { screen: "ManualLocationPicker" }],
  });
  assert.deepEqual(choices(), ["use_my_location", "search_place"]);
});

test("a location read that throws is reported and shown as a failure", async () => {
  useLocationStore.setState({
    grantLocation: async () => {
      throw new Error("gps exploded");
    },
  });
  const view = await renderScreen(gate() as never, { name: "Gate" });
  await view.press(view.findByText("Use my location"));
  await view.settle();
  assert.match(view.text(), /couldn't get your location/i);
});

test("the compact card keeps both choices and swaps its text on failure", async () => {
  useLocationStore.setState({ grantLocation: async () => false });
  const view = await renderScreen(gate({ compact: true }) as never, { name: "Gate" });
  assert.ok(view.findByText("Use my location"));
  assert.ok(view.findByText("Search for a place"));
  await view.press(view.findByText("Use my location"));
  await view.settle();
  assert.match(view.text(), /couldn't get your location/i);
});
