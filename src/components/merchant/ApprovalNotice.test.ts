// ApprovalNotice (P3-1): the "You're approved" note on Merchant Centre Home closes for good once
// dismissed. The rendered note is covered in merchant-r4-phase3.render.test.tsx.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { beforeEach } from "node:test";

import { useMerchantStore } from "@/store/useMerchantStore";

beforeEach(() => {
  useMerchantStore.getState().clearMerchant();
});

test("ApprovalNotice: dismissing a claim's note is remembered once and per claim", () => {
  const { dismissApprovalNotice } = useMerchantStore.getState();
  dismissApprovalNotice("claim-1");
  dismissApprovalNotice("claim-1");
  dismissApprovalNotice("claim-2");
  assert.deepEqual(useMerchantStore.getState().dismissedApprovalClaimIds, ["claim-1", "claim-2"]);
});

test("ApprovalNotice: signing out forgets which notes were closed", () => {
  useMerchantStore.getState().dismissApprovalNotice("claim-1");
  useMerchantStore.getState().clearMerchant();
  assert.deepEqual(useMerchantStore.getState().dismissedApprovalClaimIds, []);
});

test("ApprovalNotice: only approved, not-yet-closed claims show, and a failed read is reported", () => {
  const source = readFileSync("src/components/merchant/ApprovalNotice.tsx", "utf8");
  assert.match(source, /claim\.status === "approved" && !dismissed\.includes\(claim\.claimId\)/);
  assert.match(
    source,
    /reportError\(error, \{ screen: "MerchantDashboard", action: "load_approval_notice" \}\)/,
  );
});
