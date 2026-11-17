import * as NativeHaptics from "expo-haptics";
import { useUIStore } from "@/store/useUIStore";
export { ImpactFeedbackStyle, NotificationFeedbackType, AndroidHaptics } from "expo-haptics";

async function whenEnabled(action: () => Promise<void>): Promise<void> {
  if (!useUIStore.getState().hapticFeedbackEnabled) return;
  try {
    await action();
  } catch {
    /* Unsupported hardware is a valid no-haptics device. */
  }
}
export function impactAsync(style?: NativeHaptics.ImpactFeedbackStyle) {
  return whenEnabled(() => NativeHaptics.impactAsync(style));
}
export function notificationAsync(type?: NativeHaptics.NotificationFeedbackType) {
  return whenEnabled(() => NativeHaptics.notificationAsync(type));
}
export function selectionAsync() {
  return whenEnabled(() => NativeHaptics.selectionAsync());
}
