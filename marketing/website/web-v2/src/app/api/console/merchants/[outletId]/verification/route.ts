import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { recordConsoleAuditEvent } from "@/lib/supabase/consoleData";
import { supabaseFetch } from "@/lib/supabase/server";
import {
  isConsoleAuthResponse,
  requireConsoleApiAccess,
  requireConsoleMutationProtection,
  requireConsoleRole,
} from "../../../_auth";

type RouteContext = {
  params: Promise<{ outletId: string }>;
};

const allowedStatuses = new Set(["verified", "in_review", "rejected", "more_info_needed", "draft", "submitted"]);

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;
  const roleBlocked = requireConsoleRole(auth, "ops");
  if (roleBlocked) return roleBlocked;
  const blocked = requireConsoleMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-merchant-verification"),
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const { outletId } = await context.params;

    // Validate outletId is a safe UUID before passing to service-role queries
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(outletId ?? "")) {
      return jsonError("Invalid outlet ID.", 400);
    }

    const body = await readJsonObject(request);
    const status = getStringField(body, "status", { fallback: "verified", max: 40 }) ?? "verified";
    if (!allowedStatuses.has(status)) {
      throw new Error("Unsupported merchant verification status.");
    }

    await supabaseFetch("rest/v1/merchant_verifications", {
      body: {
        method: "licence_upload",
        outlet_id: outletId,
        status,
        submitted_at: status === "verified" || status === "in_review" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        verified_at: status === "verified" ? new Date().toISOString() : null,
      },
      method: "POST",
      params: { on_conflict: "outlet_id" },
      prefer: "resolution=merge-duplicates,return=minimal",
      serviceRole: true,
    });

    await recordConsoleAuditEvent(auth, {
      action: "merchant_verification_updated",
      metadata: { outletId, status },
      targetId: outletId,
      targetType: "merchant_outlet",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    if (error instanceof Error && error.message === "Unsupported merchant verification status.") {
      return jsonError(error.message, 400);
    }

    console.error("Console merchant verification update failed", error);
    return jsonError("Unable to update merchant verification.", 400);
  }
}
