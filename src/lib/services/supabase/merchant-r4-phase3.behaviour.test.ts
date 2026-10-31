// Merchant round-four phase 3 against the real Supabase service with a fake client: the
// signed-in user's own stall claims for the Merchant Centre gate.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";

type ServiceModule = typeof import("./supabaseService");
let service: ServiceModule["supabaseService"];

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
  auth.userId = ME;
});

test("R4-1: my claims are one claims read and one read for every stall name", async () => {
  fake.tables = {
    merchant_claim_interests: () => ({
      data: [
        { id: "c1", venue_id: "v1", status: "new", created_at: "2026-10-29T01:00:00Z" },
        { id: "c2", venue_id: "v2", status: "converted", created_at: "2026-10-28T01:00:00Z" },
        { id: "c3", venue_id: "v1", status: "contacted", created_at: "2026-10-27T01:00:00Z" },
        { id: "c4", venue_id: "v3", status: "rejected", created_at: "2026-10-26T01:00:00Z" },
      ],
      error: null,
    }),
    venues: () => ({
      data: [
        { id: "v1", name: "Uncle Tan Noodles" },
        { id: "v2", name: "Mei's Kopi" },
      ],
      error: null,
    }),
  };
  const claims = await service.supply.getMyMerchantClaims();
  assert.equal(fake.queriesOn("merchant_claim_interests").length, 1);
  assert.equal(fake.queriesOn("venues").length, 1, "stall names are not read one claim at a time");
  assert.deepEqual(
    claims.map((claim) => [claim.claimId, claim.venueName, claim.status]),
    [
      ["c1", "Uncle Tan Noodles", "submitted"],
      ["c2", "Mei's Kopi", "approved"],
      ["c3", "Uncle Tan Noodles", "in_review"],
      ["c4", "Your stall", "rejected"],
    ],
  );
  const ownClaims = fake
    .queriesOn("merchant_claim_interests")
    .flatMap((query) => query.ops)
    .find(([method, args]) => method === "eq" && args[0] === "claimed_by");
  assert.equal(ownClaims?.[1][1], ME, "only the signed-in user's claims are asked for");
});

test("R4-1: with no claims the stall names are not read at all", async () => {
  fake.tables = { merchant_claim_interests: () => ({ data: [], error: null }) };
  assert.deepEqual(await service.supply.getMyMerchantClaims(), []);
  assert.equal(fake.queriesOn("venues").length, 0);
});

test("R4-1: signed out there is nothing to read", async () => {
  auth.userId = null;
  assert.deepEqual(await service.supply.getMyMerchantClaims(), []);
  assert.equal(fake.queries.length, 0);
});

test("R4-1: a failed read rejects so the gate can offer a retry", async () => {
  fake.tables = {
    merchant_claim_interests: () => ({ data: null, error: new Error("denied") }),
  };
  await assert.rejects(() => service.supply.getMyMerchantClaims(), /denied/);
  fake.tables = {
    merchant_claim_interests: () => ({
      data: [{ id: "c1", venue_id: "v1", status: "new", created_at: "2026-10-29T01:00:00Z" }],
      error: null,
    }),
    venues: () => ({ data: null, error: new Error("venues down") }),
  };
  await assert.rejects(() => service.supply.getMyMerchantClaims(), /venues down/);
});
