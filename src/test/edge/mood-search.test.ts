import assert from "node:assert/strict";
import test from "node:test";

import { MODEL } from "../../../supabase/functions/_shared/tasteTagging";
import {
  FakeSupabase,
  fakeGemini,
  geminiReply,
  json,
  loadEdgeFunction,
  post,
  type GeminiCall,
  type QueryCall,
} from "./harness";

const ENV = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  GEMINI_API_KEY: "gemini-test",
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

type Gemini = ReturnType<typeof fakeGemini>;
const gemini = (reply: (call: GeminiCall) => unknown) => fakeGemini(reply);
const ok = (scores: unknown) => () => geminiReply(scores);

interface Options {
  user?: string | null;
  cached?: { intent: unknown }[] | null;
  cacheError?: boolean;
  slot?: unknown;
  slotError?: boolean;
  gemini?: Gemini;
  ipAllowed?: boolean | null;
  userAllowed?: boolean | null;
  headers?: Record<string, string>;
  delays?: number[];
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
  supabase.rpc.app_can_make_ip_request = () => ({
    data: "ipAllowed" in options ? options.ipAllowed : true,
  });
  supabase.rpc.app_can_make_user_request = () => ({
    data: "userAllowed" in options ? options.userAllowed : true,
  });
  const model = options.gemini ?? gemini(ok(MOOD));
  const handler = await loadEdgeFunction("mood-search", {
    env: { ...ENV, ...options.env },
    supabase,
    fetch: model.fetch,
    delays: options.delays,
    now: NOW,
  });
  return { supabase, gemini: model, handler };
}

const search = (
  query: unknown,
  token: string | undefined = "user-jwt",
  headers: Record<string, string> = {},
) => post({ query }, token, headers);

test("mood-search needs POST, Supabase env, and a bearer token that resolves to a user", async () => {
  const { handler, supabase } = await load();
  assert.equal((await handler(new Request("https://edge.test/fn", { method: "GET" }))).status, 405);
  assert.equal((await handler(search("spicy", ""))).status, 401);

  const noEnv = await load({ env: { SUPABASE_ANON_KEY: "" } });
  assert.equal((await noEnv.handler(search("spicy"))).status, 500);

  const badJwt = await load({ user: null });
  const response = await badJwt.handler(search("spicy"));
  assert.deepEqual([response.status, (await json(response)).error], [401, "unauthorized"]);
  assert.equal(supabase.callsTo("reserve_mood_search_slot").length, 0);
  assert.equal(supabase.callsTo("app_can_make_user_request").length, 0);
});

test("mood-search reads the user from the caller's own token, not the service role", async () => {
  const { handler, supabase } = await load();
  await handler(search("spicy"));
  const userClient = supabase.clientsCreated.find((client) => client.key === "anon")!;
  assert.deepEqual((userClient.options as any).global.headers, {
    Authorization: "Bearer user-jwt",
  });
  assert.ok(supabase.clientsCreated.some((client) => client.key === "service-role"));
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

test("mood-search answers a repeated search from the 30-day cache without calling Gemini or using the daily slot", async () => {
  const intent = { tasteShift: { spicy: -3 }, summary: "mild" };
  const { handler, supabase, gemini: model } = await load({ cached: [{ intent }] });
  const body = await json(await handler(search("not too spicy")));
  assert.deepEqual(body, { ok: true, cached: true, intent });
  assert.equal(model.calls.length, 0);
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

test("mood-search stops before reserving anything when Gemini is not configured", async () => {
  const { handler, supabase } = await load({ env: { GEMINI_API_KEY: "" } });
  const response = await handler(search("not too spicy"));
  assert.deepEqual(
    [response.status, (await json(response)).error],
    [500, "missing_gemini_api_key"],
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

test("mood-search turns Gemini's answer into a bounded intent and records it on the slot", async () => {
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
    const { handler } = await load({ gemini: gemini(ok({ ...MOOD, max_price: maxPrice })) });
    return (await json(await handler(search("anything")))).intent.maxPrice;
  };
  assert.equal(await intentFor(0), null);
  assert.equal(await intentFor(-3), null);
  assert.equal(await intentFor("x"), null);
  assert.equal(await intentFor(9999), 500);
});

test("mood-search gives the slot back when Gemini cannot answer", async () => {
  for (const reply of [
    () => geminiReply({}, "MAX_TOKENS"),
    () => new Error("overloaded"),
    () => geminiReply("{broken"),
    () => new Response("bad request", { status: 400 }),
  ]) {
    const { handler, supabase } = await load({ gemini: gemini(reply) });
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

test("mood-search sends the shared model, the question and a Gemini-shaped schema", async () => {
  const { handler, gemini: model } = await load();
  await handler(search("anything"));
  const [call] = model.calls;
  assert.equal(call.model, MODEL);
  assert.equal(call.apiKey, "gemini-test");
  assert.equal(call.user, "anything");
  assert.equal(call.schema.type, "OBJECT", "Gemini wants upper-case types");
  assert.equal("additionalProperties" in call.schema, false);
  assert.equal(call.generationConfig.responseMimeType, "application/json");
});

test("mood-search counts calls per client address before looking at the token", async () => {
  const { handler, supabase } = await load();
  await handler(search("spicy", "user-jwt", { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));
  assert.deepEqual(supabase.callsTo("app_can_make_ip_request")[0].args, {
    p_ip: "203.0.113.9",
    p_action: "mood-search",
    p_limit: 30,
  });

  const cloudflare = await load();
  await cloudflare.handler(
    search("spicy", "user-jwt", {
      "cf-connecting-ip": "198.51.100.4",
      "x-forwarded-for": "1.1.1.1",
    }),
  );
  assert.equal(cloudflare.supabase.callsTo("app_can_make_ip_request")[0].args.p_ip, "198.51.100.4");

  const blocked = await load({ ipAllowed: false });
  const response = await blocked.handler(search("spicy", ""));
  assert.deepEqual([response.status, (await json(response)).error], [429, "rate_limited"]);
  assert.equal(
    blocked.supabase.clientsCreated.some((client) => client.key === "anon"),
    false,
  );
});

test("mood-search also caps each signed-in user per minute, and fails open if the counter is down", async () => {
  const { handler, supabase } = await load({ userAllowed: false });
  const response = await handler(search("spicy"));
  assert.deepEqual([response.status, (await json(response)).error], [429, "rate_limited"]);
  assert.deepEqual(supabase.callsTo("app_can_make_user_request")[0].args, {
    p_actor_user_id: "u1",
    p_action: "mood-search",
    p_limit: 10,
  });
  assert.equal(supabase.callsTo("reserve_mood_search_slot").length, 0);

  const down = await load({ ipAllowed: null, userAllowed: null });
  assert.equal((await down.handler(search("spicy"))).status, 200);
});

test("mood-search rides out a busy Gemini: it retries 429 and 5xx with growing waits, then gives up", async () => {
  const busy = (status: number) => new Response("busy", { status });
  const delays: number[] = [];
  let attempt = 0;
  const flaky = await load({
    delays,
    gemini: gemini(() => (attempt++ < 3 ? busy([429, 503, 500][attempt - 1]) : geminiReply(MOOD))),
  });
  const body = await json(await flaky.handler(search("anything")));
  assert.equal(body.ok, true);
  assert.equal(flaky.gemini.calls.length, 4);
  assert.deepEqual(delays, [1000, 2500, 5000]);

  const stuckDelays: number[] = [];
  const stuck = await load({ delays: stuckDelays, gemini: gemini(() => busy(503)) });
  const response = await stuck.handler(search("anything"));
  assert.deepEqual([response.status, (await json(response)).error], [502, "parse_failed"]);
  assert.equal(stuck.gemini.calls.length, 4, "four attempts, then the slot is given back");

  const refusedDelays: number[] = [];
  const refused = await load({ delays: refusedDelays, gemini: gemini(() => busy(400)) });
  await refused.handler(search("anything"));
  assert.deepEqual([refused.gemini.calls.length, refusedDelays], [1, []], "a 400 is not retried");
});
