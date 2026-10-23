import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type Result } from "./harness";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  OPS_DISHES_DRAFT_ALLOWED_ORIGINS: "https://ops.usehungry.com",
};
const NOW = new Date("2026-10-22T04:00:00Z");
const ORIGIN = { origin: "https://ops.usehungry.com" };

interface Options {
  user?: string | null;
  admin?: boolean;
  allowed?: unknown;
  rpcError?: boolean;
  drafts?: Result;
  review?: Result;
  env?: Record<string, string>;
}

async function load(options: Options = {}) {
  const supabase = new FakeSupabase();
  supabase.getUser = async () =>
    options.user === null
      ? { data: { user: null }, error: { message: "bad jwt" } }
      : { data: { user: { id: options.user ?? "ops-1" } }, error: null };
  supabase.tables.app_ops_admins = () => ({
    data: options.admin === false ? null : { user_id: "ops-1" },
  });
  supabase.rpc.app_can_make_ops_request = () =>
    options.rpcError
      ? { error: { message: "down" } }
      : { data: "allowed" in options ? options.allowed : true };
  supabase.tables.dishes_draft = (query) =>
    query.ops.some(([op]) => op === "update")
      ? (options.review ?? { data: null })
      : (options.drafts ?? { data: [{ id: "draft-1", name: "Laksa" }] });
  const handler = await loadEdgeFunction("ops-dishes-draft", {
    env: { ...ENV, ...options.env },
    supabase,
    now: NOW,
  });
  return { supabase, handler };
}

const call = (body: unknown, headers: Record<string, string> = ORIGIN) =>
  post(body, "ops-jwt", headers);

test("ops-dishes-draft answers preflight only for the allowed origins", async () => {
  const { handler } = await load();
  const allowed = await handler(
    new Request("https://edge.test/fn", { method: "OPTIONS", headers: ORIGIN }),
  );
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), ORIGIN.origin);

  const blocked = await handler(
    new Request("https://edge.test/fn", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }),
  );
  assert.equal(blocked.status, 403);
});

test("ops-dishes-draft refuses an unknown browser origin and non-POST methods", async () => {
  const { handler, supabase } = await load();
  const evil = await handler(call({ action: "list" }, { origin: "https://evil.example" }));
  assert.equal(evil.status, 403);
  assert.equal(supabase.queries.length, 0);

  const get = await handler(
    new Request("https://edge.test/fn", { method: "GET", headers: ORIGIN }),
  );
  assert.equal(get.status, 405);
});

test("ops-dishes-draft fails closed without Supabase env", async () => {
  const { handler } = await load({ env: { SUPABASE_ANON_KEY: "" } });
  assert.equal((await handler(call({ action: "list" }))).status, 500);
});

test("ops-dishes-draft needs a signed-in operator or admin", async () => {
  const noHeader = await load();
  const missing = await noHeader.handler(post({ action: "list" }, undefined, ORIGIN));
  assert.deepEqual([missing.status, (await json(missing)).error], [401, "missing_authorization"]);

  const badJwt = await load({ user: null });
  const invalid = await badJwt.handler(call({ action: "list" }));
  assert.deepEqual([invalid.status, (await json(invalid)).error], [401, "invalid_authorization"]);

  const notOps = await load({ admin: false });
  const forbidden = await notOps.handler(call({ action: "list" }));
  assert.deepEqual([forbidden.status, (await json(forbidden)).error], [403, "forbidden_ops_user"]);
  assert.equal(
    notOps.supabase.queriesOn("dishes_draft").length,
    0,
    "no data is read for a non-ops user",
  );
});

test("ops-dishes-draft checks the admin row is enabled and has an ops role", async () => {
  const { handler, supabase } = await load();
  await handler(call({ action: "list" }));
  const ops = supabase.queriesOn("app_ops_admins")[0].ops;
  assert.deepEqual(ops.find(([op, args]) => op === "eq" && args[0] === "enabled")![1], [
    "enabled",
    true,
  ]);
  assert.deepEqual(ops.find(([op]) => op === "in")![1], ["role", ["operator", "admin"]]);
  assert.deepEqual(ops.find(([op, args]) => op === "eq" && args[0] === "user_id")![1], [
    "user_id",
    "ops-1",
  ]);
});

test("ops-dishes-draft rejects unknown actions and is rate limited per actor and action", async () => {
  const { handler, supabase } = await load();
  const unknown = await handler(call({ action: "delete-everything" }));
  assert.deepEqual([unknown.status, (await json(unknown)).error], [400, "unknown_action"]);

  await handler(call({ action: "list" }));
  assert.deepEqual(supabase.callsTo("app_can_make_ops_request")[0].args, {
    p_actor_user_id: "ops-1",
    p_action: "list",
    p_limit: 60,
  });

  for (const options of [{ allowed: false }, { rpcError: true }, { allowed: "yes" }]) {
    const limited = await load(options);
    const response = await limited.handler(call({ action: "list" }));
    assert.deepEqual([response.status, (await json(response)).error], [429, "rate_limited"]);
    assert.equal(limited.supabase.queriesOn("dishes_draft").length, 0);
  }
});

test("ops-dishes-draft lists the newest 100 drafts, optionally for one venue, and audits it", async () => {
  const { handler, supabase } = await load({ drafts: { data: [{ id: "a" }, { id: "b" }] } });
  const response = await handler(
    call(
      { action: "list", venueId: " ven-1 " },
      { ...ORIGIN, "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    ),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), { rows: [{ id: "a" }, { id: "b" }] });

  const ops = supabase.queriesOn("dishes_draft")[0].ops;
  assert.deepEqual(ops.find(([op]) => op === "order")![1], ["created_at", { ascending: false }]);
  assert.deepEqual(ops.find(([op]) => op === "limit")![1], [100]);
  assert.deepEqual(ops.find(([op]) => op === "eq")![1], ["venue_id", "ven-1"]);

  const audit = supabase.queriesOn("app_ops_audit_events")[0].ops[0][1][0] as Record<
    string,
    unknown
  >;
  assert.deepEqual(
    [
      audit.actor_user_id,
      audit.action,
      audit.target_type,
      audit.target_id,
      audit.origin,
      audit.metadata,
    ],
    ["ops-1", "dishes_draft.list", "venue", "ven-1", ORIGIN.origin, { rowCount: 2 }],
  );
  assert.equal(
    audit.ip_hash,
    createHash("sha256").update("203.0.113.5").digest("hex"),
    "only a hash of the first forwarded IP is kept",
  );
});

test("ops-dishes-draft lists across venues when no venue is given", async () => {
  const { handler, supabase } = await load();
  await handler(call({ action: "list" }));
  assert.ok(!supabase.queriesOn("dishes_draft")[0].ops.some(([op]) => op === "eq"));
  const audit = supabase.queriesOn("app_ops_audit_events")[0].ops[0][1][0] as Record<
    string,
    unknown
  >;
  assert.equal(audit.target_id, null);
  assert.equal(audit.ip_hash, createHash("sha256").update("unknown").digest("hex"));
});

test("ops-dishes-draft reports a failed list without auditing it", async () => {
  const { handler, supabase } = await load({ drafts: { error: { message: "boom" } } });
  const response = await handler(call({ action: "list" }));
  assert.deepEqual([response.status, (await json(response)).error], [500, "list_failed"]);
  assert.equal(supabase.queriesOn("app_ops_audit_events").length, 0);
});

test("ops-dishes-draft review needs a draft id and one of three decisions", async () => {
  const { handler, supabase } = await load();
  const noId = await handler(call({ action: "review", decision: "accepted" }));
  assert.deepEqual([noId.status, (await json(noId)).error], [400, "draft_dish_id_required"]);
  for (const decision of ["", "maybe", "ACCEPTED", undefined]) {
    const response = await handler(call({ action: "review", draftDishId: "d1", decision }));
    assert.deepEqual([response.status, (await json(response)).error], [400, "invalid_decision"]);
  }
  assert.ok(
    !supabase.queriesOn("dishes_draft").some((query) => query.ops.some(([op]) => op === "update")),
  );
});

test("ops-dishes-draft review records the decision, trims long notes, and audits without storing the notes", async () => {
  for (const decision of ["accepted", "rejected", "duplicate"]) {
    const { handler, supabase } = await load();
    const response = await handler(
      call({ action: "review", draftDishId: " d1 ", decision, notes: "n".repeat(5000) }),
    );
    assert.deepEqual([response.status, await json(response)], [200, { ok: true }]);

    const update = supabase.queriesOn("dishes_draft")[0].ops;
    const fields = update[0][1][0] as Record<string, unknown>;
    assert.equal(fields.review_status, decision);
    assert.equal((fields.ocr_raw_text as string).length, 4000);
    assert.equal(fields.reviewed_at, NOW.toISOString());
    assert.deepEqual(update[1], ["eq", ["id", "d1"]]);

    const audit = supabase.queriesOn("app_ops_audit_events")[0].ops[0][1][0] as Record<
      string,
      unknown
    >;
    assert.deepEqual(
      [audit.action, audit.target_id, audit.metadata],
      ["dishes_draft.review", "d1", { decision, hasNotes: true }],
    );
  }
});

test("ops-dishes-draft review without notes leaves the stored text alone, and reports a failed update", async () => {
  const { handler, supabase } = await load();
  await handler(call({ action: "review", draftDishId: "d1", decision: "accepted" }));
  const fields = supabase.queriesOn("dishes_draft")[0].ops[0][1][0] as Record<string, unknown>;
  assert.equal(fields.ocr_raw_text, undefined);

  const failing = await load({ review: { error: { message: "rls" } } });
  const response = await failing.handler(
    call({ action: "review", draftDishId: "d1", decision: "accepted" }),
  );
  assert.deepEqual([response.status, (await json(response)).error], [500, "review_failed"]);
  assert.equal(failing.supabase.queriesOn("app_ops_audit_events").length, 0);
});
