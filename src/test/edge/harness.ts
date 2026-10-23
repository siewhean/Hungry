// Runs a Supabase Edge Function (Deno) under Node for tests.
//
// The function's index.ts is bundled with esbuild, its remote imports (supabase-js on esm.sh,
// Sentry and standardwebhooks on npm:) are swapped for fakes, and `Deno.serve` is captured so a test can
// call the handler with a `Request` and read the `Response`. Nothing touches the network.

import { build } from "esbuild";
import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";

const FUNCTIONS_DIR = path.join(process.cwd(), "supabase", "functions");

export type Result = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

export interface QueryCall {
  table: string;
  ops: [string, unknown[]][];
}

type Handler<A, R> = (arg: A) => R | Promise<R>;

/**
 * A stand-in for the service-role Supabase client. Tests register what each rpc, table query
 * and storage call returns; every call is recorded for assertions. Anything not registered
 * succeeds with `{ data: null, error: null }`.
 */
export class FakeSupabase {
  rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  queries: QueryCall[] = [];
  storageCalls: { bucket: string; method: string; args: unknown[] }[] = [];
  clientsCreated: { url: string; key: string; options: unknown }[] = [];
  deletedAuthUsers: string[] = [];

  rpc: Record<string, Handler<Record<string, unknown>, Result>> = {};
  tables: Record<string, Handler<QueryCall, Result>> = {};
  storage: Record<string, Handler<{ bucket: string; args: unknown[] }, Result>> = {};
  getUser: Handler<string | undefined, { data: { user: unknown }; error: unknown }> = async () => ({
    data: { user: null },
    error: { message: "no session" },
  });
  deleteUser: Handler<string, { error: { message: string } | null }> = async () => ({
    error: null,
  });

  /** Calls to one rpc, in order. */
  callsTo(name: string) {
    return this.rpcCalls.filter((call) => call.name === name);
  }

  /** Query operations recorded against one table, e.g. `[["update", [...]], ["eq", [...]]]`. */
  queriesOn(table: string) {
    return this.queries.filter((query) => query.table === table);
  }

  client() {
    const fake = this;
    const orDefault = async (result: Result | Promise<Result> | undefined): Promise<Result> =>
      (await result) ?? { data: null, error: null };
    const builder = (call: QueryCall): unknown =>
      new Proxy(
        {},
        {
          get(_, method: string) {
            if (method === "then") {
              return (resolve: (value: Result) => void, reject: (reason: unknown) => void) =>
                orDefault(fake.tables[call.table]?.(call)).then(resolve, reject);
            }
            return (...args: unknown[]) => {
              call.ops.push([method, args]);
              return builder(call);
            };
          },
        },
      );
    return {
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        fake.rpcCalls.push({ name, args });
        return orDefault(await fake.rpc[name]?.(args));
      },
      from: (table: string) => {
        const call: QueryCall = { table, ops: [] };
        fake.queries.push(call);
        return builder(call);
      },
      storage: {
        from: (bucket: string) =>
          new Proxy(
            {},
            {
              get:
                (_, method: string) =>
                async (...args: unknown[]) => {
                  fake.storageCalls.push({ bucket, method, args });
                  return orDefault(await fake.storage[method]?.({ bucket, args }));
                },
            },
          ),
      },
      auth: {
        getUser: (token?: string) => fake.getUser(token),
        admin: {
          deleteUser: async (id: string) => {
            fake.deletedAuthUsers.push(id);
            return fake.deleteUser(id);
          },
        },
      },
    };
  }
}

export interface SentryEvent {
  kind: "init" | "exception" | "message";
  error?: unknown;
  message?: string;
  level?: string;
  tags: Record<string, unknown>;
  extras: Record<string, unknown>;
}

export interface LoadOptions {
  env?: Record<string, string>;
  supabase?: FakeSupabase;
  fetch?: typeof fetch;
  /** Receives the delay of every `setTimeout` the function asks for; the timer then fires at once. */
  delays?: number[];
  /** Freezes `new Date()` and `Date.now()` inside the function. */
  now?: Date;
  /** Collects what the function sends to Sentry (set `SENTRY_DSN` in `env` to switch reporting on). */
  sentryEvents?: SentryEvent[];
}

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/** Standard Webhooks signature: base64 HMAC-SHA256 of `id.timestamp.body` under the base64 secret. */
function webhookSignature(secret: string, id: string, timestamp: string, body: string): string {
  return createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
}

/** Headers a sender such as Supabase Auth would attach to a signed hook body. */
export function signWebhook(secret: string, body: string, id = "msg_1", at = new Date()) {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${webhookSignature(secret, id, timestamp, body)}`,
  };
}

function verifyWebhook(secret: string, body: string, headers: Record<string, string>) {
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatures = (headers["webhook-signature"] ?? "").split(" ");
  if (!id || !timestamp || !signatures[0]) throw new Error("Missing required headers");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Message timestamp outside tolerance");
  }
  const expected = Buffer.from(webhookSignature(secret, id, timestamp, body));
  const matches = signatures.some((entry) => {
    const received = Buffer.from(entry.split(",")[1] ?? "");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
  if (!matches) throw new Error("No matching signature found");
  return JSON.parse(body);
}

const bundles = new Map<string, Promise<string>>();

function bundle(name: string): Promise<string> {
  let cached = bundles.get(name);
  if (!cached) {
    cached = build({
      entryPoints: [path.join(FUNCTIONS_DIR, name, "index.ts")],
      bundle: true,
      write: false,
      platform: "neutral",
      format: "cjs",
      target: "es2022",
      logLevel: "silent",
      plugins: [
        {
          name: "fake-remote-imports",
          setup(b) {
            b.onResolve({ filter: /^https:\/\/esm\.sh\/@supabase\/supabase-js/ }, () => ({
              path: "supabase-js",
              namespace: "fake",
            }));
            b.onResolve({ filter: /^npm:standardwebhooks/ }, () => ({
              path: "webhook",
              namespace: "fake",
            }));
            b.onLoad({ filter: /^webhook$/, namespace: "fake" }, () => ({
              contents: [
                "export class Webhook {",
                "  constructor(secret) { this.secret = secret; }",
                "  verify(body, headers) { return __edge.verifyWebhook(this.secret, body, headers); }",
                "}",
              ].join("\n"),
              loader: "js",
            }));
            b.onResolve({ filter: /^npm:@sentry\/deno/ }, () => ({
              path: "sentry",
              namespace: "fake",
            }));
            b.onLoad({ filter: /^sentry$/, namespace: "fake" }, () => ({
              contents: [
                "export const init = (...a) => __edge.sentry.init(...a);",
                "export const withScope = (...a) => __edge.sentry.withScope(...a);",
                "export const captureException = (...a) => __edge.sentry.captureException(...a);",
                "export const captureMessage = (...a) => __edge.sentry.captureMessage(...a);",
                "export const flush = (...a) => __edge.sentry.flush(...a);",
              ].join("\n"),
              loader: "js",
            }));
            b.onLoad({ filter: /^supabase-js$/, namespace: "fake" }, () => ({
              contents: "export const createClient = (...args) => __edge.createClient(...args);",
              loader: "js",
            }));
          },
        },
      ],
    }).then((result) => result.outputFiles[0].text);
    bundles.set(name, cached);
  }
  return cached;
}

export type EdgeHandler = (request: Request) => Promise<Response>;

/** Loads one function and returns the handler it registered with `Deno.serve`. */
export async function loadEdgeFunction(
  name: string,
  options: LoadOptions = {},
): Promise<EdgeHandler> {
  const code = await bundle(name);
  const env = options.env ?? {};
  const supabase = options.supabase ?? new FakeSupabase();
  let handler: EdgeHandler | undefined;

  const edge = {
    createClient: (url: string, key: string, clientOptions: unknown) => {
      supabase.clientsCreated.push({ url, key, options: clientOptions });
      return supabase.client();
    },
    verifyWebhook,
    sentry: (() => {
      const events = options.sentryEvents ?? [];
      let scope = { tags: {} as Record<string, unknown>, extras: {} as Record<string, unknown> };
      return {
        init: () => void events.push({ kind: "init", tags: {}, extras: {} }),
        withScope: (callback: (scope: unknown) => void) => {
          scope = { tags: {}, extras: {} };
          callback({
            setTag: (key: string, value: unknown) => void (scope.tags[key] = value),
            setExtras: (extras: Record<string, unknown>) =>
              void Object.assign(scope.extras, extras),
          });
        },
        captureException: (error: unknown) =>
          void events.push({ kind: "exception", error, ...scope }),
        captureMessage: (message: string, level?: string) =>
          void events.push({ kind: "message", message, level, ...scope }),
        flush: async () => true,
      };
    })(),
  };
  const Deno = {
    env: { get: (key: string) => env[key] },
    serve: (serveHandler: EdgeHandler) => {
      handler = serveHandler;
      return { shutdown: async () => undefined };
    },
  };

  const RealDate = Date;
  const frozen = options.now?.getTime();
  const FunctionDate =
    frozen === undefined
      ? RealDate
      : class extends RealDate {
          constructor(...args: unknown[]) {
            if (args.length) super(...(args as [number]));
            else super(frozen as number);
          }
          static now() {
            return frozen as number;
          }
        };

  const module = { exports: {} };
  const instantTimeout = (callback: () => void, delay?: number) => {
    options.delays?.push(delay ?? 0);
    return setTimeout(callback, 0);
  };
  new Function("module", "exports", "Deno", "__edge", "fetch", "Date", "setTimeout", code)(
    module,
    module.exports,
    Deno,
    edge,
    options.fetch ??
      (async () => {
        throw new Error(`${name} called fetch but the test gave none`);
      }),
    FunctionDate,
    instantTimeout,
  );
  if (!handler) throw new Error(`${name} never called Deno.serve`);
  return handler;
}

/** A POST with a JSON body and an optional bearer token. */
export function post(body?: unknown, token?: string, extra: Record<string, string> = {}): Request {
  return new Request("https://edge.test/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function json(response: Response): Promise<any> {
  return response.json();
}

export interface GeminiCall {
  model: string;
  apiKey: string | null;
  system: string;
  user: string;
  schema: any;
  generationConfig: any;
}

/** A Gemini `generateContent` body: `finishReason` other than STOP means the answer was cut off. */
export function geminiReply(answer: unknown, finishReason = "STOP") {
  const text = typeof answer === "string" ? answer : JSON.stringify(answer);
  return { candidates: [{ finishReason, content: { parts: [{ text }] } }] };
}

/**
 * A `fetch` that answers the Gemini API through `shared/gemini.ts`. `reply` gets the decoded call
 * and returns a response body (see `geminiReply`), an `Error` to throw, or a `Response` to return.
 */
export function fakeGemini(reply: (call: GeminiCall) => unknown) {
  const calls: GeminiCall[] = [];
  const fakeFetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const model = url.match(/models\/([^:]+):generateContent/)?.[1];
    if (!model) throw new Error(`unexpected fetch to ${url}`);
    const body = JSON.parse(String(init?.body));
    const call: GeminiCall = {
      model,
      apiKey: new Headers(init?.headers).get("x-goog-api-key"),
      system: body.systemInstruction.parts[0].text,
      user: body.contents[0].parts[0].text,
      schema: body.generationConfig.responseSchema,
      generationConfig: body.generationConfig,
    };
    calls.push(call);
    const result = reply(call);
    if (result instanceof Error) throw result;
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), { status: 200 });
  }) as typeof fetch;
  return { calls, fetch: fakeFetch };
}
