import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveMockState(key: string, value: any) {
  if (typeof window === "undefined") return;
  try {
    await AsyncStorage.setItem(`@mock_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save mock state", e);
  }
}

export async function loadMockState<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  try {
    const val = await AsyncStorage.getItem(`@mock_${key}`);
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error("Failed to load mock state", e);
    return null;
  }
}
