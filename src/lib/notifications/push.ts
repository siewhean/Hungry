/**
 * Push notifications for stall alerts.
 *
 * The server (send-notifications edge function) sends Expo pushes whose data
 * carries `url` (a usehungry.com deep link) and `notificationId`. Opening one
 * goes through React Navigation linking, so the same sanitising and auth gates
 * as any other deep link apply.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { getHungryService } from "@/lib/services/serviceProvider";

export const STALL_UPDATES_CHANNEL_ID = "stall-updates";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for permission and registers this device's Expo push token. Returns false if declined.
 * With `askPermission: false` it registers only when permission is already granted.
 */
export async function registerForStallAlerts({ askPermission = true } = {}): Promise<boolean> {
  if (!Device.isDevice) return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(STALL_UPDATES_CHANNEL_ID, {
      name: "Stall updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (!existing.granted && !askPermission) return false;
  const status = existing.granted
    ? existing.status
    : (await Notifications.requestPermissionsAsync()).status;
  trackAnalyticsEvent("notification_permission_result", { status });
  if (status !== "granted") return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await getHungryService().push.registerPushToken(token, Platform.OS === "ios" ? "ios" : "android");
  return true;
}

const handledNotificationIds = new Set<string>();

function getOpenedUrl(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data ?? {};
  const url = typeof data.url === "string" ? data.url : null;
  const notificationId = typeof data.notificationId === "string" ? data.notificationId : null;

  if (notificationId && !handledNotificationIds.has(notificationId)) {
    handledNotificationIds.add(notificationId);
    trackAnalyticsEvent("notification_opened", {
      notification_id: notificationId,
      category: typeof data.category === "string" ? data.category : "unknown",
    });
    void getHungryService()
      .push.markOpened(notificationId)
      .catch(() => {});
  }
  return url;
}

/** Linking `getInitialURL` addition: the notification that cold-started the app, if any. */
export function getInitialNotificationUrl(): string | null {
  const response = Notifications.getLastNotificationResponse();
  return response ? getOpenedUrl(response) : null;
}

/** Linking `subscribe` addition: notifications tapped while the app is running. */
export function subscribeToNotificationOpens(listener: (url: string) => void) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = getOpenedUrl(response);
    if (url) listener(url);
  });
  return () => subscription.remove();
}
