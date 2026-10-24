/**
 * Web build of push.ts. Stall alerts are native-only, and importing
 * expo-notifications on web logs a console warning on load.
 */

export const STALL_UPDATES_CHANNEL_ID = "stall-updates";

export async function registerForStallAlerts(_options?: {
  askPermission?: boolean;
}): Promise<boolean> {
  return false;
}

export async function getNotificationPermissionState(): Promise<
  "granted" | "denied" | "undetermined"
> {
  return "undetermined";
}

export function getInitialNotificationUrl(): string | null {
  return null;
}

export function subscribeToNotificationOpens(_listener: (url: string) => void) {
  return () => {};
}
