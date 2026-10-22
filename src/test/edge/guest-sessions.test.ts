import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { FakeSupabase, json, loadEdgeFunction, post, type QueryCall, type Result } from "./harness";

const KEY = "guest-key";
const ENV = {
  GUEST_SESSION_API_KEY: KEY,
  GUEST_SESSION_ALLOWED_ORIGINS: "https://usehungry.com, https://www.usehungry.com",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};
const NOW = new Date("2026-10-22T04:00:00Z");

interface Options {
  env?: Record<string, string>;
  deviceCount?: number;
  ipCount?: number;
  deviceError?: boolean;
  ipError?: boolean;
  insert?: Result;
}

async function load(options: Options = {}) {
  const supabase = new FakeSupabase();
  supabase.tables.guest_sessions = (query: QueryCall) => {
    if (query.ops.some(([op]) => op === "insert")) {
      return options.insert ?? { data: { id: "gs-1", expires_at: "2026-10-23T04:00:00.000Z" } };
    }
    const byIp = query.ops.some(([op, args]) => op === "eq" && args[0] === "client_ip");
    if (byIp)
      return options.ipError ? { error: { message: "ip down" } } : { count: options.ipCount ?? 0 };
    return options.deviceError
      ? { error: { message: "device down" } }
      : { count: options.deviceCount ?? 0 };
  };
  const handler = await loadEdgeFunction("guest-sessions", {
    env: { ...ENV, ...options.env },
    supabase,
    now: NOW,
  });
  return { supabase, handler };
}

const withKey = (body: unknown, headers: Record<string, string> = {}) =>
  post(body, undefined, { "x-guest-session-key": KEY, ...headers });

test("guest-sessions answers CORS preflight only for allowed origins", async () => {
  const { handler } = await load();
  const allowed = await handler(
    new Request("https://edge.test/fn", {
      method: "OPTIONS",
      headers: { origin: "https://usehungry.com" },
    }),
  );
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://usehungry.com");
  assert.match(allowed.headers.get("access-control-allow-headers") ?? "", /x-guest-session-key/);

  const blocked = await handler(
    new Request("https://edge.test/fn", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    }),
  );
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get("access-control-allow-origin"), "null");

  const native = await handler(new Request("https://edge.test/fn", { method: "OPTIONS" }));
  assert.equal(
    native.headers.get("access-control-allow-origin"),
    "*",
    "native apps send no Origin",
  );
});

test("guest-sessions refuses a browser origin that is not on the allowlist", async () => {
  const { handler, supabase } = await load();
  const response = await handler(withKey({ deviceId: "d" }, { origin: "https://evil.example" }));
  assert.equal(response.status, 403);
  assert.equal((await json(response)).error, "forbidden_origin");
  assert.equal(supabase.queries.length, 0);
});

test("guest-sessions needs the API key configured and presented", async () => {
  const missing = await load({ env: { GUEST_SESSION_API_KEY: "  " } });
  assert.equal((await missing.handler(withKey({ deviceId: "d" }))).status, 500);

  const { handler } = await load();
  assert.equal((await handler(post({ deviceId: "d" }))).status, 401);
  assert.equal(
    (await handler(post({ deviceId: "d" }, undefined, { "x-guest-session-key": "wrong" }))).status,
    401,
  );
});

test("guest-sessions only accepts POST, and checks the key before the method", async () => {
  const { handler } = await load();
  const get = await handler(
    new Request("https://edge.test/fn", { method: "GET", headers: { "x-guest-session-key": KEY } }),
  );
  assert.equal(get.status, 405);
  const unauthenticatedGet = await handler(new Request("https://edge.test/fn", { method: "GET" }));
  assert.equal(unauthenticatedGet.status, 401);
});

test("guest-sessions fails closed when Supabase env is missing", async () => {
  const { handler } = await load({ env: { SUPABASE_SERVICE_ROLE_KEY: "" } });
  assert.equal((await handler(withKey({ deviceId: "d" }))).status, 500);
});

test("guest-sessions rejects oversized, malformed and invalid payloads", async () => {
  const { handler, supabase } = await load();
  const big = await handler(withKey({ deviceId: "d", metadata: { blob: "x".repeat(11_000) } }));
  assert.equal(big.status, 413);

  const malformed = await handler(
    new Request("https://edge.test/fn", {
      method: "POST",
      headers: { "x-guest-session-key": KEY },
      body: "{nope",
    }),
  );
  assert.equal(malformed.status, 400);
  assert.equal((await json(malformed)).error, "invalid_json");

  const invalid: [unknown, RegExp][] = [
    [{}, /deviceId is required/],
    [{ deviceId: 5 }, /deviceId is required/],
    [{ deviceId: "" }, /1-128 characters/],
    [{ deviceId: "d".repeat(129) }, /1-128 characters/],
    [{ deviceId: "d", metadata: [] }, /metadata must be a JSON object/],
    [{ deviceId: "d", metadata: null }, /metadata must be a JSON object/],
    [{ deviceId: "d", metadata: "text" }, /metadata must be a JSON object/],
    [{ deviceId: "d", metadata: { note: "x".repeat(2100) } }, /exceeds 2048 bytes/],
  ];
  for (const [body, message] of invalid) {
    const response = await handler(withKey(body));
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 60));
    const result = await json(response);
    assert.equal(result.error, "invalid_payload");
    assert.match(result.message, message);
  }
  assert.equal(supabase.queries.length, 0, "nothing is read or written for a bad request");
});

test("guest-sessions creates a session, returns the token once, and stores only its hash", async () => {
  const { handler, supabase } = await load();
  const response = await handler(
    withKey({ deviceId: "device-1", metadata: { app: "1.2" } }, { "x-real-ip": "203.0.113.9" }),
  );
  assert.equal(response.status, 201);
  const body = await json(response);
  assert.deepEqual(Object.keys(body).sort(), ["expiresAt", "guestSessionId", "token"]);
  assert.match(body.token, /^gs_[0-9a-f-]{36}_[0-9a-f]{48}$/);

  const insert = supabase
    .queriesOn("guest_sessions")
    .find((query) => query.ops.some(([op]) => op === "insert"))!;
  const row = insert.ops.find(([op]) => op === "insert")![1][0] as Record<string, unknown>;
  assert.equal(row.token_hash, createHash("sha256").update(body.token).digest("hex"));
  assert.ok(!JSON.stringify(row).includes(body.token), "the raw token is never stored");
  assert.deepEqual(
    [row.device_id, row.client_ip, row.metadata],
    ["device-1", "203.0.113.9", { app: "1.2" }],
  );
});

test("guest-sessions tokens are unique per request", async () => {
  const { handler } = await load();
  const tokens = new Set<string>();
  for (let index = 0; index < 5; index += 1)
    tokens.add((await json(await handler(withKey({ deviceId: "d" })))).token);
  assert.equal(tokens.size, 5);
});

test("guest-sessions clamps the lifetime to 1-72 hours and defaults to 24", async () => {
  const expiresFor = async (ttlHours: unknown) => {
    const { handler, supabase } = await load();
    await handler(withKey({ deviceId: "d", ...(ttlHours === undefined ? {} : { ttlHours }) }));
    const insert = supabase
      .queriesOn("guest_sessions")
      .find((query) => query.ops.some(([op]) => op === "insert"))!;
    const row = insert.ops.find(([op]) => op === "insert")![1][0] as { expires_at: string };
    return (new Date(row.expires_at).getTime() - NOW.getTime()) / 3_600_000;
  };
  assert.equal(await expiresFor(undefined), 24);
  assert.equal(await expiresFor("48"), 24, "a non-number falls back to the default");
  assert.equal(await expiresFor(0), 1);
  assert.equal(await expiresFor(-10), 1);
  assert.equal(await expiresFor(500), 72);
  assert.equal(await expiresFor(6.9), 6);
});

test("guest-sessions picks the client IP from cf-connecting-ip, then x-real-ip, then x-forwarded-for", async () => {
  const ipFor = async (headers: Record<string, string>) => {
    const { handler, supabase } = await load();
    await handler(withKey({ deviceId: "d" }, headers));
    const insert = supabase
      .queriesOn("guest_sessions")
      .find((query) => query.ops.some(([op]) => op === "insert"))!;
    return (insert.ops.find(([op]) => op === "insert")![1][0] as { client_ip: string | null })
      .client_ip;
  };
  assert.equal(await ipFor({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2" }), "1.1.1.1");
  assert.equal(await ipFor({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }), "2.2.2.2");
  assert.equal(await ipFor({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }), "3.3.3.3");
  assert.equal(await ipFor({}), null);
});

test("guest-sessions limits a device to 20 sessions an hour", async () => {
  const under = await load({ deviceCount: 19 });
  assert.equal((await under.handler(withKey({ deviceId: "d" }))).status, 201);

  const over = await load({ deviceCount: 20 });
  const response = await over.handler(withKey({ deviceId: "d" }));
  assert.equal(response.status, 429);
  assert.equal((await json(response)).error, "rate_limited");
  assert.ok(
    !over.supabase.queries.some((query) => query.ops.some(([op]) => op === "insert")),
    "no session is created",
  );
});

test("guest-sessions limits a network to 50 sessions an hour, only when the IP is known", async () => {
  const over = await load({ ipCount: 50 });
  assert.equal(
    (await over.handler(withKey({ deviceId: "d" }, { "x-real-ip": "9.9.9.9" }))).status,
    429,
  );

  const noIp = await load({ ipCount: 50 });
  assert.equal((await noIp.handler(withKey({ deviceId: "d" }))).status, 201, "no IP, no IP limit");
});

test("guest-sessions turns a failed limit check or insert into a clean 500 without leaking detail", async () => {
  for (const [options, headers] of [
    [{ deviceError: true }, {}],
    [{ ipError: true }, { "x-real-ip": "9.9.9.9" }],
    [{ insert: { error: { message: "secret detail" } } }, {}],
    [{ insert: { data: null } }, {}],
  ] as [Options, Record<string, string>][]) {
    const { handler } = await load(options);
    const response = await handler(withKey({ deviceId: "d" }, headers));
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /secret detail|device down|ip down/);
  }
});
