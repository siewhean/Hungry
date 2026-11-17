import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { webcrypto } from "node:crypto";
import * as integrity from "./ocrIntegrity.ts";

function handlerHarness(
  options: {
    rpcError?: boolean;
    badCount?: boolean;
    visionError?: boolean;
    cleanupError?: boolean;
  } = {},
) {
  let handler: (request: Request) => Promise<Response>;
  let rpcCalls = 0;
  const updates: Record<string, unknown>[] = [];
  const logs: unknown[][] = [];
  const submission = {
    id: "00000000-0000-0000-0000-000000000001",
    venue_id: "venue",
    building_id: "building",
    submitted_by: "user",
    storage_bucket: "photos",
    storage_path: "menu.png",
    ocr_attempts: 0,
    ocr_status: "pending",
  };
  const service = {
    from(table: string) {
      assert.equal(table, "menu_photo_submissions");
      let update: Record<string, unknown> | undefined;
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "lt"]) chain[method] = () => chain;
      chain.update = (value: Record<string, unknown>) => {
        update = value;
        updates.push(value);
        return chain;
      };
      chain.maybeSingle = async () => ({
        data: update ? { ...submission, ...update } : submission,
        error: null,
      });
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ error: options.cleanupError ? { code: "injected_cleanup" } : null }).then(
          resolve,
        );
      return chain;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "app_can_make_user_request") return { data: true, error: null };
      assert.equal(name, "app_complete_menu_photo_ingestion");
      rpcCalls++;
      assert.deepEqual(JSON.parse(JSON.stringify(args.p_items)), [
        { name: "Tea", price_cents: 500, modifiers: [], extraction_confidence: 0.72 },
      ]);
      return options.rpcError
        ? { data: null, error: { message: "injected persistence failure" } }
        : { data: options.badCount ? null : 1, error: null };
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://image.example.test/menu" },
          error: null,
        }),
      }),
    },
  };
  const env: Record<string, string> = {
    SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service",
    SUPABASE_ANON_KEY: "test-anon",
    GOOGLE_CLOUD_VISION_API_KEY: "test-vision",
  };
  const code = ts.transpileModule(fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    require: (specifier: string) =>
      specifier.startsWith("https:")
        ? {
            createClient: (_url: string, key: string) =>
              key === "test-anon"
                ? {
                    auth: {
                      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
                    },
                  }
                : service,
          }
        : integrity,
    exports: {},
    Deno: {
      env: { get: (key: string) => env[key] },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    Request,
    Response,
    Headers,
    Uint8Array,
    crypto: webcrypto,
    btoa,
    console: { error: (...args: unknown[]) => logs.push(args) },
    fetch: async (input: string) =>
      input.includes("image.example.test")
        ? new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } })
        : Response.json({
            responses: [
              options.visionError
                ? { error: { code: 13 } }
                : { fullTextAnnotation: { text: "Tea $5" } },
            ],
          }),
  });
  return {
    request: () =>
      handler(
        new Request("https://edge.example.test", {
          method: "POST",
          headers: { authorization: "Bearer test-only" },
          body: JSON.stringify({ submissionId: submission.id }),
        }),
      ),
    updates,
    logs,
    rpcCalls: () => rpcCalls,
  };
}

test("persistence RPC error or invalid result cannot report successful ingestion", async () => {
  for (const option of [
    { rpcError: true },
    { badCount: true },
    { rpcError: true, cleanupError: true },
  ]) {
    const harness = handlerHarness(option);
    const response = await harness.request();
    assert.equal(response.status, 500);
    assert.equal(harness.rpcCalls(), 1);
    assert.equal(harness.updates.at(-1)?.ocr_status, "failed");
    if (option.cleanupError) assert.equal(harness.logs.length, 2);
  }
});
test("successful transaction is the only success path", async () => {
  const harness = handlerHarness();
  const response = await harness.request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    submissionId: "00000000-0000-0000-0000-000000000001",
    extracted: 1,
  });
  assert.equal(harness.updates.length, 1); // claim only; completion belongs to atomic RPC
});
test("image-level OCR failure preserves retryable state and never persists drafts", async () => {
  const harness = handlerHarness({ visionError: true });
  assert.equal((await harness.request()).status, 500);
  assert.equal(harness.rpcCalls(), 0);
  assert.equal(harness.updates.at(-1)?.ocr_status, "failed");
});
