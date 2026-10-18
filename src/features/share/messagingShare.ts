import { Share } from "react-native";

import { trackAnalyticsEvent } from "@/lib/analytics";
import { openTrustedMessagingShareUrl } from "@/lib/security/safeLinking";

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
  if (channel === "whatsapp") {
    await openTrustedMessagingShareUrl(buildWhatsAppShareUrl(target.message, target.url));
  } else if (channel === "telegram") {
    await openTrustedMessagingShareUrl(buildTelegramShareUrl(target.message, target.url));
  } else {
    const result = await Share.share({
      message: `${target.message}\n${target.url}`,
      url: target.url,
    });
    if (result.action === Share.dismissedAction) return;
  }
  trackAnalyticsEvent(target.kind === "dish" ? "dish_shared" : "collection_shared", {
    [target.kind === "dish" ? "dish_id" : "collection_id"]: target.id,
    channel,
  });
}
