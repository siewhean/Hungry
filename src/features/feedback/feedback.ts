/**
 * In-app feedback. Two kinds, both sent to PostHog as events so they sit beside the usage data:
 *  - a thumbs question placed on a few screens ("Was this a good pick?"), answered in one tap;
 *  - written feedback from Settings > Send feedback.
 * Nothing is sent while "Share usage analytics" is off. Written feedback then goes by email
 * instead, written by the person in their own mail app.
 */
import { isAnalyticsEnabled, trackAnalyticsEvent } from "@/lib/analytics";
import { SUPPORT_EMAIL } from "@/constants/links";
import { useFeedbackStore } from "@/store/useFeedbackStore";

export const FEEDBACK_MAX_LENGTH = 1000;

export const FEEDBACK_CATEGORIES = [
  { id: "bug", label: "Something is broken" },
  { id: "idea", label: "An idea" },
  { id: "like", label: "Something I like" },
  { id: "other", label: "Other" },
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["id"];

export const THUMB_DOWN_REASONS = [
  { id: "wrong_food", label: "Not my kind of food" },
  { id: "too_far", label: "Too far" },
  { id: "too_pricey", label: "Too pricey" },
  { id: "seen_it", label: "Seen it already" },
  { id: "other", label: "Something else" },
] as const;
export type ThumbDownReason = (typeof THUMB_DOWN_REASONS)[number]["id"];

/** Where each thumbs question sits. The id is what PostHog groups by. */
export const FEEDBACK_PROMPTS = {
  decide_pick: { id: "decide_pick", question: "Was this a good pick?" },
  search_results: { id: "search_results", question: "Did you find what you wanted?" },
} as const;
export type FeedbackPromptId = keyof typeof FEEDBACK_PROMPTS;

/** True when this question may appear now (not asked recently, analytics on). */
export function shouldShowFeedbackPrompt(promptId: FeedbackPromptId): boolean {
  return isAnalyticsEnabled() && useFeedbackStore.getState().canAsk(promptId);
}

export function recordFeedbackPromptShown(promptId: FeedbackPromptId): void {
  useFeedbackStore.getState().markShown();
  trackAnalyticsEvent("feedback_prompt_shown", { prompt_id: promptId });
}

/** The thumb itself. A thumbs down counts at once, even if the person never picks a reason. */
export function submitFeedbackThumb(promptId: FeedbackPromptId, rating: "up" | "down"): void {
  useFeedbackStore.getState().markSettled(promptId);
  trackAnalyticsEvent("feedback_thumb_submitted", { prompt_id: promptId, rating });
}

/** The optional reason after a thumbs down. */
export function submitFeedbackThumbReason(
  promptId: FeedbackPromptId,
  reason: ThumbDownReason,
): void {
  trackAnalyticsEvent("feedback_thumb_reason", { prompt_id: promptId, reason });
}

export function dismissFeedbackPrompt(promptId: FeedbackPromptId): void {
  useFeedbackStore.getState().markSettled(promptId);
  trackAnalyticsEvent("feedback_prompt_dismissed", { prompt_id: promptId });
}

export type SendFeedbackResult =
  | { status: "sent" }
  | { status: "too_many" }
  | { status: "empty" }
  /** Analytics is off: nothing was sent. `mailto` carries what the person wrote to their mail app. */
  | { status: "use_email"; mailto: string };

export function buildFeedbackMailto(category: FeedbackCategory, message: string): string {
  const label = FEEDBACK_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Feedback";
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Hungry feedback: ${label}`)}&body=${encodeURIComponent(message)}`;
}

export function sendFeedback(category: FeedbackCategory, rawMessage: string): SendFeedbackResult {
  const message = rawMessage.trim().slice(0, FEEDBACK_MAX_LENGTH);
  if (!message) return { status: "empty" };
  if (!isAnalyticsEnabled()) {
    return { status: "use_email", mailto: buildFeedbackMailto(category, message) };
  }
  const store = useFeedbackStore.getState();
  if (!store.canSendFeedback()) return { status: "too_many" };
  store.markFeedbackSent();
  trackAnalyticsEvent("feedback_submitted", { category, message });
  return { status: "sent" };
}
