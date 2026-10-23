import assert from "node:assert/strict";
import test from "node:test";

type Ai = {
  provider: "gemini" | "anthropic";
  model: string;
  apiKey: string;
  workspaceId: string;
  problem: string | null;
};
type Provider = {
  resolveAi: (getEnv: (name: string) => string | undefined) => Ai;
  generateJson: (
    ai: Ai,
    options: { system: string; user: string; schema: unknown; maxOutputTokens: number },
  ) => Promise<Record<string, unknown> | null>;
};

// A variable path keeps tsc from resolving Deno-style Edge Function code into the app's program.
async function loadProvider(): Promise<Provider> {
  const modulePath = "../../../supabase/functions/_shared/aiProvider.ts";
  return (await import(modulePath)) as Provider;
}

const OPTIONS = {
  system: "system",
  user: "user",
  schema: { type: "object", properties: { a: { type: "number" } }, additionalProperties: false },
  maxOutputTokens: 10,
};

function envOf(values: Record<string, string>) {
  return (name: string) => values[name];
}

function claudeAnswer(stopReason: string, text: string, status = 200): Response {
  return new Response(
    JSON.stringify({ stop_reason: stopReason, content: [{ type: "text", text }] }),
    { status },
  );
}

async function withFetch<T>(
  handler: (url: string, init: RequestInit) => Response,
  run: () => Promise<T>,
): Promise<T> {
  const realFetch = globalThis.fetch;
  const realSetTimeout = globalThis.setTimeout;
  globalThis.fetch = (async (url: string, init: RequestInit) => handler(url, init)) as typeof fetch;
  globalThis.setTimeout = ((fn: () => void) => realSetTimeout(fn, 0)) as typeof setTimeout;
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
  }
}

test("resolveAi defaults to Gemini with its own key and model", async () => {
  const { resolveAi } = await loadProvider();
  const ai = resolveAi(envOf({ GEMINI_API_KEY: "g-key" }));
  assert.deepEqual(ai, {
    provider: "gemini",
    model: "gemini-3.8-flash",
    apiKey: "g-key",
    workspaceId: "",
    problem: null,
  });
});

test("resolveAi switches to Claude and lets AI_MODEL override the default", async () => {
  const { resolveAi } = await loadProvider();
  const defaults = resolveAi(envOf({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a-key" }));
  assert.equal(defaults.model, "claude-haiku-5-5");
  assert.equal(defaults.apiKey, "a-key");
  const custom = resolveAi(
    envOf({
      AI_PROVIDER: " Anthropic ",
      ANTHROPIC_API_KEY: "a-key",
      AI_MODEL: "claude-sonnet-5-5",
    }),
  );
  assert.equal(custom.provider, "anthropic");
  assert.equal(custom.model, "claude-sonnet-5-5");
});

test("resolveAi reports a wrong provider and a missing key for the chosen provider", async () => {
  const { resolveAi } = await loadProvider();
  assert.equal(resolveAi(envOf({ AI_PROVIDER: "openai" })).problem, "invalid_ai_provider");
  // Only the other provider's key is set.
  const wrongKey = resolveAi(envOf({ AI_PROVIDER: "anthropic", GEMINI_API_KEY: "g-key" }));
  assert.equal(wrongKey.problem, "missing_ai_api_key");
});

test("generateJson sends Claude the schema, key and version, and no temperature", async () => {
  const { resolveAi, generateJson } = await loadProvider();
  const ai = resolveAi(envOf({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a-key" }));
  let seen:
    | { url: string; headers: Record<string, string>; body: Record<string, unknown> }
    | undefined;
  const result = await withFetch(
    (url, init) => {
      seen = {
        url,
        headers: init.headers as Record<string, string>,
        body: JSON.parse(String(init.body)),
      };
      return claudeAnswer("end_turn", '{"a":1}');
    },
    () => generateJson(ai, OPTIONS),
  );
  assert.deepEqual(result, { a: 1 });
  assert.equal(seen?.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen?.headers["x-api-key"], "a-key");
  assert.equal(seen?.headers["anthropic-version"], "2023-06-01");
  assert.equal(seen?.body.model, "claude-haiku-5-5");
  assert.equal(seen?.body.max_tokens, 10);
  assert.equal("temperature" in (seen?.body ?? {}), false);
  assert.deepEqual(seen?.body.output_config, {
    effort: "low",
    format: { type: "json_schema", schema: OPTIONS.schema },
  });
});

test("generateJson sends the workspace header only when ANTHROPIC_WORKSPACE_ID is set", async () => {
  const { resolveAi, generateJson } = await loadProvider();
  const headerFor = async (extra: Record<string, string>) => {
    const ai = resolveAi(envOf({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a-key", ...extra }));
    let headers: Record<string, string> = {};
    await withFetch(
      (_url, init) => {
        headers = init.headers as Record<string, string>;
        return claudeAnswer("end_turn", '{"a":1}');
      },
      () => generateJson(ai, OPTIONS),
    );
    return headers["anthropic-workspace-id"];
  };
  assert.equal(await headerFor({}), undefined);
  assert.equal(await headerFor({ ANTHROPIC_WORKSPACE_ID: " wrkspc_123 " }), "wrkspc_123");
});

test("generateJson returns null when Claude stops before finishing", async () => {
  const { resolveAi, generateJson } = await loadProvider();
  const ai = resolveAi(envOf({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a-key" }));
  for (const stopReason of ["max_tokens", "refusal"]) {
    const result = await withFetch(
      () => claudeAnswer(stopReason, ""),
      () => generateJson(ai, OPTIONS),
    );
    assert.equal(result, null);
  }
});

test("generateJson retries Claude when overloaded, then reports the status", async () => {
  const { resolveAi, generateJson } = await loadProvider();
  const ai = resolveAi(envOf({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a-key" }));
  let calls = 0;
  const result = await withFetch(
    () => {
      calls += 1;
      return calls < 3
        ? new Response("overloaded", { status: 529 })
        : claudeAnswer("end_turn", '{"a":2}');
    },
    () => generateJson(ai, OPTIONS),
  );
  assert.deepEqual(result, { a: 2 });
  assert.equal(calls, 3);

  await assert.rejects(
    withFetch(
      () => new Response("bad key", { status: 401 }),
      () => generateJson(ai, OPTIONS),
    ),
    /Anthropic request failed with status 401: bad key/,
  );
});

test("generateJson calls Gemini when that is the provider", async () => {
  const { resolveAi, generateJson } = await loadProvider();
  const ai = resolveAi(envOf({ GEMINI_API_KEY: "g-key", AI_MODEL: "gemini-3.1-flash-lite" }));
  let url = "";
  const result = await withFetch(
    (requested) => {
      url = requested;
      return new Response(
        JSON.stringify({
          candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"a":3}' }] } }],
        }),
      );
    },
    () => generateJson(ai, OPTIONS),
  );
  assert.deepEqual(result, { a: 3 });
  assert.match(url, /models\/gemini-3\.1-flash-lite:generateContent$/);
});
