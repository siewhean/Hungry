type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
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
      typeof candidate.setItem === "function"
    ) {
      cachedAsyncStorage = candidate;
      return cachedAsyncStorage;
    }
  } catch {
    // Native storage is unavailable in a browser or Node test runtime.
  }

  cachedAsyncStorage = null;
  return cachedAsyncStorage;
}

function getMockKey(key: string) {
  return `@mock_${key}`;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function saveMockState(key: string, value: any) {
  if (typeof window === "undefined") return;
  const storageKey = getMockKey(key);
  try {
    const serialized = JSON.stringify(value);
    const browserStorage = getBrowserStorage();
    if (browserStorage) {
      browserStorage.setItem(storageKey, serialized);
      return;
    }
    await getAsyncStorage()?.setItem(storageKey, serialized);
  } catch (e) {
    console.error("Failed to save mock state", e);
  }
}

export async function loadMockState<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const storageKey = getMockKey(key);
  try {
    const browserValue = getBrowserStorage()?.getItem(storageKey);
    const val = browserValue ?? (await getAsyncStorage()?.getItem(storageKey));
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error("Failed to load mock state", e);
    return null;
  }
}
