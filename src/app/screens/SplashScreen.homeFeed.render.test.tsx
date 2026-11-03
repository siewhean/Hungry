// Splash for a signed-in diner: Home's first stalls are read behind the splash, and the splash
// leaves for Home once they land (or after the cap). Run with
// `node scripts/test-render.mjs src/app/screens/SplashScreen.homeFeed.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import {
  getServiceProvider,
  resetServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { SplashScreen } from "./SplashScreen";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function installLiveProvider() {
  const firstPage = deferred<DiscoveryLocationFeed | undefined>();
  const mock = getServiceProvider();
  setServiceProvider({
    ...mock,
    mode: "supabase",
    service: {
      ...mock.service,
      discovery: {
        ...mock.service.discovery,
        listDiscoveryFeedByLocation: (request) =>
          request.limit === DISCOVER_FIRST_PAGE_LIMIT
            ? firstPage.promise
            : new Promise<DiscoveryLocationFeed | undefined>(() => undefined),
        countVenuesInArea: () => new Promise<number | undefined>(() => undefined),
      },
    },
  });
  return firstPage;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const resets = (navigation: ReturnType<typeof createFakeNavigation>) =>
  navigation.calls.filter((call) => call.method === "reset");

beforeEach(async () => {
  await enterScenario("user");
  useSessionStore.setState({ isAuthReady: true, hasHydrated: true });
});

afterEach(async () => {
  resetServiceProvider();
  await cleanup();
});

test("a signed-in diner stays on Splash until Home's nearest stalls land, then opens Home", async () => {
  const firstPage = installLiveProvider();
  const navigation = createFakeNavigation();
  const view = await renderScreen(SplashScreen as never, { name: "Splash", navigation });
  await wait(1200);
  await view.settle();
  assert.equal(resets(navigation).length, 0, "still waiting for the first stalls");

  firstPage.resolve({ venues: [], results: [] });
  await wait(100);
  await view.settle();
  assert.deepEqual(resets(navigation)[0]?.args[0], {
    index: 0,
    routes: [{ name: "MainTabs", params: { screen: "Home" } }],
  });
});

test("a slow network does not hold the diner on Splash past the cap", async () => {
  installLiveProvider();
  const navigation = createFakeNavigation();
  const view = await renderScreen(SplashScreen as never, { name: "Splash", navigation });
  await wait(4300);
  await view.settle();
  assert.equal(resets(navigation).length, 1);
});
