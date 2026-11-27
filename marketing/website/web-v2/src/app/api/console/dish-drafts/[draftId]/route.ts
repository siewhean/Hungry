import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireJsonRequest, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import {
  DishDraftConflictError,
  reviewDishDraft,
  type DishDraftDecision,
  type DishDraftHalalStatus,
  type DishDraftPriceBasis,
} from "@/lib/supabase/consoleData";
import {
  isConsoleAuthResponse,
  requireConsoleApiAccess,
  requireConsoleMutationProtection,
  requireConsoleRole,
} from "../../_auth";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DECISIONS = new Set<DishDraftDecision>(["edit", "accepted", "rejected", "duplicate"]);
const ALLOWED_BASES = new Set<DishDraftPriceBasis>(["counter", "menu", "delivery"]);
const ALLOWED_HALAL = new Set<DishDraftHalalStatus>(["yes", "no", "unknown"]);

/** Ops edit, reject, mark duplicate, or accept-and-promote one OCR dish draft into public.dishes. */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;
  const roleBlocked = requireConsoleRole(auth, "ops");
  if (roleBlocked) return roleBlocked;
  const blocked = requireConsoleMutationProtection(request);
  if (blocked) return blocked;
  const jsonBlocked = requireJsonRequest(request);
  if (jsonBlocked) return jsonBlocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-dish-draft"),
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const { draftId } = await context.params;
    if (!UUID_RE.test(draftId ?? "")) {
      return jsonError("Invalid draft ID.", 400);
    }

    const body = await readJsonObject(request);
    const decision = getStringField(body, "decision", { max: 20 }) as DishDraftDecision | undefined;
    if (!decision || !ALLOWED_DECISIONS.has(decision)) {
      return jsonError("Unsupported draft decision.", 400);
    }

    const name =
      body.name !== undefined ? getStringField(body, "name", { max: 160 }) : undefined;
    if (body.name !== undefined && (!name || name.trim().length === 0)) {
      return jsonError("Dish name cannot be blank.", 400);
    }

    let priceCents: number | null | undefined;
    if (body.priceCents !== undefined) {
      if (body.priceCents === null) {
        priceCents = null;
      } else if (
        typeof body.priceCents === "number" &&
        Number.isInteger(body.priceCents) &&
        body.priceCents >= 0 &&
        body.priceCents <= 1_000_000
      ) {
        priceCents = body.priceCents;
      } else {
        return jsonError("Price must be a non-negative integer number of cents or null.", 400);
      }
    }

    const rawBasis = getStringField(body, "priceBasis", { max: 20 });
    const priceBasis = rawBasis ? (rawBasis as DishDraftPriceBasis) : undefined;
    if (priceBasis && !ALLOWED_BASES.has(priceBasis)) {
      return jsonError("Unsupported price basis.", 400);
    }

    const rawHalal = getStringField(body, "halalStatus", { max: 20 });
    const halalStatus = rawHalal ? (rawHalal as DishDraftHalalStatus) : undefined;
    if (halalStatus && !ALLOWED_HALAL.has(halalStatus)) {
      return jsonError("Unsupported halal status.", 400);
    }

    const description =
      body.description === null
        ? null
        : body.description !== undefined
          ? (getStringField(body, "description", { max: 600 }) ?? null)
          : undefined;
    const notes = getStringField(body, "notes", { max: 2000 });

    const result = await reviewDishDraft(auth, draftId, {
      decision,
      description,
      halalStatus,
      name,
      notes,
      priceBasis,
      priceCents,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    if (error instanceof DishDraftConflictError) return jsonError(error.message, 409);

    const message =
      error instanceof Error ? error.message.replace(/^Supabase [A-Z]+ \S+ failed: /, "") : "";
    console.error("Console dish draft review failed", error);
    return jsonError(message || "Unable to update this dish draft.", 400);
  }
}
