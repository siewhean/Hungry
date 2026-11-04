// Puts a fake supabase-js client behind the app's own data layer (supabaseService), so a test can
// call a real service method and read the rpc/table calls it makes. No network, no keys.
//
// Import `installFakeSupabase` first thing in the test, call it before anything imports the
// service, then load the service with a dynamic `import()`.

import Module from "node:module";

import { FakeSupabase } from "../edge/harness";

export interface AppAuthFake {
  userId: string | null;
  email: string | null;
  verifyOtpUser: string | null;
  calls: { method: string; args: unknown[] }[];
  failures: Record<string, { message: string } | undefined>;
}

export interface AppFunctionsFake {
  /** Every `client.functions.invoke(name, options)` the service made, in order. */
  calls: { name: string; body: unknown }[];
  /** What an invoke answers, by function name; a function with no entry answers `{ data: null, error: null }`. */
  results: Record<string, () => { data: unknown; error: { message: string } | null }>;
}

export function installFakeSupabase() {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

  const fake = new FakeSupabase();
  const auth: AppAuthFake = {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "me@example.sg",
    verifyOtpUser: null,
    calls: [],
    failures: {},
  };
  const functions: AppFunctionsFake = { calls: [], results: {} };
  const base = fake.client();

  const record =
    (method: string, result: () => object) =>
    async (...args: unknown[]) => {
      auth.calls.push({ method, args });
      const failure = auth.failures[method];
      return failure ? { data: { user: null, session: null }, error: failure } : result();
    };

  const client = {
    ...base,
    functions: {
      invoke: async (name: string, options?: { body?: unknown }) => {
        functions.calls.push({ name, body: options?.body });
        return functions.results[name]?.() ?? { data: null, error: null };
      },
    },
    auth: {
      ...base.auth,
      getSession: async () => ({
        data: { session: auth.userId ? { user: { id: auth.userId, email: auth.email } } : null },
        error: null,
      }),
      getUser: record("getUser", () => ({
        data: { user: auth.userId ? { id: auth.userId, email: auth.email } : null },
        error: null,
      })),
      verifyOtp: record("verifyOtp", () => ({
        data: { user: { id: auth.verifyOtpUser ?? auth.userId } },
        error: null,
      })),
      signInWithOtp: record("signInWithOtp", () => ({ data: {}, error: null })),
      signOut: record("signOut", () => ({ error: null })),
      // supabase-js internal that clears the stored session (used after an offline sign-out).
      _removeSession: async () => {
        auth.calls.push({ method: "_removeSession", args: [] });
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };

  const internals = Module as unknown as {
    _load: (request: string, ...rest: unknown[]) => unknown;
  };
  const originalLoad = internals._load;
  internals._load = function load(request: string, ...rest: unknown[]) {
    if (request === "@supabase/supabase-js") return { createClient: () => client };
    return originalLoad.call(this, request, ...rest);
  };

  return { fake, auth, functions };
}
