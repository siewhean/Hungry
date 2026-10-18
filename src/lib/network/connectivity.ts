import type { NetInfoState } from "@react-native-community/netinfo";

export type ConnectivityState = Pick<NetInfoState, "isConnected" | "isInternetReachable">;

/** How long a successful app request outweighs a failed NetInfo reachability probe. */
export const NETWORK_SUCCESS_GRACE_MS = 30_000;
/** Offline must persist this long before the banner appears (avoids flicker on flaps). */
export const OFFLINE_DEBOUNCE_MS = 2_000;

let lastNetworkSuccessAt: number | null = null;
const successListeners = new Set<() => void>();

/**
 * Record that a real app request (e.g. Supabase) got an HTTP response. Any
 * response proves the internet is reachable, whatever NetInfo's third-party
 * reachability probe (clients3.google.com) last reported.
 */
export function reportNetworkSuccess(at: number = Date.now()): void {
  lastNetworkSuccessAt = at;
  successListeners.forEach((listener) => listener());
}

export function getLastNetworkSuccessAt(): number | null {
  return lastNetworkSuccessAt;
}

export function subscribeToNetworkSuccess(listener: () => void): () => void {
  successListeners.add(listener);
  return () => {
    successListeners.delete(listener);
  };
}

/** Test-only reset of the module-level success timestamp. */
export function resetNetworkSuccessForTests(): void {
  lastNetworkSuccessAt = null;
  successListeners.clear();
}

/**
 * Wraps fetch so every HTTP response (any status) marks the network as
 * reachable. Network errors still reject unchanged.
 */
export function createConnectivityAwareFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    reportNetworkSuccess();
    return response;
  };
}

interface OfflineOptions {
  lastSuccessAt?: number | null;
  now?: number;
}

/**
 * Epoch ms at which the app should be considered offline, or null when it is
 * online/unknown. `null` reachability (probe pending) is never offline; a
 * failed reachability probe only counts once no app request has succeeded
 * within NETWORK_SUCCESS_GRACE_MS.
 */
function offlineFrom(
  { isConnected, isInternetReachable }: ConnectivityState,
  lastSuccessAt: number | null,
  now: number,
): number | null {
  if (isConnected === false) return now;
  if (isInternetReachable !== false) return null;
  if (lastSuccessAt === null) return now;
  return Math.max(now, lastSuccessAt + NETWORK_SUCCESS_GRACE_MS);
}

export function isNetworkOffline(
  state: ConnectivityState,
  { lastSuccessAt = lastNetworkSuccessAt, now = Date.now() }: OfflineOptions = {},
): boolean {
  const from = offlineFrom(state, lastSuccessAt, now);
  return from !== null && from <= now;
}

interface ConnectivityMonitorOptions {
  setOffline: (offline: boolean) => void;
  debounceMs?: number;
  now?: () => number;
  getLastSuccessAt?: () => number | null;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
}

export interface ConnectivityMonitor {
  handleState: (state: ConnectivityState) => void;
  /** Re-evaluate after a successful request; clears the banner immediately. */
  handleNetworkSuccess: () => void;
  dispose: () => void;
}

/**
 * Turns NetInfo events + app request successes into a debounced offline flag:
 * - unknown (`null`) connectivity or reachability → online, banner hidden;
 * - confirmed loss → offline only after it persists for `debounceMs`;
 * - NetInfo reporting online or any app request succeeding → hidden at once.
 */
export function createConnectivityMonitor({
  setOffline,
  debounceMs = OFFLINE_DEBOUNCE_MS,
  now = Date.now,
  getLastSuccessAt = getLastNetworkSuccessAt,
  schedule = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: ConnectivityMonitorOptions): ConnectivityMonitor {
  let latest: ConnectivityState = { isConnected: null, isInternetReachable: null };
  let offline = false;
  let timer: unknown = null;
  let disposed = false;

  const clearTimer = () => {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }
  };

  const commit = (next: boolean) => {
    if (next === offline) return;
    offline = next;
    setOffline(next);
  };

  const reconcile = () => {
    if (disposed) return;
    const current = now();
    const from = offlineFrom(latest, getLastSuccessAt(), current);
    clearTimer();
    if (from === null) {
      commit(false);
      return;
    }
    if (from > current) {
      // A recent request succeeded: stay online, but re-check once the grace
      // window lapses in case the connection really did drop afterwards.
      commit(false);
    } else if (offline) {
      return;
    }
    timer = schedule(
      () => {
        timer = null;
        if (disposed) return;
        const at = now();
        const offlineAt = offlineFrom(latest, getLastSuccessAt(), at);
        if (offlineAt !== null && offlineAt <= at) {
          commit(true);
        } else {
          reconcile();
        }
      },
      Math.max(debounceMs, from - current),
    );
  };

  return {
    handleState: (state) => {
      latest = { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable };
      reconcile();
    },
    handleNetworkSuccess: reconcile,
    dispose: () => {
      disposed = true;
      clearTimer();
    },
  };
}
