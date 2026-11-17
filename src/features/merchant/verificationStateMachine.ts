import type {
  MerchantVerification,
  VerificationEvidence,
  VerificationMethod,
  VerificationStatus,
} from "@/types/domain";

export type VerificationEvent =
  | "begin_draft"
  | "submit"
  | "start_review"
  | "approve"
  | "reject"
  | "request_more_info"
  | "reset";

const TRANSITIONS: Record<
  VerificationStatus,
  Partial<Record<VerificationEvent, VerificationStatus>>
> = {
  not_started: {
    begin_draft: "draft",
    submit: "submitted",
  },
  draft: {
    submit: "submitted",
    reset: "not_started",
  },
  submitted: {
    start_review: "in_review",
    approve: "verified",
    reject: "rejected",
    request_more_info: "more_info_needed",
  },
  in_review: {
    approve: "verified",
    reject: "rejected",
    request_more_info: "more_info_needed",
  },
  more_info_needed: {
    submit: "submitted",
    begin_draft: "draft",
  },
  rejected: {
    submit: "submitted",
    begin_draft: "draft",
  },
  verified: {
    reset: "not_started",
  },
};

export function canTransitionVerification(
  current: VerificationStatus,
  event: VerificationEvent,
): boolean {
  return Boolean(TRANSITIONS[current][event]);
}

export function transitionVerificationStatus(
  current: VerificationStatus,
  event: VerificationEvent,
): VerificationStatus {
  const next = TRANSITIONS[current][event];
  if (!next) {
    throw new Error(`Invalid verification transition: ${current} -> ${event}`);
  }
  return next;
}

export function buildVerificationEvidence(
  method: VerificationMethod,
  fileUrl: string,
): VerificationEvidence {
  return {
    id: `ev-${Date.now()}`,
    method,
    fileUrl,
    uploadedAt: new Date().toISOString(),
  };
}

export function applyVerificationSubmission(
  verification: MerchantVerification,
  evidenceInput: Omit<VerificationEvidence, "id" | "uploadedAt">,
): MerchantVerification {
  const nowIso = new Date().toISOString();
  const nextStatus = transitionVerificationStatus(verification.status, "submit");
  const evidence = {
    ...buildVerificationEvidence(evidenceInput.method, evidenceInput.fileUrl),
    reviewNote: evidenceInput.reviewNote,
  };

  return {
    ...verification,
    status: nextStatus,
    method: evidenceInput.method,
    evidence: [...verification.evidence, evidence],
    submittedAt: nowIso,
  };
}
