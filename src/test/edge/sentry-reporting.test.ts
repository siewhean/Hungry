import assert from "node:assert/strict";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type SentryEvent } from "./harness";

const ENV = {
  ORPHAN_MEDIA_WORKER_TOKEN: "worker-secret",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

async function load(env: Record<string, string>, supabase = new FakeSupabase()) {
  const sentryEvents: SentryEvent[] = [];
  const handler = await loadEdgeFunction("purge-orphan-media", {
    env: { ...ENV, ...env },
    supabase,
    sentryEvents,
  });
  return { handler, sentryEvents, supabase };
}

test("an uncaught exception becomes a generic 500 and a tagged Sentry exception", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.purge_orphan_post_drafts = () => {
    throw new Error("database exploded");
  };
  const { handler, sentryEvents } = await load(
    { SENTRY_DSN: "https://key@sentry.test/1", SB_REGION: "ap-southeast-1" },
    supabase,
  );
  const response = await handler(post({}, "worker-secret"));
  assert.deepEqual([response.status, await json(response)], [500, { error: "internal_error" }]);

  const exception = sentryEvents.find((event) => event.kind === "exception")!;
  assert.match(String((exception.error as Error).message), /database exploded/);
  assert.equal(exception.tags.function, "purge-orphan-media");
  assert.equal(exception.tags.region, "ap-southeast-1");
});

test("a 5xx response the function returned itself is reported once, with its error code", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.purge_orphan_post_drafts = () => ({ error: { message: "boom" } });
  const { handler, sentryEvents } = await load(
    { SENTRY_DSN: "https://key@sentry.test/1" },
    supabase,
  );
  assert.equal((await handler(post({}, "worker-secret"))).status, 500);
  const messages = sentryEvents.filter((event) => event.kind === "message");
  assert.equal(messages.length, 1);
  assert.match(messages[0].message ?? "", /purge-orphan-media responded 500: draft_purge_failed/);
  assert.equal(messages[0].level, "error");
});

test("client errors and successes are not reported", async () => {
  const { handler, sentryEvents } = await load({ SENTRY_DSN: "https://key@sentry.test/1" });
  assert.equal((await handler(post({}, "wrong"))).status, 401);
  assert.equal((await handler(post({}, "worker-secret"))).status, 200);
  assert.deepEqual(
    sentryEvents.filter((event) => event.kind !== "init"),
    [],
  );
});

test("without a SENTRY_DSN nothing is reported, but the caller still gets the generic 500", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.purge_orphan_post_drafts = () => {
    throw new Error("database exploded");
  };
  const { handler, sentryEvents } = await load({}, supabase);
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const response = await handler(post({}, "worker-secret"));
    assert.deepEqual([response.status, await json(response)], [500, { error: "internal_error" }]);
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(sentryEvents, []);
});
