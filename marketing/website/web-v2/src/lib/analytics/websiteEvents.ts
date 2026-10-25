import { track } from "@vercel/analytics";
import { analyticsAllowed } from "@/lib/privacy/consent";

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
  if (!analyticsAllowed()) {
    return;
  }

  try {
    const safeProperties: WebsiteEventProperties = {};
    for (const key of ["audience", "source", "route"] as const) {
      const value = properties[key];
      if (typeof value === "string" && /^[a-zA-Z0-9_/-]{1,80}$/.test(value))
        safeProperties[key] = value;
    }
    track(eventName, safeProperties);
  } catch {
    // Tracking failures should never block UI interactions.
  }
}
