import * as SecureStore from "expo-secure-store";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

type AsyncStorageLike = {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

let cachedAsyncStorage: AsyncStorageLike | null | undefined;

function getAsyncStorage(): AsyncStorageLike | null {
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

const secureStateStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const secureValue = await SecureStore.getItemAsync(name);
      if (secureValue !== null) {
        return secureValue;
      }
    } catch {
      // Fall through to legacy and in-memory fallbacks.
    }

    const asyncStorage = getAsyncStorage();
    if (asyncStorage) {
      try {
        const legacyValue = await asyncStorage.getItem(name);
        if (legacyValue !== null) {
          try {
            await SecureStore.setItemAsync(name, legacyValue);
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
    try {
      await SecureStore.setItemAsync(name, value);
      return;
    } catch {
      // Fall through to legacy and in-memory writes.
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
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Continue cleanup across fallback stores.
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

export const hungrySecurePersistStorage = createJSONStorage(
  () => secureStateStorage,
);
