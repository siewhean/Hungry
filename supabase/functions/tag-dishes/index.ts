// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { reportFunctionError, serveWithSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";
import { type AiSettings, generateJson, resolveAi } from "../_shared/aiProvider.ts";
import {
  DIETARY_FLAGS,
  FLAVOR_TAGS,
  OUTPUT_SCHEMA,
  SYSTEM_PROMPT,
  TASTE_AXES,
} from "../_shared/tasteTagging.ts";

type JsonObject = Record<string, unknown>;

// The name predates the move to Gemini. Kept so dishes that are already tagged are not tagged again.
const SOURCE = "claude_tagging_v1";
const AUTO_APPLY_CONFIDENCE = 0.7;
const MAX_BATCH_SIZE = 50;

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

function tagDish(ai: AiSettings, dish: JsonObject): Promise<JsonObject | null> {
  return generateJson(ai, {
    system: SYSTEM_PROMPT,
    user: describeDish(dish),
    schema: OUTPUT_SCHEMA,
    maxOutputTokens: 4000,
  });
}

serveWithSentry("tag-dishes", async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const workerToken = Deno.env.get("TASTE_TAGGING_WORKER_TOKEN") ?? "";
  if (!workerToken || !timingSafeEqual(getBearerToken(request), workerToken)) {
    return toJson(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }
  const ai = resolveAi((name) => Deno.env.get(name));
  if (ai.problem) {
    return toJson(500, { error: ai.problem });
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const limit = parseLimit(payload.limit);
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: dishes, error: listError } = await client.rpc("dishes_needing_taste_tags", {
    p_limit: limit,
    p_source: SOURCE,
  });
  if (listError) {
    return toJson(500, { error: "list_failed", detail: listError.message });
  }

  const summary = { tagged: 0, auto_applied: 0, needs_review: 0, skipped: 0, failed: 0 };
  // n-plus-one-ok: the model call per dish dominates; writing each result as it arrives keeps progress if the function times out.
  for (const dish of (dishes ?? []) as JsonObject[]) {
    try {
      const result = await tagDish(ai, dish);
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
            model: ai.model,
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
      await reportFunctionError("tag-dishes", error, { dishId: String(dish.dish_id) });
    }
  }

  return toJson(200, { ok: true, model: ai.model, ...summary });
});
