import { createJSONStorage, type StateStorage } from "zustand/middleware";

type AsyncStorageLike = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let cachedAsyncStorage: AsyncStorageLike | null | undefined;
let cachedLegacySecureStore: SecureStoreLike | null | undefined;

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

function getLegacySecureStore(): SecureStoreLike | null {
  if (process.env.HUNGRY_DISABLE_SECURE_STORE === "1") {
    cachedLegacySecureStore = null;
    return cachedLegacySecureStore;
  }

  if (cachedLegacySecureStore !== undefined) {
    return cachedLegacySecureStore;
  }

  try {
    const moduleRef = require("expo-secure-store") as SecureStoreLike;
    if (
      moduleRef &&
      typeof moduleRef.getItemAsync === "function" &&
      typeof moduleRef.deleteItemAsync === "function"
    ) {
      cachedLegacySecureStore = moduleRef;
      return cachedLegacySecureStore;
    }
  } catch {
    // Native module is not available in this runtime.
  }

  cachedLegacySecureStore = null;
  return cachedLegacySecureStore;
}

// Values acknowledged while durable storage is unavailable remain authoritative
// for this process, including removals. A failed durable write cannot promise
// persistence across an application restart.
const pendingValues = new Map<string, { value: string | null }>();
const operations = new Map<string, Promise<unknown>>();
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
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

async function writePrimary(name: string, value: string | null): Promise<boolean> {
  try {
    const browser = getBrowserStorage();
    if (browser) {
      if (value === null) browser.removeItem(name);
      else browser.setItem(name, value);
      return true;
    }
    const storage = getAsyncStorage();
    if (!storage) return false;
    if (value === null) await storage.removeItem(name);
    else await storage.setItem(name, value);
    return true;
  } catch {
    return false;
  }
}

const safeAsyncStorage: StateStorage = {
  getItem: (name) =>
    serial(name, async () => {
      const pending = pendingValues.get(name);
      if (pending) {
        if (await writePrimary(name, pending.value)) {
          if (pending.value !== null) pendingValues.delete(name);
          else {
            try {
              await getLegacySecureStore()?.deleteItemAsync(name);
              pendingValues.delete(name);
            } catch {
              /* Retain the tombstone until legacy cleanup succeeds. */
            }
          }
        }
        return pending.value;
      }
      try {
        const browserValue = getBrowserStorage()?.getItem(name) ?? null;
        if (browserValue !== null) return browserValue;
      } catch {
        /* Continue to native storage. */
      }
      const storage = getAsyncStorage();
      if (!storage) return null;
      try {
        const value = await storage.getItem(name);
        if (value !== null) return value;
      } catch {
        return null;
      }
      const legacy = getLegacySecureStore();
      if (!legacy) return null;
      try {
        const value = await legacy.getItemAsync(name);
        if (value === null) return null;
        if (await writePrimary(name, value)) {
          try {
            await legacy.deleteItemAsync(name);
          } catch {
            /* Destination is durable. */
          }
        }
        return value;
      } catch {
        return null;
      }
    }),
  setItem: (name, value) =>
    serial(name, async () => {
      pendingValues.set(name, { value });
      if (await writePrimary(name, value)) pendingValues.delete(name);
    }),
  removeItem: (name) =>
    serial(name, async () => {
      pendingValues.set(name, { value: null });
      if (await writePrimary(name, null)) {
        // Retire the legacy copy too, otherwise a later read could resurrect it.
        try {
          await getLegacySecureStore()?.deleteItemAsync(name);
          pendingValues.delete(name);
        } catch {
          /* Retain the authoritative tombstone until cleanup can retry. */
        }
      }
    }),
};

export const hungryPersistStorage = createJSONStorage(() => safeAsyncStorage);
