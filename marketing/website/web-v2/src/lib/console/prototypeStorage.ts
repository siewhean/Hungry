const PROTOTYPE_STORAGE_ENABLED =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_HUNGRY_CONSOLE_PROTOTYPE_STORAGE === "1";

export function isConsolePrototypeStorageEnabled() {
  return PROTOTYPE_STORAGE_ENABLED;
}

export function readConsolePrototypeStorage<T>(key: string, fallback: T): T {
  if (!PROTOTYPE_STORAGE_ENABLED || typeof window === "undefined") {
    return fallback;
  }

  const saved = window.localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export function writeConsolePrototypeStorage<T>(key: string, value: T) {
  if (!PROTOTYPE_STORAGE_ENABLED || typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readConsolePrototypeString(key: string) {
  if (!PROTOTYPE_STORAGE_ENABLED || typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(key);
}
