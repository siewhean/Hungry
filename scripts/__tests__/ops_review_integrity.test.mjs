import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

const actor = "00000000-0000-0000-0000-000000000001";
const draft = "00000000-0000-0000-0000-000000000002";
function harness(
  name,
  resolve = () => ({ data: null, error: null }),
  rpcResolve = () => ({ data: true, error: null }),
  moodStop = "end_turn",
) {
  const calls = [];
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: actor } }, error: null }),
      admin: { deleteUser: async () => ({ error: null }) },
    },
    rpc: async (name, values) => {
      calls.push({ rpc: name, values });
      return rpcResolve(name, values);
    },
    from(table) {
      const call = { table, operation: "select", filters: [], orders: [] };
      calls.push(call);
      const query = {
        select(value) {
          call.select = value;
          return query;
        },
        insert(value) {
          call.operation = "insert";
          call.values = value;
          return query;
        },
        update(value) {
          call.operation = "update";
          call.values = value;
          return query;
        },
        delete() {
          call.operation = "delete";
          return query;
        },
        eq(key, value) {
          call.filters.push([key, value]);
          return query;
        },
        in() {
          return query;
        },
        gte() {
          return query;
        },
        order(key, options) {
          call.orders.push([key, options]);
          return query;
        },
        limit(value) {
          call.limit = value;
          return query;
        },
        or(value) {
          call.or = value;
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(accept, reject) {
          return Promise.resolve()
            .then(() =>
              table === "app_ops_admins"
                ? { data: { user_id: actor }, error: null }
                : resolve(call),
            )
            .then(accept, reject);
        },
      };
      return query;
    },
  };
  let handle;
  const environment = {
    SUPABASE_URL: "https://example.test",
    SUPABASE_SERVICE_ROLE_KEY: "local-test",
    SUPABASE_ANON_KEY: "local-test",
    ANTHROPIC_API_KEY: "local-test",
    ACCOUNT_DELETION_WORKER_TOKEN: "worker-test",
  };
  const source = readFileSync(`supabase/functions/${name}/index.ts`, "utf8").replace(
    /^import .*;\n/gm,
    "",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  vm.runInNewContext(output, {
    createClient: () => client,
    Anthropic: class {
      messages = {
        create: async () => ({ stop_reason: moodStop, content: [{ type: "text", text: "{}" }] }),
      };
    },
    MODEL: "test",
    TASTE_AXES: ["sweet", "spicy", "sour", "salty", "rich", "aromatic"],
    timingSafeEqual: (a, b) => a === b,
    Deno: {
      env: { get: (key) => environment[key] },
      serve: (callback) => {
        handle = callback;
      },
    },
    Request,
    Response,
    Headers,
    TextEncoder,
    crypto: webcrypto,
    console: { error() {} },
  });
  return {
    calls,
    request: (body) =>
      handle(
        new Request("https://example.test", {
          method: "POST",
          headers: {
            authorization:
              name === "process-account-deletions" ? "Bearer worker-test" : "Bearer user-test",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      ),
  };
}

test("mood completion failure never reports success or refunds a paid reservation", async () => {
  const h = harness(
    "mood-search",
    (call) =>
      call.operation === "select"
        ? { data: [], error: null }
        : { data: null, error: { message: "db unavailable" } },
    () => ({ data: 12, error: null }),
  );
  const response = await h.request({ query: "mild soup" });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "completion_persistence_failed");
  assert.equal(
    h.calls.some((call) => call.operation === "delete"),
    false,
  );
});
test("mood thrown completion failure also retains paid reservation", async () => {
  const h = harness(
    "mood-search",
    (call) => {
      if (call.operation === "select") return { data: [], error: null };
      throw new Error("network unavailable");
    },
    () => ({ data: 12, error: null }),
  );
  const response = await h.request({ query: "mild soup" });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "completion_persistence_failed");
  assert.equal(
    h.calls.some((call) => call.operation === "delete"),
    false,
  );
});
test("mood completion with no affected row fails; successful persistence returns intent", async () => {
  for (const completed of [null, { id: 12 }]) {
    const h = harness(
      "mood-search",
      (call) => ({ data: call.operation === "select" ? [] : completed, error: null }),
      () => ({ data: 12, error: null }),
    );
    assert.equal((await h.request({ query: "mild soup" })).status, completed ? 200 : 500);
  }
});
test("mood parse failure checks failed reservation cleanup", async () => {
  const h = harness(
    "mood-search",
    (call) => ({
      data: call.operation === "select" ? [] : null,
      error: call.operation === "delete" ? { message: "cleanup unavailable" } : null,
    }),
    () => ({ data: 12, error: null }),
    "max_tokens",
  );
  const response = await h.request({ query: "mild soup" });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "reservation_cleanup_failed");
});
test("ops list fails closed when audit insertion returns an error", async () => {
  const h = harness("ops-dishes-draft", (call) => ({
    data: [],
    error: call.table === "app_ops_audit_events" ? { message: "audit unavailable" } : null,
  }));
  const response = await h.request({ action: "list" });
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error, "audit_write_failed");
});
test("ops queue paginates equal timestamps without repeats and reaches old pending rows", async () => {
  const createdAt = "2026-11-16T12:00:00.123456+00:00";
  const all = Array.from({ length: 111 }, (_, i) => ({
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    created_at: createdAt,
    review_status: "pending",
  }));
  const reviewed = Array.from({ length: 100 }, (_, i) => ({
    id: `10000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    created_at: "2026-11-17T12:00:00+00:00",
    review_status: "accepted",
  }));
  const h = harness("ops-dishes-draft", (call) => {
    if (call.table !== "dishes_draft") return { data: null, error: null };
    let rows = [...all, ...reviewed];
    for (const [key, value] of call.filters) rows = rows.filter((row) => row[key] === value);
    if (call.or) {
      assert.ok(call.or.includes(createdAt), "cursor must preserve microseconds");
      const id = call.or.match(/id\.lt\.([0-9a-f-]+)/)[1];
      rows = rows.filter((row) => row.id < id);
    }
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return { data: rows.slice(0, call.limit), error: null };
  });
  const first = await (await h.request({ action: "list", reviewStatus: "pending" })).json();
  assert.equal(first.rows.length, 100);
  assert.equal(first.nextCursor.createdAt, createdAt);
  const second = await (
    await h.request({ action: "list", reviewStatus: "pending", cursor: first.nextCursor })
  ).json();
  assert.equal(second.rows.length, 11);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 111);
  const reads = h.calls.filter((call) => call.table === "dishes_draft");
  assert.ok(reads.every((call) => call.limit === 101 && call.orders.length === 2));
});
test("ops rejects cursor injection before constructing a filtered query", async () => {
  const h = harness("ops-dishes-draft");
  const response = await h.request({
    action: "list",
    cursor: { createdAt: "2026-11-16T12:00:00Z", id: "bad),id.gt.0" },
  });
  assert.equal(response.status, 400);
  assert.equal(
    h.calls.some((call) => call.table === "dishes_draft"),
    false,
  );
});
test("ops review uses one transactional RPC and never writes notes to OCR text", async () => {
  for (const failed of [false, true]) {
    const h = harness(
      "ops-dishes-draft",
      () => ({ data: null, error: null }),
      (name) => ({
        data: true,
        error:
          failed && name === "app_review_dish_draft" ? { message: "audit insert failed" } : null,
      }),
    );
    assert.equal(
      (
        await h.request({
          action: "review",
          draftDishId: draft,
          decision: "accepted",
          notes: "operator evidence",
        })
      ).status,
      failed ? 500 : 200,
    );
    const call = h.calls.find((call) => call.rpc === "app_review_dish_draft");
    assert.equal(call.values.p_notes, "operator evidence");
    assert.equal(call.values.p_actor_user_id, actor);
    assert.equal(
      h.calls.some((call) => call.table === "dishes_draft"),
      false,
    );
    assert.equal(
      h.calls.some((call) => call.table === "app_ops_audit_events"),
      false,
    );
  }
});
test("deletion reports original error and failure-persistence errors while attempting both writes", async () => {
  for (const failedTable of [
    "account_deletion_requests",
    "account_deletion_processing_events",
    "both",
  ]) {
    const h = harness(
      "process-account-deletions",
      (call) => ({
        data: call.table === "account_deletion_requests" ? { id: draft } : null,
        error:
          failedTable === "both" || failedTable === call.table
            ? { message: "persistence unavailable" }
            : null,
      }),
      (name) =>
        name === "claim_account_deletion_requests"
          ? { data: [{ request_id: draft, user_id: actor }], error: null }
          : { data: null, error: { message: "original processing error" } },
    );
    const response = await h.request({});
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.results[0].error, "original processing error");
    assert.ok(body.results[0].persistenceError.includes("persistence unavailable"));
    assert.ok(h.calls.some((call) => call.table === "account_deletion_processing_events"));
    const update = h.calls.find((call) => call.table === "account_deletion_requests");
    assert.ok(
      update.filters.some(([key, value]) => key === "worker_lock_id" && value === body.workerId),
    );
  }
});
test("deletion failure is recorded normally when both persistence writes succeed", async () => {
  const h = harness(
    "process-account-deletions",
    (call) => ({
      data: call.table === "account_deletion_requests" ? { id: draft } : null,
      error: null,
    }),
    (name) =>
      name === "claim_account_deletion_requests"
        ? { data: [{ request_id: draft, user_id: actor }], error: null }
        : { data: null, error: { message: "processing failed" } },
  );
  const response = await h.request({});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.results[0].error, "processing failed");
  assert.equal(body.results[0].persistenceError, undefined);
});
