/**
 * Web build of push.ts. Stall alerts are native-only, and importing
 * expo-notifications on web logs a console warning on load.
 */

export const STALL_UPDATES_CHANNEL_ID = "stall-updates";

export async function registerForStallAlerts(): Promise<boolean> {
  return false;
}

export function getInitialNotificationUrl(): string | null {
  return null;
}

export function subscribeToNotificationOpens(_listener: (url: string) => void) {
  return () => {};
}
