import assert from "node:assert/strict";
import test from "node:test";

import { resolveAi } from "../../../supabase/functions/_shared/aiProvider";
import { SYSTEM_PROMPT, TASTE_AXES } from "../../../supabase/functions/_shared/tasteTagging";
import {
  FakeSupabase,
  fakeGemini,
  geminiReply,
  json,
  loadEdgeFunction,
  post,
  type GeminiCall,
} from "./harness";

const TOKEN = "tag-secret";
const ENV = {
  TASTE_TAGGING_WORKER_TOKEN: TOKEN,
  GEMINI_API_KEY: "gemini-test",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};
// The default model, as resolved from the secrets above.
const MODEL = resolveAi((name) => (ENV as Record<string, string>)[name]).model;
const DISH = { dish_id: "dish-1", dish_name: "Laksa", venue_name: "Katong Laksa", price: 6.5 };

type Gemini = ReturnType<typeof fakeGemini>;
const gemini = (reply: (call: GeminiCall) => unknown) => fakeGemini(reply);
const answer =
  (scores: Record<string, unknown>, finishReason = "STOP") =>
  () =>
    geminiReply(scores, finishReason);

const SCORES = {
  sweet: 2.34,
  spicy: 6,
  sour: 1,
  salty: 6.5,
  rich: 8.5,
  aromatic: 9,
  flavor_tags: ["lemak", "not_a_tag", "wok_hei"],
  dietary_flags: ["pork_free", "halal", "made_up"],
  confidence: 0.85,
  rationale: "Coconut gravy.",
};

async function load(
  options: {
    dishes?: unknown[];
    gemini?: Gemini;
    env?: Record<string, string>;
    upsertError?: boolean;
    applyError?: boolean;
  } = {},
) {
  const supabase = new FakeSupabase();
  supabase.rpc.dishes_needing_taste_tags = () => ({ data: options.dishes ?? [DISH] });
  supabase.tables.dish_flavor_tags = () =>
    options.upsertError ? { error: { message: "unique violation" } } : { data: { id: "tag-1" } };
  if (options.applyError)
    supabase.rpc.apply_dish_flavor_tag = () => ({ error: { message: "bad vector" } });
  const model = options.gemini ?? gemini(answer(SCORES));
  const handler = await loadEdgeFunction("tag-dishes", {
    env: { ...ENV, ...options.env },
    supabase,
    fetch: model.fetch,
  });
  return { supabase, gemini: model, handler };
}

test("tag-dishes rejects other methods and bad tokens, and needs its secrets", async () => {
  const { handler } = await load();
  assert.equal((await handler(new Request("https://edge.test/fn", { method: "GET" }))).status, 405);
  assert.equal((await handler(post({}, "wrong"))).status, 401);

  const noSupabase = await load({ env: { SUPABASE_URL: "" } });
  assert.equal((await noSupabase.handler(post({}, TOKEN))).status, 500);
  const noGemini = await load({ env: { GEMINI_API_KEY: "" } });
  const response = await noGemini.handler(post({}, TOKEN));
  assert.deepEqual([response.status, (await json(response)).error], [500, "missing_ai_api_key"]);
  const badProvider = await load({ env: { AI_PROVIDER: "openai" } });
  const wrong = await badProvider.handler(post({}, TOKEN));
  assert.deepEqual([wrong.status, (await json(wrong)).error], [500, "invalid_ai_provider"]);
});

test("tag-dishes asks for the clamped batch of untagged dishes", async () => {
  const limits: unknown[] = [];
  for (const limit of [undefined, 0, 500, 7.8]) {
    const { handler, supabase } = await load({ dishes: [] });
    await handler(post(limit === undefined ? {} : { limit }, TOKEN));
    limits.push(supabase.callsTo("dishes_needing_taste_tags")[0].args.p_limit);
    assert.equal(
      supabase.callsTo("dishes_needing_taste_tags")[0].args.p_source,
      "claude_tagging_v1",
    );
  }
  assert.deepEqual(limits, [10, 1, 50, 7]);
});

test("tag-dishes reports a failed dish lookup", async () => {
  const supabase = new FakeSupabase();
  supabase.rpc.dishes_needing_taste_tags = () => ({ error: { message: "timeout" } });
  const handler = await loadEdgeFunction("tag-dishes", {
    env: ENV,
    supabase,
    fetch: gemini(answer(SCORES)).fetch,
  });
  const response = await handler(post({}, TOKEN));
  assert.deepEqual(
    [response.status, await json(response)],
    [500, { error: "list_failed", detail: "timeout" }],
  );
});

test("tag-dishes describes the dish to Gemini with the shared prompt and model", async () => {
  const { handler, gemini: model } = await load({
    dishes: [{ ...DISH, description: "Spicy coconut noodle soup", taste_tags: ["spicy", "rich"] }],
  });
  await handler(post({}, TOKEN));
  const [call] = model.calls;
  assert.equal(call.model, MODEL);
  assert.equal(call.system, SYSTEM_PROMPT);
  assert.equal(
    call.user,
    [
      "Dish: Laksa",
      "Stall: Katong Laksa",
      "Description: Spicy coconut noodle soup",
      "Existing tags: spicy, rich",
      "Price: SGD 6.50",
    ].join("\n"),
  );
  assert.equal(call.schema.type, "OBJECT");
  assert.equal(call.apiKey, "gemini-test");
});

test("tag-dishes saves a confident answer, drops unknown tags, rounds scores, and applies it", async () => {
  const { handler, supabase } = await load();
  const body = await json(await handler(post({}, TOKEN)));
  assert.deepEqual(body, {
    ok: true,
    model: MODEL,
    tagged: 1,
    auto_applied: 1,
    needs_review: 0,
    skipped: 0,
    failed: 0,
  });

  const upsert = supabase.queriesOn("dish_flavor_tags")[0].ops;
  const row = upsert.find(([op]) => op === "upsert")![1][0] as Record<string, unknown>;
  assert.equal(row.suggested_vector, "[2.3,6,1,6.5,8.5,9]");
  assert.deepEqual(row.suggested_flavor_tags, ["lemak", "wok_hei"]);
  assert.deepEqual(
    row.suggested_dietary_flags,
    ["pork_free"],
    "halal is never accepted from the model",
  );
  assert.deepEqual(
    [row.status, row.source, row.tag_slug, row.dish_id],
    ["pending", "claude_tagging_v1", "taste_profile", "dish-1"],
  );
  assert.deepEqual(upsert.find(([op]) => op === "upsert")![1][1], {
    onConflict: "dish_id,tag_slug,source",
  });
  assert.deepEqual(supabase.callsTo("apply_dish_flavor_tag")[0].args, { p_tag_id: "tag-1" });
});

test("tag-dishes leaves a low-confidence answer for review instead of applying it", async () => {
  const { handler, supabase } = await load({
    gemini: gemini(answer({ ...SCORES, confidence: 0.69 })),
  });
  const body = await json(await handler(post({}, TOKEN)));
  assert.deepEqual([body.tagged, body.auto_applied, body.needs_review], [1, 0, 1]);
  assert.equal(supabase.callsTo("apply_dish_flavor_tag").length, 0);

  const boundary = await load({ gemini: gemini(answer({ ...SCORES, confidence: 0.7 })) });
  assert.equal(
    (await json(await boundary.handler(post({}, TOKEN)))).auto_applied,
    1,
    "0.7 is the auto-apply threshold",
  );
});

test("tag-dishes clamps wild scores into range", async () => {
  const wild = { ...SCORES, sweet: -4, spicy: 99, sour: "abc", confidence: 7 };
  const { handler, supabase } = await load({ gemini: gemini(answer(wild)) });
  await handler(post({}, TOKEN));
  const row = supabase
    .queriesOn("dish_flavor_tags")[0]
    .ops.find(([op]) => op === "upsert")![1][0] as Record<string, unknown>;
  assert.equal(row.suggested_vector, "[0,10,0,6.5,8.5,9]");
  assert.equal(row.confidence, 1);
  assert.equal(TASTE_AXES.length, 6);
});

test("tag-dishes skips a truncated answer and counts failures without stopping the batch", async () => {
  const replies = [
    answer(SCORES, "MAX_TOKENS")(),
    new Error("overloaded"),
    geminiReply("not json"),
    answer(SCORES)(),
  ];
  let index = 0;
  const { handler, supabase } = await load({
    dishes: [DISH, DISH, DISH, { ...DISH, dish_id: "dish-4" }],
    gemini: gemini(() => replies[index++]),
  });
  const body = await json(await handler(post({}, TOKEN)));
  assert.deepEqual([body.skipped, body.failed, body.tagged, body.auto_applied], [1, 2, 1, 1]);
  assert.equal(supabase.queriesOn("dish_flavor_tags").length, 1, "only the good answer is written");
});

test("tag-dishes counts a failed save or apply as a failure", async () => {
  const save = await load({ upsertError: true });
  assert.equal((await json(await save.handler(post({}, TOKEN)))).failed, 1);
  const apply = await load({ applyError: true });
  const body = await json(await apply.handler(post({}, TOKEN)));
  assert.deepEqual([body.tagged, body.auto_applied, body.failed], [1, 0, 1]);
});
