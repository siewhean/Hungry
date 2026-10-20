import { trackAnalyticsEvent, type AnalyticsEventName } from "@/lib/analytics";
import { createClientReviewId } from "@/features/review/reviewDraft";

/**
 * Merchant product analytics: activation and drop-off in Merchant Centre. Only the outlet id and
 * non-identifying properties (counts, flags, methods) are sent, never names, text or contacts.
 */
export function trackMerchantEvent(
  event: Extract<AnalyticsEventName, `merchant_${string}`>,
  outletId: string | undefined,
  properties: Record<string, string | number | boolean | undefined> = {},
): void {
  if (!outletId) return;
  try {
    trackAnalyticsEvent(event, { outlet_id: outletId, ...properties });
  } catch {
    // Analytics must never break a merchant action.
  }
}

/** Random dish id made once per editor, so a retried save edits the dish the first try created. */
export function createMerchantDishId(): string {
  return `merchant-dish-${createClientReviewId()}`;
}
