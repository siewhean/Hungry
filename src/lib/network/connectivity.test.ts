import assert from "node:assert/strict";
import test from "node:test";

import {
  createConnectivityAwareFetch,
  createConnectivityMonitor,
  getLastNetworkSuccessAt,
  isNetworkOffline,
  NETWORK_SUCCESS_GRACE_MS,
  OFFLINE_DEBOUNCE_MS,
  resetNetworkSuccessForTests,
  subscribeToNetworkSuccess,
} from "./connectivity";

test("connectivity treats confirmed transport or internet loss as offline", () => {
  assert.equal(
    isNetworkOffline({ isConnected: false, isInternetReachable: true }, { lastSuccessAt: null }),
    true,
  );
  assert.equal(
    isNetworkOffline({ isConnected: true, isInternetReachable: false }, { lastSuccessAt: null }),
    true,
  );
});

test("connectivity waits for an unknown reachability probe before declaring offline", () => {
  assert.equal(isNetworkOffline({ isConnected: true, isInternetReachable: null }), false);
  assert.equal(isNetworkOffline({ isConnected: null, isInternetReachable: null }), false);
});

test("a recent successful request outweighs a failed reachability probe", () => {
  const now = 1_000_000;
  const probeFailed = { isConnected: true, isInternetReachable: false };
  assert.equal(isNetworkOffline(probeFailed, { lastSuccessAt: now - 1_000, now }), false);
  assert.equal(
    isNetworkOffline(probeFailed, { lastSuccessAt: now - NETWORK_SUCCESS_GRACE_MS - 1, now }),
    true,
  );
  // Losing the transport is offline regardless of earlier successes.
  assert.equal(
    isNetworkOffline(
      { isConnected: false, isInternetReachable: false },
      { lastSuccessAt: now - 1_000, now },
    ),
    true,
  );
});

function createHarness() {
  let clock = 0;
  let lastSuccessAt: number | null = null;
  const timers = new Map<number, { at: number; callback: () => void }>();
  let nextId = 1;
  const changes: boolean[] = [];

  const monitor = createConnectivityMonitor({
    setOffline: (offline) => changes.push(offline),
    now: () => clock,
    getLastSuccessAt: () => lastSuccessAt,
    schedule: (callback, delayMs) => {
      const id = nextId++;
      timers.set(id, { at: clock + delayMs, callback });
      return id;
    },
    cancel: (handle) => {
      timers.delete(handle as number);
    },
  });

  const advance = (ms: number) => {
    const target = clock + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = due[1].at;
      due[1].callback();
    }
    clock = target;
  };

  const succeed = () => {
    lastSuccessAt = clock;
    monitor.handleNetworkSuccess();
  };

  return { advance, changes, monitor, succeed };
}

test("monitor never shows the banner while reachability is unknown (null)", () => {
  const { advance, changes, monitor } = createHarness();
  monitor.handleState({ isConnected: true, isInternetReachable: null });
  monitor.handleState({ isConnected: null, isInternetReachable: null });
  advance(60_000);
  assert.deepEqual(changes, []);
});

test("monitor shows offline only after the loss persists past the debounce", () => {
  const { advance, changes, monitor } = createHarness();
  monitor.handleState({ isConnected: false, isInternetReachable: false });
  advance(OFFLINE_DEBOUNCE_MS - 1);
  assert.deepEqual(changes, []);
  advance(1);
  assert.deepEqual(changes, [true]);
});

test("monitor ignores flaps shorter than the debounce", () => {
  const { advance, changes, monitor } = createHarness();
  monitor.handleState({ isConnected: false, isInternetReachable: false });
  advance(1_000);
  monitor.handleState({ isConnected: true, isInternetReachable: true });
  advance(10_000);
  assert.deepEqual(changes, []);
});

test("monitor hides the banner immediately when NetInfo reports online", () => {
  const { advance, changes, monitor } = createHarness();
  monitor.handleState({ isConnected: true, isInternetReachable: false });
  advance(OFFLINE_DEBOUNCE_MS);
  monitor.handleState({ isConnected: true, isInternetReachable: true });
  assert.deepEqual(changes, [true, false]);
});

test("a successful request clears a stuck failed-probe banner at once", () => {
  const { advance, changes, monitor, succeed } = createHarness();
  // iOS simulator case: NetInfo's probe fails and never emits again.
  monitor.handleState({ isConnected: true, isInternetReachable: false });
  advance(OFFLINE_DEBOUNCE_MS);
  assert.deepEqual(changes, [true]);
  succeed();
  assert.deepEqual(changes, [true, false]);
  // It stays hidden while requests keep succeeding.
  advance(NETWORK_SUCCESS_GRACE_MS - 1);
  succeed();
  advance(NETWORK_SUCCESS_GRACE_MS - 1);
  assert.deepEqual(changes, [true, false]);
});

test("a request success does not hide a confirmed transport loss", () => {
  const { advance, changes, monitor, succeed } = createHarness();
  monitor.handleState({ isConnected: false, isInternetReachable: false });
  advance(OFFLINE_DEBOUNCE_MS);
  succeed();
  assert.deepEqual(changes, [true]);
});

test("monitor dispose cancels a pending offline transition", () => {
  const { advance, changes, monitor } = createHarness();
  monitor.handleState({ isConnected: false, isInternetReachable: false });
  monitor.dispose();
  advance(10_000);
  assert.deepEqual(changes, []);
});

test("connectivity-aware fetch reports success for any HTTP response, not network errors", async () => {
  resetNetworkSuccessForTests();
  let notified = 0;
  const unsubscribe = subscribeToNetworkSuccess(() => {
    notified += 1;
  });

  const okFetch = createConnectivityAwareFetch(async () => new Response(null, { status: 401 }));
  await okFetch("https://example.supabase.co/rest/v1/dishes");
  assert.equal(notified, 1);
  assert.notEqual(getLastNetworkSuccessAt(), null);

  resetNetworkSuccessForTests();
  const failingFetch = createConnectivityAwareFetch(async () => {
    throw new TypeError("Network request failed");
  });
  await assert.rejects(failingFetch("https://example.supabase.co/rest/v1/dishes"));
  assert.equal(getLastNetworkSuccessAt(), null);
  unsubscribe();
});
