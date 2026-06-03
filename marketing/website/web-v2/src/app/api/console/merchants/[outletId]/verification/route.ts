import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import { supabaseFetch } from "@/lib/supabase/server";
import { requireConsoleApiAccess, requireConsoleMutationProtection } from "../../../_auth";

type RouteContext = {
  params: Promise<{ outletId: string }>;
};

const allowedStatuses = new Set(["verified", "in_review", "rejected", "more_info_needed", "draft", "submitted"]);

export async function PATCH(request: NextRequest, context: RouteContext) {
  const unauthorized = await requireConsoleApiAccess(request);
  if (unauthorized) return unauthorized;
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

    await supabaseFetch("rest/v1/website_console_audit_events", {
      body: {
        action: "merchant_verification_updated",
        actor_email: "hungry_console",
        metadata: { outletId, status },
        target_id: outletId,
        target_type: "merchant_outlet",
      },
      method: "POST",
      prefer: "return=minimal",
      serviceRole: true,
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
