import { MERCHANT_REPLY_MAX_LENGTH } from "@/features/merchant/merchantReadiness";

export type ReplySuggestionKind = "thank" | "apologise" | "invite_back";

export const REPLY_SUGGESTION_LABELS: Record<ReplySuggestionKind, string> = {
  thank: "Thank",
  apologise: "Apologise",
  invite_back: "Invite back",
};

export const REPLY_SUGGESTION_KINDS: readonly ReplySuggestionKind[] = [
  "thank",
  "apologise",
  "invite_back",
];

/** The reviewer's first name for a greeting, or nothing when the name is missing or generic. */
function greetingName(authorName: string | undefined): string | null {
  const first = authorName?.trim().split(/\s+/)[0] ?? "";
  if (!first || /^(anonymous|guest|diner|user)$/i.test(first)) return null;
  return first;
}

/**
 * An editable starting point for a public reply. It promises nothing the stall has not decided
 * (no refunds, no offers), so the merchant can send it as is or change it.
 */
export function buildReplySuggestion(
  kind: ReplySuggestionKind,
  authorName: string | undefined,
): string {
  const name = greetingName(authorName);
  const hello = name ? `Hi ${name}, ` : "";
  const text = {
    thank: `${hello}thank you for the kind words and for visiting us. We hope to see you again soon!`,
    apologise: `${hello}we're sorry your visit was not what you hoped for. Thank you for telling us, we will look into it.`,
    invite_back: `${hello}thank you for your feedback. We would love to have you back and show you a better visit.`,
  }[kind];
  return text.slice(0, MERCHANT_REPLY_MAX_LENGTH);
}
