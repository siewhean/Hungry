/**
 * How long the same destination is ignored after it was opened. Long enough for a hurried double
 * tap (and for a lazy screen to load), short enough that going back and tapping again just works.
 */
export const NAVIGATE_ONCE_WINDOW_MS = 800;

type Navigate = (routeName: never, params?: never) => void;

let lastKey = "";
let lastAt = Number.NEGATIVE_INFINITY;

/**
 * Opens a screen, unless that same screen (same name and params) was opened a moment ago. A quick
 * second tap on a button whose screen is still loading would otherwise push it twice. Other
 * destinations are never held back, so tapping a different card right after still opens it.
 */
export function navigateOnce(
  navigation: { navigate: unknown },
  routeName: string,
  params?: object,
  now: number = Date.now(),
): boolean {
  const key = `${routeName}:${params ? JSON.stringify(params) : ""}`;
  if (key === lastKey && now - lastAt < NAVIGATE_ONCE_WINDOW_MS) return false;
  lastKey = key;
  lastAt = now;
  (navigation.navigate as Navigate)(routeName as never, params as never);
  return true;
}

/** Forgets the last destination (tests). */
export function resetNavigateOnce() {
  lastKey = "";
  lastAt = Number.NEGATIVE_INFINITY;
}
