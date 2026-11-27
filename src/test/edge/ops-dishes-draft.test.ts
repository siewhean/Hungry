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

const DEFAULT_CLAIMABLE_DRAFT = {
  id: "11111111-1111-4111-8111-111111111111",
  venue_id: "ven-1",
  building_id: "jurong-west-hc",
  name: "Char Kway Teow",
  price_cents: 450,
  modifiers: ["less sweet"],
  promoted_dish_id: null,
  updated_at: "2026-10-22T03:00:00Z",
};

interface Options {
  user?: string | null;
  admin?: boolean;
  allowed?: unknown;
  rpcError?: boolean;
  drafts?: Result;
  draftSingle?: Result;
  review?: Result;
  dishes?: Result;
  refreshVenue?: Result;
  submissions?: Result;
  signedUrls?: Result;
  halalFlag?: Result;
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
  supabase.rpc.catalog_raw_refresh_venue = () =>
    options.refreshVenue ?? { data: null, error: null };
  supabase.tables.dishes_draft = (query) => {
    if (query.ops.some(([op]) => op === "update")) {
      return options.review ?? { data: DEFAULT_CLAIMABLE_DRAFT };
    }
    if (query.ops.some(([op]) => op === "maybeSingle")) {
      return options.draftSingle ?? { data: DEFAULT_CLAIMABLE_DRAFT };
    }
    return options.drafts ?? { data: [{ id: "draft-1", name: "Laksa" }] };
  };
  supabase.tables.dishes = () => options.dishes ?? { data: null, error: null };
  supabase.tables.menu_photo_submissions = () => options.submissions ?? { data: [], error: null };
  supabase.tables.dietary_flags = () =>
    options.halalFlag ?? { data: { id: "flag-halal-uuid" }, error: null };
  supabase.storage.createSignedUrls = () => options.signedUrls ?? { data: [], error: null };
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

test("ops-dishes-draft lists drafts ordered by (created_at desc, id desc) with batched signed URLs and keyset cursor", async () => {
  const draftAId = "22222222-2222-4222-8222-222222222222";
  const draftBId = "33333333-3333-4333-8333-333333333333";
  const { handler, supabase } = await load({
    drafts: {
      data: [
        { id: draftAId, source_photo_id: "photo-1", created_at: "2026-10-22T03:00:00Z" },
        { id: draftBId, source_photo_id: "photo-2", created_at: "2026-10-22T02:00:00Z" },
      ],
    },
    submissions: {
      data: [
        { id: "photo-1", storage_bucket: "menu-photos", storage_path: "u1/ven-1/m1.jpg" },
        { id: "photo-2", storage_bucket: "menu-photos", storage_path: "u1/ven-1/m2.jpg" },
      ],
    },
    signedUrls: {
      data: [
        { path: "u1/ven-1/m1.jpg", signedUrl: "https://signed.example/m1.jpg" },
        { path: "u1/ven-1/m2.jpg", signedUrl: "https://signed.example/m2.jpg" },
      ],
    },
  });

  const response = await handler(
    call(
      {
        action: "list",
        venueId: " ven-1 ",
        status: "pending",
        limit: 2,
        cursorCreatedAt: "2026-10-22T04:00:00Z",
        cursorId: "44444444-4444-4444-8444-444444444444",
      },
      { ...ORIGIN, "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    ),
  );
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.rows.length, 2);
  assert.equal(body.rows[0].source_photo_url, "https://signed.example/m1.jpg");
  assert.deepEqual(body.nextCursor, {
    cursorCreatedAt: "2026-10-22T02:00:00Z",
    cursorId: draftBId,
  });

  const orders = supabase
    .queriesOn("dishes_draft")[0]
    .ops.filter(([op]) => op === "order")
    .map(([, args]) => args);
  assert.deepEqual(orders, [
    ["created_at", { ascending: false }],
    ["id", { ascending: false }],
  ]);
  assert.equal(supabase.storageCalls.filter((c) => c.method === "createSignedUrls").length, 1);

  const audit = supabase.queriesOn("app_ops_audit_events")[0].ops[0][1][0] as Record<
    string,
    unknown
  >;
  assert.equal(audit.ip_hash, createHash("sha256").update("203.0.113.5").digest("hex"));
});

test("ops-dishes-draft edit persists priceBasis, halalStatus, and description inside modifiers and returns them", async () => {
  const { handler, supabase } = await load();
  const res = await handler(
    call({
      action: "edit",
      draftDishId: DEFAULT_CLAIMABLE_DRAFT.id,
      name: "Char Kway Teow (Small)",
      priceCents: 400,
      priceBasis: "counter",
      halalStatus: "yes",
      description: "Fried to order",
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await json(res), {
    ok: true,
    priceBasis: "counter",
    halalStatus: "yes",
    description: "Fried to order",
  });

  const updateQuery = supabase
    .queriesOn("dishes_draft")
    .find((q) => q.ops.some(([op]) => op === "update"))!;
  const patch = updateQuery.ops[0][1][0] as Record<string, unknown>;
  assert.deepEqual(patch.modifiers, [
    "less sweet",
    {
      __ops_edit: 1,
      priceBasis: "counter",
      halalStatus: "yes",
      description: "Fried to order",
    },
  ]);
});

test("ops-dishes-draft review validates inputs, returns 409 when rejected/duplicate matches 0 rows, and handles valid rejections", async () => {
  const { handler } = await load();
  const noId = await handler(call({ action: "review", decision: "accepted" }));
  assert.deepEqual([noId.status, (await json(noId)).error], [400, "draft_dish_id_required"]);
  for (const decision of ["", "maybe", "ACCEPTED", undefined]) {
    const response = await handler(call({ action: "review", draftDishId: "d1", decision }));
    assert.deepEqual([response.status, (await json(response)).error], [400, "invalid_decision"]);
  }

  for (const decision of ["rejected", "duplicate"]) {
    const sub = await load();
    const response = await sub.handler(
      call({ action: "review", draftDishId: " d1 ", decision, notes: "n".repeat(5000) }),
    );
    assert.deepEqual([response.status, await json(response)], [200, { ok: true }]);

    const alreadyPromoted = await load({ review: { data: null } });
    const conflict = await alreadyPromoted.handler(
      call({ action: "review", draftDishId: "d1", decision }),
    );
    assert.deepEqual(
      [conflict.status, (await json(conflict)).error],
      [409, "draft_not_reviewable"],
    );
  }
});

test("ops-dishes-draft accepted review promotes draft to public.dishes and releases claim to edited if catalog refresh fails", async () => {
  const { handler, supabase } = await load({
    review: {
      data: {
        ...DEFAULT_CLAIMABLE_DRAFT,
        modifiers: [
          "less sweet",
          {
            __ops_edit: 1,
            priceBasis: "counter",
            halalStatus: "yes",
            description: "Saved from earlier edit",
          },
        ],
      },
    },
  });
  const response = await handler(
    call({
      action: "review",
      draftDishId: DEFAULT_CLAIMABLE_DRAFT.id,
      decision: "accepted",
      notes: "Verified against stall board",
    }),
  );
  assert.equal(response.status, 200);
  const expectedDishId = `draft:${DEFAULT_CLAIMABLE_DRAFT.id}`;
  assert.deepEqual(await json(response), { ok: true, promotedDishId: expectedDishId });

  const dishUpsert = supabase.queriesOn("dishes")[0].ops[0][1][0] as Record<string, unknown>;
  assert.deepEqual(dishUpsert, {
    id: expectedDishId,
    venue_id: "ven-1",
    building_id: "jurong-west-hc",
    name: "Char Kway Teow",
    description: "Saved from earlier edit",
    price: 4.5,
    price_confidence: "counter_price",
    price_checked_at: NOW.toISOString(),
    dietary_status: { flags: { halal: "yes" } },
    menu_approved_for_display: true,
    menu_rights_status: "operator_owned",
    archived_at: null,
  });

  // If catalog_raw_refresh_venue fails, draft is released back to 'edited' instead of finalizing 'promoted'.
  const failedRefresh = await load({
    refreshVenue: { data: null, error: { message: "rpc timeout" } },
  });
  const failRes = await failedRefresh.handler(
    call({ action: "review", draftDishId: DEFAULT_CLAIMABLE_DRAFT.id, decision: "accepted" }),
  );
  assert.deepEqual([failRes.status, (await json(failRes)).error], [500, "catalog_refresh_failed"]);
  const draftUpdates = failedRefresh.supabase.queriesOn("dishes_draft");
  const revertPatch = draftUpdates[draftUpdates.length - 1].ops[0][1][0] as Record<string, unknown>;
  assert.equal(revertPatch.review_status, "edited");
});
