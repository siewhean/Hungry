import AsyncStorage from "@react-native-async-storage/async-storage";

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

export async function saveMockState(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const storageKey = getMockKey(key);
  try {
    const serialized = JSON.stringify(value);
    const browserStorage = getBrowserStorage();
    if (browserStorage) {
      browserStorage.setItem(storageKey, serialized);
      return;
    }
    await AsyncStorage.setItem(storageKey, serialized);
  } catch (e) {
    console.error("Failed to save mock state", e);
  }
}

export async function loadMockState<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const storageKey = getMockKey(key);
  try {
    const browserValue = getBrowserStorage()?.getItem(storageKey);
    const val = browserValue ?? (await AsyncStorage.getItem(storageKey));
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error("Failed to load mock state", e);
    return null;
  }
}
