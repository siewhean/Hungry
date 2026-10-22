import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post } from "./harness";

const ENV = {
  ACCOUNT_DELETION_WORKER_TOKEN: "deletion-secret",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};
const TOKEN = "deletion-secret";

async function load(supabase = new FakeSupabase(), env: Record<string, string> = ENV) {
  return {
    supabase,
    handler: await loadEdgeFunction("process-account-deletions", { env, supabase }),
  };
}

function claims(...ids: string[]) {
  return { data: ids.map((id) => ({ request_id: `req-${id}`, user_id: `user-${id}` })) };
}

test("process-account-deletions rejects other methods and bad tokens before touching data", async () => {
  const { handler, supabase } = await load();
  assert.equal((await handler(new Request("https://edge.test/fn", { method: "GET" }))).status, 405);
  assert.equal((await handler(post({}))).status, 401);
  assert.equal((await handler(post({}, "nope"))).status, 401);
  assert.equal(supabase.rpcCalls.length, 0);
});

test("process-account-deletions fails closed without Supabase credentials", async () => {
  const { handler } = await load(new FakeSupabase(), { ACCOUNT_DELETION_WORKER_TOKEN: TOKEN });
  assert.equal((await handler(post({}, TOKEN))).status, 500);
});

test("process-account-deletions claims at most the clamped batch with a worker id", async () => {
  const supabase = new FakeSupabase();
  const { handler } = await load(supabase);
  for (const limit of [undefined, 0, 99, 3.7, "x"]) {
    await handler(post(limit === undefined ? {} : { limit }, TOKEN));
  }
  assert.deepEqual(
    supabase.callsTo("claim_account_deletion_requests").map((call) => call.args.p_limit),
    [5, 1, 25, 3, 5],
  );
  const worker = supabase.callsTo("claim_account_deletion_requests")[0].args.p_worker_id;
  assert.match(String(worker), /^[0-9a-f-]{36}$/);
});

test("process-account-deletions reports a failed claim", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => ({ error: { message: "lock timeout" } });
  const { handler } = await load(supabase);
  const response = await handler(post({}, TOKEN));
  assert.equal(response.status, 500);
  assert.deepEqual(await json(response), { error: "claim_failed", detail: "lock timeout" });
});

test("process-account-deletions anonymises, strips media, deletes the auth user, then completes the request", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  supabase.storage.list = ({ bucket }) => ({
    data: bucket === "avatars" ? [{ name: "me.jpg", id: "obj-1" }, { name: "albums" }] : [],
  });
  supabase.storage.list = ({ bucket, args }) => {
    if (bucket === "avatars" && args[0] === "user-1")
      return { data: [{ name: "me.jpg", id: "obj-1" }, { name: "albums" }] };
    if (bucket === "avatars" && args[0] === "user-1/albums")
      return { data: [{ name: "pic.jpg", id: "obj-2" }] };
    return { data: [] };
  };
  const { handler } = await load(supabase);

  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.claimed, 1);
  assert.deepEqual(body.results, [
    { requestId: "req-1", userId: "user-1", status: "completed", removedMedia: 2 },
  ]);

  assert.deepEqual(
    supabase.rpcCalls.map((call) => call.name),
    [
      "claim_account_deletion_requests",
      "anonymize_account_deletion_request",
      "complete_account_deletion_request",
    ],
  );
  assert.deepEqual(supabase.callsTo("complete_account_deletion_request")[0].args, {
    p_request_id: "req-1",
    p_worker_id: supabase.callsTo("claim_account_deletion_requests")[0].args.p_worker_id,
    p_auth_deleted: true,
  });
  assert.deepEqual(supabase.deletedAuthUsers, ["user-1"]);

  const removed = supabase.storageCalls.filter((call) => call.method === "remove");
  assert.deepEqual(
    removed.map((call) => call.args[0]),
    [["user-1/me.jpg", "user-1/albums/pic.jpg"]],
  );

  const menuPhotos = supabase.queriesOn("menu_photo_submissions")[0].ops;
  assert.deepEqual(
    menuPhotos[0],
    ["update", [{ submitted_by: null }]],
    "menu photos stay, unlinked from the account",
  );
  assert.deepEqual(menuPhotos[1], ["eq", ["submitted_by", "user-1"]]);
  assert.deepEqual(supabase.queriesOn("user_profiles")[0].ops[0], [
    "update",
    [{ avatar_url: null }],
  ]);
});

test("process-account-deletions never removes menu-photo files", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  const { handler } = await load(supabase);
  await handler(post({}, TOKEN));
  const buckets = new Set(supabase.storageCalls.map((call) => call.bucket));
  assert.deepEqual([...buckets].sort(), ["avatars", "bites-media", "post-media", "review-media"]);
});

test("process-account-deletions treats an already-deleted auth user as done", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  supabase.deleteUser = () => ({ error: { message: "User not found" } });
  const { handler } = await load(supabase);
  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.results[0].status, "completed");
  assert.equal(supabase.callsTo("complete_account_deletion_request").length, 1);
});

test("process-account-deletions records a failure, releases the lock, and carries on with the next request", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1", "2");
  supabase.rpc.anonymize_account_deletion_request = (args) =>
    args.p_request_id === "req-1" ? { error: { message: "constraint violated" } } : { data: null };
  const { handler } = await load(supabase);

  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.claimed, 2);
  assert.deepEqual(
    body.results.map((result: { status: string }) => result.status),
    ["failed", "completed"],
  );
  assert.equal(body.results[0].error, "constraint violated");
  assert.deepEqual(
    supabase.deletedAuthUsers,
    ["user-2"],
    "the failed user is not deleted from auth",
  );

  const release = supabase.queriesOn("account_deletion_requests")[0].ops;
  assert.deepEqual(release[0], [
    "update",
    [{ last_error: "constraint violated", worker_lock_id: null, worker_locked_at: null }],
  ]);
  assert.deepEqual(release[1], ["eq", ["id", "req-1"]]);
  const event = supabase.queriesOn("account_deletion_processing_events")[0].ops[0];
  assert.equal(event[0], "insert");
  assert.equal((event[1][0] as { event_type: string }).event_type, "failed");
});

test("process-account-deletions skips claims that lack ids and truncates long error text", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => ({
    data: [
      { request_id: "", user_id: "x" },
      { request_id: "req-1", user_id: "user-1" },
    ],
  });
  supabase.rpc.anonymize_account_deletion_request = () => ({
    error: { message: "x".repeat(5000) },
  });
  const { handler } = await load(supabase);
  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.results.length, 1);
  const update = supabase.queriesOn("account_deletion_requests")[0].ops[0][1][0] as {
    last_error: string;
  };
  assert.equal(update.last_error.length, 1000);
});
