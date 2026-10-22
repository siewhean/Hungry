import assert from "node:assert/strict";
import test from "node:test";

// Dynamic import: the helper is Edge Function code outside src/, loaded the same way the eval script loads it.
async function generateJson(options: typeof OPTIONS) {
  // A variable path keeps tsc from resolving Deno-style Edge Function code into the app's program.
  const modulePath = "../../../supabase/functions/_shared/gemini.ts";
  const { generateJson: run } = (await import(modulePath)) as {
    generateJson: (options: typeof OPTIONS) => Promise<Record<string, unknown> | null>;
  };
  return run(options);
}

const OPTIONS = {
  apiKey: "test-key",
  model: "test-model",
  system: "system",
  user: "user",
  schema: { type: "object", properties: { a: { type: "number" } }, additionalProperties: false },
  maxOutputTokens: 10,
};

function answer(finishReason: string, text: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] }),
  );
}

async function withFetch<T>(
  handler: (init: RequestInit) => Response,
  run: () => Promise<T>,
): Promise<T> {
  const realFetch = globalThis.fetch;
  const realSetTimeout = globalThis.setTimeout;
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => handler(init)) as typeof fetch;
  globalThis.setTimeout = ((fn: () => void) => realSetTimeout(fn, 0)) as typeof setTimeout;
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
  }
}

test("generateJson sends an upper-case schema without additionalProperties", async () => {
  let sent: { generationConfig: { responseSchema: Record<string, unknown> } } | undefined;
  const result = await withFetch(
    (init) => {
      sent = JSON.parse(String(init.body));
      return answer("STOP", '{"a":1}');
    },
    () => generateJson(OPTIONS),
  );
  assert.deepEqual(result, { a: 1 });
  assert.equal(sent?.generationConfig.responseSchema.type, "OBJECT");
  assert.equal("additionalProperties" in (sent?.generationConfig.responseSchema ?? {}), false);
});

test("generateJson returns null when the model stops before finishing", async () => {
  const result = await withFetch(
    () => answer("MAX_TOKENS", ""),
    () => generateJson(OPTIONS),
  );
  assert.equal(result, null);
});

test("generateJson retries a busy model and then succeeds", async () => {
  let calls = 0;
  const result = await withFetch(
    () => {
      calls += 1;
      return calls < 3 ? new Response("busy", { status: 503 }) : answer("STOP", '{"a":2}');
    },
    () => generateJson(OPTIONS),
  );
  assert.deepEqual(result, { a: 2 });
  assert.equal(calls, 3);
});

test("generateJson gives up after four busy answers and reports the status", async () => {
  let calls = 0;
  await withFetch(
    () => {
      calls += 1;
      return new Response("busy", { status: 503 });
    },
    async () => {
      await assert.rejects(() => generateJson(OPTIONS), /status 503: busy/);
    },
  );
  assert.equal(calls, 4);
});

test("generateJson does not retry a rejected request", async () => {
  let calls = 0;
  await withFetch(
    () => {
      calls += 1;
      return new Response("bad key", { status: 400 });
    },
    async () => {
      await assert.rejects(() => generateJson(OPTIONS), /status 400/);
    },
  );
  assert.equal(calls, 1);
});
