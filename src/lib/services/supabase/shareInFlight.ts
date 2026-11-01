// One request for identical reads that overlap. Several screens (or one screen rendering twice)
// can ask for the same thing while the first answer is still on its way; they now share that
// answer instead of each sending the request. The entry is dropped the moment the request ends,
// so nothing is cached: the next read after it finishes is a fresh request.
//
// Two guards keep a share from doing harm:
// - Shares are kept per Supabase client, so a new sign-in (a new client) never joins a request
//   that was made for the old one.
// - A request that has been out longer than SHARE_WINDOW_MS is not joined any more. A stalled
//   phone request can hang, and a later screen must start its own instead of waiting on it.

const SHARE_WINDOW_MS = 10_000;

interface Entry {
  request: Promise<unknown>;
  startedAt: number;
}

let pendingByClient = new WeakMap<object, Map<string, Entry>>();

/** Forget every shared request. Tests call this so a read one test left hanging is not joined by the next. */
export function resetSharedReads(): void {
  pendingByClient = new WeakMap();
}

export function shareInFlight<T>(
  scope: object | null | undefined,
  key: string,
  start: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  if (!scope) return start();
  let pending = pendingByClient.get(scope);
  if (!pending) {
    pending = new Map();
    pendingByClient.set(scope, pending);
  }
  const existing = pending.get(key);
  if (existing && now() - existing.startedAt < SHARE_WINDOW_MS) {
    return existing.request as Promise<T>;
  }
  const entries = pending;
  const request: Promise<T> = start().finally(() => {
    if (entries.get(key)?.request === request) entries.delete(key);
  });
  entries.set(key, { request, startedAt: now() });
  return request;
}
