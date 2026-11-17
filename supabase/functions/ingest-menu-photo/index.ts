// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

import { clampConfidence, fallbackExtract, persistenceItems, visionText } from "./ocrIntegrity.ts";
import type { ExtractionDish } from "./ocrIntegrity.ts";

type JsonObject = Record<string, unknown>;

const ALLOWED_OCR_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/webp"]);

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("INGEST_MENU_PHOTO_ALLOWED_ORIGINS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function resolveAllowedOrigin(request: Request, allowedOrigins: Set<string>): string | null {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) {
    return "*";
  }
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

async function runVision(visionApiKey: string, imageBase64: string): Promise<string> {
  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["zh-Hans", "zh-Hant", "en"] },
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Vision request failed: ${response.status}`);
  }
  const payload = (await response.json()) as JsonObject;
  return visionText(payload);
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function assertValidOcrImageType(response: Response): void {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_OCR_IMAGE_TYPES.has(contentType)) {
    throw new Error(`invalid_ocr_image_type:${contentType ?? "missing"}`);
  }
}

async function runLlmExtraction(apiKey: string, text: string): Promise<ExtractionDish[] | null> {
  if (!apiKey) return null;
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Extract menu items from OCR text. Return ONLY strict JSON array with fields: name (string), price (number|null), modifiers (string[]), extraction_confidence (0..1). OCR text:\n" +
                  text,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as JsonObject;
  const textPayload =
    ((payload.candidates as JsonObject[] | undefined)?.[0]?.content as JsonObject | undefined)
      ?.parts?.[0]?.text ?? "";
  if (typeof textPayload !== "string" || textPayload.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(textPayload) as ExtractionDish[];
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item) => ({
        name: String(item?.name ?? "").trim(),
        price: typeof item?.price === "number" ? item.price : null,
        modifiers: Array.isArray(item?.modifiers)
          ? item.modifiers.map((m) => String(m).trim()).filter(Boolean)
          : [],
        extraction_confidence: clampConfidence(Number(item?.extraction_confidence ?? 0.5)),
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  const allowedOrigin = resolveAllowedOrigin(request, getAllowedOrigins());
  if (request.method === "OPTIONS") {
    if (!allowedOrigin) {
      return toJson(403, { error: "forbidden_origin" }, null);
    }
    return new Response("ok", { headers: buildCorsHeaders(allowedOrigin) });
  }
  if (!allowedOrigin) {
    return toJson(403, { error: "forbidden_origin" }, null);
  }
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" }, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const visionApiKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY") ?? "";
  const llmApiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("ingest-menu-photo missing Supabase environment");
    return toJson(500, { error: "missing_supabase_env" }, allowedOrigin);
  }
  if (!visionApiKey) {
    console.error("ingest-menu-photo missing Google Vision API key");
    return toJson(500, { error: "missing_vision_api_key" }, allowedOrigin);
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
  const callerUserId = userData?.user?.id;
  if (userError || !callerUserId) {
    return toJson(401, { error: "invalid_authorization" }, allowedOrigin);
  }

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const submissionId = String(body.submissionId ?? "").trim();
  if (!submissionId) {
    return toJson(400, { error: "submission_id_required" }, allowedOrigin);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: submission, error: submissionError } = await client
    .from("menu_photo_submissions")
    .select(
      "id, venue_id, building_id, submitted_by, storage_bucket, storage_path, ocr_attempts, ocr_status",
    )
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError || !submission) {
    return toJson(404, { error: "submission_not_found" }, allowedOrigin);
  }
  if (String(submission.submitted_by) !== callerUserId) {
    return toJson(403, { error: "forbidden_submission" }, allowedOrigin);
  }
  if (!["pending", "failed"].includes(String(submission.ocr_status ?? "pending"))) {
    return toJson(409, { error: "submission_not_queued" }, allowedOrigin);
  }
  if (Number(submission.ocr_attempts ?? 0) >= 3) {
    return toJson(429, { error: "ocr_retry_limit_exceeded" }, allowedOrigin);
  }

  const { data: rateAllowed, error: rateLimitError } = await client.rpc(
    "app_can_make_user_request",
    {
      p_actor_user_id: callerUserId,
      p_action: "ingest-menu-photo",
      p_limit: 10,
    },
  );
  if (rateLimitError || rateAllowed !== true) {
    return toJson(429, { error: "rate_limited" }, allowedOrigin);
  }

  const ocrJobId = crypto.randomUUID();
  const { data: processingSubmission, error: claimError } = await client
    .from("menu_photo_submissions")
    .update({
      ocr_status: "processing",
      ocr_attempts: Number(submission.ocr_attempts ?? 0) + 1,
      ocr_job_id: ocrJobId,
      ocr_error: null,
    })
    .eq("id", submissionId)
    .eq("submitted_by", callerUserId)
    .in("ocr_status", ["pending", "failed"])
    .lt("ocr_attempts", 3)
    .select(
      "id, venue_id, building_id, submitted_by, storage_bucket, storage_path, ocr_attempts, ocr_status",
    )
    .maybeSingle();
  if (claimError || !processingSubmission) {
    return toJson(409, { error: "submission_not_queued" }, allowedOrigin);
  }

  try {
    const signed = await client.storage
      .from(String(processingSubmission.storage_bucket))
      .createSignedUrl(String(processingSubmission.storage_path), 120);
    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(signed.error?.message ?? "signed_url_failed");
    }

    const imageResponse = await fetch(signed.data.signedUrl);
    if (!imageResponse.ok) {
      throw new Error(`image_fetch_failed:${imageResponse.status}`);
    }
    assertValidOcrImageType(imageResponse);
    const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    const imageBase64 = bytesToBase64(imageBytes);

    const ocrText = await runVision(visionApiKey, imageBase64);
    const llmResult = await runLlmExtraction(llmApiKey, ocrText);
    const extracted = (
      llmResult && llmResult.length > 0 ? llmResult : fallbackExtract(ocrText)
    ).slice(0, 50);

    // One transaction persists every draft and the completion state. A failed query
    // rolls back all draft writes; the job id makes an ambiguous retry idempotent.
    const { data: extractedCount, error: persistenceError } = await client.rpc(
      "app_complete_menu_photo_ingestion",
      {
        p_submission_id: submissionId,
        p_ocr_job_id: ocrJobId,
        p_items: persistenceItems(extracted),
        p_ocr_text: ocrText,
      },
    );
    if (persistenceError || !Number.isInteger(extractedCount) || extractedCount < 0) {
      throw new Error("ocr_persistence_failed");
    }

    return toJson(200, { ok: true, submissionId, extracted: extractedCount }, allowedOrigin);
  } catch (error) {
    console.error("OCR pipeline error", error);
    const { error: failurePersistenceError } = await client
      .from("menu_photo_submissions")
      .update({
        ocr_status: "failed",
        ocr_error: "Processing failed. Please try again.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("ocr_job_id", ocrJobId)
      .eq("ocr_status", "processing");
    if (failurePersistenceError) {
      console.error("OCR failure state could not be persisted", failurePersistenceError.code);
    }

    return toJson(500, { error: "ocr_pipeline_failed" }, allowedOrigin);
  }
});
