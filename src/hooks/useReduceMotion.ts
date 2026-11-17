import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { useUIStore } from "@/store/useUIStore";

export function useReduceMotion() {
  const appReducedMotion = useUIStore((state) => state.reducedMotionEnabled);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setSystemReducedMotion(enabled);
        }
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setSystemReducedMotion(Boolean(enabled));
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return appReducedMotion || systemReducedMotion;
}
