import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("follow RPC migration writes pending/approved by privacy and exposes counts and lists", () => {
  const sql = read("supabase/migrations/20261019060000_follow_user_rpc_and_counts.sql");

  assert.match(sql, /create or replace function app_private\.follow_user\(p_target_user_id uuid\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /= 'private' then 'pending'\s+else 'approved'/);
  assert.match(sql, /app_private\.app_user_block_exists\(v_viewer, p_target_user_id\)/);
  assert.match(sql, /You cannot follow yourself/);
  assert.match(sql, /create or replace function public\.follow_user\(p_target_user_id uuid\)/);
  assert.match(sql, /create or replace function public\.get_follow_counts\(p_user_id uuid\)/);
  assert.match(sql, /create or replace function public\.list_user_followers\(/);
  assert.match(sql, /create or replace function public\.list_user_following\(/);
  assert.match(sql, /app_private\.can_read_author_content\(p_user_id\)/);
  assert.match(sql, /grant execute on function public\.follow_user\(uuid\) to authenticated/);
});

test("supabase follows use the RPCs; mock matches the contract", () => {
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const mock = read("src/lib/services/mock/mockService.ts");
  const types = read("src/lib/services/types.ts");

  assert.match(types, /followUser\(userId: string\): Promise<"approved" \| "pending">/);
  assert.match(types, /getFollowCounts\(\s*userId: string,\s*\)/);
  assert.match(supabase, /client\.rpc\("follow_user", \{ p_target_user_id: userId \}\)/);
  assert.doesNotMatch(supabase, /followee_id: userId, status: "approved"/);
  assert.match(supabase, /client\.rpc\("list_user_followers", \{ p_user_id: userId \}\)/);
  assert.match(supabase, /client\.rpc\("list_user_following", \{ p_user_id: userId \}\)/);
  assert.match(supabase, /client\.rpc\("get_follow_counts", \{ p_user_id: userId \}\)/);
  assert.match(mock, /async getFollowCounts\(userId: string\)/);
  // Mock must not hand every user the signed-in profile's followers.
  assert.match(
    mock,
    /userId === _profile\.id \? _mockFollowersByUser\[userProfile\.id\] : undefined/,
  );
});

test("mock follow counts match the follower list and follows", async () => {
  const { hungryService: service } = await import("@/lib/services/mock/mockService");
  const otherUserId = "user-follow-contract-target";

  const before = await service.social.getFollowCounts(otherUserId);
  assert.deepEqual(before, { followersCount: 0, followingCount: 0 });
  assert.deepEqual(await service.social.listFollowers(otherUserId), []);

  assert.equal(await service.social.followUser(otherUserId), "approved");
  const after = await service.social.getFollowCounts(otherUserId);
  assert.equal(after?.followersCount, 1);
  assert.equal((await service.social.listFollowers(otherUserId)).length, 1);
  assert.deepEqual(await service.social.listFollowing(otherUserId), []);

  await service.social.unfollowUser(otherUserId);
  assert.equal((await service.social.getFollowCounts(otherUserId))?.followersCount, 0);
});
