import { NextRequest, NextResponse } from "next/server";

import { clientRequestKey, jsonError, requireRateLimit } from "@/lib/security/api";
import { getStringField, readJsonObject, validationErrorResponse } from "@/lib/security/validation";
import {
  MerchantClaimConflictError,
  reviewMerchantClaim,
  type MerchantClaimAction,
} from "@/lib/supabase/consoleData";
import {
  isConsoleAuthResponse,
  requireConsoleApiAccess,
  requireConsoleMutationProtection,
  requireConsoleRole,
} from "../../_auth";

type RouteContext = {
  params: Promise<{ claimId: string }>;
};

const allowedActions = new Set<MerchantClaimAction>(["approve", "reject", "contacted"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ops decide one stall claim: approve (creates the merchant account), reject, or mark contacted. */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireConsoleApiAccess(request);
  if (isConsoleAuthResponse(auth)) return auth;
  const roleBlocked = requireConsoleRole(auth, "ops");
  if (roleBlocked) return roleBlocked;
  const blocked = requireConsoleMutationProtection(request);
  if (blocked) return blocked;
  const rateLimited = await requireRateLimit(request, {
    key: clientRequestKey(request, "console-merchant-claim"),
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const { claimId } = await context.params;
    if (!UUID_RE.test(claimId ?? "")) {
      return jsonError("Invalid claim ID.", 400);
    }

    const body = await readJsonObject(request);
    const action = getStringField(body, "action", { max: 20 }) as MerchantClaimAction | undefined;
    if (!action || !allowedActions.has(action)) {
      return jsonError("Unsupported claim action.", 400);
    }

    const result = await reviewMerchantClaim(auth, claimId, action);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;
    if (error instanceof MerchantClaimConflictError) return jsonError(error.message, 409);

    // The database explains why a claim cannot be approved (already owned, rejected, no email).
    const message =
      error instanceof Error ? error.message.replace(/^Supabase [A-Z]+ \S+ failed: /, "") : "";
    console.error("Console merchant claim review failed", error);
    return jsonError(message || "Unable to update this claim.", 400);
  }
}
