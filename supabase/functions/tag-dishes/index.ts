// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

type JsonObject = Record<string, unknown>;

const MODEL = "claude-haiku-5-5";
const SOURCE = "claude_tagging_v1";
const AUTO_APPLY_CONFIDENCE = 0.7;
const MAX_BATCH_SIZE = 50;
const TASTE_AXES = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;
const FLAVOR_TAGS = [
  "wok_hei",
  "lemak",
  "qq",
  "jelak",
  "hiam",
  "gao",
  "chao_ta",
  "shiok",
  "sedap",
  "power",
];
// Halal needs certification, so the model never suggests it.
const DIETARY_FLAGS = ["vegetarian", "vegan", "pork_free", "nut_free", "gluten_free"];

const SYSTEM_PROMPT = `You score Singapore hawker and restaurant dishes for a food recommendation app.

For the dish given, estimate how it usually tastes as served in Singapore, on six axes from 0 (none) to 10 (extreme):
sweet, spicy, sour, salty, rich (fat, coconut milk, oil, creaminess), aromatic (herbs, spices, wok hei, fragrance).

Reference points:
- Hainanese chicken rice: sweet 2, spicy 1, sour 1, salty 5, rich 5, aromatic 6
- Laksa: sweet 2, spicy 6, sour 1, salty 6, rich 9, aromatic 8
- Chendol: sweet 9, spicy 0, sour 0, salty 1, rich 6, aromatic 3
- Assam fish: sweet 3, spicy 7, sour 8, salty 5, rich 3, aromatic 7

Also return:
- flavor_tags: up to 6 that clearly apply, from the allowed list only. wok_hei = smoky wok char, lemak = coconut-milk richness, qq = springy texture, jelak = cloyingly rich, hiam = aggressive lingering heat, gao = thick and concentrated, chao_ta = charred, shiok = very satisfying, sedap = umami-rich, power = standout strong flavour.
- dietary_flags: only flags the dish almost always meets by its usual recipe. Leave a flag out when unsure; a wrong flag can hurt someone.
- confidence: 0 to 1 for the taste scores. Above 0.8 only for a well-known dish with a clear name. Below 0.5 when the name is vague, unfamiliar, or could be several different dishes.
- rationale: one short sentence on what drove the scores.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sweet: { type: "number" },
    spicy: { type: "number" },
    sour: { type: "number" },
    salty: { type: "number" },
    rich: { type: "number" },
    aromatic: { type: "number" },
    flavor_tags: { type: "array", items: { type: "string", enum: FLAVOR_TAGS } },
    dietary_flags: { type: "array", items: { type: "string", enum: DIETARY_FLAGS } },
    confidence: { type: "number" },
    rationale: { type: "string" },
  },
  required: [...TASTE_AXES, "flavor_tags", "dietary_flags", "confidence", "rationale"],
  additionalProperties: false,
};

function toJson(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function parseLimit(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

function clamp(value: unknown, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function describeDish(dish: JsonObject): string {
  const lines = [`Dish: ${dish.dish_name}`, `Stall: ${dish.venue_name}`];
  if (dish.description) lines.push(`Description: ${dish.description}`);
  if (Array.isArray(dish.taste_tags) && dish.taste_tags.length > 0) {
    lines.push(`Existing tags: ${dish.taste_tags.join(", ")}`);
  }
  if (Number(dish.price) > 0) lines.push(`Price: SGD ${Number(dish.price).toFixed(2)}`);
  return lines.join("\n");
}

async function tagDish(anthropic: Anthropic, dish: JsonObject): Promise<JsonObject | null> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: describeDish(dish) }],
  });
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  return JSON.parse(text) as JsonObject;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const workerToken = Deno.env.get("TASTE_TAGGING_WORKER_TOKEN") ?? "";
  if (!workerToken || getBearerToken(request) !== workerToken) {
    return toJson(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return toJson(500, { error: "missing_anthropic_api_key" });
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const limit = parseLimit(payload.limit);
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anthropic = new Anthropic();

  const { data: dishes, error: listError } = await client.rpc("dishes_needing_taste_tags", {
    p_limit: limit,
    p_source: SOURCE,
  });
  if (listError) {
    return toJson(500, { error: "list_failed", detail: listError.message });
  }

  const summary = { tagged: 0, auto_applied: 0, needs_review: 0, skipped: 0, failed: 0 };
  for (const dish of (dishes ?? []) as JsonObject[]) {
    try {
      const result = await tagDish(anthropic, dish);
      if (!result) {
        summary.skipped += 1;
        continue;
      }
      const vector = TASTE_AXES.map((axis) => Math.round(clamp(result[axis], 0, 10) * 10) / 10);
      const confidence = Math.round(clamp(result.confidence, 0, 1) * 1000) / 1000;
      const flavorTags = (Array.isArray(result.flavor_tags) ? result.flavor_tags : [])
        .filter((tag) => FLAVOR_TAGS.includes(tag))
        .slice(0, 6);
      const dietaryFlags = (Array.isArray(result.dietary_flags) ? result.dietary_flags : []).filter(
        (flag) => DIETARY_FLAGS.includes(flag),
      );

      const { data: tagRow, error: insertError } = await client
        .from("dish_flavor_tags")
        .upsert(
          {
            dish_id: dish.dish_id,
            tag_slug: "taste_profile",
            source: SOURCE,
            model: MODEL,
            suggested_vector: `[${vector.join(",")}]`,
            suggested_flavor_tags: flavorTags,
            suggested_dietary_flags: dietaryFlags,
            confidence,
            rationale: String(result.rationale ?? "").slice(0, 500),
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "dish_id,tag_slug,source" },
        )
        .select("id")
        .single();
      if (insertError) throw insertError;
      summary.tagged += 1;

      if (confidence >= AUTO_APPLY_CONFIDENCE) {
        const { error: applyError } = await client.rpc("apply_dish_flavor_tag", {
          p_tag_id: tagRow.id,
        });
        if (applyError) throw applyError;
        summary.auto_applied += 1;
      } else {
        summary.needs_review += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error("tag-dishes failed", dish.dish_id, String(error?.message ?? error));
    }
  }

  return toJson(200, { ok: true, model: MODEL, ...summary });
});
