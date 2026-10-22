import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post } from "./harness";

const ENV = {
  ORPHAN_MEDIA_WORKER_TOKEN: "worker-secret",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

async function load(supabase = new FakeSupabase(), env: Record<string, string> = ENV) {
  return { supabase, handler: await loadEdgeFunction("purge-orphan-media", { env, supabase }) };
}

test("purge-orphan-media only answers POST", async () => {
  const { handler } = await load();
  const response = await handler(new Request("https://edge.test/fn", { method: "GET" }));
  assert.equal(response.status, 405);
});

test("purge-orphan-media rejects a missing, wrong or unconfigured worker token", async () => {
  const { handler, supabase } = await load();
  assert.equal((await handler(post({}))).status, 401);
  assert.equal((await handler(post({}, "wrong"))).status, 401);
  assert.equal(
    (await handler(post({}, "worker-secre"))).status,
    401,
    "a prefix of the token is not enough",
  );

  const unconfigured = await load(supabase, { ...ENV, ORPHAN_MEDIA_WORKER_TOKEN: "" });
  assert.equal(
    (await unconfigured.handler(post({}, ""))).status,
    401,
    "an empty token never matches an empty secret",
  );
  assert.equal(supabase.rpcCalls.length, 0, "nothing runs before authorisation");
});

test("purge-orphan-media fails closed when the Supabase env is missing", async () => {
  const { handler } = await load(new FakeSupabase(), {
    ORPHAN_MEDIA_WORKER_TOKEN: "worker-secret",
  });
  const response = await handler(post({}, "worker-secret"));
  assert.equal(response.status, 500);
  assert.equal((await json(response)).error, "missing_supabase_env");
});

test("purge-orphan-media purges drafts first, then removes each bucket's orphans", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.purge_orphan_post_drafts = () => ({ data: 3 });
  supabase.rpc.list_orphan_media_objects = ({ p_bucket }) => ({
    data:
      p_bucket === "review-media"
        ? [{ name: "u1/a.jpg" }, { name: "u1/b.jpg" }, { name: "" }]
        : [{ name: "u2/c.jpg" }],
  });
  const { handler } = await load(supabase);

  const response = await handler(post({}, "worker-secret"));
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), {
    draftsRemoved: 3,
    removed: { "review-media": 2, "post-media": 1 },
  });

  assert.deepEqual(
    supabase.rpcCalls.map((call) => call.name),
    ["purge_orphan_post_drafts", "list_orphan_media_objects", "list_orphan_media_objects"],
    "drafts are deleted before orphan lookup so their files count in the same run",
  );
  assert.deepEqual(supabase.callsTo("purge_orphan_post_drafts")[0].args, {
    p_older_than: "24 hours",
  });
  assert.deepEqual(
    supabase.storageCalls.map((call) => [call.bucket, call.method, call.args[0]]),
    [
      ["review-media", "remove", ["u1/a.jpg", "u1/b.jpg"]],
      ["post-media", "remove", ["u2/c.jpg"]],
    ],
    "blank names are dropped",
  );
});

test("purge-orphan-media clamps the batch limit to 1..500 and defaults to 200", async () => {
  const supabase = new FakeSupabase();
  const { handler } = await load(supabase);
  for (const limit of [undefined, 0, -5, 10_000, 7.9, "abc"]) {
    await handler(post(limit === undefined ? {} : { limit }, "worker-secret"));
  }
  const limits = supabase.callsTo("list_orphan_media_objects").map((call) => call.args.p_limit);
  const perRun = limits.length / 6;
  assert.equal(perRun, 2, "one lookup per bucket");
  const firstOfEach = limits.filter((_, index) => index % 2 === 0);
  assert.deepEqual(firstOfEach, [200, 1, 1, 500, 7, 200]);
});

test("purge-orphan-media removes files in chunks of 100", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.list_orphan_media_objects = ({ p_bucket }) => ({
    data:
      p_bucket === "review-media"
        ? Array.from({ length: 230 }, (_, index) => ({ name: `u/${index}.jpg` }))
        : [],
  });
  const { handler } = await load(supabase);
  const body = await json(await handler(post({ limit: 500 }, "worker-secret")));
  assert.equal(body.removed["review-media"], 230);
  assert.deepEqual(
    supabase.storageCalls.map((call) => (call.args[0] as string[]).length),
    [100, 100, 30],
  );
});

test("purge-orphan-media reports each failure with where it stopped", async () => {
  const draftFails = new FakeSupabase();
  draftFails.rpc.purge_orphan_post_drafts = () => ({ error: { message: "boom" } });
  let body = await json(await (await load(draftFails)).handler(post({}, "worker-secret")));
  assert.deepEqual(body, { error: "draft_purge_failed", detail: "boom" });
  assert.equal(draftFails.callsTo("list_orphan_media_objects").length, 0);

  const listFails = new FakeSupabase();
  listFails.rpc.list_orphan_media_objects = () => ({ error: { message: "slow query" } });
  const listResponse = await (await load(listFails)).handler(post({}, "worker-secret"));
  assert.equal(listResponse.status, 500);
  body = await json(listResponse);
  assert.deepEqual([body.error, body.bucket], ["list_failed", "review-media"]);

  const removeFails = new FakeSupabase();
  removeFails.rpc.list_orphan_media_objects = () => ({ data: [{ name: "u/a.jpg" }] });
  removeFails.storage.remove = () => ({ error: { message: "bucket locked" } });
  body = await json(await (await load(removeFails)).handler(post({}, "worker-secret")));
  assert.deepEqual(
    [body.error, body.bucket, body.detail],
    ["remove_failed", "review-media", "bucket locked"],
  );
});

test("purge-orphan-media uses the service-role key without persisting a session", async () => {
  const { handler, supabase } = await load();
  await handler(post({}, "worker-secret"));
  assert.equal(supabase.clientsCreated[0].key, "service-role");
  assert.deepEqual(supabase.clientsCreated[0].options, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});
