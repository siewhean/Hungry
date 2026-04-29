import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Sprint 10 contract: StallDetail claim CTA is staging-gated and wired", () => {
  const source = read("src/app/screens/detail/StallDetailScreen.tsx");
  const claimHelper = read("src/features/merchantClaim/submitClaimFromStall.ts");

  assert.match(source, /FEATURE_FLAGS\.merchantClaimCtaEnabled/);
  assert.match(source, /submitClaimFromStall\(/);
  assert.match(claimHelper, /trackAnalyticsEvent\("claim_this_stall_tapped"/);
  assert.match(claimHelper, /service\.supply\.submitMerchantClaimInterest\(/);
  assert.match(source, /status === "created"/);
  assert.match(source, /already submitted a claim/);
});

test("Sprint 10 contract: StallDetail menu remains curated from dishes", () => {
  const source = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(source, /repository\.listDishesByVenue\(venue\.id\)/);
  assert.doesNotMatch(source, /dishes_draft/);
  assert.doesNotMatch(source, /listDraftDishesQueue/);
});

test("Sprint 10 contract: claim RPC null result maps to already_exists", () => {
  const source = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(source, /rpc\("submit_merchant_claim_interest"/);
  assert.match(source, /claimId: claimId \? String\(claimId\) : null/);
  assert.match(source, /status: claimId \? "created" : "already_exists"/);
});
