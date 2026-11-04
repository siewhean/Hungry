// The Wheel as it ships in production: solo only, so it opens straight on its lobby.
// Run with `node scripts/test-render.mjs src/app/screens/wheel/wheelSolo.render.test.tsx`.
// The flags are read when the screens load, so the production setting is imported first.

import "@/test/render/productionEnv";
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { clearTrackedAnalyticsEvents } from "@/lib/analytics";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const loadScreen = async () =>
  (await import("@/app/screens/wheel/WheelHomeScreen")).WheelHomeScreen;
const loadStore = async () => (await import("@/store/useWheelStore")).useWheelStore;

beforeEach(async () => {
  await enterScenario("guest");
  clearTrackedAnalyticsEvents();
});

afterEach(async () => {
  await cleanup();
  (await loadStore()).getState().reset();
});

test("MD-W1 with parties off, the wheel opens straight on its lobby", async () => {
  const Screen = await loadScreen();
  const navigation = createFakeNavigation();
  await renderScreen(Screen as never, { name: "WheelHome", params: undefined, navigation });
  const replaced = navigation.calls.filter((call) => call.method === "replace");
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].args[0], "WheelLobby");
  assert.ok((await loadStore()).getState().party, "a solo wheel was made");
});

test("MD-W1 a failed start says so, is reported, and Try again starts it", async () => {
  const Screen = await loadScreen();
  const store = await loadStore();
  const real = store.getState().createParty;
  const originalConsoleError = console.error;
  const reported: { action?: string }[] = [];
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[2] as { action?: string });
  };
  store.setState({
    createParty: async () => {
      throw new Error("offline");
    },
  });
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(Screen as never, {
      name: "WheelHome",
      params: undefined,
      navigation,
    });
    assert.match(view.text(), /Couldn't set up your wheel/);
    assert.ok(reported.some((report) => report.action === "create_party"));
    assert.equal(navigation.calls.filter((call) => call.method === "replace").length, 0);

    store.setState({ createParty: real });
    await view.settle();
    await view.press(view.findByText("Try again"));
    assert.equal(navigation.calls.filter((call) => call.method === "replace").length, 1);
  } finally {
    console.error = originalConsoleError;
    globals.__DEV__ = previousDev;
    store.setState({ createParty: real });
  }
});

test("an invite link still explains that group spins are coming, and offers a solo spin", async () => {
  const Screen = await loadScreen();
  const navigation = createFakeNavigation();
  const view = await renderScreen(Screen as never, {
    name: "WheelHome",
    params: { code: "MAKAN7" },
    navigation,
  });
  assert.match(view.text(), /Group spins are coming soon/);
  assert.equal(navigation.calls.filter((call) => call.method === "replace").length, 0);
  await view.press(view.findByLabel("Spin the wheel"));
  assert.equal(navigation.calls.filter((call) => call.method === "replace").length, 1);
});
