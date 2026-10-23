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

test("process-account-deletions anonymises, purges, strips media, deletes the auth user, then completes the request", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  supabase.storage.list = ({ bucket, args }) => {
    if (bucket === "avatars" && args[0] === "user-1")
      return {
        data: [
          { name: "me.jpg", id: "obj-1" },
          { name: "albums", id: null },
        ],
      };
    if (bucket === "avatars" && args[0] === "user-1/albums")
      return { data: [{ name: "pic.jpg", id: "obj-2" }] };
    return { data: [] };
  };
  const { handler } = await load(supabase);

  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.claimed, 1);
  assert.deepEqual(body.results, [
    {
      requestId: "req-1",
      userId: "user-1",
      status: "completed",
      storageRemoved: {
        avatars: 2,
        "review-media": 0,
        "bites-media": 0,
        "post-media": 0,
        "user-stall-submission-images": 0,
      },
    },
  ]);

  assert.deepEqual(
    supabase.rpcCalls.map((call) => call.name),
    [
      "claim_account_deletion_requests",
      "anonymize_account_deletion_request",
      "purge_account_deletion_residual_data",
      "complete_account_deletion_request",
    ],
  );
  const workerId = supabase.callsTo("claim_account_deletion_requests")[0].args.p_worker_id;
  assert.deepEqual(supabase.callsTo("purge_account_deletion_residual_data")[0].args, {
    p_request_id: "req-1",
    p_worker_id: workerId,
  });
  assert.deepEqual(supabase.callsTo("complete_account_deletion_request")[0].args, {
    p_request_id: "req-1",
    p_worker_id: workerId,
    p_auth_deleted: true,
  });
  assert.deepEqual(supabase.deletedAuthUsers, ["user-1"]);

  const removed = supabase.storageCalls.filter((call) => call.method === "remove");
  assert.deepEqual(
    removed.map((call) => [call.bucket, call.args[0]]),
    [["avatars", ["user-1/me.jpg", "user-1/albums/pic.jpg"]]],
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
  assert.deepEqual([...buckets].sort(), [
    "avatars",
    "bites-media",
    "post-media",
    "review-media",
    "user-stall-submission-images",
  ]);
});

test("process-account-deletions keeps the objects the purge says to retain", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  supabase.rpc.purge_account_deletion_residual_data = () => ({
    data: {
      retained_storage_objects: [
        { bucket: "post-media", path: "user-1/shared.jpg" },
        { bucket: "post-media" },
        { path: "orphan.jpg" },
        null,
      ],
    },
  });
  supabase.storage.list = ({ bucket }) => ({
    data:
      bucket === "post-media"
        ? [
            { name: "shared.jpg", id: "a" },
            { name: "mine.jpg", id: "b" },
          ]
        : [],
  });
  const { handler } = await load(supabase);

  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.results[0].storageRemoved["post-media"], 1);
  const removed = supabase.storageCalls.filter((call) => call.method === "remove");
  assert.deepEqual(
    removed.map((call) => call.args[0]),
    [["user-1/mine.jpg"]],
  );
});

test("process-account-deletions pages through large folders and removes in chunks of 100", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  const file = (index: number) => ({ name: `f${index}.jpg`, id: `id-${index}` });
  supabase.storage.list = ({ bucket, args }) => {
    if (bucket !== "review-media") return { data: [] };
    const { offset, limit } = args[1] as { offset: number; limit: number };
    assert.equal(limit, 100);
    const total = 150;
    return {
      data: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) =>
        file(offset + i),
      ),
    };
  };
  const { handler } = await load(supabase);

  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.results[0].storageRemoved["review-media"], 150);
  const lists = supabase.storageCalls.filter(
    (call) => call.method === "list" && call.bucket === "review-media",
  );
  assert.deepEqual(
    lists.map((call) => (call.args[1] as { offset: number }).offset),
    [0, 100],
  );
  const removed = supabase.storageCalls.filter((call) => call.method === "remove");
  assert.deepEqual(
    removed.map((call) => (call.args[0] as string[]).length),
    [100, 50],
  );
});

test("process-account-deletions skips a bucket that does not exist but fails on other storage errors", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.claim_account_deletion_requests = () => claims("1");
  supabase.storage.list = ({ bucket }) =>
    bucket === "bites-media" ? { error: { message: "Bucket not found" } } : { data: [] };
  const { handler } = await load(supabase);
  const body = await json(await handler(post({}, TOKEN)));
  assert.equal(body.results[0].status, "completed");
  assert.equal(body.results[0].storageRemoved["bites-media"], 0);

  const broken = new FakeSupabase();
  broken.rpc.claim_account_deletion_requests = () => claims("1");
  broken.storage.list = () => ({ error: { message: "storage down" } });
  const failing = await load(broken);
  const failed = await json(await failing.handler(post({}, TOKEN)));
  assert.equal(failed.results[0].status, "failed");
  assert.equal(failed.results[0].error, "storage down");
  assert.deepEqual(broken.deletedAuthUsers, [], "the auth user is kept so the request can retry");
  assert.equal(broken.callsTo("complete_account_deletion_request").length, 0);
});

test("process-account-deletions fails the request when the purge or the media removal fails", async () => {
  const purge = new FakeSupabase();
  purge.rpc.claim_account_deletion_requests = () => claims("1");
  purge.rpc.purge_account_deletion_residual_data = () => ({ error: { message: "purge failed" } });
  const first = await load(purge);
  const purged = await json(await first.handler(post({}, TOKEN)));
  assert.equal(purged.results[0].error, "purge failed");
  assert.deepEqual(purge.deletedAuthUsers, []);

  const remove = new FakeSupabase();
  remove.rpc.claim_account_deletion_requests = () => claims("1");
  remove.storage.list = ({ bucket }) => ({
    data: bucket === "avatars" ? [{ name: "me.jpg", id: "obj-1" }] : [],
  });
  remove.storage.remove = () => ({ error: { message: "cannot remove" } });
  const second = await load(remove);
  const removed = await json(await second.handler(post({}, TOKEN)));
  assert.equal(removed.results[0].error, "cannot remove");
  assert.deepEqual(remove.deletedAuthUsers, []);
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
