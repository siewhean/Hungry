// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { timingSafeEqual } from "../_shared/timingSafeEqual.ts";

type JsonObject = Record<string, unknown>;

const MAX_BATCH_SIZE = 25;
const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_CHUNK_SIZE = 100;

// Buckets whose objects are written under a `<auth uid>/` prefix by storage RLS
// (0014, 0016, 0023, 20260527113000). merchant-verification-evidence is excluded on
// purpose: verification evidence is retained for fraud/legal review.
const USER_PREFIXED_BUCKETS = [
  "avatars",
  "review-media",
  "bites-media",
  "post-media",
  // "menu-photos" is deliberately excluded: menu photos stay on the stall page for
  // other diners after deletion; only menu_photo_submissions.submitted_by is cleared.
  "user-stall-submission-images",
];

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

function isMissingBucketError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? error).toLowerCase();
  return message.includes("bucket not found");
}

async function listUserObjectPaths(
  client: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
): Promise<string[]> {
  const files: string[] = [];
  const folders = [userId];
  while (folders.length > 0) {
    const folder = folders.pop() as string;
    for (let offset = 0; ; offset += STORAGE_LIST_PAGE_SIZE) {
      const { data, error } = await client.storage
        .from(bucket)
        .list(folder, { limit: STORAGE_LIST_PAGE_SIZE, offset });
      if (error) {
        if (isMissingBucketError(error)) return [];
        throw error;
      }
      const entries = Array.isArray(data) ? data : [];
      for (const entry of entries) {
        const fullPath = `${folder}/${entry.name}`;
        // Storage list() returns folders as entries with a null id.
        if (entry.id === null || entry.id === undefined) folders.push(fullPath);
        else files.push(fullPath);
      }
      if (entries.length < STORAGE_LIST_PAGE_SIZE) break;
    }
  }
  return files;
}

async function deleteUserStorageObjects(
  client: ReturnType<typeof createClient>,
  userId: string,
  retained: Set<string>,
): Promise<Record<string, number>> {
  const removedByBucket: Record<string, number> = {};
  for (const bucket of USER_PREFIXED_BUCKETS) {
    const paths = (await listUserObjectPaths(client, bucket, userId)).filter(
      (path) => !retained.has(`${bucket}/${path}`),
    );
    for (let index = 0; index < paths.length; index += STORAGE_REMOVE_CHUNK_SIZE) {
      const { error } = await client.storage
        .from(bucket)
        .remove(paths.slice(index, index + STORAGE_REMOVE_CHUNK_SIZE));
      if (error) throw error;
    }
    removedByBucket[bucket] = paths.length;
  }
  return removedByBucket;
}

function toRetainedObjectKeys(purgeResult: unknown): Set<string> {
  const retained = (purgeResult as { retained_storage_objects?: unknown } | null)
    ?.retained_storage_objects;
  const keys = new Set<string>();
  for (const item of Array.isArray(retained) ? retained : []) {
    const bucket = String((item as { bucket?: unknown })?.bucket ?? "");
    const path = String((item as { path?: unknown })?.path ?? "");
    if (bucket && path) keys.add(`${bucket}/${path}`);
  }
  return keys;
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

      const { data: purgeResult, error: purgeError } = await client.rpc(
        "purge_account_deletion_residual_data",
        { p_request_id: requestId, p_worker_id: workerId },
      );
      if (purgeError) throw purgeError;

      // Every step is idempotent, so a failure here leaves the request claimable and
      // the next run safely repeats anonymize/purge before retrying auth deletion.
      const storageRemoved = await deleteUserStorageObjects(
        client,
        userId,
        toRetainedObjectKeys(purgeResult),
      );

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

      results.push({ requestId, userId, status: "completed", storageRemoved });
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
