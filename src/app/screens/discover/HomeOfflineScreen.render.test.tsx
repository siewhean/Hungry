// The offline Home page (HomeOfflineScreen): what Home shows when the live feed can't load.
// Run with `node scripts/test-render.mjs <file>`.
import assert from "node:assert/strict";
import { act, createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { HOME_OFFLINE_COPY, HomeOfflineScreen } from "@/app/screens/discover/HomeOfflineScreen";
import { clearCachedDiscoverFeed, writeCachedDiscoverFeed } from "@/features/discover/feedCache";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { VenueSummary } from "@/types/domain";

function venue(id: string, name: string, buildingName?: string) {
  return { id, name, buildingId: "b1", buildingName } as VenueSummary;
}

function setSavedDishes(ids: string[]) {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, favouriteDishIds: ids },
  }));
}

beforeEach(async () => {
  await enterScenario("user");
  await clearCachedDiscoverFeed();
  useUIStore.setState({ isOffline: false });
  setSavedDishes([]);
});

afterEach(async () => {
  await cleanup();
  useUIStore.setState({ isOffline: false });
});

test("with the phone online it says Hungry can't be reached and Try again retries", async () => {
  let retries = 0;
  const view = await render(createElement(HomeOfflineScreen, { onRetry: () => (retries += 1) }));

  assert.match(view.text(), new RegExp(HOME_OFFLINE_COPY.unreachable.title));
  assert.doesNotMatch(view.text(), /Saved on this phone|From your last visit/);
  await view.press(view.findByTestId("home-offline-retry"));
  assert.equal(retries, 1);
});

test("with no connection it says so, and coming back online retries without a tap", async () => {
  useUIStore.setState({ isOffline: true });
  let retries = 0;
  const view = await render(createElement(HomeOfflineScreen, { onRetry: () => (retries += 1) }));

  assert.match(view.text(), /You're offline/);
  assert.equal(retries, 0);
  await act(async () => useUIStore.setState({ isOffline: false }));
  await view.settle();
  assert.equal(retries, 1, "reconnecting tries the live Home");
  assert.match(view.text(), /Can't reach Hungry/);
});

test("saved dishes and the last visit's stalls stay in reach and open their pages", async () => {
  setSavedDishes(["d1", "d2"]);
  await writeCachedDiscoverFeed("area-a", {
    venues: [venue("v1", "Ah Seng Fishball", "Maxwell Food Centre"), venue("v2", "Hill Street")],
    results: [],
  });
  const view = await render(createElement(HomeOfflineScreen, { onRetry: () => undefined }));
  await view.settle();

  assert.match(view.text(), /Your saved dishes/);
  assert.match(view.text(), /2 dishes/);
  assert.match(view.text(), /From your last visit/);
  assert.match(view.text(), /Ah Seng Fishball/);

  await view.press(view.findByLabel("Your saved dishes, 2 saved"));
  assert.deepEqual(view.navigation.calls.at(-1)?.args, ["Favourites", { section: "dishes" }]);
  await view.press(view.findByLabel("Ah Seng Fishball, Maxwell Food Centre"));
  assert.deepEqual(view.navigation.calls.at(-1)?.args, ["StallDetail", { venueId: "v1" }]);
});
