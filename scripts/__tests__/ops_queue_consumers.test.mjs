import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const cursor = {
  createdAt: "2026-11-16T12:00:00.123456Z",
  id: "00000000-0000-0000-0000-000000000100",
};
const row = (id, status = "accepted") => ({
  id,
  venue_id: "venue-test",
  name: `Dish ${id}`,
  price_cents: 500,
  review_status: status,
});
function serviceHarness(page) {
  const source = readFileSync("src/lib/services/supabase/supabaseService.ts", "utf8");
  const start = source.indexOf("    async listDraftDishesQueue(venueId) {");
  const end = source.indexOf("\n    async reviewDraftDish(", start);
  const method = source
    .slice(start, end)
    .trim()
    .replace(/,$/, "")
    .replace("async listDraftDishesQueue(", "async function listDraftDishesQueue(");
  const calls = [];
  const context = {
    requireSupabaseClient: () => ({
      functions: {
        invoke: async (_name, payload) => {
          calls.push(payload.body);
          return page(calls.length, payload.body);
        },
      },
    }),
    asString: (value) => (typeof value === "string" ? value : undefined),
    asNumber: (value) => (typeof value === "number" ? value : undefined),
    asStringArray: (value) => (Array.isArray(value) ? value : []),
    normalizeMenuEntry: (value) => value.toLowerCase(),
  };
  vm.createContext(context);
  vm.runInContext(
    ts.transpileModule(method, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText,
    context,
  );
  return { calls, run: () => context.listDraftDishesQueue("venue-test") };
}
function htmlHarness(page) {
  const source = readFileSync("ops/dishes-draft/index.html", "utf8").match(
    /<script>([\s\S]*?)<\/script>/,
  )[1];
  const calls = [];
  const rows = {
    innerHTML: "existing table content",
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener() {},
  };
  const context = {
    document: {
      getElementById: (id) =>
        id === "rows"
          ? rows
          : { value: id === "venueId" ? "venue-test" : "test", addEventListener() {} },
      createElement: () => ({ innerHTML: "" }),
    },
    fetch: async (_url, request) => {
      const payload = JSON.parse(request.body);
      calls.push(payload);
      const result = await page(calls.length, payload);
      return result.error
        ? new Response("page failed", { status: 503 })
        : Response.json(result.data);
    },
    alert() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { calls, rows, run: () => context.loadQueue() };
}
for (const [label, harness] of [
  ["service", serviceHarness],
  ["HTML ops", htmlHarness],
]) {
  test(`${label} follows two queue pages and reaches older pending drafts`, async () => {
    const h = harness(async (count, body) => {
      assert.equal(body.venueId, "venue-test");
      if (count === 1)
        return { data: { rows: [row("newer-reviewed")], nextCursor: cursor }, error: null };
      assert.deepEqual(JSON.parse(JSON.stringify(body.cursor)), cursor);
      return { data: { rows: [row("older-pending", "pending")], nextCursor: null }, error: null };
    });
    const result = await h.run();
    assert.equal(h.calls.length, 2);
    if (label === "service") {
      assert.deepEqual(
        Array.from(result, (value) => value.id),
        ["newer-reviewed", "older-pending"],
      );
      assert.equal(result[1].reviewStatus, "pending");
    } else {
      assert.equal(h.rows.children.length, 2);
      assert.ok(h.rows.children[1].innerHTML.includes("older-pending"));
    }
  });
  test(`${label} rejects repeated queue cursors instead of truncating or looping`, async () => {
    const h = harness(async () => ({
      data: { rows: [row("draft")], nextCursor: cursor },
      error: null,
    }));
    await assert.rejects(h.run(), /repeated a cursor/);
    assert.equal(h.calls.length, 2);
    if (label !== "service") assert.equal(h.rows.innerHTML, "existing table content");
  });
  test(`${label} surfaces a later-page failure without returning partial success`, async () => {
    const h = harness(async (count) =>
      count === 1
        ? { data: { rows: [row("newer")], nextCursor: cursor }, error: null }
        : { data: null, error: new Error("page failed") },
    );
    await assert.rejects(h.run(), /page failed/);
    assert.equal(h.calls.length, 2);
    if (label !== "service") assert.equal(h.rows.innerHTML, "existing table content");
  });
  test(`${label} bounds a non-repeating infinite queue explicitly`, async () => {
    const h = harness(async (count) => ({
      data: { rows: [], nextCursor: { createdAt: cursor.createdAt, id: `draft-${count}` } },
      error: null,
    }));
    await assert.rejects(h.run(), /exceeded its page limit/);
    assert.equal(h.calls.length, 1000);
  });
}
