// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

type JsonObject = Record<string, unknown>;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toJson(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function isAllowedDecision(value: string): boolean {
  return value === "accepted" || value === "rejected" || value === "duplicate";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const opsApiKey = Deno.env.get("OPS_DISHES_DRAFT_API_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }
  if (!opsApiKey) {
    return toJson(500, { error: "missing_ops_api_key" });
  }
  if (request.headers.get("x-ops-api-key") !== opsApiKey) {
    return toJson(401, { error: "unauthorized" });
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const action = String(payload.action ?? "");

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "list") {
    const venueId = String(payload.venueId ?? "").trim();
    let query = client
      .from("dishes_draft")
      .select(
        "id, venue_id, source_photo_id, name, name_normalized, price_cents, currency, modifiers, extraction_confidence, confidence_bumps, review_status, duplicate_of, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }

    const { data, error } = await query;
    if (error) {
      return toJson(500, { error: "list_failed", message: error.message });
    }
    return toJson(200, { rows: data ?? [] });
  }

  if (action === "review") {
    const draftDishId = String(payload.draftDishId ?? "").trim();
    const decision = String(payload.decision ?? "").trim();
    const notes = String(payload.notes ?? "").trim();
    if (!draftDishId) {
      return toJson(400, { error: "draft_dish_id_required" });
    }
    if (!isAllowedDecision(decision)) {
      return toJson(400, { error: "invalid_decision" });
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
      return toJson(500, { error: "review_failed", message: error.message });
    }

    return toJson(200, { ok: true });
  }

  return toJson(400, { error: "unknown_action" });
});
