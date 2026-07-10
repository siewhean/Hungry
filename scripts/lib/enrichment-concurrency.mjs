export function clampWorkerCount(value, fallback = 2) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(3, parsed));
}

export async function runWorkerPool(items, workerCount, worker) {
  const count = clampWorkerCount(workerCount);
  let cursor = 0;
  const results = new Array(items.length);

  async function run(workerId) {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index, workerId);
    }
  }

  await Promise.all(Array.from({ length: Math.min(count, items.length) }, (_, index) => run(index + 1)));
  return results;
}

export function createRateLimitedExecutor({ minIntervalMs = 250, now = Date.now, wait } = {}) {
  const sleep = wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let queue = Promise.resolve();
  let lastStartedAt = 0;

  return function schedule(operation) {
    const task = queue.then(async () => {
      const delay = Math.max(0, lastStartedAt + Math.max(0, minIntervalMs) - now());
      if (delay > 0) await sleep(delay);
      lastStartedAt = now();
      return operation();
    });
    queue = task.catch(() => undefined);
    return task;
  };
}

export function mergeCheckpointProgress(state, { index, venue, success, completed }) {
  state.lastProcessedIndex = Math.max(Number(state.lastProcessedIndex ?? -1), Number(index ?? -1));
  if (!(state.completedVenueIds instanceof Set)) state.completedVenueIds = new Set();
  if (completed && venue?.id) state.completedVenueIds.add(venue.id);
  return {
    last_processed_index: state.lastProcessedIndex,
    last_venue_id: venue?.id || null,
    last_venue_name: venue?.name || null,
    last_success_count: Number(success) || 0,
    last_completed: Boolean(completed),
    completed_venue_ids: Array.from(state.completedVenueIds),
  };
}
