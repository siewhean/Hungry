import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("follow request migration: guarded RPCs, block-aware lists, activity only on the right status", () => {
  const sql = read("supabase/migrations/20261019074000_follow_requests.sql");

  // activity_events accepts the new type.
  assert.match(sql, /'new_follower',\s+'follow_request'\s+\)\)/);
  // Pending sends follow_request; new_follower only once approved (insert or later approval).
  assert.match(
    sql,
    /if NEW\.status = 'approved'\s+and \(TG_OP = 'INSERT' or OLD\.status is distinct from 'approved'\) then[\s\S]*'new_follower'/,
  );
  assert.match(
    sql,
    /elsif NEW\.status = 'pending'\s+and \(TG_OP = 'INSERT' or OLD\.status is distinct from 'pending'\) then[\s\S]*'follow_request'/,
  );
  assert.match(sql, /after insert or update of status on public\.follows/);
  assert.match(
    sql,
    /revoke execute on function public\.trg_activity_on_follow\(\)\s+from public, anon, authenticated/,
  );

  for (const fn of [
    "list_incoming_follow_requests",
    "count_incoming_follow_requests",
    "approve_follow_request",
    "decline_follow_request",
    "cancel_follow_request",
  ]) {
    assert.match(sql, new RegExp(`create or replace function app_private\\.${fn}\\(`));
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`));
    assert.match(
      sql,
      new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon`),
    );
  }
  assert.equal((sql.match(/security definer/g) ?? []).length, 7);
  assert.match(sql, /You must be signed in to answer follow requests\./);
  assert.match(
    sql,
    /f\.followee_id = auth\.uid\(\)\s+and f\.status = 'pending'\s+and not app_private\.app_user_block_exists\(auth\.uid\(\), f\.follower_id\)/,
  );
  assert.match(sql, /You cannot approve this follow request\./);
  // Approve only touches the caller's own pending request.
  assert.match(
    sql,
    /f\.follower_id = p_requester_id\s+and f\.followee_id = v_viewer\s+and f\.status = 'pending'\s+for update/,
  );
  // Cancel only removes the caller's own pending request.
  assert.match(
    sql,
    /f\.follower_id = v_viewer\s+and f\.followee_id = p_target_user_id\s+and f\.status = 'pending'/,
  );
  assert.match(sql, /limit least\(greatest\(coalesce\(p_limit, 50\), 1\), 200\)/);

  const smoke = read("supabase/smoke/follow_requests.sql");
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
});

test("supabase and mock services expose the same follow request contract", () => {
  const types = read("src/lib/services/types.ts");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const mock = read("src/lib/services/mock/mockService.ts");

  assert.match(
    types,
    /getFollowStatus\(userId: string\): Promise<"approved" \| "pending" \| "none">/,
  );
  assert.match(types, /"new_follower" \| "follow_request"/);
  assert.match(supabase, /client\.rpc\("cancel_follow_request", \{ p_target_user_id: userId \}\)/);
  assert.match(
    supabase,
    /client\.rpc\("list_incoming_follow_requests", \{\s*p_limit: page\?\.limit \?\? 50,\s*p_offset: page\?\.offset \?\? 0,/,
  );
  assert.match(supabase, /client\.rpc\("count_incoming_follow_requests"\)/);
  assert.match(
    supabase,
    /client\.rpc\("approve_follow_request", \{\s*p_requester_id: requesterId,/,
  );
  assert.match(
    supabase,
    /client\.rpc\("decline_follow_request", \{\s*p_requester_id: requesterId,/,
  );
  for (const method of [
    "getFollowStatus",
    "cancelFollowRequest",
    "listFollowRequests",
    "getFollowRequestCount",
    "approveFollowRequest",
    "declineFollowRequest",
  ]) {
    assert.match(supabase, new RegExp(`async ${method}\\(`));
    assert.match(mock, new RegExp(`async ${method}\\(`));
  }
});

test("mock: private accounts get pending requests that can be cancelled", async () => {
  const { hungryService: service } = await import("@/lib/services/mock/mockService");
  const privateUserId = "user-emma";

  assert.equal(await service.social.followUser(privateUserId), "pending");
  assert.equal(await service.social.getFollowStatus(privateUserId), "pending");
  assert.equal(await service.social.isFollowing(privateUserId), false);
  assert.equal((await service.social.getFollowCounts(privateUserId))?.followersCount, 0);

  await service.social.cancelFollowRequest(privateUserId);
  assert.equal(await service.social.getFollowStatus(privateUserId), "none");
  // Cancelling again is a no-op, like the RPC.
  await service.social.cancelFollowRequest(privateUserId);

  assert.equal(await service.social.followUser("user-public-request-check"), "approved");
  assert.equal(await service.social.getFollowStatus("user-public-request-check"), "approved");
  await service.social.unfollowUser("user-public-request-check");
});

test("mock: incoming requests page, approve into followers, and decline", async () => {
  const { hungryService: service } = await import("@/lib/services/mock/mockService");
  const me = await service.profile.getProfile();

  const count = await service.social.getFollowRequestCount();
  assert.ok(count >= 2);
  const requests = await service.social.listFollowRequests();
  assert.equal(requests.length, count);
  assert.equal((await service.social.listFollowRequests({ limit: 1 })).length, 1);

  const [toApprove, toDecline] = requests;
  const followersBefore = (await service.social.getFollowCounts(me.id))?.followersCount ?? 0;

  await service.social.approveFollowRequest(toApprove.userId);
  assert.equal((await service.social.getFollowCounts(me.id))?.followersCount, followersBefore + 1);
  assert.ok(
    (await service.social.listFollowers(me.id)).some(
      (follower) => follower.userId === toApprove.userId,
    ),
  );

  await service.social.declineFollowRequest(toDecline.userId);
  assert.equal(await service.social.getFollowRequestCount(), count - 2);
  assert.equal((await service.social.getFollowCounts(me.id))?.followersCount, followersBefore + 1);

  await assert.rejects(service.social.approveFollowRequest(toDecline.userId), /not found/);
  await assert.rejects(service.social.declineFollowRequest(toApprove.userId), /not found/);
});

test("follow button shows Requested and tapping it cancels the request", () => {
  const store = read("src/store/useSocialStore.ts");
  const profile = read("src/app/screens/profile/UserProfileContent.tsx");
  const connections = read("src/app/screens/profile/ProfileConnectionsScreen.tsx");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");

  assert.match(store, /requestedUserIds: Record<string, boolean>/);
  assert.match(
    store,
    /if \(!isFollowing && get\(\)\.requestedUserIds\[userId\]\) \{[\s\S]*service\.social\.cancelFollowRequest\(userId\)/,
  );
  assert.match(store, /requestedUserIds: \{ \.\.\.prev\.requestedUserIds, \[userId\]: true \}/);
  assert.match(profile, /service\.getFollowStatus\(resolvedAuthorId\)/);
  assert.match(profile, /setFollowRequested\(resolvedAuthorId, serverFollowStatus === "pending"\)/);
  assert.match(profile, /\? "Requested"/);
  assert.match(profile, /Cancels your follow request/);
  assert.match(connections, /isRequested \? "Requested"/);
  assert.match(home, /isFollowRequested \? "Requested"/);
});

test("Follow Requests screen is a protected root route reached from Profile and Activity", () => {
  const screen = read("src/app/screens/profile/FollowRequestsScreen.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");
  const root = read("src/app/navigation/RootNavigator.tsx");
  const profileHome = read("src/app/screens/profile/ProfileHomeScreen.tsx");
  const inbox = read("src/app/screens/home/ActivityInboxScreen.tsx");
  const activityStore = read("src/store/useActivityStore.ts");

  assert.match(types, /FollowRequests: undefined;/);
  assert.match(
    root,
    /<RootStack\.Screen getComponent=\{loadFollowRequestsScreen\} name="FollowRequests" \/>/,
  );
  const protectedBlock =
    root.match(/const PROTECTED_ROOT_ROUTES = new Set<RootRouteName>\(\[([\s\S]*?)\]\);/)?.[1] ??
    "";
  assert.match(protectedBlock, /"FollowRequests"/);

  // Loading, error (with retry), empty, and labelled Approve/Decline per row.
  assert.match(screen, /Loading follow requests/);
  assert.match(screen, /Couldn't load follow requests/);
  assert.match(screen, /ctaLabel="Try again"/);
  assert.match(screen, /No follow requests/);
  assert.match(screen, /accessibilityLabel=\{`Approve follow request from \$\{request\.name\}`\}/);
  assert.match(screen, /accessibilityLabel=\{`Decline follow request from \$\{request\.name\}`\}/);
  assert.match(screen, /service\.approveFollowRequest\(request\.userId\)/);
  assert.match(screen, /service\.declineFollowRequest\(request\.userId\)/);

  // Profile row only when there are requests or the account is private.
  assert.match(
    profileHome,
    /\(followRequestCount \?\? 0\) > 0 \|\| profile\.profileVisibility === "private"/,
  );
  assert.match(profileHome, /rootNavigation\.navigate\("FollowRequests"\)/);
  assert.match(profileHome, /social\.getFollowRequestCount\(\)/);

  assert.match(activityStore, /e\.eventType === "follow_request"\s+\? "follow_request"/);
  assert.match(
    inbox,
    /if \(update\.kind === "follow_request"\) \{\s+navigation\.navigate\("FollowRequests"\);/,
  );
});
