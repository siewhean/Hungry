import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitEntry>();
const RATE_LIMIT_REDIS_URL =
  process.env.HUNGRY_RATE_LIMIT_REDIS_REST_URL?.trim() ||
  process.env.UPSTASH_REDIS_REST_URL?.trim() ||
  "";
const RATE_LIMIT_REDIS_TOKEN =
  process.env.HUNGRY_RATE_LIMIT_REDIS_REST_TOKEN?.trim() ||
  process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
  "";

// Basic IPv4 and IPv6 pattern — rejects crafted keys like "scope:attacker"
const SAFE_IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

function sanitizeIp(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const first = raw.split(",")[0]?.trim() ?? "";
  return SAFE_IP_RE.test(first) ? first : "unknown";
}

function getClientIp(request: NextRequest) {
  return (
    sanitizeIp(request.headers.get("x-forwarded-for")) ||
    sanitizeIp(request.headers.get("x-real-ip")) ||
    "unknown"
  );
}


export function clientRequestKey(request: NextRequest, scope: string) {
  return `${scope}:${getClientIp(request)}`;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function requireJsonRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return jsonError("Request must use JSON.", 415);
  }

  return null;
}

function rateLimitResponse(resetAt: number) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))),
      },
      status: 429,
    },
  );
}

function requireInMemoryRateLimit(options: RateLimitOptions) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(options.key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (bucket.count >= options.limit) {
    return rateLimitResponse(bucket.resetAt);
  }

  bucket.count += 1;
  return null;
}

async function requireRedisRateLimit(options: RateLimitOptions) {
  if (!RATE_LIMIT_REDIS_URL || !RATE_LIMIT_REDIS_TOKEN) return null;

  const key = `hungry:web:${options.key}`;
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const response = await fetch(`${RATE_LIMIT_REDIS_URL.replace(/\/$/, "")}/pipeline`, {
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSeconds, "NX"],
    ]),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${RATE_LIMIT_REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Rate limit store returned ${response.status}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Rate limit store returned empty response.");
  }

  let payload: { result?: unknown }[];
  try {
    payload = JSON.parse(text) as { result?: unknown }[];
  } catch {
    throw new Error("Rate limit store returned malformed JSON response.");
  }

  const count = Number(payload[0]?.result);
  if (Number.isFinite(count) && count > options.limit) {
    return rateLimitResponse(Date.now() + options.windowMs);
  }

  return null;
}

export async function requireRateLimit(_request: NextRequest, options: RateLimitOptions) {
  try {
    const durableResult = await requireRedisRateLimit(options);
    if (durableResult) return durableResult;
    if (RATE_LIMIT_REDIS_URL && RATE_LIMIT_REDIS_TOKEN) return null;
  } catch (error) {
    console.warn("Durable rate limit check failed; using in-memory fallback.", error);
  }

  return requireInMemoryRateLimit(options);
}
