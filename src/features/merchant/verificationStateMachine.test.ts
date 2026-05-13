import assert from "node:assert/strict";
import test from "node:test";

import {
  applyVerificationSubmission,
  canTransitionVerification,
  transitionVerificationStatus,
} from "./verificationStateMachine";
import type { MerchantVerification } from "@/types/domain";

test("transitionVerificationStatus allows expected transitions", () => {
  assert.equal(transitionVerificationStatus("not_started", "begin_draft"), "draft");
  assert.equal(transitionVerificationStatus("draft", "submit"), "submitted");
  assert.equal(transitionVerificationStatus("submitted", "start_review"), "in_review");
  assert.equal(transitionVerificationStatus("in_review", "approve"), "verified");
  assert.equal(transitionVerificationStatus("in_review", "request_more_info"), "more_info_needed");
  assert.equal(transitionVerificationStatus("more_info_needed", "submit"), "submitted");
  assert.equal(transitionVerificationStatus("rejected", "submit"), "submitted");
});

test("transitionVerificationStatus blocks invalid transitions", () => {
  assert.equal(canTransitionVerification("verified", "submit"), false);
  assert.equal(canTransitionVerification("not_started", "approve"), false);

  assert.throws(
    () => transitionVerificationStatus("verified", "submit"),
    /Invalid verification transition/,
  );
});

test("applyVerificationSubmission appends evidence and resets rejection fields", () => {
  const initial: MerchantVerification = {
    status: "more_info_needed",
    method: "licence_upload",
    evidence: [
      {
        id: "ev-old",
        method: "licence_upload",
        fileUrl: "mock://old.pdf",
        uploadedAt: "2026-04-28T12:00:00.000Z",
      },
    ],
    rejectionReason: "Blurry document",
    rejectedAt: "2026-04-28T13:00:00.000Z",
  };

  const next = applyVerificationSubmission(initial, {
    method: "video_walkaround",
    fileUrl: "mock://new.mp4",
  });

  assert.equal(next.status, "submitted");
  assert.equal(next.method, "video_walkaround");
  assert.equal(next.evidence.length, 2);
  assert.equal(next.evidence[1]?.method, "video_walkaround");
  assert.equal(next.evidence[1]?.fileUrl, "mock://new.mp4");
  assert.equal(typeof next.submittedAt, "string");
  assert.equal(next.rejectionReason, undefined);
  assert.equal(next.rejectedAt, undefined);
});
