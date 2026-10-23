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

// Semantic helpers. Haptics here follow Apple's and Android's guidance: short, tied to one clear
// action, never stacked, and gentle. Pick by meaning, not by strength:
//  - tapHaptic: a light tap when a control changes the screen (open, apply, confirm a toggle off).
//  - selectHaptic: a soft tick while a choice moves (chip, tab, segment, picker, switch).
//  - confirmHaptic: a soft thud when something is kept (save, like, mark tried).
//  - successHaptic: the two-beat success pattern, only for milestones (review posted, badge unlocked).
//  - warnHaptic: a warning pattern before a destructive step or a refused action.
const MIN_GAP_MS = 80;
let lastHapticAt = 0;

/** Drops a haptic that arrives right after another, so rapid taps never buzz. */
function shouldPlay(): boolean {
  const now = Date.now();
  if (now - lastHapticAt < MIN_GAP_MS) return false;
  lastHapticAt = now;
  return true;
}

export function resetHapticThrottle(): void {
  lastHapticAt = 0;
}

export function tapHaptic(): void {
  if (shouldPlay()) void impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function selectHaptic(): void {
  if (shouldPlay()) void selectionAsync().catch(() => undefined);
}

export function confirmHaptic(): void {
  if (shouldPlay()) void impactAsync(ExpoHaptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
}

export function successHaptic(): void {
  if (shouldPlay()) {
    void notificationAsync(ExpoHaptics.NotificationFeedbackType.Success).catch(() => undefined);
  }
}

export function warnHaptic(): void {
  if (shouldPlay()) {
    void notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }
}
