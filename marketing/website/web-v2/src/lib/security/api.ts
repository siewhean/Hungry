import { NextRequest, NextResponse } from "next/server";

import { resolveClientIp } from "./clientIp";
import { parseRedisRateLimitPipeline } from "./redisPipeline";

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
const IS_DEPLOYED_PRODUCTION =
  process.env.NODE_ENV === "production" &&
  [process.env.HUNGRY_DEPLOY_ENV, process.env.VERCEL_ENV]
    .map((value) => value?.trim().toLowerCase())
    .some((value) => value === "production");
const RATE_LIMIT_MODE =
  process.env.HUNGRY_RATE_LIMIT_MODE?.trim().toLowerCase() ||
  (IS_DEPLOYED_PRODUCTION ? "redis" : "memory");

function getClientIp(request: NextRequest) {
  return resolveClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
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

function rateLimitUnavailableResponse() {
  return NextResponse.json(
    { error: "Request protection is temporarily unavailable. Please try again shortly." },
    {
      headers: { "Retry-After": "30" },
      status: 503,
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
  if (!RATE_LIMIT_REDIS_URL || !RATE_LIMIT_REDIS_TOKEN) {
    throw new Error("Durable rate limit store is not configured.");
  }

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
    signal: AbortSignal.timeout(2_000),
  });

  if (!response.ok) {
    throw new Error(`Rate limit store returned ${response.status}.`);
  }

  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Rate limit store returned empty response.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Rate limit store returned malformed JSON response.");
  }

  const count = parseRedisRateLimitPipeline(payload);
  if (count > options.limit) {
    return rateLimitResponse(Date.now() + options.windowMs);
  }

  return null;
}

export async function requireRateLimit(_request: NextRequest, options: RateLimitOptions) {
  if (IS_DEPLOYED_PRODUCTION && RATE_LIMIT_MODE !== "redis") {
    console.error("Rate limiting denied: deployed production requires HUNGRY_RATE_LIMIT_MODE=redis.");
    return rateLimitUnavailableResponse();
  }

  if (RATE_LIMIT_MODE === "memory") {
    return requireInMemoryRateLimit(options);
  }

  if (RATE_LIMIT_MODE !== "redis") {
    console.error("Rate limiting denied: HUNGRY_RATE_LIMIT_MODE must be redis or memory.");
    return rateLimitUnavailableResponse();
  }

  try {
    return await requireRedisRateLimit(options);
  } catch (error) {
    console.error("Durable rate limit check failed closed.", error);
    return rateLimitUnavailableResponse();
  }
}
