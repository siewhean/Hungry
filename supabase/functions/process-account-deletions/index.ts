// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

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
  if (!workerToken || getBearerToken(request) !== workerToken) {
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

      results.push({ requestId, userId, status: "completed" });
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
