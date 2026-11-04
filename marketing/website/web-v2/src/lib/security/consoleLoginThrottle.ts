// Brute-force guard for the console's username and password. After CONSOLE_LOGIN_MAX_FAILURES
// wrong logins from one IP address within CONSOLE_LOGIN_LOCK_MS, that address gets 429 until the
// window ends, even with the right password, so a guesser cannot tell when they hit it.
//
// Counts live in Upstash Redis when it is configured (shared by every server instance), and in
// memory otherwise or when Redis fails.

export const CONSOLE_LOGIN_MAX_FAILURES = 10;
export const CONSOLE_LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED_CLIENTS = 5000;

type FailureEntry = { failures: number; resetAt: number };

const failuresByClient = new Map<string, FailureEntry>();

function redisConfig() {
  const url =
    process.env.HUNGRY_RATE_LIMIT_REDIS_REST_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    "";
  const token =
    process.env.HUNGRY_RATE_LIMIT_REDIS_REST_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    "";
  return url && token ? { token, url: url.replace(/\/$/, "") } : null;
}

function redisKey(client: string) {
  return `hungry:web:console-login-failures:${client}`;
}

async function redisPipeline(commands: (string | number)[][]): Promise<{ result?: unknown }[]> {
  const config = redisConfig();
  if (!config) throw new Error("Rate limit store is not configured.");
  const response = await fetch(`${config.url}/pipeline`, {
    body: JSON.stringify(commands),
    cache: "no-store",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new Error(`Rate limit store returned ${response.status}.`);
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) throw new Error("Rate limit store returned an unexpected response.");
  return payload as { result?: unknown }[];
}

function memoryEntry(client: string, now: number) {
  const entry = failuresByClient.get(client);
  if (entry && entry.resetAt <= now) {
    failuresByClient.delete(client);
    return null;
  }
  return entry ?? null;
}

/** Seconds until this client may try again, or null when it is not locked out. */
export async function consoleLoginRetryAfterSeconds(
  client: string,
  now = Date.now(),
): Promise<number | null> {
  if (redisConfig()) {
    try {
      const [count, ttl] = await redisPipeline([
        ["GET", redisKey(client)],
        ["PTTL", redisKey(client)],
      ]);
      if (Number(count?.result) < CONSOLE_LOGIN_MAX_FAILURES) return null;
      const ttlMs = Number(ttl?.result);
      return Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : CONSOLE_LOGIN_LOCK_MS) / 1000));
    } catch (error) {
      console.warn("Console login throttle store failed; using in-memory fallback.", error);
    }
  }

  const entry = memoryEntry(client, now);
  if (!entry || entry.failures < CONSOLE_LOGIN_MAX_FAILURES) return null;
  return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
}

/** Counts one wrong console login for this client. */
export async function recordConsoleLoginFailure(client: string, now = Date.now()): Promise<void> {
  if (redisConfig()) {
    try {
      await redisPipeline([
        ["INCR", redisKey(client)],
        ["PEXPIRE", redisKey(client), CONSOLE_LOGIN_LOCK_MS, "NX"],
      ]);
      return;
    } catch (error) {
      console.warn("Console login throttle store failed; using in-memory fallback.", error);
    }
  }

  const entry = memoryEntry(client, now);
  if (entry) {
    entry.failures += 1;
    return;
  }
  if (failuresByClient.size >= MAX_TRACKED_CLIENTS) {
    // Drop the oldest entry so a flood of addresses cannot grow memory without bound.
    const oldest = failuresByClient.keys().next().value;
    if (oldest !== undefined) failuresByClient.delete(oldest);
  }
  failuresByClient.set(client, { failures: 1, resetAt: now + CONSOLE_LOGIN_LOCK_MS });
}

/** Test helper: forget every in-memory count. */
export function resetConsoleLoginThrottle() {
  failuresByClient.clear();
}
