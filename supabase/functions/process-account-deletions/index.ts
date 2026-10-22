// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";

type JsonObject = Record<string, unknown>;

const MAX_BATCH_SIZE = 25;

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
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(parsed)));
}

function isAlreadyDeletedAuthError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? error).toLowerCase();
  return message.includes("not found") || message.includes("no user");
}

// Buckets whose objects live under the owner's `{userId}/` folder. Menu photos are
// kept on purpose (they stay on the stall page without the uploader's name).
const USER_MEDIA_BUCKETS = ["avatars", "review-media", "post-media", "bites-media"];

async function listStoragePaths(
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  const paths: string[] = [];
  // n-plus-one-ok: paged storage listing, 1000 entries per call; folders recurse.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    const entries = Array.isArray(data) ? data : [];
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      // Folders come back without an id.
      if (entry.id) paths.push(path);
      else if (depth < 4) paths.push(...(await listStoragePaths(client, bucket, path, depth + 1)));
    }
    if (entries.length < 1000) return paths;
  }
}

async function removeUserMedia(
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  let removed = 0;
  for (const bucket of USER_MEDIA_BUCKETS) {
    const paths = await listStoragePaths(client, bucket, userId);
    // n-plus-one-ok: removes 100 paths per call, not one per file.
    for (let index = 0; index < paths.length; index += 100) {
      const chunk = paths.slice(index, index + 100);
      const { error } = await client.storage.from(bucket).remove(chunk);
      if (error) throw error;
      removed += chunk.length;
    }
  }
  return removed;
}

async function markFailure(
  client: ReturnType<typeof createClient>,
  requestId: string,
  userId: string,
  workerId: string,
  error: unknown,
): Promise<void> {
  const message = String((error as { message?: unknown } | null)?.message ?? error);
  await client
    .from("account_deletion_requests")
    .update({
      last_error: message.slice(0, 1000),
      worker_lock_id: null,
      worker_locked_at: null,
    })
    .eq("id", requestId);
  await client.from("account_deletion_processing_events").insert({
    request_id: requestId,
    user_id: userId,
    event_type: "failed",
    metadata: { worker_id: workerId, error: message.slice(0, 1000) },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" });
  }

  const workerToken = Deno.env.get("ACCOUNT_DELETION_WORKER_TOKEN") ?? "";
  if (!workerToken || !timingSafeEqual(getBearerToken(request), workerToken)) {
    return toJson(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return toJson(500, { error: "missing_supabase_env" });
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const limit = parseLimit(payload.limit);
  const workerId = crypto.randomUUID();
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: claims, error: claimError } = await client.rpc("claim_account_deletion_requests", {
    p_limit: limit,
    p_worker_id: workerId,
  });
  if (claimError) {
    return toJson(500, { error: "claim_failed", detail: claimError.message });
  }

  const results: JsonObject[] = [];
  // n-plus-one-ok: each account is deleted and can fail on its own; the auth admin API takes one user.
  for (const claim of Array.isArray(claims) ? claims : []) {
    const requestId = String(claim.request_id ?? "");
    const userId = String(claim.user_id ?? "");
    if (!requestId || !userId) continue;

    try {
      const { error: anonymizeError } = await client.rpc("anonymize_account_deletion_request", {
        p_request_id: requestId,
        p_worker_id: workerId,
      });
      if (anonymizeError) throw anonymizeError;

      // Menu photos stay on the stall page for other diners; only the link to
      // the deleted account is removed.
      const { error: menuPhotoError } = await client
        .from("menu_photo_submissions")
        .update({ submitted_by: null })
        .eq("submitted_by", userId);
      if (menuPhotoError) throw menuPhotoError;

      // The anonymized profile row stays, so drop its avatar link and the files behind it.
      const { error: avatarError } = await client
        .from("user_profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (avatarError) throw avatarError;
      const removedMedia = await removeUserMedia(client, userId);

      const { error: deleteError } = await client.auth.admin.deleteUser(userId);
      if (deleteError && !isAlreadyDeletedAuthError(deleteError)) {
        throw deleteError;
      }

      const { error: completeError } = await client.rpc("complete_account_deletion_request", {
        p_request_id: requestId,
        p_worker_id: workerId,
        p_auth_deleted: true,
      });
      if (completeError) throw completeError;

      results.push({ requestId, userId, status: "completed", removedMedia });
    } catch (error) {
      await markFailure(client, requestId, userId, workerId, error);
      results.push({
        requestId,
        userId,
        status: "failed",
        error: String((error as { message?: unknown } | null)?.message ?? error),
      });
    }
  }

  return toJson(200, {
    workerId,
    claimed: Array.isArray(claims) ? claims.length : 0,
    results,
  });
});
