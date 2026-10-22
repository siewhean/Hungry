import assert from "node:assert/strict";
import test from "node:test";

import { MODEL } from "../../../supabase/functions/_shared/tasteTagging";
import {
  FakeSupabase,
  json,
  loadEdgeFunction,
  post,
  type FakeAnthropic,
  type QueryCall,
} from "./harness";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  ANTHROPIC_API_KEY: "sk-test",
};
const NOW = new Date("2026-10-22T04:00:00Z");

const MOOD = {
  sweet: 0,
  spicy: -3.04,
  sour: 0,
  salty: 0,
  rich: 9,
  aromatic: 0,
  max_price: 8,
  dietary_flags: ["vegetarian", "kosher"],
  keywords: ["Soup ", "", "noodle", "rice", "curry", "dessert"],
  summary: "soupy, mild, under $8",
};

function claude(reply: () => unknown): FakeAnthropic & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    messages: {
      create: async (params: unknown) => {
        calls.push(params);
        const result = reply();
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
}
const ok = (scores: unknown) => () => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(scores) }],
});

interface Options {
  user?: string | null;
  cached?: { intent: unknown }[] | null;
  cacheError?: boolean;
  slot?: unknown;
  slotError?: boolean;
  anthropic?: FakeAnthropic;
  env?: Record<string, string>;
}

async function load(options: Options = {}) {
  const supabase = new FakeSupabase();
  supabase.getUser = async () =>
    options.user === null
      ? { data: { user: null }, error: { message: "bad jwt" } }
      : { data: { user: { id: options.user ?? "u1" } }, error: null };
  supabase.tables.mood_search_queries = (query: QueryCall) => {
    if (query.ops.some(([op]) => op === "select")) {
      return options.cacheError ? { error: { message: "down" } } : { data: options.cached ?? [] };
    }
    return { data: null };
  };
  supabase.rpc.reserve_mood_search_slot = () =>
    options.slotError
      ? { error: { message: "down" } }
      : { data: "slot" in options ? options.slot : "slot-1" };
  const anthropic = options.anthropic ?? claude(ok(MOOD));
  const handler = await loadEdgeFunction("mood-search", {
    env: { ...ENV, ...options.env },
    supabase,
    anthropic,
    now: NOW,
  });
  return { supabase, anthropic, handler };
}

const search = (query: unknown, token: string | undefined = "user-jwt") => post({ query }, token);

test("mood-search needs POST, Supabase env, and a bearer token that resolves to a user", async () => {
  const { handler, supabase } = await load();
  assert.equal((await handler(new Request("https://edge.test/fn", { method: "GET" }))).status, 405);
  assert.equal((await handler(search("spicy", ""))).status, 401);

  const noEnv = await load({ env: { SUPABASE_ANON_KEY: "" } });
  assert.equal((await noEnv.handler(search("spicy"))).status, 500);

  const badJwt = await load({ user: null });
  const response = await badJwt.handler(search("spicy"));
  assert.deepEqual([response.status, (await json(response)).error], [401, "unauthorized"]);
  assert.equal(supabase.rpcCalls.length, 0);
});

test("mood-search reads the user from the caller's own token, not the service role", async () => {
  const { handler, supabase } = await load();
  await handler(search("spicy"));
  assert.equal(supabase.clientsCreated[0].key, "anon");
  assert.deepEqual((supabase.clientsCreated[0].options as any).global.headers, {
    Authorization: "Bearer user-jwt",
  });
  assert.equal(supabase.clientsCreated[1].key, "service-role");
});

test("mood-search rejects a search that is too short once normalised", async () => {
  const { handler } = await load();
  for (const query of ["", " a ", undefined, "\n\t"]) {
    const response = await handler(search(query));
    assert.deepEqual([response.status, (await json(response)).error], [400, "query_too_short"]);
  }
});

test("mood-search normalises the query: lower case, single spaces, 200 characters", async () => {
  const { handler, supabase } = await load();
  await handler(search("  Not   TOO\nSpicy  " + "x".repeat(300)));
  const lookup = supabase
    .queriesOn("mood_search_queries")[0]
    .ops.find(([op, args]) => op === "eq" && args[0] === "query_norm")!;
  const normalised = lookup[1][1] as string;
  assert.ok(normalised.startsWith("not too spicy x"));
  assert.equal(normalised.length, 200);
});

test("mood-search answers a repeated search from the 30-day cache without calling Claude or using the daily slot", async () => {
  const intent = { tasteShift: { spicy: -3 }, summary: "mild" };
  const { handler, supabase, anthropic } = await load({ cached: [{ intent }] });
  const body = await json(await handler(search("not too spicy")));
  assert.deepEqual(body, { ok: true, cached: true, intent });
  assert.equal((anthropic as any).calls.length, 0);
  assert.equal(supabase.callsTo("reserve_mood_search_slot").length, 0);

  const lookup = supabase.queriesOn("mood_search_queries")[0].ops;
  const since = lookup.find(([op]) => op === "gte")![1][1] as string;
  assert.equal(since, new Date(NOW.getTime() - 30 * 24 * 3600 * 1000).toISOString());
  assert.deepEqual(lookup.find(([op, args]) => op === "eq" && args[0] === "cached")![1], [
    "cached",
    false,
  ]);

  const logged = supabase
    .queriesOn("mood_search_queries")[1]
    .ops.find(([op]) => op === "insert")![1][0];
  assert.deepEqual(logged, { user_id: "u1", query_norm: "not too spicy", intent, cached: true });
});

test("mood-search reports a failed cache lookup", async () => {
  const { handler } = await load({ cacheError: true });
  const response = await handler(search("not too spicy"));
  assert.deepEqual([response.status, (await json(response)).error], [500, "cache_lookup_failed"]);
});

test("mood-search stops before reserving anything when Claude is not configured", async () => {
  const { handler, supabase } = await load({ env: { ANTHROPIC_API_KEY: "" } });
  const response = await handler(search("not too spicy"));
  assert.deepEqual(
    [response.status, (await json(response)).error],
    [500, "missing_anthropic_api_key"],
  );
  assert.equal(supabase.callsTo("reserve_mood_search_slot").length, 0);
});

test("mood-search reserves a daily slot in one locked rpc, and answers 429 once the cap is used", async () => {
  const { handler, supabase } = await load({ slot: null });
  const response = await handler(search("not too spicy"));
  assert.deepEqual([response.status, (await json(response)).error], [429, "daily_limit"]);
  assert.deepEqual(supabase.callsTo("reserve_mood_search_slot")[0].args, {
    p_user_id: "u1",
    p_query_norm: "not too spicy",
    p_daily_limit: 20,
  });

  const failing = await load({ slotError: true });
  const failed = await failing.handler(search("not too spicy"));
  assert.deepEqual([failed.status, (await json(failed)).error], [500, "usage_lookup_failed"]);
});

test("mood-search turns Claude's answer into a bounded intent and records it on the slot", async () => {
  const { handler, supabase } = await load();
  const body = await json(await handler(search("soupy and mild, under $8")));
  assert.equal(body.cached, false);
  assert.deepEqual(body.intent, {
    tasteShift: { sweet: 0, spicy: -3, sour: 0, salty: 0, rich: 5, aromatic: 0 },
    maxPrice: 8,
    dietaryFlags: ["vegetarian"],
    keywords: ["soup", "noodle", "rice", "curry"],
    summary: "soupy, mild, under $8",
  });
  const update = supabase
    .queriesOn("mood_search_queries")
    .find((query) => query.ops.some(([op]) => op === "update"))!;
  assert.deepEqual(update.ops[0][1][0], { intent: body.intent, pending: false });
  assert.deepEqual(update.ops[1], ["eq", ["id", "slot-1"]]);
});

test("mood-search turns a zero or missing budget into no price limit and caps absurd ones", async () => {
  const intentFor = async (maxPrice: unknown) => {
    const { handler } = await load({ anthropic: claude(ok({ ...MOOD, max_price: maxPrice })) });
    return (await json(await handler(search("anything")))).intent.maxPrice;
  };
  assert.equal(await intentFor(0), null);
  assert.equal(await intentFor(-3), null);
  assert.equal(await intentFor("x"), null);
  assert.equal(await intentFor(9999), 500);
});

test("mood-search gives the slot back when Claude cannot answer", async () => {
  for (const reply of [
    () => ({ stop_reason: "max_tokens", content: [] }),
    () => new Error("overloaded"),
    () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "{broken" }] }),
  ]) {
    const { handler, supabase } = await load({ anthropic: claude(reply) });
    const response = await handler(search("anything"));
    assert.deepEqual([response.status, (await json(response)).error], [502, "parse_failed"]);
    const deletion = supabase
      .queriesOn("mood_search_queries")
      .find((query) => query.ops.some(([op]) => op === "delete"))!;
    assert.deepEqual(
      deletion.ops[1],
      ["eq", ["id", "slot-1"]],
      "a failed parse does not eat the user's daily allowance",
    );
  }
});

test("mood-search uses the shared tagging model", async () => {
  const { handler, anthropic } = await load();
  await handler(search("anything"));
  assert.equal((anthropic as any).calls[0].model, MODEL);
});
