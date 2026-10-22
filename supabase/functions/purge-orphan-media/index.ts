// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";

// Removes what a failed or abandoned publish leaves behind (reviews-posting-M15):
// draft posts older than 24 hours, then review-media and post-media files that no
// review_photos / post_media row references. Run nightly by the purge-orphan-media
// pg_cron job (20261022060100). Authenticated with ORPHAN_MEDIA_WORKER_TOKEN.

const BUCKETS = ["review-media", "post-media"];
const MAX_BATCH_SIZE = 500;

function toJson(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const workerToken = Deno.env.get("ORPHAN_MEDIA_WORKER_TOKEN") ?? "";
  if (!workerToken || !timingSafeEqual(getBearerToken(request), workerToken)) {
    return toJson(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }

  const payload = await request.json().catch(() => ({}));
  const parsedLimit = Number(payload?.limit);
  const limit = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : 200),
  );
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Drafts first: deleting them frees their post_media rows, so those files count as
  // orphans in the same run.
  const { data: draftsRemoved, error: draftError } = await client.rpc("purge_orphan_post_drafts", {
    p_older_than: "24 hours",
  });
  if (draftError) {
    return toJson(500, { error: "draft_purge_failed", detail: draftError.message });
  }

  const removed: Record<string, number> = {};
  // n-plus-one-ok: one orphan listing per bucket (a handful), then removal in chunks of 100.
  for (const bucket of BUCKETS) {
    const { data, error } = await client.rpc("list_orphan_media_objects", {
      p_bucket: bucket,
      p_older_than: "24 hours",
      p_limit: limit,
    });
    if (error) {
      return toJson(500, { error: "list_failed", bucket, detail: error.message });
    }
    const paths = (Array.isArray(data) ? data : [])
      .map((row) => String(row.name ?? ""))
      .filter(Boolean);
    removed[bucket] = 0;
    for (let index = 0; index < paths.length; index += 100) {
      const chunk = paths.slice(index, index + 100);
      const { error: removeError } = await client.storage.from(bucket).remove(chunk);
      if (removeError) {
        return toJson(500, {
          error: "remove_failed",
          bucket,
          detail: removeError.message,
          removed,
        });
      }
      removed[bucket] += chunk.length;
    }
  }

  return toJson(200, { draftsRemoved: draftsRemoved ?? 0, removed });
});
