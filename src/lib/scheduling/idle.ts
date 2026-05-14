export type ScheduledIdleTask = {
  cancel: () => void;
};

type IdleCallbackHandle = number;

type IdleScheduler = {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
};

const idleScheduler = globalThis as typeof globalThis & IdleScheduler;

export function scheduleIdleTask(callback: () => void, timeout = 500): ScheduledIdleTask {
  if (typeof idleScheduler.requestIdleCallback === "function") {
    const handle = idleScheduler.requestIdleCallback(callback, { timeout });
    return {
      cancel: () => idleScheduler.cancelIdleCallback?.(handle),
    };
  }

  const handle = setTimeout(callback, 0);
  return {
    cancel: () => clearTimeout(handle),
  };
}
