// The social graph service methods (migration 20261107180000) against a fake client: the rpc
// names and arguments, sign-in checks, the older-backend fallbacks, and that other errors throw.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const MISSING = { code: "PGRST202", message: "Could not find the function" };
const BROKEN = { code: "57014", message: "canceling statement due to statement timeout" };

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

test("getProfileRelationship reads one row, null on an older backend, throws otherwise", async () => {
  fake.rpc.get_profile_relationship = () => ({
    data: [{ follows_you: true, mutual_count: 1, mutual_user_ids: [OTHER], mutual_names: ["Mei"] }],
  });
  assert.deepEqual(await service.social.getProfileRelationship(OTHER), {
    followsYou: true,
    mutualCount: 1,
    mutuals: [{ userId: OTHER, displayName: "Mei" }],
  });
  assert.deepEqual(fake.callsTo("get_profile_relationship")[0].args, { p_user_id: OTHER });

  fake.rpc.get_profile_relationship = () => ({ data: [] });
  assert.equal(await service.social.getProfileRelationship(OTHER), null);
  fake.rpc.get_profile_relationship = () => ({ error: MISSING });
  assert.equal(await service.social.getProfileRelationship(OTHER), null);
  fake.rpc.get_profile_relationship = () => ({ error: BROKEN });
  await assert.rejects(service.social.getProfileRelationship(OTHER));
});

test("getTasteMatches sends each id once, at most 200, and skips the call for none", async () => {
  assert.deepEqual(await service.social.getTasteMatches([]), {});
  assert.equal(fake.rpcCalls.length, 0);

  fake.rpc.get_taste_matches = () => ({ data: [{ user_id: OTHER, score: 81 }] });
  const ids = [OTHER, OTHER, "", ...Array.from({ length: 250 }, (_, index) => `id-${index}`)];
  assert.deepEqual(await service.social.getTasteMatches(ids), { [OTHER]: 81 });
  const sent = (fake.callsTo("get_taste_matches")[0].args as { p_user_ids: string[] }).p_user_ids;
  assert.equal(sent.length, 200);
  assert.equal(sent[0], OTHER);
  assert.equal(new Set(sent).size, 200);

  fake.rpc.get_taste_matches = () => ({ error: MISSING });
  assert.deepEqual(await service.social.getTasteMatches([OTHER]), {});
  fake.rpc.get_taste_matches = () => ({ error: BROKEN });
  await assert.rejects(service.social.getTasteMatches([OTHER]));
});

test("getTasteComparison maps both palates and falls back to null", async () => {
  const row = {
    score: 64,
    sweet: 3,
    spicy: 9,
    sour: 5,
    salty: 6,
    rich: 7,
    aromatic: 4,
    my_sweet: 5,
    my_spicy: 8,
    my_sour: 5,
    my_salty: 5,
    my_rich: 6,
    my_aromatic: 4,
  };
  fake.rpc.get_taste_comparison = () => ({ data: [row] });
  const result = await service.social.getTasteComparison(OTHER);
  assert.equal(result?.score, 64);
  assert.equal(result?.theirs.spicy, 9);
  assert.equal(result?.mine.spicy, 8);
  assert.deepEqual(fake.callsTo("get_taste_comparison")[0].args, { p_user_id: OTHER });

  fake.rpc.get_taste_comparison = () => ({ error: MISSING });
  assert.equal(await service.social.getTasteComparison(OTHER), null);
  fake.rpc.get_taste_comparison = () => ({ error: BROKEN });
  await assert.rejects(service.social.getTasteComparison(OTHER));
});

test("people suggestions and network picks are signed-in only and pass the limit", async () => {
  auth.userId = null;
  assert.deepEqual(await service.social.listPeopleSuggestions(5), []);
  assert.deepEqual(await service.social.listNetworkStallPicks(5), []);
  assert.equal(fake.rpcCalls.length, 0);

  auth.userId = ME;
  fake.rpc.get_people_suggestions = () => ({
    data: [{ user_id: OTHER, display_name: "Mei", taste_match: 90, reason: "taste" }],
  });
  fake.rpc.get_network_stall_picks = () => ({
    data: [
      {
        venue_id: "v1",
        source: "following",
        people_count: 1,
        sample_user_ids: [OTHER],
        sample_names: ["Mei"],
      },
    ],
  });
  const people = await service.social.listPeopleSuggestions(5);
  assert.equal(people[0]?.userId, OTHER);
  assert.equal(people[0]?.reason, "taste");
  assert.deepEqual(fake.callsTo("get_people_suggestions")[0].args, { p_limit: 5 });
  const picks = await service.social.listNetworkStallPicks(12);
  assert.equal(picks[0]?.venueId, "v1");
  assert.deepEqual(fake.callsTo("get_network_stall_picks")[0].args, { p_limit: 12 });

  fake.rpc.get_people_suggestions = () => ({ error: MISSING });
  fake.rpc.get_network_stall_picks = () => ({ error: MISSING });
  assert.deepEqual(await service.social.listPeopleSuggestions(), []);
  assert.deepEqual(await service.social.listNetworkStallPicks(), []);
  fake.rpc.get_people_suggestions = () => ({ error: BROKEN });
  fake.rpc.get_network_stall_picks = () => ({ error: BROKEN });
  await assert.rejects(service.social.listPeopleSuggestions());
  await assert.rejects(service.social.listNetworkStallPicks());
});
