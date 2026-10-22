// Runs a Supabase Edge Function (Deno) under Node for tests.
//
// The function's index.ts is bundled with esbuild, its remote imports (supabase-js on esm.sh,
// the Anthropic SDK on npm:) are swapped for fakes, and `Deno.serve` is captured so a test can
// call the handler with a `Request` and read the `Response`. Nothing touches the network.

import { build } from "esbuild";
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

export interface FakeAnthropic {
  messages: { create: (params: unknown) => Promise<unknown> };
}

export interface LoadOptions {
  env?: Record<string, string>;
  supabase?: FakeSupabase;
  anthropic?: FakeAnthropic;
  fetch?: typeof fetch;
  /** Freezes `new Date()` and `Date.now()` inside the function. */
  now?: Date;
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
            b.onResolve({ filter: /^npm:@anthropic-ai\/sdk/ }, () => ({
              path: "anthropic",
              namespace: "fake",
            }));
            b.onLoad({ filter: /^supabase-js$/, namespace: "fake" }, () => ({
              contents: "export const createClient = (...args) => __edge.createClient(...args);",
              loader: "js",
            }));
            b.onLoad({ filter: /^anthropic$/, namespace: "fake" }, () => ({
              contents:
                "export default class Anthropic { constructor(options) { return __edge.anthropic(options); } }",
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
    anthropic: () => {
      if (!options.anthropic)
        throw new Error(`${name} created an Anthropic client but the test gave none`);
      return options.anthropic;
    },
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
  new Function("module", "exports", "Deno", "__edge", "fetch", "Date", code)(
    module,
    module.exports,
    Deno,
    edge,
    options.fetch ??
      (async () => {
        throw new Error(`${name} called fetch but the test gave none`);
      }),
    FunctionDate,
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
