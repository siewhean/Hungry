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

const memoryStore = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: async (name) => memoryStore.get(name) ?? null,
  setItem: async (name, value) => {
    memoryStore.set(name, value);
  },
  removeItem: async (name) => {
    memoryStore.delete(name);
  },
};

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

const browserStorage: StateStorage = {
  getItem: async (name) => getBrowserStorage()?.getItem(name) ?? null,
  setItem: async (name, value) => {
    getBrowserStorage()?.setItem(name, value);
  },
  removeItem: async (name) => {
    getBrowserStorage()?.removeItem(name);
  },
};

const secureStateStorage: StateStorage = {
  getItem: async (name) => {
    const secureStore = getSecureStore();
    try {
      const secureValue = secureStore ? await secureStore.getItemAsync(name) : null;
      if (secureValue !== null) {
        return secureValue;
      }
    } catch {
      // Fall through to legacy and in-memory fallbacks.
    }

    const browserValue = await browserStorage.getItem(name);
    if (browserValue !== null) {
      return browserValue;
    }

    const asyncStorage = getAsyncStorage();
    if (asyncStorage) {
      try {
        const legacyValue = await asyncStorage.getItem(name);
        if (legacyValue !== null) {
          try {
            if (secureStore) {
              await secureStore.setItemAsync(name, legacyValue);
            }
            await asyncStorage.removeItem(name);
          } catch {
            // Keep legacy value readable even if migration write fails.
          }
          return legacyValue;
        }
      } catch {
        // Fall through to in-memory fallback.
      }
    }

    return memoryStorage.getItem(name);
  },
  setItem: async (name, value) => {
    const secureStore = getSecureStore();
    try {
      if (secureStore) {
        await secureStore.setItemAsync(name, value);
        return;
      }
    } catch {
      // Fall through to legacy and in-memory writes.
    }

    if (getBrowserStorage()) {
      await browserStorage.setItem(name, value);
      return;
    }

    const asyncStorage = getAsyncStorage();
    if (asyncStorage) {
      try {
        await asyncStorage.setItem(name, value);
        return;
      } catch {
        // Fall through to in-memory writes.
      }
    }

    await memoryStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    const secureStore = getSecureStore();
    try {
      if (secureStore) {
        await secureStore.deleteItemAsync(name);
      }
    } catch {
      // Continue cleanup across fallback stores.
    }

    if (getBrowserStorage()) {
      await browserStorage.removeItem(name);
      return;
    }

    const asyncStorage = getAsyncStorage();
    if (asyncStorage) {
      try {
        await asyncStorage.removeItem(name);
      } catch {
        // Ignore and clear in-memory fallback.
      }
    }

    await memoryStorage.removeItem(name);
  },
};

export const hungrySecurePersistStorage = createJSONStorage(() => secureStateStorage);
