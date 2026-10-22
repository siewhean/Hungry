// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { reportFunctionError, serveWithSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { TASTE_AXES } from "../_shared/tasteTagging.ts";

type JsonObject = Record<string, unknown>;

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_QUERY_LENGTH = 200;
const DAILY_LIMIT = 20;
// Per-minute burst caps. The daily cap only counts searches that reach Gemini, so these also bound
// cached answers and rejected calls (each still costs a database or Auth call).
const MAX_CALLS_PER_IP_PER_MINUTE = 30;
const MAX_CALLS_PER_USER_PER_MINUTE = 10;
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
  type: "OBJECT",
  properties: {
    ...Object.fromEntries(TASTE_AXES.map((axis) => [axis, { type: "NUMBER" }])),
    max_price: { type: "NUMBER" },
    dietary_flags: { type: "ARRAY", items: { type: "STRING", enum: DIETARY_FLAGS } },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    summary: { type: "STRING" },
  },
  required: [...TASTE_AXES, "max_price", "dietary_flags", "keywords", "summary"],
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

async function parseMood(apiKey: string, query: string): Promise<JsonObject | null> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: query }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: OUTPUT_SCHEMA,
          maxOutputTokens: 1000,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }
  const body = (await response.json()) as JsonObject;
  const candidate = (body.candidates as JsonObject[] | undefined)?.[0];
  if (!candidate || candidate.finishReason !== "STOP") return null;
  const parts = ((candidate.content as JsonObject | undefined)?.parts ?? []) as JsonObject[];
  const text = parts.map((part) => String(part.text ?? "")).join("");
  return toIntent(JSON.parse(text) as JsonObject);
}

serveWithSentry("mood-search", async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Checked before the Auth lookup so a flood of bad tokens is cut off too. The counters fail open.
  const clientIp =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  const { data: ipAllowed } = await client.rpc("app_can_make_ip_request", {
    p_ip: clientIp,
    p_action: "mood-search",
    p_limit: MAX_CALLS_PER_IP_PER_MINUTE,
  });
  if (ipAllowed === false) {
    return toJson(429, { error: "rate_limited" });
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

  const { data: userAllowed } = await client.rpc("app_can_make_user_request", {
    p_actor_user_id: userId,
    p_action: "mood-search",
    p_limit: MAX_CALLS_PER_USER_PER_MINUTE,
  });
  if (userAllowed === false) {
    return toJson(429, { error: "rate_limited" });
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const query = normalizeQuery(payload.query);
  if (query.length < 2) {
    return toJson(400, { error: "query_too_short" });
  }

  // Common searches reuse an earlier answer, so they don't call Gemini or count toward the cap.
  const cacheSince = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cachedRows, error: cacheError } = await client
    .from("mood_search_queries")
    .select("intent")
    .eq("query_norm", query)
    .eq("cached", false)
    .eq("pending", false)
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

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiApiKey) {
    return toJson(500, { error: "missing_gemini_api_key" });
  }

  // Check the daily cap and claim a slot in one locked step, so parallel calls
  // can't all pass the check before any of them is recorded.
  const { data: slotId, error: slotError } = await client.rpc("reserve_mood_search_slot", {
    p_user_id: userId,
    p_query_norm: query,
    p_daily_limit: DAILY_LIMIT,
  });
  if (slotError) {
    return toJson(500, { error: "usage_lookup_failed" });
  }
  if (slotId === null || slotId === undefined) {
    return toJson(429, { error: "daily_limit" });
  }

  try {
    const intent = await parseMood(geminiApiKey, query);
    if (!intent) {
      await client.from("mood_search_queries").delete().eq("id", slotId);
      return toJson(502, { error: "parse_failed" });
    }
    await client.from("mood_search_queries").update({ intent, pending: false }).eq("id", slotId);
    return toJson(200, { ok: true, cached: false, intent });
  } catch (error) {
    await reportFunctionError("mood-search", error, {}, request);
    await client.from("mood_search_queries").delete().eq("id", slotId);
    return toJson(502, { error: "parse_failed" });
  }
});
