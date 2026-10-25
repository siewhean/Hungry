// Profile reads against a fake Supabase client: which errors fall back, which reach the screen.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

let service: typeof import("./supabaseService").supabaseService;

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

test("getUserReviews throws when the profile-reviews rpc fails, instead of reading the table", async () => {
  fake.rpc.get_user_profile_reviews = () => ({
    error: { message: "rate limit exceeded", code: "P0001" },
  });
  await assert.rejects(service.reviews.getUserReviews(OTHER), { message: "rate limit exceeded" });
  assert.equal(fake.queriesOn("reviews").length, 0, "the table read is not used");
});

test("getUserReviews falls back to the table read only when the rpc does not exist", async () => {
  fake.rpc.get_user_profile_reviews = () => ({
    error: { message: "function does not exist", code: "42883" },
  });
  fake.tables.reviews = () => ({ data: [] });
  assert.deepEqual(await service.reviews.getUserReviews(OTHER), []);
  assert.equal(fake.queriesOn("reviews").length, 1);
});

test("getPublicProfile maps the server's reviewed-dish counter", async () => {
  fake.tables.public_profiles = () => ({
    data: { id: OTHER, display_name: "Ahmad", dishes_reviewed: 73, stalls_visited: 12 },
  });
  const profile = await service.profile.getPublicProfile(OTHER);
  assert.equal(profile?.dishesReviewed, 73);
  assert.equal(profile?.stallsVisited, 12);
  const select = fake.queriesOn("public_profiles")[0].ops.find(([op]) => op === "select");
  assert.match(String(select?.[1][0]), /dishes_reviewed/);
});

test("getPublicProfile throws when the private-profile card fails, so the screen can retry", async () => {
  fake.tables.public_profiles = () => ({ data: null });
  fake.rpc.get_profile_card = () => ({ error: { message: "network down", code: "08006" } });
  await assert.rejects(service.profile.getPublicProfile(OTHER), { message: "network down" });

  fake.rpc.get_profile_card = () => ({ data: [] });
  assert.equal(await service.profile.getPublicProfile(OTHER), undefined, "no card is not found");
});
