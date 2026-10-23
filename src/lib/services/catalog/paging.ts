/**
 * Appends a page to an already-rendered list, dropping rows whose id is
 * already present. List keys (FlashList/React) must stay unique even if a
 * source repeats a row across pages.
 */
export function appendUniqueById<T extends { id: string }>(current: T[], next: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  const appended = next.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return appended.length ? [...current, ...appended] : current;
}

/**
 * Promise.allSettled with at most `limit` tasks in flight, preserving input
 * order. Used where no batch catalog read exists, so a long favourites list
 * does not fire one request per id at once.
 */
export async function settleWithConcurrency<T, R>(
  inputs: readonly T[],
  limit: number,
  run: (input: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(inputs.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await run(inputs[index] as T) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  const workerCount = Math.max(1, Math.min(Math.floor(limit) || 1, inputs.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
