// Calls the real Supabase service methods against a fake client and checks the rpc/table calls
// and the values that come back: sign-in checks, argument shaping, error handling.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake, auth } = installFakeSupabase();
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";

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
  auth.email = "me@example.sg";
  auth.verifyOtpUser = null;
  auth.calls.length = 0;
  auth.failures = {};
});

const rejectsWith = async (promise: Promise<unknown>, message: RegExp) =>
  assert.rejects(promise, (error: Error) => message.test(error.message));

test("followUser returns 'pending' for a private account and 'approved' otherwise", async () => {
  fake.rpc.follow_user = () => ({ data: "pending" });
  assert.equal(await service.social.followUser(OTHER), "pending");
  fake.rpc.follow_user = () => ({ data: "approved" });
  assert.equal(await service.social.followUser(OTHER), "approved");
  fake.rpc.follow_user = () => ({ data: null });
  assert.equal(await service.social.followUser(OTHER), "approved");
  assert.deepEqual(fake.callsTo("follow_user")[0].args, { p_target_user_id: OTHER });
});

test("followUser and unfollowUser need a signed-in user and surface server errors", async () => {
  auth.userId = null;
  await rejectsWith(service.social.followUser(OTHER), /signed in to follow/);
  await rejectsWith(service.social.unfollowUser(OTHER), /signed in to unfollow/);
  assert.equal(fake.rpcCalls.length, 0);

  auth.userId = ME;
  fake.rpc.follow_user = () => ({ error: { message: "cannot follow yourself" } });
  await rejectsWith(service.social.followUser(OTHER), /cannot follow yourself/);
});

test("unfollowUser deletes only the caller's own follow row", async () => {
  await service.social.unfollowUser(OTHER);
  const ops = fake.queriesOn("follows")[0].ops;
  assert.equal(ops[0][0], "delete");
  assert.deepEqual(
    ops.filter(([op]) => op === "eq").map(([, args]) => args),
    [
      ["follower_id", ME],
      ["followee_id", OTHER],
    ],
  );
});

test("listFollowers maps rows, fills defaults, pages, and throws on error", async () => {
  fake.rpc.list_user_followers = () => ({
    data: [{ user_id: "a", display_name: "Ahmad", avatar_url: "a.jpg" }, { user_id: "b" }, {}],
  });
  assert.deepEqual(await service.social.listFollowers(OTHER), [
    { userId: "a", displayName: "Ahmad", avatarUrl: "a.jpg" },
    { userId: "b", displayName: "", avatarUrl: undefined },
    { userId: "", displayName: "", avatarUrl: undefined },
  ]);
  assert.deepEqual(fake.callsTo("list_user_followers")[0].args, {
    p_user_id: OTHER,
    p_limit: 100,
    p_offset: 0,
  });

  await service.social.listFollowers(OTHER, { limit: 20, offset: 40 });
  assert.deepEqual(fake.callsTo("list_user_followers")[1].args, {
    p_user_id: OTHER,
    p_limit: 20,
    p_offset: 40,
  });

  fake.rpc.list_user_followers = () => ({ data: null });
  assert.deepEqual(await service.social.listFollowers(OTHER), []);
  fake.rpc.list_user_followers = () => ({ error: { message: "offline" } });
  await rejectsWith(service.social.listFollowers(OTHER), /offline/);
});

test("canViewFollowLists assumes visible when the check fails, and respects an explicit no", async () => {
  fake.rpc.can_view_follow_lists = () => ({ data: false });
  assert.equal(await service.social.canViewFollowLists(OTHER), false);
  fake.rpc.can_view_follow_lists = () => ({ data: true });
  assert.equal(await service.social.canViewFollowLists(OTHER), true);
  fake.rpc.can_view_follow_lists = () => ({ error: { message: "down" } });
  assert.equal(await service.social.canViewFollowLists(OTHER), true);
});

test("getFollowCounts returns null without a row and throws when the read fails (PROF-V1)", async () => {
  fake.rpc.get_follow_counts = () => ({ data: [{ followers_count: 12, following_count: "7" }] });
  assert.deepEqual(await service.social.getFollowCounts(OTHER), {
    followersCount: 12,
    followingCount: 7,
  });
  fake.rpc.get_follow_counts = () => ({ data: [] });
  assert.equal(await service.social.getFollowCounts(OTHER), null);
  fake.rpc.get_follow_counts = () => ({ error: { message: "x" } });
  await assert.rejects(service.social.getFollowCounts(OTHER));
});

test("getFollowStatus is 'none' when signed out and reads the caller's own row otherwise", async () => {
  auth.userId = null;
  assert.equal(await service.social.getFollowStatus(OTHER), "none");

  auth.userId = ME;
  for (const [stored, expected] of [
    ["approved", "approved"],
    ["pending", "pending"],
    ["weird", "none"],
    [undefined, "none"],
  ] as const) {
    fake.tables.follows = () => ({ data: stored ? { status: stored } : null });
    assert.equal(await service.social.getFollowStatus(OTHER), expected);
  }
  fake.tables.follows = () => ({ error: { message: "rls" } });
  await rejectsWith(service.social.getFollowStatus(OTHER), /rls/);
});

test("follow-request actions call their rpc and raise its errors", async () => {
  await service.social.approveFollowRequest(OTHER);
  await service.social.declineFollowRequest(OTHER);
  await service.social.cancelFollowRequest(OTHER);
  assert.deepEqual(fake.callsTo("approve_follow_request")[0].args, { p_requester_id: OTHER });
  assert.deepEqual(fake.callsTo("decline_follow_request")[0].args, { p_requester_id: OTHER });
  assert.deepEqual(fake.callsTo("cancel_follow_request")[0].args, { p_target_user_id: OTHER });

  fake.rpc.count_incoming_follow_requests = () => ({ data: 4 });
  assert.equal(await service.social.getFollowRequestCount(), 4);
  fake.rpc.count_incoming_follow_requests = () => ({ data: null });
  assert.equal(await service.social.getFollowRequestCount(), 0);
  fake.rpc.approve_follow_request = () => ({
    error: { message: "You cannot approve this follow request." },
  });
  await rejectsWith(service.social.approveFollowRequest(OTHER), /cannot approve/);
});

test("listFollowRequests maps the requester and defaults the page", async () => {
  fake.rpc.list_incoming_follow_requests = () => ({
    data: [
      { user_id: "u", display_name: "Mei", avatar_url: null, requested_at: "2026-10-20T00:00:00Z" },
    ],
  });
  assert.deepEqual(await service.social.listFollowRequests(), [
    { userId: "u", displayName: "Mei", avatarUrl: undefined, requestedAt: "2026-10-20T00:00:00Z" },
  ]);
  assert.deepEqual(fake.callsTo("list_incoming_follow_requests")[0].args, {
    p_limit: 50,
    p_offset: 0,
  });
});

test("reportContent sends posts through report_post and everything else through report_content", async () => {
  await service.communitySafety.reportContent({
    targetType: "post",
    targetId: POST,
    reason: "spam",
    targetAuthorKey: OTHER,
  } as never);
  assert.deepEqual(fake.callsTo("report_post")[0].args, {
    p_post_id: POST,
    p_reason_code: "spam",
    p_details: `target_author_key:${OTHER}`,
  });

  await service.communitySafety.reportContent({
    targetType: "comment",
    targetId: "c1",
    reason: "offensive",
  } as never);
  assert.deepEqual(fake.callsTo("report_content")[0].args, {
    p_target_type: "comment",
    p_target_id: "c1",
    p_reason: "offensive",
    p_target_author_key: null,
  });
});

test("reportContent checks sign-in and that a post report names a real post", async () => {
  await rejectsWith(
    service.communitySafety.reportContent({
      targetType: "post",
      targetId: "not-a-uuid",
      reason: "spam",
    } as never),
    /valid post id/,
  );
  auth.userId = null;
  await rejectsWith(
    service.communitySafety.reportContent({
      targetType: "post",
      targetId: POST,
      reason: "spam",
    } as never),
    /signed in to report/,
  );
  assert.equal(fake.rpcCalls.length, 0);
});

test("blockUser refuses yourself and bad ids, lower-cases the id, and defaults the reason", async () => {
  await rejectsWith(
    service.communitySafety.blockUser({ blockedUserId: ME } as never),
    /cannot block yourself/,
  );
  await rejectsWith(
    service.communitySafety.blockUser({ blockedUserId: "nope" } as never),
    /valid user id/,
  );
  assert.equal(fake.rpcCalls.length, 0);

  await service.communitySafety.blockUser({ blockedUserId: OTHER.toUpperCase() } as never);
  assert.deepEqual(fake.callsTo("block_user")[0].args, {
    p_blocked_user_id: OTHER,
    p_reason: "user_initiated_block",
  });

  auth.userId = null;
  await rejectsWith(
    service.communitySafety.blockUser({ blockedUserId: OTHER } as never),
    /signed in to block/,
  );
});

test("unblockUser deletes the caller's own block row", async () => {
  await service.communitySafety.unblockUser(OTHER.toUpperCase());
  const ops = fake.queriesOn("user_blocks")[0].ops;
  assert.equal(ops[0][0], "delete");
  assert.deepEqual(
    ops.filter(([op]) => op === "eq").map(([, args]) => args),
    [
      ["blocker_id", ME],
      ["blocked_user_key", OTHER],
    ],
  );
  await rejectsWith(service.communitySafety.unblockUser("nope"), /valid user id/);
});

test("hidePost and unhidePost validate the post id and need sign-in", async () => {
  await service.communitySafety.hidePost(POST);
  assert.deepEqual(fake.callsTo("hide_post")[0].args, {
    p_post_id: POST,
    p_reason: "hidden_by_user",
  });
  await service.communitySafety.unhidePost(POST);
  assert.deepEqual(fake.callsTo("unhide_post")[0].args, { p_post_id: POST });
  await rejectsWith(service.communitySafety.hidePost("x"), /valid post id/);
  auth.userId = null;
  await rejectsWith(service.communitySafety.unhidePost(POST), /signed in to unhide/);
});

test("listBlockedUsers and listHiddenPosts map rows and throw on error", async () => {
  fake.rpc.list_my_blocked_users = () => ({
    data: [
      {
        blocked_user_id: OTHER,
        display_name: "Ben",
        reason: "spam",
        created_at: "2026-10-01T00:00:00Z",
      },
    ],
  });
  assert.deepEqual(await service.communitySafety.listBlockedUsers(), [
    {
      blockedUserId: OTHER,
      displayName: "Ben",
      avatarUrl: undefined,
      reason: "spam",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ]);
  fake.rpc.list_my_hidden_posts = () => ({ error: { message: "offline" } });
  await rejectsWith(service.communitySafety.listHiddenPosts(), /offline/);
});

test("requestAccountDeletion proves the emailed code, queues the request, and leaves sign-out to the caller", async () => {
  fake.rpc.request_my_account_deletion = () => ({ data: "2026-11-21T00:00:00Z" });
  const result = await service.auth.requestAccountDeletion({ code: " 123456 ", reason: "leaving" });
  assert.deepEqual(result, { scheduledFor: "2026-11-21T00:00:00Z" });

  assert.deepEqual(auth.calls.find((call) => call.method === "verifyOtp")!.args, [
    { email: "me@example.sg", token: "123456", type: "email" },
  ]);
  assert.deepEqual(fake.callsTo("request_my_account_deletion")[0].args, { p_reason: "leaving" });
  assert.equal(
    auth.calls.some((call) => call.method === "signOut"),
    false,
    "the caller purges local data and then signs out through the session store",
  );
});

test("requestAccountDeletion needs sign-in, a code, and a code for the same account", async () => {
  await rejectsWith(service.auth.requestAccountDeletion({ code: "" }), /Enter the code/);
  await rejectsWith(service.auth.requestAccountDeletion(undefined), /Enter the code/);

  auth.verifyOtpUser = OTHER;
  await rejectsWith(service.auth.requestAccountDeletion({ code: "123456" }), /different account/);

  auth.verifyOtpUser = null;
  auth.failures.verifyOtp = { message: "Token has expired" };
  await rejectsWith(service.auth.requestAccountDeletion({ code: "123456" }), /expired/);

  auth.failures = {};
  auth.userId = null;
  await rejectsWith(
    service.auth.requestAccountDeletion({ code: "123456" }),
    /signed in to request account deletion/,
  );
  assert.equal(
    fake.callsTo("request_my_account_deletion").length,
    0,
    "nothing is queued without the code check",
  );
});

test("requestAccountDeletion defaults the reason and rejects a response without a date", async () => {
  fake.rpc.request_my_account_deletion = () => ({ data: "2026-11-21T00:00:00Z" });
  await service.auth.requestAccountDeletion({ code: "123456" });
  assert.deepEqual(fake.callsTo("request_my_account_deletion")[0].args, {
    p_reason: "user_initiated_settings_flow",
  });

  fake.rpc.request_my_account_deletion = () => ({ data: null });
  await rejectsWith(
    service.auth.requestAccountDeletion({ code: "123456" }),
    /did not return a date/,
  );
  fake.rpc.request_my_account_deletion = () => ({ error: { message: "blocked" } });
  await rejectsWith(service.auth.requestAccountDeletion({ code: "123456" }), /blocked/);
});

test("getPendingAccountDeletion, cancelAccountDeletion and the blocker read the server's answer", async () => {
  fake.tables.account_deletion_requests = () => ({
    data: { scheduled_for: "2026-11-21T00:00:00Z" },
  });
  assert.deepEqual(await service.auth.getPendingAccountDeletion(), {
    scheduledFor: "2026-11-21T00:00:00Z",
  });
  fake.tables.account_deletion_requests = () => ({ data: null });
  assert.equal(await service.auth.getPendingAccountDeletion(), null);
  auth.userId = null;
  assert.equal(await service.auth.getPendingAccountDeletion(), null);

  fake.rpc.cancel_my_account_deletion = () => ({ data: true });
  assert.equal(await service.auth.cancelAccountDeletion(), true);
  fake.rpc.cancel_my_account_deletion = () => ({ data: false });
  assert.equal(await service.auth.cancelAccountDeletion(), false);

  fake.rpc.get_my_account_deletion_blocker = () => ({ data: "merchant_owner_must_transfer" });
  assert.equal(await service.auth.getAccountDeletionBlocker(), "merchant_owner_must_transfer");
  fake.rpc.get_my_account_deletion_blocker = () => ({ data: "something_else" });
  assert.equal(await service.auth.getAccountDeletionBlocker(), null);
});

test("signOut ends only this device by default and clears locally when the server revoke fails", async () => {
  await service.auth.signOut();
  assert.deepEqual(
    auth.calls.filter((call) => call.method === "signOut").map((call) => call.args),
    [[{ scope: "local" }]],
  );

  auth.calls.length = 0;
  auth.failures.signOut = { message: "offline" };
  await rejectsWith(service.auth.signOut({ scope: "global" }), /offline/); // an explicit global sign-out reports failure
  assert.equal(
    auth.calls.filter((call) => call.method === "signOut").length,
    1,
    "no silent local fallback for global",
  );
  auth.calls.length = 0;
  // AUTH-10: a failed local revoke removes the stored session directly instead of a
  // second signOut, which went back to the server and failed the same way.
  await service.auth.signOut();
  assert.deepEqual(
    auth.calls.map((call) => call.method),
    ["signOut", "_removeSession"],
  );
});

test("sendAccountDeletionCode emails a one-time code to the signed-in address without creating users", async () => {
  await service.auth.sendAccountDeletionCode();
  assert.deepEqual(auth.calls.find((call) => call.method === "signInWithOtp")!.args, [
    { email: "me@example.sg", options: { shouldCreateUser: false } },
  ]);
  auth.email = null;
  await rejectsWith(service.auth.sendAccountDeletionCode(), /./);
});

test("signInWithEmailCode emails a code to the normalised address and may create the account", async () => {
  await service.auth.signInWithEmailCode("  Mei@Example.SG ");
  const [sent] = auth.calls.filter((call) => call.method === "signInWithOtp");
  const args = sent.args[0] as { email: string; options: Record<string, unknown> };
  assert.equal(args.email, "mei@example.sg");
  assert.equal(args.options.shouldCreateUser, true);
  assert.ok(args.options.emailRedirectTo);
  assert.equal("data" in args.options, false, "no name, no metadata");

  auth.calls.length = 0;
  await service.auth.signInWithEmailCode("mei@example.sg", { displayName: "  Mei  " });
  const named = auth.calls.find((call) => call.method === "signInWithOtp")!.args[0] as {
    options: { data?: { display_name?: string } };
  };
  assert.deepEqual(named.options.data, { display_name: "Mei" });

  auth.failures.signInWithOtp = { message: "email rate limit exceeded" };
  await rejectsWith(service.auth.signInWithEmailCode("mei@example.sg"), /rate limit/);
});

test("verifyEmailCode checks a sign-in code as an email OTP", async () => {
  await service.auth.verifyEmailCode("Mei@Example.SG", " 12345678 ", "email");
  const [verified] = auth.calls.filter((call) => call.method === "verifyOtp");
  assert.deepEqual(verified.args[0], { email: "mei@example.sg", token: "12345678", type: "email" });
});

test("adjustCommunityTasteVector saves numeric axes through submit_dish_taste_rating", async () => {
  await service.ai.adjustCommunityTasteVector(
    "dish-1",
    { spicy: 7.5, sweet: undefined, salty: 2.5 },
    POST,
  );
  assert.deepEqual(fake.callsTo("submit_dish_taste_rating")[0].args, {
    p_dish_id: "dish-1",
    p_rating: { spicy: 7.5, salty: 2.5 },
    p_review_id: POST,
  });

  fake.rpcCalls.length = 0;
  await service.ai.adjustCommunityTasteVector("dish-1", {});
  assert.equal(fake.rpcCalls.length, 0);

  fake.rpc.submit_dish_taste_rating = () => ({ error: { message: "rate limited" } });
  await rejectsWith(service.ai.adjustCommunityTasteVector("dish-1", { sour: 5 }), /rate limited/);
  assert.equal(fake.callsTo("submit_dish_taste_rating")[0].args.p_review_id, null);
});

test("an offline sign-out still clears the stored session on this device (AUTH-10)", async () => {
  auth.failures.signOut = { message: "Network request failed" };
  await service.auth.signOut();
  const methods = auth.calls.map((call) => call.method);
  // One server attempt only: a second signOut would hit the server and fail the same way.
  assert.deepEqual(methods, ["signOut", "_removeSession"]);
});

test("listRecentReviewsPage withPhotos inner-joins review_photos; dish and stall reads do not (REV-3)", async () => {
  const rows = [
    { id: "r2", dish_id: "d1", created_at: "2026-10-02T00:00:00Z", rating: 5, text: "a" },
    { id: "r1", dish_id: "d1", created_at: "2026-10-01T00:00:00Z", rating: 4, text: "b" },
  ];
  fake.tables.reviews = () => ({ data: rows, error: null });
  const select = (table: string) =>
    fake.queriesOn(table)[0].ops.find(([method]) => method === "select")?.[1][0] as string;

  const page = await service.reviews.listRecentReviewsPage({ limit: 2, withPhotos: true });
  assert.match(select("reviews"), /,review_photos!inner\(id\)$/);
  // Paging still comes from the raw rows read.
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.nextCursor, { before: "2026-10-01T00:00:00Z", beforeId: "r1" });

  fake.queries.length = 0;
  await service.reviews.listRecentReviewsPage({ limit: 2, venueId: "v1" });
  assert.doesNotMatch(select("reviews"), /review_photos/);
});
