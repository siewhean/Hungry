import { trackAnalyticsEvent } from "@/lib/analytics";

interface PermissionAnswer {
  granted: boolean;
  status: string;
}

/**
 * The notification permission, asking only when allowed. notification_permission_result is
 * the outcome of a prompt, so it is sent only when the system prompt was actually requested,
 * not when an already-granted permission is read on launch (SET-V3).
 * Resolves to null when permission is missing and asking is not allowed.
 */
export async function resolveNotificationPermission(options: {
  askPermission: boolean;
  getPermissions: () => Promise<PermissionAnswer>;
  requestPermissions: () => Promise<PermissionAnswer>;
}): Promise<string | null> {
  const existing = await options.getPermissions();
  if (existing.granted) return existing.status;
  if (!options.askPermission) return null;
  const { status } = await options.requestPermissions();
  trackAnalyticsEvent("notification_permission_result", { status });
  return status;
}
