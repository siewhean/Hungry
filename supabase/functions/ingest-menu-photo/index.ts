// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

type JsonObject = Record<string, unknown>;

interface ExtractionDish {
  name: string;
  price: number | null;
  modifiers: string[];
  extraction_confidence: number;
}

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

function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function toPriceCents(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function textToVector(text: string, price: number | null): number[] {
  const dimensions = 32;
  const vector = new Array<number>(dimensions + 1).fill(0);
  const normalized = normalizeName(text);
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    vector[i % dimensions] += code / 255;
  }
  vector[dimensions] = price ?? 0;
  return vector;
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  const size = Math.max(left.length, right.length);
  for (let i = 0; i < size; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    dot += l * r;
    leftMag += l * l;
    rightMag += r * r;
  }
  if (leftMag === 0 || rightMag === 0) return 0;
  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
}

function parsePrice(raw: string): number | null {
  const match = raw.match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function fallbackExtract(text: string): ExtractionDish[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);

  const extracted: ExtractionDish[] = [];
  for (const line of lines.slice(0, 25)) {
    const price = parsePrice(line);
    const name = line
      .replace(/S?\$?\s*\d+(?:\.\d{1,2})?/gi, "")
      .replace(/[.]{2,}/g, " ")
      .trim();
    if (name.length < 2) continue;
    extracted.push({
      name,
      price,
      modifiers: [],
      extraction_confidence: price !== null ? 0.72 : 0.56,
    });
  }
  return extracted;
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
  const first = Array.isArray(payload.responses)
    ? (payload.responses[0] as JsonObject | undefined)
    : undefined;
  const text =
    (first?.fullTextAnnotation as JsonObject | undefined)?.text ||
    (first?.textAnnotations as JsonObject[] | undefined)?.[0]?.description ||
    "";
  return typeof text === "string" ? text : "";
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

    const { data: existingRows } = await client
      .from("dishes_draft")
      .select("id, name, price_cents, extraction_confidence, confidence_bumps")
      .eq("venue_id", processingSubmission.venue_id)
      .in("review_status", ["pending", "accepted", "edited"]);

    const existing = Array.isArray(existingRows) ? existingRows : [];

    for (const dish of extracted) {
      const normalizedName = normalizeName(dish.name);
      if (!normalizedName) continue;

      const currentVector = textToVector(normalizedName, dish.price);
      let bestMatch: JsonObject | null = null;
      let bestScore = 0;

      for (const row of existing) {
        const candidateName = String(row.name ?? "");
        const candidatePrice =
          typeof row.price_cents === "number" ? Number(row.price_cents) / 100 : null;
        const score = cosineSimilarity(currentVector, textToVector(candidateName, candidatePrice));
        if (score > bestScore) {
          bestScore = score;
          bestMatch = row as JsonObject;
        }
      }

      if (bestMatch && bestScore > 0.9) {
        await client
          .from("dishes_draft")
          .update({
            extraction_confidence: Math.max(
              Number(bestMatch.extraction_confidence ?? 0),
              clampConfidence(dish.extraction_confidence),
            ),
            confidence_bumps: Number(bestMatch.confidence_bumps ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", String(bestMatch.id));
        continue;
      }

      await client.from("dishes_draft").insert({
        venue_id: processingSubmission.venue_id,
        building_id: processingSubmission.building_id,
        source_photo_id: processingSubmission.id,
        name: dish.name,
        name_normalized: normalizedName,
        price_cents: toPriceCents(dish.price),
        modifiers: dish.modifiers,
        ocr_raw_text: ocrText,
        extraction_confidence: clampConfidence(dish.extraction_confidence),
        review_status: "pending",
      });
    }

    await client
      .from("menu_photo_submissions")
      .update({
        ocr_status: extracted.length > 0 ? "succeeded" : "skipped",
        processed_at: new Date().toISOString(),
        vision_response: { textPreview: ocrText.slice(0, 1200), extractedCount: extracted.length },
        ocr_error: null,
      })
      .eq("id", submissionId);

    return toJson(200, { ok: true, submissionId, extracted: extracted.length }, allowedOrigin);
  } catch (error) {
    console.error("OCR pipeline error", error);
    await client
      .from("menu_photo_submissions")
      .update({
        ocr_status: "failed",
        ocr_error: "Processing failed. Please try again.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    return toJson(500, { error: "ocr_pipeline_failed" }, allowedOrigin);
  }
});
