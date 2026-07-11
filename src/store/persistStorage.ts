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

const safeAsyncStorage: StateStorage = {
  getItem: async (name) => {
    const browserValue = await browserStorage.getItem(name);
    if (browserValue !== null) {
      return browserValue;
    }

    const asyncStorage = getAsyncStorage();
    if (!asyncStorage) {
      return memoryStorage.getItem(name);
    }

    try {
      const asyncValue = await asyncStorage.getItem(name);
      if (asyncValue !== null) {
        return asyncValue;
      }
    } catch {
      return memoryStorage.getItem(name);
    }

    const legacySecureStore = getLegacySecureStore();
    if (!legacySecureStore) {
      return memoryStorage.getItem(name);
    }

    try {
      const legacyValue = await legacySecureStore.getItemAsync(name);
      if (legacyValue === null) {
        return memoryStorage.getItem(name);
      }

      // App metadata previously used SecureStore. Read it once, promote it to
      // durable app storage, and remove the legacy secure copy so existing
      // signed-in installs do not look logged out after this storage split.
      try {
        await asyncStorage.setItem(name, legacyValue);
        await legacySecureStore.deleteItemAsync(name);
      } catch {
        // Keep the legacy copy readable if promotion cleanup fails.
      }
      return legacyValue;
    } catch {
      return memoryStorage.getItem(name);
    }
  },
  setItem: async (name, value) => {
    if (getBrowserStorage()) {
      await browserStorage.setItem(name, value);
      return;
    }

    const asyncStorage = getAsyncStorage();
    if (!asyncStorage) {
      await memoryStorage.setItem(name, value);
      return;
    }

    try {
      await asyncStorage.setItem(name, value);
    } catch {
      await memoryStorage.setItem(name, value);
    }
  },
  removeItem: async (name) => {
    if (getBrowserStorage()) {
      await browserStorage.removeItem(name);
      return;
    }

    const asyncStorage = getAsyncStorage();
    if (!asyncStorage) {
      await memoryStorage.removeItem(name);
      return;
    }

    try {
      await asyncStorage.removeItem(name);
    } catch {
      await memoryStorage.removeItem(name);
    }
  },
};

export const hungryPersistStorage = createJSONStorage(() => safeAsyncStorage);
