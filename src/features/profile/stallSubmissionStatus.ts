import type { UserStallSubmissionStatus } from "@/types/domain";
import type { BadgeTone } from "@/components/ui/badgeTones";

/** What a stall submission's status means to the person who submitted it. */
export const STALL_SUBMISSION_STATUS: Record<
  UserStallSubmissionStatus,
  { label: string; tone: BadgeTone; detail: string }
> = {
  pending: {
    label: "Waiting for review",
    tone: "neutral",
    detail: "The Hungry team hasn't looked at this yet.",
  },
  under_review: {
    label: "Being reviewed",
    tone: "info",
    detail: "The Hungry team is checking the details.",
  },
  accepted: {
    label: "Added to Hungry",
    tone: "success",
    detail: "Thanks for the find. The stall is on Hungry.",
  },
  rejected: {
    label: "Not added",
    tone: "error",
    detail: "The team couldn't add this one.",
  },
  duplicate: {
    label: "Already on Hungry",
    tone: "warning",
    detail: "Hungry already lists this stall.",
  },
};
