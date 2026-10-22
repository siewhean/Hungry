/** Monotonic account-transition token; never reuse a prior subject's async work. */
let generation = 0;
export function getAccountGeneration(): number {
  return generation;
}
export function advanceAccountGeneration(): number {
  return ++generation;
}
export function assertAccountGeneration(expected: number): void {
  if (generation !== expected)
    throw new Error("Your account changed. Reopen this action in the current account.");
}
