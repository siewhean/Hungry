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
  // Lists are paged; callers pass limit/offset through to the RPC.
  assert.match(
    supabase,
    /client\.rpc\("list_user_followers", \{\s*p_user_id: userId,\s*p_limit: page\?\.limit \?\? 100,\s*p_offset: page\?\.offset \?\? 0,/,
  );
  assert.match(
    supabase,
    /client\.rpc\("list_user_following", \{\s*p_user_id: userId,\s*p_limit: page\?\.limit \?\? 100,\s*p_offset: page\?\.offset \?\? 0,/,
  );
  assert.match(supabase, /client\.rpc\("can_view_follow_lists", \{ p_user_id: userId \}\)/);
  assert.match(types, /canViewFollowLists\(userId: string\): Promise<boolean>/);
  assert.match(mock, /async canViewFollowLists\(/);
  // Mock refuses self-follows like the SQL does.
  assert.match(
    mock,
    /if \(userId === _profile\.id\) throw new Error\("You can't follow yourself\."\)/,
  );
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

test("follow list follow-up: own lists keep blocked-pair rows and visibility is exposed", () => {
  const sql = read("supabase/migrations/20261019063000_follow_lists_own_and_visibility.sql");

  // Own lists match own counts (and the data export); other users' lists keep the block filter.
  assert.equal(
    (sql.match(/p_user_id = auth\.uid\(\)\s+or up\.id = auth\.uid\(\)/g) ?? []).length,
    2,
  );
  assert.match(sql, /not app_private\.app_user_block_exists\(auth\.uid\(\), up\.id\)/);
  assert.match(sql, /create or replace function public\.can_view_follow_lists\(p_user_id uuid\)/);
  assert.match(
    sql,
    /app_private\.can_read_author_content\(p_user_id\)\s+and not app_private\.app_user_block_exists\(auth\.uid\(\), p_user_id\)/,
  );
  assert.match(
    sql,
    /revoke all on function public\.can_view_follow_lists\(uuid\) from public, anon/,
  );
});

test("mock follow lists page like the RPCs and refuse self-follow", async () => {
  const { hungryService: service } = await import("@/lib/services/mock/mockService");
  const me = await service.profile.getProfile();
  const ids = ["user-page-a", "user-page-b", "user-page-c"];
  await Promise.all(ids.map((id) => service.social.followUser(id)));
  try {
    const all = await service.social.listFollowing(me.id);
    const first = await service.social.listFollowing(me.id, { limit: 2, offset: 0 });
    const rest = await service.social.listFollowing(me.id, { limit: 2, offset: 2 });
    assert.equal(first.length, 2);
    assert.deepEqual([...first, ...rest], all.slice(0, first.length + rest.length));
    await assert.rejects(service.social.followUser(me.id), /can't follow yourself/);
    assert.equal(await service.social.canViewFollowLists("user-page-a"), true);
  } finally {
    await Promise.all(ids.map((id) => service.social.unfollowUser(id)));
  }
});

test("data export fails loudly instead of returning a partial export", async () => {
  const { buildMyDataExport } = await import("@/features/profile/exportMyData");
  const service = {
    profile: {
      exportMyData: async () => {
        throw new Error("permission denied for function export_my_data");
      },
    },
  } as unknown as Parameters<typeof buildMyDataExport>[0];

  await assert.rejects(buildMyDataExport(service), /export_my_data/);

  const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(supabaseService, /\.rpc\("export_my_data"\)/);
  const migration = read("supabase/migrations/20261019100000_export_my_data.sql");
  assert.match(migration, /create or replace function app_private\.export_my_data\(\)/);
  assert.match(migration, /security definer/);
  assert.match(
    migration,
    /create or replace function public\.export_my_data\(\)[\s\S]*?security invoker/,
  );
  assert.match(migration, /auth\.uid\(\)/);
});

test("connections screen pages, explains hidden lists, and profile reconciles both ways", () => {
  const screen = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");
  const profile = read("src/app/screens/profile/UserProfileContent.tsx");
  const store = read("src/store/useSocialStore.ts");

  assert.match(screen, /const CONNECTIONS_PAGE_SIZE = 100;/);
  assert.match(screen, /setHasMore\(rowCount === CONNECTIONS_PAGE_SIZE\)/);
  assert.match(screen, /label="Load more"/);
  assert.match(screen, /service\.canViewFollowLists\(targetUserId\)/);
  assert.match(screen, /This account is private/);
  assert.match(store, /setFollowedUserId: \(userId, isFollowing\) =>/);
  assert.match(
    profile,
    /if \(serverIsFollowing !== null\) setFollowedUserId\(resolvedAuthorId, serverIsFollowing\)/,
  );
  assert.doesNotMatch(profile, /markFollowedUserIds\(\[resolvedAuthorId\]\)/);
});
