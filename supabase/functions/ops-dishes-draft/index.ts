// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

type JsonObject = Record<string, unknown>;

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_OPS_ACTIONS_PER_MINUTE = 60;

function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("OPS_DISHES_DRAFT_ALLOWED_ORIGINS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function resolveAllowedOrigin(request: Request, allowedOrigins: Set<string>): string | null {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : "";
}

function buildCorsHeaders(origin: string | null): HeadersInit {
  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": origin ?? "null",
    Vary: "Origin",
  };
}

function toJson(status: number, body: JsonObject, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

function isAllowedDecision(value: string): boolean {
  return value === "accepted" || value === "rejected" || value === "duplicate";
}

async function sha256Hex(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function requireAuthenticatedOpsUser(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceClient: ReturnType<typeof createClient>,
): Promise<{ userId?: string; error?: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { error: "missing_authorization" };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  const userId = data?.user?.id;
  if (error || !userId) {
    return { error: "invalid_authorization" };
  }

  const { data: adminRow, error: adminError } = await serviceClient
    .from("app_ops_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("enabled", true)
    .in("role", ["operator", "admin"])
    .maybeSingle();
  if (adminError || !adminRow) {
    return { error: "forbidden_ops_user" };
  }

  return { userId };
}

async function enforceRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  actorUserId: string,
  action: string,
): Promise<boolean> {
  const { data, error } = await serviceClient.rpc("app_can_make_ops_request", {
    p_actor_user_id: actorUserId,
    p_action: action,
    p_limit: MAX_OPS_ACTIONS_PER_MINUTE,
  });
  return !error && data === true;
}

async function writeAuditEvent(
  serviceClient: ReturnType<typeof createClient>,
  request: Request,
  actorUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: JsonObject = {},
): Promise<void> {
  const origin = request.headers.get("origin") ?? null;
  await serviceClient.from("app_ops_audit_events").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    origin,
    ip_hash: await sha256Hex(getClientIp(request)),
    metadata,
  });
}

Deno.serve(async (request) => {
  const allowedOrigin = resolveAllowedOrigin(request, getAllowedOrigins());
  if (request.method === "OPTIONS") {
    if (allowedOrigin === "") {
      return toJson(403, { error: "forbidden_origin" }, null);
    }
    return new Response("ok", { headers: buildCorsHeaders(allowedOrigin) });
  }
  if (allowedOrigin === "") {
    return toJson(403, { error: "forbidden_origin" }, null);
  }
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" }, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return toJson(500, { error: "missing_supabase_env" }, allowedOrigin);
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const action = String(payload.action ?? "");

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const caller = await requireAuthenticatedOpsUser(request, supabaseUrl, anonKey, client);
  if (!caller.userId) {
    return toJson(
      caller.error === "forbidden_ops_user" ? 403 : 401,
      { error: caller.error },
      allowedOrigin,
    );
  }
  if (!["list", "review"].includes(action)) {
    return toJson(400, { error: "unknown_action" }, allowedOrigin);
  }
  if (!(await enforceRateLimit(client, caller.userId, action))) {
    return toJson(429, { error: "rate_limited" }, allowedOrigin);
  }

  if (action === "list") {
    const venueId = String(payload.venueId ?? "").trim();
    let query = client
      .from("dishes_draft")
      .select(
        "id, venue_id, source_photo_id, name, name_normalized, price_cents, currency, modifiers, extraction_confidence, confidence_bumps, review_status, duplicate_of, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;
    if (error) {
      return toJson(500, { error: "list_failed" }, allowedOrigin);
    }
    await writeAuditEvent(
      client,
      request,
      caller.userId,
      "dishes_draft.list",
      "venue",
      venueId || undefined,
      {
        rowCount: Array.isArray(data) ? data.length : 0,
      },
    );
    return toJson(200, { rows: data ?? [] }, allowedOrigin);
  }

  if (action === "review") {
    const draftDishId = String(payload.draftDishId ?? "").trim();
    const decision = String(payload.decision ?? "").trim();
    const notes = String(payload.notes ?? "").trim();
    if (!draftDishId) {
      return toJson(400, { error: "draft_dish_id_required" }, allowedOrigin);
    }
    if (!isAllowedDecision(decision)) {
      return toJson(400, { error: "invalid_decision" }, allowedOrigin);
    }

    const { error } = await client
      .from("dishes_draft")
      .update({
        review_status: decision,
        ocr_raw_text: notes.length > 0 ? notes.slice(0, 4000) : undefined,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", draftDishId);
    if (error) {
      return toJson(500, { error: "review_failed" }, allowedOrigin);
    }

    await writeAuditEvent(
      client,
      request,
      caller.userId,
      "dishes_draft.review",
      "dishes_draft",
      draftDishId,
      {
        decision,
        hasNotes: notes.length > 0,
      },
    );
    return toJson(200, { ok: true }, allowedOrigin);
  }

  return toJson(400, { error: "unknown_action" }, allowedOrigin);
});
