import { Alert, Share } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedMessagingShareUrl } from "@/lib/security/safeLinking";

import { performShareHandoff } from "./shareHandoff";
import { withShareSource } from "./shareAttribution";

export type ShareChannel = "whatsapp" | "telegram" | "system_share";

export interface ShareTarget {
  kind: "dish" | "portfolio";
  id: string;
  /** Short line shown above the link, e.g. "Chicken rice at Tian Tian, S$6.00". */
  message: string;
  url: string;
}

export function buildWhatsAppShareUrl(message: string, url: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`;
}

export function buildTelegramShareUrl(message: string, url: string) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`;
}

/** Shares a dish or list link through WhatsApp, Telegram or the system sheet and logs the channel. */
export async function shareLink(target: ShareTarget, channel: ShareChannel) {
  const url = withShareSource(target.url, channel);
  try {
    const completed = await performShareHandoff(channel, target.message, url, {
      openMessaging: openTrustedMessagingShareUrl,
      shareSystem: (content) => Share.share(content),
      sharedAction: Share.sharedAction,
    });
    if (!completed) return false;
  } catch {
    Alert.alert("Could not open sharing", "Please try again.");
    return false;
  }
  trackAnalyticsEvent(target.kind === "dish" ? "dish_shared" : "collection_shared", {
    [target.kind === "dish" ? "dish_id" : "collection_id"]: target.id,
    channel,
  });
  return true;
}
