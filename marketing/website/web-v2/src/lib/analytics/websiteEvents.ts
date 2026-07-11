import { track } from "@vercel/analytics";

export type WebsiteAudience = "foodie" | "merchant";

export type WebsiteEventName =
  | "website_cta_clicked"
  | "website_waitlist_started"
  | "website_waitlist_submitted"
  | "website_merchant_interest_started"
  | "website_merchant_interest_submitted";

type TrackPropertyValue = string | number | boolean | null;
export type WebsiteEventProperties = Record<string, TrackPropertyValue>;

export function trackWebsiteEvent(
  eventName: WebsiteEventName,
  properties: WebsiteEventProperties = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    track(eventName, properties);
  } catch {
    // Tracking failures should never block UI interactions.
  }
}
