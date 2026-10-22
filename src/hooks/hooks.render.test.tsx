// Hooks, share helpers and permission helpers that need a React tree or native-module stubs.
// Run with `npm run test:render`.

import assert from "node:assert/strict";
import { createElement } from "react";
import { createRequire } from "node:module";
import { Alert, Platform, Share } from "react-native";
import test, { afterEach } from "node:test";

import {
  useItemDetailsState,
  useItemLabels,
  useItemLabelsState,
  itemLabelTargetsKey,
} from "@/features/checklistPortfolio/useItemLabels";
import { useRetryableLoad } from "@/features/profile/useRetryableLoad";
import { profileShareUrl, shareProfileLink } from "@/features/share/profileShare";
import { useFoodHistory } from "@/hooks/useFoodHistory";
import { useScrollToRevealBack } from "@/hooks/useScrollToRevealBack";
import { askMediaSource, captureWithCamera } from "@/lib/permissions/mediaSource";
import { getHungryService, setMockServiceProvider } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";

afterEach(cleanup);

/** Renders a hook and exposes its latest return value; `again()` re-renders without remounting. */
async function renderHook<T>(useHook: () => T) {
  const box: { current: T } = { current: undefined as T };
  function Probe() {
    box.current = useHook();
    return null;
  }
  const view = await render(createElement(Probe));
  return { box, view, again: () => view.rerender(createElement(Probe)) };
}

test("useRetryableLoad runs the loader on mount and reports success", async () => {
  let loads = 0;
  const load = async () => {
    loads += 1;
  };
  const { box } = await renderHook(() => useRetryableLoad(load, "lists"));
  assert.equal(loads, 1);
  assert.equal(box.current.failed, false);
});

test("useRetryableLoad flags a failed load and clears the flag when retry succeeds", async () => {
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    let shouldFail = true;
    const load = async () => {
      if (shouldFail) throw new Error("offline");
    };
    const { box, view } = await renderHook(() => useRetryableLoad(load, "lists"));
    assert.equal(box.current.failed, true);
    assert.match(String(logged[0][0]), /Failed to load lists/);

    shouldFail = false;
    box.current.retry();
    await view.settle();
    assert.equal(box.current.failed, false);
  } finally {
    console.error = originalError;
  }
});

test("itemLabelTargetsKey is stable and order-independent", () => {
  assert.equal(itemLabelTargetsKey([]), "");
  assert.equal(
    itemLabelTargetsKey([{ dishId: "b" }, { stallId: "z" }, { dishId: "a" }, { dishId: "b" }]),
    itemLabelTargetsKey([{ dishId: "a" }, { dishId: "b" }, { stallId: "z" }]),
  );
  assert.equal(itemLabelTargetsKey([{ dishId: "a" }, { stallId: "s" }]), "d:a,s:s");
});

test("useItemLabels looks dishes and venues up one by one and finishes loading", async () => {
  setMockServiceProvider();
  const items = [{ dishId: "does-not-exist" }, { stallId: "no-such-venue" }];
  const { box } = await renderHook(() => useItemLabelsState(items));
  assert.equal(box.current.isLoaded, true);
  assert.deepEqual(box.current.labels, {}, "ids that resolve to nothing produce no labels");
});

test("useItemDetailsState reports lookup errors as failed ids and retry looks them up again", async () => {
  setMockServiceProvider();
  const discovery = getHungryService().discovery;
  const original = discovery.getDish;
  let calls = 0;
  let fail = true;
  discovery.getDish = (async (id: string) => {
    calls += 1;
    if (fail) throw new Error("timeout");
    return { id, name: "Chicken Rice", venueName: "Tian Tian", price: 5, imageUrl: "" } as never;
  }) as typeof discovery.getDish;
  try {
    const items = [{ dishId: "d1" }];
    const { box, view } = await renderHook(() => useItemDetailsState(items));
    assert.equal(box.current.isLoaded, true);
    assert.deepEqual([...box.current.failedIds], ["d1"]);
    assert.deepEqual(box.current.details, {});

    fail = false;
    box.current.retry();
    await view.settle();
    assert.equal(box.current.failedIds.size, 0);
    assert.equal(box.current.details.d1.name, "Chicken Rice");
    assert.equal(box.current.details.d1.stallName, "Tian Tian");
    assert.equal(box.current.details.d1.price, 5);
    assert.ok(calls >= 2);
  } finally {
    discovery.getDish = original;
  }
});

test("useItemDetailsState reads a whole portfolio in one call and marks everything failed if it errors", async () => {
  setMockServiceProvider();
  const portfolio = getHungryService().portfolio;
  const original = portfolio.getPortfolioItemDetails;
  let calls = 0;
  let fail = false;
  portfolio.getPortfolioItemDetails = (async () => {
    calls += 1;
    if (fail) throw new Error("rpc failed");
    return [
      { dishId: "d1", name: "Laksa", stallName: "Katong", price: 6, imageUrl: "x.jpg" },
      { stallId: "s1", name: "Maxwell stall", imageUrl: "y.jpg" },
    ] as never;
  }) as typeof portfolio.getPortfolioItemDetails;
  try {
    const items = [{ dishId: "d1" }, { stallId: "s1" }];
    const { box, view } = await renderHook(() => useItemDetailsState(items, "p1"));
    assert.equal(calls, 1, "one request for the whole list, not one per item");
    assert.equal(box.current.details.d1.stallName, "Katong");
    assert.equal(
      box.current.details.s1.stallName,
      undefined,
      "stalls carry no stall name or price",
    );

    fail = true;
    box.current.retry();
    await view.settle();
    assert.deepEqual([...box.current.failedIds].sort(), ["d1", "s1"]);
  } finally {
    portfolio.getPortfolioItemDetails = original;
  }
});

test("useItemLabels returns just the names and keeps the same object while nothing changes", async () => {
  setMockServiceProvider();
  const discovery = getHungryService().discovery;
  const original = discovery.getVenue;
  discovery.getVenue = (async (id: string) => ({
    id,
    name: "Hill Street Char Kway Teow",
  })) as never;
  try {
    const items = [{ stallId: "s9" }];
    const { box, again } = await renderHook(() => useItemLabels(items));
    assert.deepEqual(box.current, { s9: "Hill Street Char Kway Teow" });
    const first = box.current;
    await again();
    assert.equal(box.current, first);
  } finally {
    discovery.getVenue = original;
  }
});

test("useFoodHistory derives history and openness from the profile store", async () => {
  const { box, view, again } = await renderHook(() => useFoodHistory());
  assert.ok(box.current.history);
  assert.ok(box.current.openness);
  const before = box.current;
  await again();
  assert.equal(box.current, before, "memoised while the profile is unchanged");
  useProfileStore.setState({ foodHistory: [...(useProfileStore.getState().foodHistory ?? [])] });
  await view.settle();
  assert.notEqual(box.current, before, "a new food history recomputes");
});

test("useScrollToRevealBack forwards the scroll offset to the UI store", async () => {
  useUIStore.setState({ lastScrollY: 0, isHeaderCollapsed: false, scrollBackVisible: false });
  const { box } = await renderHook(() => useScrollToRevealBack());
  assert.equal(box.current.scrollEventThrottle, 16);
  const scroll = (y: number) =>
    box.current.onScroll({ nativeEvent: { contentOffset: { y } } } as never);
  scroll(500);
  assert.equal(useUIStore.getState().lastScrollY, 500);
  assert.equal(useUIStore.getState().isHeaderCollapsed, true);
  scroll(400);
  assert.equal(
    useUIStore.getState().scrollBackVisible,
    true,
    "scrolling up past 300 reveals the back button",
  );
});

test("profileShareUrl points at the web profile and carries the share channel", () => {
  const url = profileShareUrl("user 1", "copy_link");
  assert.match(url, /\/user\/user%201/);
  assert.match(url, /[?&]src=copy_link/);
});

test("shareProfileLink opens the system share sheet with the name and a tagged link", async () => {
  const original = Share.share;
  const shared: { message?: string }[] = [];
  Share.share = (async (content: { message?: string }) => {
    shared.push(content);
    return { action: "sharedAction" };
  }) as typeof Share.share;
  try {
    await shareProfileLink("u1", "Wei Ming");
    assert.equal(shared.length, 1);
    assert.match(
      shared[0].message ?? "",
      /^Wei Ming on Hungry: https?:\/\/.*\/user\/u1\?src=system_share$/,
    );
  } finally {
    Share.share = original;
  }
});

test("askMediaSource goes straight to the library on web", async () => {
  assert.equal(Platform.OS, "web");
  assert.equal(await askMediaSource(), "library");
});

test("askMediaSource asks natively and resolves with the chosen source or null on cancel", async () => {
  const originalOS = Platform.OS;
  const originalAlert = Alert.alert;
  const choose = (label: string) => {
    Alert.alert = ((
      _title: string,
      _message: unknown,
      buttons: { text: string; onPress?: () => void }[],
    ) => {
      buttons.find((button) => button.text === label)?.onPress?.();
    }) as typeof Alert.alert;
  };
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
  try {
    choose("Take photo");
    assert.equal(await askMediaSource("Add a photo"), "camera");
    choose("Choose from library");
    assert.equal(await askMediaSource(), "library");
    choose("Cancel");
    assert.equal(await askMediaSource(), null);
  } finally {
    Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    Alert.alert = originalAlert;
  }
});

test("captureWithCamera reports denied permission, a cancelled capture, and a photo", async () => {
  // The raw (assignable) module, not an import namespace.
  const picker = createRequire(__filename)("expo-image-picker") as Record<string, unknown>;
  const original = {
    request: picker.requestCameraPermissionsAsync,
    launch: picker.launchCameraAsync,
  };
  try {
    picker.requestCameraPermissionsAsync = async () => ({
      granted: false,
      status: "denied",
      canAskAgain: false,
    });
    assert.deepEqual(await captureWithCamera({}), { status: "denied" });

    picker.requestCameraPermissionsAsync = async () => ({
      granted: true,
      status: "granted",
      canAskAgain: true,
    });
    picker.launchCameraAsync = async () => ({ canceled: true, assets: null });
    assert.deepEqual(await captureWithCamera({}), { status: "canceled" });

    picker.launchCameraAsync = async () => ({
      canceled: false,
      assets: [{ uri: "file://photo.jpg" }],
    });
    assert.deepEqual(await captureWithCamera({}), {
      status: "ok",
      assets: [{ uri: "file://photo.jpg" }],
    });
  } finally {
    picker.requestCameraPermissionsAsync = original.request;
    picker.launchCameraAsync = original.launch;
  }
});
