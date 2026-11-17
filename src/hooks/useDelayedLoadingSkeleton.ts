import { useEffect, useState } from "react";

export const LOADING_SKELETON_DELAY_MS = 300;

export function useDelayedLoadingSkeleton(isLoading: boolean, delayMs = LOADING_SKELETON_DELAY_MS) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setShowSkeleton(true);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [delayMs, isLoading]);

  return showSkeleton;
}
