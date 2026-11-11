// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { reportFunctionError, serveWithSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";
import { TIMEOUT_MS } from "../_shared/timeouts.ts";

// Checks photos a person has just uploaded for explicit or violent content before the review
// or post is published (App Store 1.2: filter objectionable material before it is posted). The
// app calls this between the upload and `submit_review` / `publish_post`; "blocked" stops the
// post and the app discards the files. Google Cloud Vision SafeSearch does the check.
//
// Each answer is recorded per photo (record_photo_safety_checks): publish_post refuses a post
// photo with no answer or a blocked one, so skipping this call cannot publish an unchecked photo.
// `bucket` is "review-media" (the default) or "post-media".
//
// Fails closed: with no Vision key, or when Google is down, the answer is "unchecked" and the
// error is reported. publish_post and the review photo trigger accept only "clear", so the app asks
// the person to try again (owner decision 11 Nov 2026). Each answer is tied to the stored file as it
// was when this check started, so a file uploaded or replaced afterwards has no answer. The
// person whose photo is blocked is not told which rule it broke.

type JsonObject = Record<string, unknown>;

const BUCKETS = new Set(["review-media", "post-media"]);
const DEFAULT_BUCKET = "review-media";
const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_CALLS_PER_USER_PER_MINUTE = 30;
const SIGNED_URL_SECONDS = 120;

const LIKELIHOOD_RANK: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};
// Adult and violent images at LIKELY or above; "racy" only at VERY_LIKELY, because food and
// skin-toned dishes score racy often.
const BLOCK_AT: Record<string, number> = {
  adult: LIKELIHOOD_RANK.LIKELY,
  violence: LIKELIHOOD_RANK.LIKELY,
  racy: LIKELIHOOD_RANK.VERY_LIKELY,
};

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("CHECK_PHOTO_SAFETY_ALLOWED_ORIGINS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function resolveAllowedOrigin(request: Request, allowedOrigins: Set<string>): string | null {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return "*";
  return allowedOrigins.has(origin) ? origin : null;
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

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(""));
}

/** True when SafeSearch rates the image at or above a blocking level. */
function isBlocked(annotation: JsonObject | undefined): boolean {
  if (!annotation) return false;
  return Object.entries(BLOCK_AT).some(([category, threshold]) => {
    const likelihood = String(annotation[category] ?? "UNKNOWN");
    return (LIKELIHOOD_RANK[likelihood] ?? 0) >= threshold;
  });
}

function validPaths(value: unknown, userId: string): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PHOTOS) return null;
  const paths = value.map((entry) => (typeof entry === "string" ? entry.trim() : ""));
  const ok = paths.every(
    (path) =>
      path.length > 0 &&
      path.length <= 300 &&
      path.startsWith(`${userId}/`) &&
      !path.includes(".."),
  );
  return ok ? [...new Set(paths)] : null;
}

type Verdict = "clear" | "unchecked" | "blocked";

/** Keeps each photo's answer for publish_post. A failure is reported, never shown to the caller. */
async function recordVerdicts(
  client: ReturnType<typeof createClient>,
  request: Request,
  userId: string,
  bucket: string,
  verdicts: { path: string; status: Verdict }[],
  startedAt: string,
): Promise<void> {
  const { error } = await client.rpc("record_photo_safety_checks", {
    p_user_id: userId,
    p_bucket: bucket,
    p_checks: verdicts,
    p_started_at: startedAt,
  });
  if (error) {
    await reportFunctionError(
      "check-photo-safety",
      new Error(`record_photo_safety_checks failed: ${error.message}`),
      { stage: "record" },
      request,
    );
  }
}

serveWithSentry("check-photo-safety", async (request) => {
  const allowedOrigin = resolveAllowedOrigin(request, getAllowedOrigins());
  if (request.method === "OPTIONS") {
    if (!allowedOrigin) return toJson(403, { error: "forbidden_origin" }, null);
    return new Response("ok", { headers: buildCorsHeaders(allowedOrigin) });
  }
  if (!allowedOrigin) return toJson(403, { error: "forbidden_origin" }, null);
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" }, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const visionApiKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("check-photo-safety missing Supabase environment");
    return toJson(500, { error: "missing_supabase_env" }, allowedOrigin);
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return toJson(401, { error: "missing_authorization" }, allowedOrigin);
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) {
    return toJson(401, { error: "invalid_authorization" }, allowedOrigin);
  }

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const paths = validPaths(body.paths, userId);
  if (!paths) {
    return toJson(400, { error: "invalid_paths" }, allowedOrigin);
  }
  const bucket = body.bucket === undefined ? DEFAULT_BUCKET : String(body.bucket);
  if (!BUCKETS.has(bucket)) {
    return toJson(400, { error: "invalid_bucket" }, allowedOrigin);
  }
  const all = (status: Verdict) => paths.map((path) => ({ path, status }));

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: rateAllowed, error: rateLimitError } = await client.rpc(
    "app_can_make_user_request",
    {
      p_actor_user_id: userId,
      p_action: "check-photo-safety",
      p_limit: MAX_CALLS_PER_USER_PER_MINUTE,
    },
  );
  if (rateLimitError || rateAllowed !== true) {
    return toJson(429, { error: "rate_limited" }, allowedOrigin);
  }

  // Files changed after this moment get no answer from this call.
  const startedAt = new Date().toISOString();

  if (!visionApiKey) {
    await reportFunctionError(
      "check-photo-safety",
      new Error("GOOGLE_CLOUD_VISION_API_KEY is not set; photos are not being checked"),
      { stage: "config" },
      request,
    );
    await recordVerdicts(client, request, userId, bucket, all("unchecked"), startedAt);
    return toJson(200, { status: "unchecked", photos: paths.length }, allowedOrigin);
  }

  try {
    const signed = await client.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (signed.error || !Array.isArray(signed.data)) {
      throw new Error(signed.error?.message ?? "signed_urls_failed");
    }

    // Every photo goes to Vision in one request.
    const images = await Promise.all(
      signed.data.map(async (entry) => {
        if (!entry?.signedUrl) throw new Error("signed_url_missing");
        const image = await fetch(entry.signedUrl, {
          signal: AbortSignal.timeout(TIMEOUT_MS.photoDownload),
        });
        if (!image.ok) throw new Error(`image_fetch_failed:${image.status}`);
        const bytes = new Uint8Array(await image.arrayBuffer());
        if (bytes.length > MAX_PHOTO_BYTES) throw new Error("image_too_large");
        return bytesToBase64(bytes);
      }),
    );

    const vision = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS.vision),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: images.map((content) => ({
            image: { content },
            features: [{ type: "SAFE_SEARCH_DETECTION" }],
          })),
        }),
      },
    );
    if (!vision.ok) throw new Error(`vision_failed:${vision.status}`);
    const payload = (await vision.json()) as JsonObject;
    const responses = Array.isArray(payload.responses) ? (payload.responses as JsonObject[]) : [];
    if (responses.length !== images.length) throw new Error("vision_response_mismatch");
    if (responses.some((entry) => entry?.error)) throw new Error("vision_item_error");

    const blockedFlags = responses.map((entry) =>
      isBlocked(entry?.safeSearchAnnotation as JsonObject | undefined),
    );
    const flagged = blockedFlags.filter(Boolean).length;
    // createSignedUrls answers in the order asked, so photo i is paths[i].
    await recordVerdicts(
      client,
      request,
      userId,
      bucket,
      paths.map((path, index) => ({ path, status: blockedFlags[index] ? "blocked" : "clear" })),
      startedAt,
    );
    if (flagged > 0) {
      // Not an error: a person posted something that broke the rules. Kept as a warning so ops
      // can see the volume without the image or its text.
      console.warn(`check-photo-safety blocked ${flagged} of ${images.length} photos`);
      return toJson(200, { status: "blocked", flagged, photos: images.length }, allowedOrigin);
    }
    return toJson(200, { status: "clear", photos: images.length }, allowedOrigin);
  } catch (error) {
    await reportFunctionError("check-photo-safety", error, { stage: "safe_search" }, request);
    await recordVerdicts(client, request, userId, bucket, all("unchecked"), startedAt);
    return toJson(200, { status: "unchecked", photos: paths.length }, allowedOrigin);
  }
});
