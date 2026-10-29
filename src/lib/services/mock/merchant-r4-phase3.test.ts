import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

test("R4-1: a signed-in user's mock claims list the stall and read as submitted", async () => {
  await hungryService.auth.signIn("weiming@example.sg", "dev-password");
  const before = await hungryService.supply.getMyMerchantClaims();
  await hungryService.supply.submitMerchantClaimInterest({
    venueId: "venue-claim-listing",
    buildingId: "building-1",
    contactName: "Weiming",
  } as never);
  const claims = await hungryService.supply.getMyMerchantClaims();
  assert.equal(claims.length, before.length + 1);
  const mine = claims.find((claim) => claim.venueId === "venue-claim-listing");
  assert.ok(mine);
  assert.equal(mine.status, "submitted");
  assert.equal(mine.venueName, "Your stall", "an unknown stall still reads sensibly");
  assert.ok(Number.isFinite(new Date(mine.submittedAt).getTime()));
  // Claiming twice does not list the stall twice.
  await hungryService.supply.submitMerchantClaimInterest({
    venueId: "venue-claim-listing",
    buildingId: "building-1",
  } as never);
  assert.equal(
    (await hungryService.supply.getMyMerchantClaims()).filter(
      (claim) => claim.venueId === "venue-claim-listing",
    ).length,
    1,
  );
});

test("R4-1: signed out, there are no claims to list", async () => {
  await hungryService.auth.signOut();
  assert.deepEqual(await hungryService.supply.getMyMerchantClaims(), []);
});
