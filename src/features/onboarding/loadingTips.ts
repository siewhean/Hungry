/** Short lines shown while the picks load. They rotate; none of them is a promise about speed. */
export const LOADING_TIPS = [
  "Halal, vegetarian or vegan? I only show dishes tagged that way.",
  "Change your taste, diet or price any time in Profile.",
  "Hearts and passes teach me your taste a little more each time.",
  "Add a review and your next picks get sharper.",
] as const;

/** How long the picks may take before the screen offers a retry. */
export const LOADING_TIMEOUT_MS = 10_000;
/** How often the tip changes. */
export const TIP_INTERVAL_MS = 3_000;

/** The tip to show after `ticks` rotations; it wraps around. */
export function tipAt(ticks: number): string {
  return LOADING_TIPS[((ticks % LOADING_TIPS.length) + LOADING_TIPS.length) % LOADING_TIPS.length]!;
}

/** Rejects after `ms`, so a stuck request becomes a retry instead of a spinner that never ends. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
