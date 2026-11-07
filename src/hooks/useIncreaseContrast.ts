import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * True while the system asks for more contrast: Increase Contrast on iOS ("darker system
 * colours") or High contrast text on Android. Web has no such setting, so it stays false.
 */
export function useIncreaseContrast() {
  const [increaseContrast, setIncreaseContrast] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    let active = true;
    const read =
      Platform.OS === "ios"
        ? AccessibilityInfo.isDarkerSystemColorsEnabled
        : AccessibilityInfo.isHighTextContrastEnabled;
    read?.()
      .then((enabled) => {
        if (active) setIncreaseContrast(Boolean(enabled));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      Platform.OS === "ios" ? "darkerSystemColorsChanged" : "highTextContrastChanged",
      (enabled) => setIncreaseContrast(Boolean(enabled)),
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return increaseContrast;
}
