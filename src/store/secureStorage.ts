import { createJSONStorage, type StateStorage } from "zustand/middleware";

type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

type AsyncStorageLike = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

let cachedSecureStore: SecureStoreLike | null | undefined;
let cachedAsyncStorage: AsyncStorageLike | null | undefined;

function getSecureStore(): SecureStoreLike | null {
  if (process.env.HUNGRY_DISABLE_SECURE_STORE === "1") {
    cachedSecureStore = null;
    return cachedSecureStore;
  }

  if (cachedSecureStore !== undefined) {
    return cachedSecureStore;
  }

  try {
    const moduleRef = require("expo-secure-store") as SecureStoreLike;
    if (
      moduleRef &&
      typeof moduleRef.getItemAsync === "function" &&
      typeof moduleRef.setItemAsync === "function" &&
      typeof moduleRef.deleteItemAsync === "function"
    ) {
      cachedSecureStore = moduleRef;
      return cachedSecureStore;
    }
  } catch {
    // Native module is not available in this runtime.
  }

  cachedSecureStore = null;
  return cachedSecureStore;
}

function getAsyncStorage(): AsyncStorageLike | null {
  if (process.env.HUNGRY_DISABLE_ASYNC_STORAGE === "1") {
    cachedAsyncStorage = null;
    return cachedAsyncStorage;
  }

  if (cachedAsyncStorage !== undefined) {
    return cachedAsyncStorage;
  }

  try {
    const moduleRef = require("@react-native-async-storage/async-storage") as {
      default?: AsyncStorageLike;
    };
    const candidate = moduleRef.default;
    if (
      candidate &&
      typeof candidate.getItem === "function" &&
      typeof candidate.setItem === "function" &&
      typeof candidate.removeItem === "function"
    ) {
      cachedAsyncStorage = candidate;
      return cachedAsyncStorage;
    }
  } catch {
    // Native module is not available in this runtime.
  }

  cachedAsyncStorage = null;
  return cachedAsyncStorage;
}

type PendingValue = { value: string | null };
const pendingValues = new Map<string, PendingValue>();
const operations = new Map<string, Promise<unknown>>();
const fallbackKey = (name: string) => `hungry-secure-fallback-v1:${name}`;
function serial<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const result = (operations.get(name) ?? Promise.resolve()).catch(() => {}).then(operation);
  operations.set(name, result);
  const cleanup = () => {
    if (operations.get(name) === result) operations.delete(name);
  };
  void result.then(cleanup, cleanup);
  return result;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  const isLocalWebRuntime =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    process.env.NODE_ENV === "test";
  if (!isLocalWebRuntime) return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

async function retainFallback(name: string, pending: PendingValue): Promise<void> {
  // One atomic fallback record carries either a value or a deletion tombstone.
  // It is read before SecureStore on restart, so a stale secure value cannot win.
  pendingValues.set(name, pending);
  try {
    getBrowserStorage()?.setItem(fallbackKey(name), JSON.stringify(pending));
  } catch {
    /* Memory remains authoritative. */
  }
  try {
    await getAsyncStorage()?.setItem(fallbackKey(name), JSON.stringify(pending));
  } catch {
    /* Memory remains authoritative. */
  }
}
async function readFallback(name: string): Promise<PendingValue | undefined> {
  const memory = pendingValues.get(name);
  if (memory) return memory;
  let raw: string | null = null;
  try {
    raw = getBrowserStorage()?.getItem(fallbackKey(name)) ?? null;
  } catch {
    /* Try native fallback. */
  }
  if (raw === null) {
    try {
      raw = (await getAsyncStorage()?.getItem(fallbackKey(name))) ?? null;
    } catch {
      return undefined;
    }
  }
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "value" in parsed &&
      (typeof parsed.value === "string" || parsed.value === null)
    ) {
      const pending = { value: parsed.value };
      pendingValues.set(name, pending);
      return pending;
    }
  } catch {
    /* Invalid fallback records are not restored. */
  }
  return undefined;
}
async function synchronize(name: string, pending: PendingValue): Promise<void> {
  const secure = getSecureStore();
  if (!secure) return;
  try {
    if (pending.value === null) await secure.deleteItemAsync(name);
    else await secure.setItemAsync(name, pending.value);
    // Only retire fallback evidence after the destination write succeeds.
    const browser = getBrowserStorage();
    browser?.removeItem(name);
    await getAsyncStorage()?.removeItem(name);
    browser?.removeItem(fallbackKey(name));
    await getAsyncStorage()?.removeItem(fallbackKey(name));
    pendingValues.delete(name);
  } catch {
    /* Retain the authoritative fallback for the next attempt. */
  }
}

const secureStateStorage: StateStorage = {
  getItem: (name) =>
    serial(name, async () => {
      const pending = await readFallback(name);
      if (pending) {
        await synchronize(name, pending);
        return pending.value;
      }
      const secure = getSecureStore();
      try {
        const value = secure ? await secure.getItemAsync(name) : null;
        if (value !== null) return value;
      } catch {
        /* Fall through to legacy stores. */
      }
      try {
        const value = getBrowserStorage()?.getItem(name) ?? null;
        if (value !== null) return value;
      } catch {
        /* Try legacy native storage. */
      }
      const storage = getAsyncStorage();
      if (storage) {
        try {
          const value = await storage.getItem(name);
          if (value !== null) {
            // With no destination, keep the only durable legacy copy intact.
            if (secure) {
              try {
                await secure.setItemAsync(name, value);
                await storage.removeItem(name);
              } catch {
                /* Keep the source on failed migration. */
              }
            }
            return value;
          }
        } catch {
          /* No readable durable value. */
        }
      }
      return null;
    }),
  setItem: (name, value) =>
    serial(name, async () => {
      const pending = { value };
      pendingValues.set(name, pending);
      await synchronize(name, pending);
      if (pendingValues.has(name)) await retainFallback(name, pending);
    }),
  removeItem: (name) =>
    serial(name, async () => {
      const pending = { value: null };
      pendingValues.set(name, pending);
      await synchronize(name, pending);
      if (pendingValues.has(name)) await retainFallback(name, pending);
      // When SecureStore is absent, retain the tombstone but remove legacy data.
      if (!getSecureStore()) {
        try {
          getBrowserStorage()?.removeItem(name);
        } catch {
          /* Tombstone remains. */
        }
        try {
          await getAsyncStorage()?.removeItem(name);
        } catch {
          /* Tombstone remains. */
        }
      }
    }),
};

export const hungrySecurePersistStorage = createJSONStorage(() => secureStateStorage);
