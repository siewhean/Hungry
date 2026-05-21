#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SMOKE_URL_ENV = "HUNGRY_SUPABASE_SMOKE_URL";
const SMOKE_ANON_ENV = "HUNGRY_SUPABASE_SMOKE_ANON_KEY";
const SMOKE_SERVICE_ENV = "HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY";
const SMOKE_PROJECT_REF_ENV = "HUNGRY_SUPABASE_SMOKE_PROJECT_REF";
const SERVICE_ROLE_OPT_IN_ENV = "HUNGRY_ALLOW_SERVICE_ROLE_SMOKE";
const OCR_IMAGE_ENV = "HUNGRY_OCR_SMOKE_IMAGE_PATH";
const OCR_VENUE_ENV = "HUNGRY_OCR_SMOKE_VENUE_ID";
const OCR_ORIGIN_ENV = "HUNGRY_OCR_SMOKE_ORIGIN";
const OCR_TIMEOUT_ENV = "HUNGRY_OCR_SMOKE_TIMEOUT_MS";

function isLocalSmokeUrl(urlText) {
  try {
    const { hostname } = new URL(urlText);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function getMissingEnv() {
  const missing = [SMOKE_URL_ENV, SMOKE_SERVICE_ENV, SMOKE_ANON_ENV, OCR_IMAGE_ENV].filter(
    (name) => !process.env[name]?.trim(),
  );
  const smokeUrl = process.env[SMOKE_URL_ENV]?.trim();

  if (smokeUrl && !isLocalSmokeUrl(smokeUrl) && !process.env[SMOKE_PROJECT_REF_ENV]?.trim()) {
    missing.push(SMOKE_PROJECT_REF_ENV);
  }
  if (process.env[SERVICE_ROLE_OPT_IN_ENV] !== "1") {
    missing.push(`${SERVICE_ROLE_OPT_IN_ENV}=1`);
  }
  return missing;
}

function fail(message) {
  throw new Error(`[supabase-ocr-smoke] ${message}`);
}

function createSupabaseClient(key) {
  return createClient(process.env[SMOKE_URL_ENV].trim(), key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function assertSmokeTargetIsAllowed() {
  const smokeUrl = process.env[SMOKE_URL_ENV].trim();
  if (isLocalSmokeUrl(smokeUrl)) return;

  const { hostname } = new URL(smokeUrl);
  const actualProjectRef = hostname.split(".")[0] ?? "";
  const expectedProjectRef = process.env[SMOKE_PROJECT_REF_ENV]?.trim() ?? "";

  if (!expectedProjectRef) {
    fail(
      `cloud smoke target requires ${SMOKE_PROJECT_REF_ENV} to confirm the intended dev project`,
    );
  }
  if (actualProjectRef !== expectedProjectRef) {
    fail(
      `${SMOKE_PROJECT_REF_ENV}=${expectedProjectRef} does not match the Supabase URL project ref ${actualProjectRef}`,
    );
  }
}

async function expectNoError(result, label) {
  if (result.error) {
    fail(`${label}: ${result.error.message}`);
  }
  return result.data;
}

function inferContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".heic") return "image/heic";
  fail(`${OCR_IMAGE_ENV} must point to a .jpg, .jpeg, .png, or .heic menu image`);
}

async function createTestUser(admin, runId) {
  const email = `hungry-ocr-${runId}@example.test`;
  const password = `HungryOcrSmoke-${runId}-123!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: `Hungry OCR Smoke ${runId}`,
    },
  });
  if (error || !data.user?.id) {
    fail(`create smoke auth user: ${error?.message ?? "missing user id"}`);
  }
  return { id: data.user.id, email, password };
}

async function signInUser(anonKey, user) {
  const client = createSupabaseClient(anonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session?.access_token) {
    fail(`sign in smoke user: ${error?.message ?? "missing session token"}`);
  }
  return client;
}

async function resolveVenueId(admin) {
  const configuredVenueId = process.env[OCR_VENUE_ENV]?.trim();
  if (configuredVenueId) {
    const venue = await expectNoError(
      await admin
        .from("venues")
        .select("id, building_id")
        .eq("id", configuredVenueId)
        .maybeSingle(),
      `lookup ${OCR_VENUE_ENV}`,
    );
    if (!venue?.id) fail(`${OCR_VENUE_ENV}=${configuredVenueId} did not match a venue row`);
    return venue.id;
  }

  const venue = await expectNoError(
    await admin.from("venues").select("id, building_id").limit(1).maybeSingle(),
    "lookup fallback venue",
  );
  if (!venue?.id) fail(`no venue row found; set ${OCR_VENUE_ENV} to a staging venue id`);
  return venue.id;
}

async function invokeWithTimeout(operation, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function cleanup(admin, userId, submissionId, draftIds, storagePath) {
  const errors = [];
  const capture = async (operation, label) => {
    try {
      const result = await operation;
      if (result?.error) errors.push(`${label}: ${result.error.message}`);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (draftIds.length > 0) {
    await capture(admin.from("dishes_draft").delete().in("id", draftIds), "delete draft dishes");
  }
  if (submissionId) {
    await capture(
      admin.from("menu_photo_submissions").delete().eq("id", submissionId),
      "delete menu photo submission",
    );
  }
  if (storagePath) {
    await capture(
      admin.storage.from("menu-photos").remove([storagePath]),
      "delete uploaded menu photo",
    );
  }
  if (userId) {
    await capture(admin.from("user_profiles").delete().eq("id", userId), "delete smoke profile");
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) errors.push(`delete auth user ${userId}: ${result.error.message}`);
  }

  return errors;
}

async function main() {
  const missing = getMissingEnv();
  const requireEnv =
    process.argv.includes("--require-env") || process.env.HUNGRY_SUPABASE_SMOKE_REQUIRED === "1";

  if (missing.length > 0) {
    const message = `skipped; missing ${missing.join(", ")}`;
    if (requireEnv) fail(message);
    console.log(`[supabase-ocr-smoke] ${message}`);
    console.log(
      `[supabase-ocr-smoke] edge function must also have GOOGLE_CLOUD_VISION_API_KEY configured; GEMINI_API_KEY is optional`,
    );
    return;
  }

  assertSmokeTargetIsAllowed();

  const startedAt = Date.now();
  const timeoutMs = Number(process.env[OCR_TIMEOUT_ENV] || 30_000);
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const admin = createSupabaseClient(process.env[SMOKE_SERVICE_ENV].trim());
  const anonKey = process.env[SMOKE_ANON_ENV].trim();
  const origin = process.env[OCR_ORIGIN_ENV]?.trim() || "http://localhost:8081";
  const imagePath = path.resolve(process.env[OCR_IMAGE_ENV].trim());
  const contentType = inferContentType(imagePath);

  let user;
  let submissionId = "";
  let storagePath = "";
  let draftIds = [];
  let smokeCompleted = false;

  try {
    user = await createTestUser(admin, runId);
    const userClient = await signInUser(anonKey, user);
    await expectNoError(
      await userClient.from("user_profiles").upsert(
        {
          id: user.id,
          email: user.email,
          display_name: `OCR Smoke ${runId}`,
        },
        { onConflict: "id" },
      ),
      "upsert smoke profile",
    );

    const venueId = await resolveVenueId(admin);
    const imageBytes = await readFile(imagePath);
    storagePath = `${user.id}/ocr-smoke/${runId}${path.extname(imagePath).toLowerCase()}`;

    await expectNoError(
      await userClient.storage.from("menu-photos").upload(storagePath, imageBytes, {
        contentType,
        upsert: false,
      }),
      "upload menu photo",
    );

    submissionId = await expectNoError(
      await userClient.rpc("submit_menu_photo", {
        p_venue_id: venueId,
        p_storage_path: storagePath,
        p_content_type: contentType,
        p_size_bytes: imageBytes.byteLength,
      }),
      "submit menu photo metadata",
    );

    const ingest = await invokeWithTimeout(
      userClient.functions.invoke("ingest-menu-photo", {
        body: { submissionId },
        headers: { Origin: origin },
      }),
      timeoutMs,
    );
    if (ingest.error) {
      fail(`ingest-menu-photo: ${ingest.error.message}`);
    }
    if (!ingest.data?.ok) {
      fail(`ingest-menu-photo returned ${JSON.stringify(ingest.data)}`);
    }

    const submission = await expectNoError(
      await admin
        .from("menu_photo_submissions")
        .select("id, ocr_status, ocr_error, processed_at")
        .eq("id", submissionId)
        .maybeSingle(),
      "read processed submission",
    );
    if (submission?.ocr_status !== "succeeded") {
      fail(
        `expected OCR status succeeded, got ${submission?.ocr_status}: ${submission?.ocr_error ?? ""}`,
      );
    }

    const drafts = await expectNoError(
      await admin
        .from("dishes_draft")
        .select("id, name, review_status, extraction_confidence")
        .eq("source_photo_id", submissionId),
      "read OCR draft dishes",
    );
    draftIds = Array.isArray(drafts) ? drafts.map((row) => row.id).filter(Boolean) : [];
    if (draftIds.length === 0) {
      fail("OCR completed without creating dishes_draft rows");
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > timeoutMs) {
      fail(`OCR smoke exceeded ${timeoutMs}ms: ${elapsedMs}ms`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          runId,
          venueId,
          submissionId,
          elapsedMs,
          draftCount: draftIds.length,
          firstDraft: drafts[0]?.name ?? null,
          verified: [
            "auth smoke user created",
            "menu photo uploaded to user-owned menu-photos path",
            "submit_menu_photo RPC created submission metadata",
            "ingest-menu-photo returned ok",
            "submission reached succeeded status",
            "dishes_draft rows were created",
          ],
        },
        null,
        2,
      ),
    );
    smokeCompleted = true;
  } finally {
    const cleanupErrors = await cleanup(admin, user?.id ?? "", submissionId, draftIds, storagePath);
    if (cleanupErrors.length > 0) {
      const message = `cleanup failed: ${cleanupErrors.join("; ")}`;
      if (smokeCompleted) {
        fail(message);
      }
      console.error(`[supabase-ocr-smoke] ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
