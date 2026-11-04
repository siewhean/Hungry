// Security review 2026-11-04 (M4): the website console's username and password are throttled per
// IP address. After 10 wrong logins in 15 minutes that address gets 429, even with the right
// password, and the browser's first credential-less request never counts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach, beforeEach } from "node:test";

import { clientIpFromHeaders } from "../../../marketing/website/web-v2/src/lib/security/clientIp";
import {
  CONSOLE_LOGIN_LOCK_MS,
  CONSOLE_LOGIN_MAX_FAILURES,
  consoleLoginRetryAfterSeconds,
  recordConsoleLoginFailure,
  resetConsoleLoginThrottle,
} from "../../../marketing/website/web-v2/src/lib/security/consoleLoginThrottle";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const originalWarn = console.warn;

function clearRedisEnv() {
  delete process.env.HUNGRY_RATE_LIMIT_REDIS_REST_URL;
  delete process.env.HUNGRY_RATE_LIMIT_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

beforeEach(() => {
  clearRedisEnv();
  resetConsoleLoginThrottle();
  console.warn = () => {};
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
  console.warn = originalWarn;
});

test("an address is locked out after 10 wrong logins, until the 15 minute window ends", async () => {
  const start = 1_000_000;
  for (let i = 1; i < CONSOLE_LOGIN_MAX_FAILURES; i += 1) {
    await recordConsoleLoginFailure("203.0.113.5", start + i);
    assert.equal(await consoleLoginRetryAfterSeconds("203.0.113.5", start + i), null);
  }
  await recordConsoleLoginFailure("203.0.113.5", start + 10);
  assert.equal(
    await consoleLoginRetryAfterSeconds("203.0.113.5", start + 10),
    CONSOLE_LOGIN_LOCK_MS / 1000,
  );

  // Another address is unaffected.
  assert.equal(await consoleLoginRetryAfterSeconds("203.0.113.6", start + 10), null);

  // The lock ends with the window, and counting starts again.
  const later = start + CONSOLE_LOGIN_LOCK_MS + 1;
  assert.equal(await consoleLoginRetryAfterSeconds("203.0.113.5", later), null);
  await recordConsoleLoginFailure("203.0.113.5", later);
  assert.equal(await consoleLoginRetryAfterSeconds("203.0.113.5", later), null);
});

test("with Redis configured, counts are shared through it", async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example/";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  const calls: unknown[] = [];
  let stored = 0;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    assert.equal(url, "https://redis.example/pipeline");
    const commands = JSON.parse(String(init.body)) as (string | number)[][];
    calls.push(commands);
    if (commands[0]?.[0] === "INCR") {
      stored += 1;
      return new Response(JSON.stringify([{ result: stored }, { result: 1 }]));
    }
    return new Response(JSON.stringify([{ result: String(stored) }, { result: 120_000 }]));
  }) as typeof fetch;

  for (let i = 0; i < CONSOLE_LOGIN_MAX_FAILURES - 1; i += 1) {
    await recordConsoleLoginFailure("198.51.100.2");
  }
  assert.equal(await consoleLoginRetryAfterSeconds("198.51.100.2"), null);
  await recordConsoleLoginFailure("198.51.100.2");
  assert.equal(await consoleLoginRetryAfterSeconds("198.51.100.2"), 120);
  assert.deepEqual(calls[0], [
    ["INCR", "hungry:web:console-login-failures:198.51.100.2"],
    ["PEXPIRE", "hungry:web:console-login-failures:198.51.100.2", CONSOLE_LOGIN_LOCK_MS, "NX"],
  ]);
});

test("when Redis fails the in-memory count still locks the address out", async () => {
  process.env.HUNGRY_RATE_LIMIT_REDIS_REST_URL = "https://redis.example";
  process.env.HUNGRY_RATE_LIMIT_REDIS_REST_TOKEN = "token";
  globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;

  for (let i = 0; i < CONSOLE_LOGIN_MAX_FAILURES; i += 1) {
    await recordConsoleLoginFailure("192.0.2.9");
  }
  const retryAfter = await consoleLoginRetryAfterSeconds("192.0.2.9");
  assert.ok(retryAfter !== null && retryAfter > 0);

  globalThis.fetch = (async () => new Response(JSON.stringify({ not: "a list" }))) as typeof fetch;
  assert.ok((await consoleLoginRetryAfterSeconds("192.0.2.9")) !== null);
});

test("the client address comes from the platform headers and ignores crafted values", () => {
  const headers = (values: Record<string, string>) => new Headers(values);
  assert.equal(
    clientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })),
    "203.0.113.1",
  );
  assert.equal(
    clientIpFromHeaders(
      headers({ "x-forwarded-for": "scope:attacker", "x-real-ip": "2001:db8::1" }),
    ),
    "2001:db8::1",
  );
  assert.equal(clientIpFromHeaders(headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assert.equal(clientIpFromHeaders(headers({})), "unknown");
});

test("the proxy checks the lockout before the password and counts only wrong logins", () => {
  const proxy = readFileSync("marketing/website/web-v2/src/proxy.ts", "utf8");
  const body = proxy.slice(proxy.indexOf("async function consoleBasicAuthDenied"));
  const lockCheck = body.indexOf("consoleLoginRetryAfterSeconds(client)");
  const validCheck = body.indexOf("if (result.valid) return null;");
  assert.ok(lockCheck > 0 && validCheck > lockCheck, "lockout must be checked before the password");
  assert.match(body, /status: 429/);
  assert.match(body, /Retry-After/);
  assert.match(
    body,
    /result\.reason !== "missing_header"\) await recordConsoleLoginFailure\(client\)/,
  );
  assert.match(proxy, /const denied = await consoleBasicAuthDenied\(request\);/);
  assert.match(proxy, /export async function proxy\(/);
});
