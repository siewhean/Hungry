// @ts-nocheck
/* eslint-disable import/no-unresolved */
import { serveWithSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

type JsonObject = Record<string, unknown>;

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_OPS_ACTIONS_PER_MINUTE = 60;
const STALE_CLAIM_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set([
  "pending",
  "accepted",
  "edited",
  "rejected",
  "promoted",
  "duplicate",
]);
const ALLOWED_PRICE_BASES = new Set(["counter", "menu", "delivery"]);
const ALLOWED_HALAL_STATUSES = new Set(["yes", "no", "unknown"]);

function getAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("OPS_DISHES_DRAFT_ALLOWED_ORIGINS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function resolveAllowedOrigin(request: Request, allowedOrigins: Set<string>): string | null {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : "";
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

function isAllowedDecision(value: string): boolean {
  return value === "accepted" || value === "rejected" || value === "duplicate";
}

function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapPriceBasisToConfidence(priceBasis: string | null): string | null {
  if (priceBasis === "counter") return "counter_price";
  if (priceBasis === "delivery") return "delivery_price";
  if (priceBasis === "menu") return "listed_price";
  return null;
}

interface StoredOpsDraftMeta {
  __ops_edit: 1;
  priceBasis?: string | null;
  halalStatus?: string;
  description?: string | null;
}

function extractOpsMetaFromModifiers(modifiers: unknown): {
  stringModifiers: string[];
  meta: StoredOpsDraftMeta | null;
} {
  if (!Array.isArray(modifiers)) return { stringModifiers: [], meta: null };
  const stringModifiers: string[] = [];
  let meta: StoredOpsDraftMeta | null = null;
  for (const item of modifiers) {
    if (typeof item === "string") {
      stringModifiers.push(item);
    } else if (item && typeof item === "object" && (item as JsonObject).__ops_edit === 1) {
      meta = item as StoredOpsDraftMeta;
    }
  }
  return { stringModifiers, meta };
}

function mergeOpsMetaIntoModifiers(
  existingModifiers: unknown,
  updates: {
    hasPriceBasisEdit: boolean;
    priceBasis: string | null;
    hasHalalEdit: boolean;
    halalStatus: string;
    hasDescriptionEdit: boolean;
    description?: string | null;
  },
): unknown[] {
  const { stringModifiers, meta } = extractOpsMetaFromModifiers(existingModifiers);
  const nextMeta: StoredOpsDraftMeta = {
    __ops_edit: 1,
    priceBasis: updates.hasPriceBasisEdit ? updates.priceBasis : (meta?.priceBasis ?? null),
    halalStatus: updates.hasHalalEdit ? updates.halalStatus : (meta?.halalStatus ?? "unknown"),
    description: updates.hasDescriptionEdit
      ? (updates.description ?? null)
      : (meta?.description ?? null),
  };
  return [...stringModifiers, nextMeta];
}

async function sha256Hex(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function requireAuthenticatedOpsUser(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceClient: ReturnType<typeof createClient>,
): Promise<{ userId?: string; error?: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { error: "missing_authorization" };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  const userId = data?.user?.id;
  if (error || !userId) {
    return { error: "invalid_authorization" };
  }

  const { data: adminRow, error: adminError } = await serviceClient
    .from("app_ops_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("enabled", true)
    .in("role", ["operator", "admin"])
    .maybeSingle();
  if (adminError || !adminRow) {
    return { error: "forbidden_ops_user" };
  }

  return { userId };
}

async function enforceRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  actorUserId: string,
  action: string,
): Promise<boolean> {
  const { data, error } = await serviceClient.rpc("app_can_make_ops_request", {
    p_actor_user_id: actorUserId,
    p_action: action,
    p_limit: MAX_OPS_ACTIONS_PER_MINUTE,
  });
  return !error && data === true;
}

async function writeAuditEvent(
  serviceClient: ReturnType<typeof createClient>,
  request: Request,
  actorUserId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata: JsonObject = {},
): Promise<void> {
  const origin = request.headers.get("origin") ?? null;
  await serviceClient.from("app_ops_audit_events").insert({
    actor_user_id: actorUserId,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    origin,
    ip_hash: await sha256Hex(getClientIp(request)),
    metadata,
  });
}

interface ParsedDraftEdits {
  hasNameEdit: boolean;
  name?: string;
  hasPriceEdit: boolean;
  priceCents?: number | null;
  hasPriceBasisEdit: boolean;
  priceBasis: string | null;
  hasHalalEdit: boolean;
  halalStatus: string;
  hasDescriptionEdit: boolean;
  description?: string | null;
  error?: string;
}

function parseDraftEdits(payload: JsonObject): ParsedDraftEdits {
  const fail = (error: string): ParsedDraftEdits => ({
    hasNameEdit: false,
    hasPriceEdit: false,
    hasPriceBasisEdit: false,
    priceBasis: null,
    hasHalalEdit: false,
    halalStatus: "unknown",
    hasDescriptionEdit: false,
    error,
  });

  const hasNameEdit = payload.name !== undefined;
  let name: string | undefined;
  if (hasNameEdit) {
    if (typeof payload.name !== "string" || payload.name.trim().length === 0) {
      return fail("invalid_name");
    }
    name = payload.name.trim().slice(0, 160);
  }

  const hasPriceEdit = payload.priceCents !== undefined;
  let priceCents: number | null | undefined;
  if (hasPriceEdit) {
    if (payload.priceCents === null) {
      priceCents = null;
    } else if (
      typeof payload.priceCents === "number" &&
      Number.isInteger(payload.priceCents) &&
      payload.priceCents >= 0 &&
      payload.priceCents <= 1_000_000
    ) {
      priceCents = payload.priceCents;
    } else {
      return fail("invalid_price_cents");
    }
  }

  const hasPriceBasisEdit =
    payload.priceBasis !== undefined && payload.priceBasis !== null && payload.priceBasis !== "";
  let priceBasis: string | null = null;
  if (hasPriceBasisEdit) {
    const rawBasis = String(payload.priceBasis).trim();
    if (!ALLOWED_PRICE_BASES.has(rawBasis)) {
      return fail("invalid_price_basis");
    }
    priceBasis = rawBasis;
  }

  const hasHalalEdit =
    payload.halalStatus !== undefined && payload.halalStatus !== null && payload.halalStatus !== "";
  let halalStatus = "unknown";
  if (hasHalalEdit) {
    const rawHalal = String(payload.halalStatus).trim();
    if (!ALLOWED_HALAL_STATUSES.has(rawHalal)) {
      return fail("invalid_halal_status");
    }
    halalStatus = rawHalal;
  }

  const hasDescriptionEdit = payload.description !== undefined;
  let description: string | null | undefined;
  if (hasDescriptionEdit) {
    if (payload.description === null) {
      description = null;
    } else if (typeof payload.description === "string") {
      const trimmed = payload.description.trim().slice(0, 600);
      description = trimmed.length > 0 ? trimmed : null;
    } else {
      return fail("invalid_description");
    }
  }

  return {
    hasNameEdit,
    name,
    hasPriceEdit,
    priceCents,
    hasPriceBasisEdit,
    priceBasis,
    hasHalalEdit,
    halalStatus,
    hasDescriptionEdit,
    description,
  };
}

async function attachBatchedPhotoUrls(
  client: ReturnType<typeof createClient>,
  rows: JsonObject[],
): Promise<JsonObject[]> {
  const photoIds = Array.from(
    new Set(
      rows
        .map((row) => (typeof row?.source_photo_id === "string" ? row.source_photo_id.trim() : ""))
        .filter(Boolean),
    ),
  );
  if (photoIds.length === 0) return rows;

  const { data: submissions } = await client
    .from("menu_photo_submissions")
    .select("id, storage_bucket, storage_path")
    .in("id", photoIds);
  const submissionList = Array.isArray(submissions) ? (submissions as JsonObject[]) : [];
  if (submissionList.length === 0) return rows;

  const byBucket = new Map<string, { id: string; path: string }[]>();
  for (const sub of submissionList) {
    const id = typeof sub.id === "string" ? sub.id : "";
    const bucket = typeof sub.storage_bucket === "string" ? sub.storage_bucket : "menu-photos";
    const storagePath = typeof sub.storage_path === "string" ? sub.storage_path : "";
    if (!id || !storagePath) continue;
    const list = byBucket.get(bucket) ?? [];
    list.push({ id, path: storagePath });
    byBucket.set(bucket, list);
  }

  // Batched createSignedUrls per bucket (typically just 'menu-photos') — never N+1.
  const signedBySubmissionId = new Map<string, string>();
  for (const [bucket, items] of byBucket.entries()) {
    const paths = items.map((item) => item.path);
    const { data: signedRows } = await client.storage.from(bucket).createSignedUrls(paths, 3600);
    if (!Array.isArray(signedRows)) continue;
    const urlByPath = new Map<string, string>();
    for (const entry of signedRows as JsonObject[]) {
      const p = typeof entry?.path === "string" ? entry.path : "";
      const url = typeof entry?.signedUrl === "string" ? entry.signedUrl : "";
      if (p && url) urlByPath.set(p, url);
    }
    for (const item of items) {
      const signedUrl = urlByPath.get(item.path);
      if (signedUrl) signedBySubmissionId.set(item.id, signedUrl);
    }
  }

  return rows.map((row) => {
    const sourceId = typeof row?.source_photo_id === "string" ? row.source_photo_id : "";
    const signedUrl = sourceId ? signedBySubmissionId.get(sourceId) : undefined;
    return signedUrl ? { ...row, source_photo_url: signedUrl } : row;
  });
}

serveWithSentry("ops-dishes-draft", async (request) => {
  const allowedOrigin = resolveAllowedOrigin(request, getAllowedOrigins());
  if (request.method === "OPTIONS") {
    if (allowedOrigin === "") {
      return toJson(403, { error: "forbidden_origin" }, null);
    }
    return new Response("ok", { headers: buildCorsHeaders(allowedOrigin) });
  }
  if (allowedOrigin === "") {
    return toJson(403, { error: "forbidden_origin" }, null);
  }
  if (request.method !== "POST") {
    return toJson(405, { error: "method_not_allowed" }, allowedOrigin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return toJson(500, { error: "missing_supabase_env" }, allowedOrigin);
  }

  const payload = (await request.json().catch(() => ({}))) as JsonObject;
  const action = String(payload.action ?? "");

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const caller = await requireAuthenticatedOpsUser(request, supabaseUrl, anonKey, client);
  if (!caller.userId) {
    return toJson(
      caller.error === "forbidden_ops_user" ? 403 : 401,
      { error: caller.error },
      allowedOrigin,
    );
  }
  if (!["list", "edit", "review"].includes(action)) {
    return toJson(400, { error: "unknown_action" }, allowedOrigin);
  }
  if (!(await enforceRateLimit(client, caller.userId, action))) {
    return toJson(429, { error: "rate_limited" }, allowedOrigin);
  }

  if (action === "list") {
    const venueId = String(payload.venueId ?? "").trim();
    const statusFilter = String(payload.status ?? "").trim();
    if (statusFilter && !ALLOWED_STATUSES.has(statusFilter)) {
      return toJson(400, { error: "invalid_status_filter" }, allowedOrigin);
    }
    const requestedLimit =
      typeof payload.limit === "number" && Number.isInteger(payload.limit) ? payload.limit : 100;
    const pageLimit = Math.min(100, Math.max(1, requestedLimit));
    const cursorCreatedAt = String(payload.cursorCreatedAt ?? "").trim();
    const cursorId = String(payload.cursorId ?? "").trim();
    if ((cursorCreatedAt && !cursorId) || (!cursorCreatedAt && cursorId)) {
      return toJson(400, { error: "invalid_cursor" }, allowedOrigin);
    }
    if (cursorCreatedAt && (Number.isNaN(Date.parse(cursorCreatedAt)) || !UUID_RE.test(cursorId))) {
      return toJson(400, { error: "invalid_cursor" }, allowedOrigin);
    }

    let query = client
      .from("dishes_draft")
      .select(
        "id, venue_id, building_id, source_photo_id, name, name_normalized, price_cents, currency, modifiers, extraction_confidence, confidence_bumps, review_status, review_notes, promoted_dish_id, duplicate_of, created_at",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageLimit);

    if (venueId) {
      query = query.eq("venue_id", venueId);
    }
    if (statusFilter) {
      query = query.eq("review_status", statusFilter);
    }
    if (cursorCreatedAt && cursorId) {
      query = query.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      return toJson(500, { error: "list_failed" }, allowedOrigin);
    }
    const rawRows = Array.isArray(data) ? (data as JsonObject[]) : [];
    const hydratedRows = await attachBatchedPhotoUrls(client, rawRows);
    const lastRow =
      hydratedRows.length === pageLimit ? hydratedRows[hydratedRows.length - 1] : null;
    const nextCursor =
      lastRow && typeof lastRow.created_at === "string" && typeof lastRow.id === "string"
        ? { cursorCreatedAt: lastRow.created_at, cursorId: lastRow.id }
        : undefined;

    await writeAuditEvent(
      client,
      request,
      caller.userId,
      "dishes_draft.list",
      "venue",
      venueId || undefined,
      {
        rowCount: hydratedRows.length,
      },
    );
    return toJson(
      200,
      nextCursor ? { rows: hydratedRows, nextCursor } : { rows: hydratedRows },
      allowedOrigin,
    );
  }

  if (action === "edit") {
    const draftDishId = String(payload.draftDishId ?? "").trim();
    const notes = String(payload.notes ?? "").trim();
    if (!draftDishId) {
      return toJson(400, { error: "draft_dish_id_required" }, allowedOrigin);
    }
    const edits = parseDraftEdits(payload);
    if (edits.error) {
      return toJson(400, { error: edits.error }, allowedOrigin);
    }

    // race-ok: compare-and-set update below filters on review_status IN ('pending','edited') and updated_at
    const { data: currentDraft, error: loadErr } = await client
      .from("dishes_draft")
      .select("id, modifiers, updated_at")
      .eq("id", draftDishId)
      .in("review_status", ["pending", "edited"])
      .maybeSingle();
    if (loadErr) {
      return toJson(500, { error: "edit_failed" }, allowedOrigin);
    }
    if (!currentDraft) {
      return toJson(409, { error: "draft_not_editable" }, allowedOrigin);
    }

    const currentRow = currentDraft as JsonObject;
    const nextModifiers = mergeOpsMetaIntoModifiers(currentRow.modifiers, edits);
    const { meta: savedMeta } = extractOpsMetaFromModifiers(nextModifiers);

    const updateFields: JsonObject = {
      review_status: "edited",
      modifiers: nextModifiers,
      review_notes: notes.length > 0 ? notes.slice(0, 4000) : undefined,
      updated_at: new Date().toISOString(),
    };
    if (edits.hasNameEdit && edits.name) {
      updateFields.name = edits.name;
      updateFields.name_normalized = normalizeName(edits.name);
    }
    if (edits.hasPriceEdit) {
      updateFields.price_cents = edits.priceCents;
    }

    let editQuery = client
      .from("dishes_draft")
      .update(updateFields)
      .eq("id", draftDishId)
      .in("review_status", ["pending", "edited"]);
    if (typeof currentRow.updated_at === "string") {
      editQuery = editQuery.eq("updated_at", currentRow.updated_at);
    }
    const { data: updatedDraft, error } = await editQuery.select("id").maybeSingle();
    if (error) {
      return toJson(500, { error: "edit_failed" }, allowedOrigin);
    }
    if (!updatedDraft) {
      return toJson(409, { error: "draft_not_editable" }, allowedOrigin);
    }

    await writeAuditEvent(
      client,
      request,
      caller.userId,
      "dishes_draft.edit",
      "dishes_draft",
      draftDishId,
      {
        editedName: edits.hasNameEdit,
        editedPrice: edits.hasPriceEdit,
        hasNotes: notes.length > 0,
      },
    );
    return toJson(
      200,
      {
        ok: true,
        priceBasis: savedMeta?.priceBasis ?? null,
        halalStatus: savedMeta?.halalStatus ?? "unknown",
        description: savedMeta?.description ?? null,
      },
      allowedOrigin,
    );
  }

  if (action === "review") {
    const draftDishId = String(payload.draftDishId ?? "").trim();
    const decision = String(payload.decision ?? "").trim();
    const notes = String(payload.notes ?? "").trim();
    if (!draftDishId) {
      return toJson(400, { error: "draft_dish_id_required" }, allowedOrigin);
    }
    if (!isAllowedDecision(decision)) {
      return toJson(400, { error: "invalid_decision" }, allowedOrigin);
    }
    const edits = parseDraftEdits(payload);
    if (edits.error) {
      return toJson(400, { error: edits.error }, allowedOrigin);
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (decision !== "accepted") {
      const duplicateOf =
        decision === "duplicate" &&
        typeof payload.duplicateOf === "string" &&
        UUID_RE.test(payload.duplicateOf.trim())
          ? payload.duplicateOf.trim()
          : undefined;
      const { data: updatedRow, error } = await client
        .from("dishes_draft")
        .update({
          review_status: decision,
          // Notes have their own column (20261112090000), so ocr_raw_text keeps the extraction.
          review_notes: notes.length > 0 ? notes.slice(0, 4000) : undefined,
          duplicate_of: duplicateOf,
          reviewed_at: nowIso,
        })
        .eq("id", draftDishId)
        .in("review_status", ["pending", "edited"])
        .select("id")
        .maybeSingle();
      if (error) {
        return toJson(500, { error: "review_failed" }, allowedOrigin);
      }
      if (!updatedRow) {
        return toJson(409, { error: "draft_not_reviewable" }, allowedOrigin);
      }

      await writeAuditEvent(
        client,
        request,
        caller.userId,
        "dishes_draft.review",
        "dishes_draft",
        draftDishId,
        {
          decision,
          hasNotes: notes.length > 0,
        },
      );
      return toJson(200, { ok: true }, allowedOrigin);
    }

    // Exclusive claim: only 'pending' or 'edited' (or a crashed 'accepted' claim older than 60s)
    // can transition to 'accepted' with this request's reviewed_at, preventing two concurrent
    // operators from claiming and racing on the same draft.
    const staleClaimCutoffIso = new Date(nowMs - STALE_CLAIM_MS).toISOString();
    const claimFields: JsonObject = {
      review_status: "accepted",
      review_notes: notes.length > 0 ? notes.slice(0, 4000) : undefined,
      reviewed_at: nowIso,
    };
    if (edits.hasNameEdit && edits.name) {
      claimFields.name = edits.name;
      claimFields.name_normalized = normalizeName(edits.name);
    }
    if (edits.hasPriceEdit) {
      claimFields.price_cents = edits.priceCents;
    }

    // race-ok: exclusive atomic compare-and-set UPDATE transitioning pending/edited (or stale >60s accepted) -> accepted
    const { data: claimed, error: claimError } = await client
      .from("dishes_draft")
      .update(claimFields)
      .eq("id", draftDishId)
      .or(
        `review_status.in.(pending,edited),and(review_status.eq.accepted,reviewed_at.lt.${staleClaimCutoffIso})`,
      )
      .select("id, venue_id, building_id, name, price_cents, modifiers, promoted_dish_id")
      .maybeSingle();
    if (claimError) {
      return toJson(500, { error: "review_failed" }, allowedOrigin);
    }
    if (!claimed) {
      return toJson(409, { error: "draft_not_reviewable" }, allowedOrigin);
    }

    const releaseClaimForRetry = async () => {
      await client
        .from("dishes_draft")
        .update({ review_status: "edited", updated_at: new Date().toISOString() })
        .eq("id", draftDishId)
        .eq("review_status", "accepted")
        .eq("reviewed_at", nowIso);
    };

    const draftRow = claimed as JsonObject;
    const { meta: savedMeta } = extractOpsMetaFromModifiers(draftRow.modifiers);
    const venueId = typeof draftRow.venue_id === "string" ? draftRow.venue_id.trim() : "";
    const buildingId = typeof draftRow.building_id === "string" ? draftRow.building_id.trim() : "";
    const finalName = edits.name ?? (typeof draftRow.name === "string" ? draftRow.name.trim() : "");
    if (!venueId || !buildingId || !finalName) {
      await releaseClaimForRetry();
      return toJson(422, { error: "draft_missing_required_fields" }, allowedOrigin);
    }

    const effectivePriceCents = edits.hasPriceEdit
      ? edits.priceCents
      : typeof draftRow.price_cents === "number"
        ? draftRow.price_cents
        : null;
    const hasRealPrice = typeof effectivePriceCents === "number" && effectivePriceCents > 0;
    const finalPriceDollars = hasRealPrice ? Number((effectivePriceCents / 100).toFixed(2)) : 0;
    const effectiveBasis = edits.hasPriceBasisEdit
      ? edits.priceBasis
      : (savedMeta?.priceBasis ?? null);
    const finalPriceConfidence = hasRealPrice
      ? (mapPriceBasisToConfidence(effectiveBasis) ?? "listed_price")
      : null;
    const effectiveHalal = edits.hasHalalEdit
      ? edits.halalStatus
      : (savedMeta?.halalStatus ?? "unknown");
    const effectiveDescription = edits.hasDescriptionEdit
      ? edits.description
      : savedMeta?.description;

    const dishId =
      typeof draftRow.promoted_dish_id === "string" && draftRow.promoted_dish_id.trim().length > 0
        ? draftRow.promoted_dish_id.trim()
        : `draft:${String(draftRow.id)}`;

    const dishRecord: JsonObject = {
      id: dishId,
      venue_id: venueId,
      building_id: buildingId,
      name: finalName,
      price: finalPriceDollars,
      price_confidence: finalPriceConfidence,
      price_checked_at: hasRealPrice ? nowIso : null,
      dietary_status: { flags: { halal: effectiveHalal } },
      menu_approved_for_display: true,
      menu_rights_status: "operator_owned",
      archived_at: null,
    };
    if (effectiveDescription !== undefined) {
      dishRecord.description = effectiveDescription;
    }

    const { error: dishUpsertError } = await client
      .from("dishes")
      .upsert(dishRecord, { onConflict: "id" });
    if (dishUpsertError) {
      await releaseClaimForRetry();
      return toJson(500, { error: "dish_promotion_failed" }, allowedOrigin);
    }

    const { error: venueUpdateError } = await client
      .from("venues")
      .update({
        menu_approved_for_display: true,
        menu_rights_status: "operator_owned",
      })
      .eq("id", venueId)
      .eq("menu_rights_status", "unverified");
    if (venueUpdateError) {
      await releaseClaimForRetry();
      return toJson(500, { error: "venue_approval_failed" }, allowedOrigin);
    }

    const { data: halalFlag, error: halalLookupError } = await client
      .from("dietary_flags")
      .select("id")
      .eq("slug", "halal")
      .maybeSingle();
    if (halalLookupError) {
      await releaseClaimForRetry();
      return toJson(500, { error: "dietary_lookup_failed" }, allowedOrigin);
    }
    const halalFlagId = (halalFlag as JsonObject | null)?.id;
    if (typeof halalFlagId === "string" && halalFlagId.length > 0) {
      const dietaryResult =
        effectiveHalal === "yes"
          ? await client
              .from("dish_dietary_flags")
              .upsert(
                { dish_id: dishId, dietary_flag_id: halalFlagId },
                { onConflict: "dish_id,dietary_flag_id" },
              )
          : await client
              .from("dish_dietary_flags")
              .delete()
              .eq("dish_id", dishId)
              .eq("dietary_flag_id", halalFlagId);
      if (dietaryResult.error) {
        await releaseClaimForRetry();
        return toJson(500, { error: "dietary_sync_failed" }, allowedOrigin);
      }
    }

    const { error: refreshError } = await client.rpc("catalog_raw_refresh_venue", {
      p_venue_id: venueId,
    });
    if (refreshError) {
      await releaseClaimForRetry();
      return toJson(500, { error: "catalog_refresh_failed" }, allowedOrigin);
    }

    const { error: markPromotedError } = await client
      .from("dishes_draft")
      .update({
        review_status: "promoted",
        promoted_dish_id: dishId,
        reviewed_at: nowIso,
      })
      .eq("id", draftDishId)
      .eq("review_status", "accepted")
      .eq("reviewed_at", nowIso);
    if (markPromotedError) {
      await releaseClaimForRetry();
      return toJson(500, { error: "promotion_finalize_failed" }, allowedOrigin);
    }

    await writeAuditEvent(
      client,
      request,
      caller.userId,
      "dishes_draft.review",
      "dishes_draft",
      draftDishId,
      {
        decision: "accepted",
        promotedDishId: dishId,
        venueId,
        hasNotes: notes.length > 0,
      },
    ).catch((auditErr) => {
      console.error("ops-dishes-draft post-promotion audit write failed", auditErr);
    });
    return toJson(200, { ok: true, promotedDishId: dishId }, allowedOrigin);
  }

  return toJson(400, { error: "unknown_action" }, allowedOrigin);
});
