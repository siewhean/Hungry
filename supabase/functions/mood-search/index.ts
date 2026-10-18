// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";
import { MODEL, TASTE_AXES } from "../_shared/tasteTagging.ts";

type JsonObject = Record<string, unknown>;

const MAX_QUERY_LENGTH = 200;
const DAILY_LIMIT = 20;
const CACHE_DAYS = 30;
const MAX_SHIFT = 5;
const DIETARY_FLAGS = ["halal", "vegetarian", "vegan", "pork_free", "nut_free", "gluten_free"];

const SYSTEM_PROMPT = `You turn what someone types into a Singapore food app's search box into search settings.

The app ranks dishes on six taste axes from 0 to 10: sweet, spicy, sour, salty, rich (fat, coconut milk, oil, creaminess), aromatic (herbs, spices, wok hei, fragrance).

Return:
- A shift from -5 to +5 for each axis: how far to move the person's usual taste for this search. 0 when the text says nothing about that axis. "not too spicy" is about spicy -3; "really spicy" is about spicy +4; "light" lowers rich; "comforting" or "hearty" raises rich a little.
- max_price: the most they want to pay per dish in SGD, or 0 when no budget is given.
- dietary_flags: only flags the text asks for outright, from the allowed list.
- keywords: up to 4 short dish-type words the text points to, in plain English as they would appear in a dish name (for example "soup", "noodle", "rice", "curry", "dessert"). "soupy" becomes "soup". Leave it empty when nothing points to a dish type.
- summary: a short phrase saying what you understood, for example "soupy, mild, under $8".`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    ...Object.fromEntries(TASTE_AXES.map((axis) => [axis, { type: "number" }])),
    max_price: { type: "number" },
    dietary_flags: { type: "array", items: { type: "string", enum: DIETARY_FLAGS } },
    keywords: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
  required: [...TASTE_AXES, "max_price", "dietary_flags", "keywords", "summary"],
  additionalProperties: false,
};

function toJson(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clamp(value: unknown, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeQuery(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function toIntent(result: JsonObject): JsonObject {
  const tasteShift = Object.fromEntries(
    TASTE_AXES.map((axis) => [
      axis,
      Math.round(clamp(result[axis], -MAX_SHIFT, MAX_SHIFT) * 10) / 10,
    ]),
  );
  const maxPrice = clamp(result.max_price, 0, 500);
  return {
    tasteShift,
    maxPrice: maxPrice > 0 ? maxPrice : null,
    dietaryFlags: (Array.isArray(result.dietary_flags) ? result.dietary_flags : []).filter((flag) =>
      DIETARY_FLAGS.includes(flag),
    ),
    keywords: (Array.isArray(result.keywords) ? result.keywords : [])
      .map((keyword) => String(keyword).toLowerCase().trim().slice(0, 30))
      .filter(Boolean)
      .slice(0, 4),
    summary: String(result.summary ?? "").slice(0, 120),
  };
}

async function parseMood(anthropic: Anthropic, query: string): Promise<JsonObject | null> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: query }],
  });
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  return toIntent(JSON.parse(text) as JsonObject);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return toJson(401, { error: "missing_authorization" });
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return toJson(401, { error: "unauthorized" });
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const query = normalizeQuery(payload.query);
  if (query.length < 2) {
    return toJson(400, { error: "query_too_short" });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Common searches reuse an earlier answer, so they don't call Claude or count toward the cap.
  const cacheSince = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedRows, error: cacheError } = await client
    .from("mood_search_queries")
    .select("intent")
    .eq("query_norm", query)
    .eq("cached", false)
    .gte("created_at", cacheSince)
    .order("created_at", { ascending: false })
    .limit(1);
  if (cacheError) {
    return toJson(500, { error: "cache_lookup_failed" });
  }
  if (cachedRows?.length) {
    const intent = cachedRows[0].intent;
    await client
      .from("mood_search_queries")
      .insert({ user_id: userId, query_norm: query, intent, cached: true });
    return toJson(200, { ok: true, cached: true, intent });
  }

  const daySince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await client
    .from("mood_search_queries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("cached", false)
    .gte("created_at", daySince);
  if (countError) {
    return toJson(500, { error: "usage_lookup_failed" });
  }
  if ((count ?? 0) >= DAILY_LIMIT) {
    return toJson(429, { error: "daily_limit" });
  }

  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return toJson(500, { error: "missing_anthropic_api_key" });
  }
  try {
    const intent = await parseMood(new Anthropic(), query);
    if (!intent) {
      return toJson(502, { error: "parse_failed" });
    }
    await client
      .from("mood_search_queries")
      .insert({ user_id: userId, query_norm: query, intent, cached: false });
    return toJson(200, { ok: true, cached: false, intent });
  } catch (error) {
    console.error("mood-search failed", String(error?.message ?? error));
    return toJson(502, { error: "parse_failed" });
  }
});
