import { useEffect, useState } from "react";

import { reportError } from "@/lib/monitoring/reportError";

/**
 * Runs `load` on mount and whenever `retry` is called, and reports whether the last run failed, so
 * a list can show an error with Retry instead of an empty state. `load` must be stable
 * (useCallback or a store action).
 */
export function useRetryableLoad(load: () => Promise<unknown>, label: string) {
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isActive = true;
    setFailed(false);
    load().catch((error) => {
      reportError(error, { action: "load", label });
      if (isActive) setFailed(true);
    });
    return () => {
      isActive = false;
    };
  }, [label, load, reloadKey]);

  return { failed, retry: () => setReloadKey((key) => key + 1) };
}
