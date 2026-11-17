type IdleCallbackId = ReturnType<typeof setTimeout> | number;

type IdleGlobals = {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => IdleCallbackId;
  cancelIdleCallback?: (handle: IdleCallbackId) => void;
};

export function scheduleIdleWork(
  callback: () => void,
  options?: { timeout?: number; fallbackDelayMs?: number; onComplete?: () => void },
): () => void {
  const globals = globalThis as IdleGlobals;
  if (typeof globals.requestIdleCallback === "function") {
    const handle = globals.requestIdleCallback(() => {
      try {
        callback();
      } finally {
        options?.onComplete?.();
      }
    }, options);
    return () => {
      globals.cancelIdleCallback?.(handle);
    };
  }

  const handle = setTimeout(() => {
    try {
      callback();
    } finally {
      options?.onComplete?.();
    }
  }, options?.fallbackDelayMs ?? 0);

  return () => {
    clearTimeout(handle);
  };
}
