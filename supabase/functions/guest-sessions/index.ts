// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

type Json = Record<string, unknown>;

interface CreateGuestSessionPayload {
  deviceId: string;
  ttlHours?: number;
  metadata?: Json;
}

const DEFAULT_TTL_HOURS = 24;
const MIN_TTL_HOURS = 1;
const MAX_TTL_HOURS = 72;
const MAX_METADATA_BYTES = 2048;
const MAX_DEVICE_ID_LENGTH = 128;
const MAX_SESSIONS_PER_DEVICE_PER_HOUR = 20;
const MAX_SESSIONS_PER_IP_PER_HOUR = 50;

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-guest-session-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("GUEST_SESSION_ALLOWED_ORIGINS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function resolveAllowedOrigin(request: Request, allowedOrigins: Set<string>): string | null {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) {
    // Native/device requests may not include an Origin header.
    return "*";
  }
  if (origin && allowedOrigins.has(origin)) {
    return origin;
  }
  return null;
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": origin ?? "null",
    Vary: "Origin",
  };
}

function toJsonResponse(status: number, body: Json, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  if (forwarded?.trim()) {
    return forwarded.trim().slice(0, 128);
  }
  const xForwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const firstForwarded = xForwardedFor.split(",")[0]?.trim();
  return firstForwarded ? firstForwarded.slice(0, 128) : null;
}

function createGuestToken(): string {
  const randomBytes = new Uint8Array(24);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `gs_${crypto.randomUUID()}_${randomHex}`;
}

async function sha256Hex(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Constant-time secret comparison: hash both sides to equal-length digests, then
// XOR every byte so timing does not reveal how many leading characters matched.
async function timingSafeEqualString(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

function normalizeTtlHours(input?: number): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return DEFAULT_TTL_HOURS;
  }
  const integer = Math.floor(input);
  if (integer < MIN_TTL_HOURS) return MIN_TTL_HOURS;
  if (integer > MAX_TTL_HOURS) return MAX_TTL_HOURS;
  return integer;
}

function validatePayload(payload: CreateGuestSessionPayload): string | null {
  if (typeof payload.deviceId !== "string") return "deviceId is required and must be a string.";
  if (payload.deviceId.length === 0 || payload.deviceId.length > MAX_DEVICE_ID_LENGTH) {
    return `deviceId must be 1-${MAX_DEVICE_ID_LENGTH} characters.`;
  }
  if (payload.metadata !== undefined) {
    if (
      !payload.metadata ||
      Array.isArray(payload.metadata) ||
      typeof payload.metadata !== "object"
    ) {
      return "metadata must be a JSON object.";
    }
    if (new TextEncoder().encode(JSON.stringify(payload.metadata)).length > MAX_METADATA_BYTES) {
      return `metadata exceeds ${MAX_METADATA_BYTES} bytes.`;
    }
  }
  return null;
}

Deno.serve(async (request) => {
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = resolveAllowedOrigin(request, allowedOrigins);

  if (request.method === "OPTIONS") {
    if (!allowedOrigin) {
      return toJsonResponse(
        403,
        {
          error: "forbidden_origin",
          message: "Origin is not allowed for guest session creation.",
        },
        null,
      );
    }
    return new Response("ok", { headers: buildCorsHeaders(allowedOrigin) });
  }

  if (!allowedOrigin) {
    return toJsonResponse(
      403,
      {
        error: "forbidden_origin",
        message: "Origin is not allowed for guest session creation.",
      },
      null,
    );
  }

  const configuredApiKey = Deno.env.get("GUEST_SESSION_API_KEY")?.trim() ?? "";
  if (!configuredApiKey) {
    console.error("Guest session function missing GUEST_SESSION_API_KEY");
    return toJsonResponse(
      500,
      {
        error: "server_misconfigured",
        message: "Guest session service is unavailable.",
      },
      allowedOrigin,
    );
  }

  const providedApiKey = request.headers.get("x-guest-session-key") ?? "";
  if (!(await timingSafeEqualString(providedApiKey, configuredApiKey))) {
    return toJsonResponse(
      401,
      {
        error: "unauthorized",
        message: "Invalid guest session API key.",
      },
      allowedOrigin,
    );
  }

  if (request.method !== "POST") {
    return toJsonResponse(
      405,
      {
        error: "method_not_allowed",
        message: "Use POST to create a guest session.",
      },
      allowedOrigin,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Guest session function missing Supabase environment");
    return toJsonResponse(
      500,
      {
        error: "server_misconfigured",
        message: "Guest session service is unavailable.",
      },
      allowedOrigin,
    );
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).length > 10_000) {
    return toJsonResponse(
      413,
      {
        error: "payload_too_large",
        message: "Payload exceeds 10KB limit.",
      },
      allowedOrigin,
    );
  }

  let payload: CreateGuestSessionPayload = { deviceId: "" };
  try {
    const body = rawBody ? (JSON.parse(rawBody) as CreateGuestSessionPayload) : {};
    payload = body ?? {};
  } catch {
    return toJsonResponse(
      400,
      {
        error: "invalid_json",
        message: "Request body must be valid JSON.",
      },
      allowedOrigin,
    );
  }

  const payloadError = validatePayload(payload);
  if (payloadError) {
    return toJsonResponse(
      400,
      {
        error: "invalid_payload",
        message: payloadError,
      },
      allowedOrigin,
    );
  }

  const ttlHours = normalizeTtlHours(payload.ttlHours);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const token = createGuestToken();
  const tokenHash = await sha256Hex(token);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const clientIp = getClientIp(request);
  const { count, error: countError } = await adminClient
    .from("guest_sessions")
    .select("id", { count: "exact", head: true })
    .eq("device_id", payload.deviceId)
    .gte("created_at", oneHourAgo);
  if (countError) {
    console.error("Guest session device rate-limit check failed", countError);
    return toJsonResponse(
      500,
      {
        error: "rate_limit_check_failed",
        message: "Unable to verify guest session limits.",
      },
      allowedOrigin,
    );
  }
  if ((count ?? 0) >= MAX_SESSIONS_PER_DEVICE_PER_HOUR) {
    return toJsonResponse(
      429,
      {
        error: "rate_limited",
        message: "Too many guest sessions requested for this device. Try again later.",
      },
      allowedOrigin,
    );
  }

  if (clientIp) {
    const { count: ipCount, error: ipCountError } = await adminClient
      .from("guest_sessions")
      .select("id", { count: "exact", head: true })
      .eq("client_ip", clientIp)
      .gte("created_at", oneHourAgo);
    if (ipCountError) {
      console.error("Guest session IP rate-limit check failed", ipCountError);
      return toJsonResponse(
        500,
        {
          error: "rate_limit_check_failed",
          message: "Unable to verify guest session limits.",
        },
        allowedOrigin,
      );
    }
    if ((ipCount ?? 0) >= MAX_SESSIONS_PER_IP_PER_HOUR) {
      return toJsonResponse(
        429,
        {
          error: "rate_limited",
          message: "Too many guest sessions requested from this network. Try again later.",
        },
        allowedOrigin,
      );
    }
  }

  const { data, error } = await adminClient
    .from("guest_sessions")
    .insert({
      token_hash: tokenHash,
      device_id: payload.deviceId,
      client_ip: clientIp,
      metadata: payload.metadata ?? {},
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (error || !data?.id) {
    console.error("Guest session create failed", error);
    return toJsonResponse(
      500,
      {
        error: "guest_session_create_failed",
        message: "Unable to create guest session.",
      },
      allowedOrigin,
    );
  }

  return toJsonResponse(
    201,
    {
      guestSessionId: data.id,
      token,
      expiresAt: data.expires_at,
    },
    allowedOrigin,
  );
});
