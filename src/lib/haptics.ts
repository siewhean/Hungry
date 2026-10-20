// The only module that may import expo-haptics (enforced by eslint): every haptic in the
// app goes through here so Settings > Haptic feedback turns all of them off.
import * as ExpoHaptics from "expo-haptics";

import { useUIStore } from "@/store/useUIStore";

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;

function isHapticFeedbackEnabled(): boolean {
  return useUIStore.getState().hapticFeedbackEnabled;
}

export async function impactAsync(
  style: ExpoHaptics.ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle.Medium,
): Promise<void> {
  if (!isHapticFeedbackEnabled()) return;
  await ExpoHaptics.impactAsync(style);
}

export async function notificationAsync(
  type: ExpoHaptics.NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType.Success,
): Promise<void> {
  if (!isHapticFeedbackEnabled()) return;
  await ExpoHaptics.notificationAsync(type);
}

export async function selectionAsync(): Promise<void> {
  if (!isHapticFeedbackEnabled()) return;
  await ExpoHaptics.selectionAsync();
}
