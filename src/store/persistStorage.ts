import { createJSONStorage, type StateStorage } from "zustand/middleware";

type AsyncStorageLike = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

let cachedAsyncStorage: AsyncStorageLike | null | undefined;

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
      return await asyncStorage.getItem(name);
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
